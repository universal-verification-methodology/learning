/**
 * Fork / join* / disable fork / named disable.
 * Extracted from sim.js (modularity M3). See MODULARITY.md.
 */

/**
 * @param {{
 *   procState: object[],
 *   schedule: (delay: number, fn: Function) => void,
 *   settle: () => void,
 *   runProc: (proc: object) => void,
 * }} ctx
 */
export function createForkControl(ctx) {
  const { procState, schedule, settle, runProc } = ctx;

  function isForkDescendant(child, ancestor) {
    let cur = child.forkParent;
    while (cur) {
      if (cur === ancestor) return true;
      cur = cur.forkParent;
    }
    return false;
  }

  function hasLiveForkChildren(parent) {
    return procState.some((p) => !p.dead && isForkDescendant(p, parent));
  }

  function wakeForkWaiters(token) {
    schedule(0, () => {
      for (const p of procState) {
        if (p.forkWait === token) {
          p.forkWait = null;
          p.suspended = false;
          runProc(p);
        }
      }
      settle();
    });
  }

  function noteForkBranchDone(proc) {
    if (proc.forkCounted) return;
    proc.forkCounted = true;
    const tok = proc.forkToken;
    if (tok) {
      tok.remaining--;
      if (tok.mode === "join_any" && !tok.anyDone) {
        tok.anyDone = true;
        wakeForkWaiters(tok);
      } else if (tok.mode === "join" && tok.remaining <= 0) {
        wakeForkWaiters(tok);
      }
    }
    // wait fork parents wake via wakeWaiters in settle
    schedule(0, () => settle());
  }

  function killForkProc(p) {
    p.dead = true;
    p.suspended = true;
    p.stack = null;
    p.waitExpr = null;
    p.waitSens = null;
    p.waitSensSnap = null;
    p.waitPred = null;
    p.waitFork = false;
    p.forkWait = null;
    p.disableTarget = null;
    noteForkBranchDone(p);
  }

  function disableForkSiblings(issuer) {
    // From inside a fork branch: kill siblings (and their descendants) of the
    // immediately enclosing fork — not the issuer or its nested children.
    // From the forking process itself (e.g. after join_none): kill all fork descendants.
    if (!issuer.forkParent) {
      for (const p of procState) {
        if (p.dead || !isForkDescendant(p, issuer)) continue;
        killForkProc(p);
      }
      return;
    }
    const owner = issuer.forkParent;
    for (const p of procState) {
      if (p.dead || p === issuer) continue;
      if (isForkDescendant(p, issuer)) continue;
      const underOwner = p.forkParent === owner || isForkDescendant(p, owner);
      if (!underOwner) continue;
      killForkProc(p);
    }
  }

  function requestDisable(name) {
    for (const p of procState) {
      if (p.dead) continue;
      if (!p.blockStack || !p.blockStack.includes(name)) continue;
      p.disableTarget = name;
      p.waitExpr = null;
      p.waitSens = null;
      p.waitSensSnap = null;
      p.waitPred = null;
      p.waitFork = false;
      p.forkWait = null;
      if (p.suspended) {
        p.suspended = false;
        schedule(0, () => {
          runProc(p);
          settle();
        });
      }
    }
  }

  /**
   * Spawn fork branches and return whether the parent should suspend.
   * @returns {{ suspend: boolean, forkWait?: object }}
   */
  function spawnForkJoin(proc, branches, join) {
    const token = {
      remaining: branches.length,
      mode: join,
      anyDone: false,
      parent: proc,
    };
    for (const body of branches) {
      const child = {
        kind: "ForkBranch",
        body,
        stack: null,
        suspended: false,
        dead: false,
        running: false,
        forkToken: token,
        forkParent: proc,
        forkCounted: false,
        blockStack: [],
        disableTarget: null,
        sens: { type: "Initial" },
      };
      procState.push(child);
      runProc(child);
    }
    if (join === "join_none") {
      return { suspend: false };
    }
    if (join === "join_any") {
      if (token.anyDone || token.remaining <= 0) return { suspend: false };
      return { suspend: true, forkWait: token };
    }
    // join (all)
    if (token.remaining > 0) return { suspend: true, forkWait: token };
    return { suspend: false };
  }

  return {
    isForkDescendant,
    hasLiveForkChildren,
    noteForkBranchDone,
    disableForkSiblings,
    requestDisable,
    spawnForkJoin,
  };
}
