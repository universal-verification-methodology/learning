/**
 * Interactive session wrapper for teaching tools (clock stepper, NBA lab, …).
 * Same capabilities as BrowserEngine.createSession, without the IDE adapter layer.
 */

import { parse } from "./parser.js";
import { elaborate } from "./elaborate.js";
import { createSim } from "./sim.js";
import { materializeSources } from "./preprocess.js";

function compile(source, opts = {}) {
  const text = materializeSources(source, opts);
  const ast = parse(text);
  const net = elaborate(ast, { top: opts.top });
  const sim = createSim(net, { memFiles: opts.memFiles });
  return { ast, net, sim };
}

/**
 * @typedef {{
 *   time: number,
 *   finished: boolean,
 *   paused?: boolean,
 *   console: string[],
 *   waves: { time: number, name: string, value: string }[],
 *   signals: Record<string, { width: number, kind: string, bits: string }>,
 *   pending?: number,
 *   started?: boolean,
 * }} SessionSnapshot
 */

/**
 * @param {object} raw
 * @returns {SessionSnapshot}
 */
function snap(raw) {
  return {
    time: raw.time,
    finished: !!raw.finished,
    paused: !!raw.paused,
    console: raw.console || [],
    waves: raw.waves || [],
    signals: raw.signals || {},
    pending: raw.pending,
    started: raw.started,
  };
}

/**
 * @param {string|string[]|object} source
 * @param {{ top?: string, maxTime?: number, maxSteps?: number, files?: Record<string, string>, entry?: string, defines?: Record<string, string>, incdirs?: string[] }} [opts]
 */
export function createSession(source, opts = {}) {
  const { sim, net, ast } = compile(source, {
    top: opts.top,
    files: opts.files,
    entry: opts.entry,
    defines: opts.defines,
    incdirs: opts.incdirs,
  });
  const maxTime = opts.maxTime ?? 10000;
  const maxSteps = opts.maxSteps ?? 10000;
  let stopped = false;

  return {
    net,
    ast,
    source,
    maxTime,
    top: opts.top,

    /** @returns {SessionSnapshot} */
    start() {
      stopped = false;
      return snap(sim.start());
    },

    /** Advance one scheduled time slot. @returns {SessionSnapshot} */
    step() {
      if (stopped) return snap(sim.getResult());
      if (sim.isPaused()) return snap(sim.getResult());
      return snap(sim.step({ maxTime }));
    },

    /**
     * Step until posedge/negedge on named signal.
     * @param {string} name
     * @param {'posedge'|'negedge'} edge
     * @returns {SessionSnapshot}
     */
    runToEdge(name, edge = "posedge") {
      if (stopped) return snap(sim.getResult());
      if (sim.isPaused()) sim.resume();
      return snap(sim.runToEdge(name, edge, { maxTime, maxSteps }));
    },

    /**
     * @param {string} name
     * @param {string} bits
     * @returns {SessionSnapshot}
     */
    poke(name, bits) {
      sim.poke(name, bits);
      return snap(sim.getResult());
    },

    /** @param {string} name @returns {string|null} */
    peek(name) {
      const v = sim.peek(name);
      return v && v.bits != null ? v.bits : null;
    },

    force(name, bits) {
      return snap(sim.force(name, bits));
    },

    release(name) {
      return snap(sim.release(name));
    },

    listForced: () => sim.listForced(),
    listMemories: () => sim.listMemories(),
    dumpMemory: (name, opts) => sim.dumpMemory(name, opts),

    /** @returns {SessionSnapshot} */
    continue() {
      if (stopped) return snap(sim.getResult());
      if (sim.isPaused()) sim.resume();
      return snap(sim.run({ maxTime }));
    },

    /** @returns {SessionSnapshot} */
    resume() {
      if (stopped) return snap(sim.getResult());
      return snap(sim.resume());
    },

    /** @returns {SessionSnapshot} */
    getResult() {
      return snap(sim.getResult());
    },

    getTime() {
      return sim.getTime();
    },

    stop() {
      stopped = true;
      return snap(sim.stop());
    },

    isFinished() {
      return stopped || sim.isFinished();
    },

    isPaused() {
      return !stopped && sim.isPaused();
    },

    hasPending() {
      return !stopped && !sim.isPaused() && sim.hasPending();
    },

    isStarted() {
      return sim.isStarted();
    },
  };
}
