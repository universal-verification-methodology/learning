/**
 * Native runtime for built-in `std` classes (mailbox / semaphore / process).
 * SV method bodies in std-package.js are stubs; calls are intercepted here.
 */
import { Value } from "./value.js";
import { isHandle, NULL_HANDLE } from "./handle.js";

export function isStdNativeClass(name) {
  return name === "mailbox" || name === "semaphore" || name === "process";
}

export function isStdBlockingTask(className, methodName) {
  if (className === "semaphore" && methodName === "get") return true;
  if (className === "mailbox" && (methodName === "put" || methodName === "get" || methodName === "peek")) {
    return true;
  }
  if (className === "process" && methodName === "await") return true;
  return false;
}

export function initStdObject(obj) {
  if (obj.className === "mailbox") {
    obj.mboxQueue = [];
    obj.mboxBound = Number.POSITIVE_INFINITY;
  } else if (obj.className === "semaphore") {
    obj.semKeys = 0;
  } else if (obj.className === "process") {
    obj.processState = 1; // RUNNING
  }
}

/**
 * @returns {{ handled: boolean, value?: any, blocking?: boolean }}
 */
export function tryStdFunction(obj, methodName, argValues, thisHandle, ctx) {
  if (!obj) return { handled: false };

  if (obj.className === "process") {
    if (methodName === "status") {
      return { handled: true, value: Value.fromUint(obj.processState ?? 1, 32) };
    }
    if (methodName === "kill") {
      obj.processState = 4; // KILLED
      return { handled: true, value: NULL_HANDLE };
    }
    if (methodName === "suspend") {
      obj.processState = 3;
      return { handled: true, value: NULL_HANDLE };
    }
    if (methodName === "resume") {
      obj.processState = 1;
      return { handled: true, value: NULL_HANDLE };
    }
    if (methodName === "await") {
      // non-blocking stub in function context
      return { handled: true, value: NULL_HANDLE };
    }
  }

  if (obj.className === "semaphore") {
    if (methodName === "put") {
      const n = Number(argValues[0]?.toUint?.() ?? 1);
      obj.semKeys = (obj.semKeys || 0) + n;
      return { handled: true, value: NULL_HANDLE };
    }
    if (methodName === "try_get") {
      const n = Number(argValues[0]?.toUint?.() ?? 1);
      if ((obj.semKeys || 0) >= n) {
        obj.semKeys -= n;
        return { handled: true, value: Value.fromUint(1, 32) };
      }
      return { handled: true, value: Value.fromUint(0, 32) };
    }
  }

  if (obj.className === "mailbox") {
    if (methodName === "num") {
      return { handled: true, value: Value.fromUint(obj.mboxQueue?.length || 0, 32) };
    }
    if (methodName === "try_put") {
      const msg = argValues[0];
      const bound = obj.mboxBound ?? Number.POSITIVE_INFINITY;
      if ((obj.mboxQueue?.length || 0) >= bound) {
        return { handled: true, value: Value.fromUint(0, 32) };
      }
      if (!obj.mboxQueue) obj.mboxQueue = [];
      obj.mboxQueue.push(isHandle(msg) ? msg : msg.clone?.() ?? msg);
      return { handled: true, value: Value.fromUint(1, 32) };
    }
    if (methodName === "try_get") {
      if (!obj.mboxQueue?.length) {
        return { handled: true, value: Value.fromUint(0, 32), out: null };
      }
      const msg = obj.mboxQueue.shift();
      return { handled: true, value: Value.fromUint(1, 32), out: msg };
    }
    if (methodName === "try_peek") {
      if (!obj.mboxQueue?.length) {
        return { handled: true, value: Value.fromUint(0, 32), out: null };
      }
      return { handled: true, value: Value.fromUint(1, 32), out: obj.mboxQueue[0] };
    }
  }

  return { handled: false };
}

/**
 * Blocking std task methods (generator).
 * @returns {Generator|null}
 */
export function* stdTaskRunner(obj, methodName, argValues, outputSlots) {
  if (!obj) return;

  if (obj.className === "semaphore" && methodName === "get") {
    const n = Number(argValues[0]?.toUint?.() ?? 1);
    while ((obj.semKeys || 0) < n) {
      yield { type: "wait_pred", pred: () => (obj.semKeys || 0) >= n };
    }
    obj.semKeys -= n;
    return;
  }

  if (obj.className === "mailbox") {
    if (methodName === "put") {
      const msg = argValues[0];
      const bound = obj.mboxBound ?? Number.POSITIVE_INFINITY;
      if (!obj.mboxQueue) obj.mboxQueue = [];
      while (obj.mboxQueue.length >= bound) {
        yield {
          type: "wait_pred",
          pred: () => obj.mboxQueue.length < bound,
        };
      }
      obj.mboxQueue.push(isHandle(msg) ? msg : msg.clone?.() ?? msg);
      return;
    }
    if (methodName === "get" || methodName === "peek") {
      if (!obj.mboxQueue) obj.mboxQueue = [];
      while (obj.mboxQueue.length === 0) {
        yield { type: "wait_pred", pred: () => obj.mboxQueue.length > 0 };
      }
      const msg = methodName === "peek" ? obj.mboxQueue[0] : obj.mboxQueue.shift();
      if (outputSlots?.[0]) {
        const slot = outputSlots[0];
        if (slot.isHandle) slot.handle = msg;
        else slot.value = (msg.clone?.() ?? msg).resize?.(slot.width) ?? msg;
      }
      return;
    }
  }

  if (obj.className === "process" && methodName === "await") {
    while ((obj.processState ?? 1) !== 0 && (obj.processState ?? 1) !== 4) {
      // wait until FINISHED(0) or KILLED(4) — for stub, finish immediately if already done
      if (obj.processState === 0 || obj.processState === 4) break;
      // In this subset, await on self returns after one tick unless killed/finished
      yield { type: "delay", delay: 1 };
      break;
    }
  }
}

export function applyStdCtor(obj, className, argValues) {
  initStdObject(obj);
  if (className === "semaphore") {
    const n = argValues[0] ? Number(argValues[0].toUint?.() ?? 0) : 0;
    obj.semKeys = n;
  }
  if (className === "mailbox") {
    // optional bound: new(bound) — 0 means unbounded in many sims; we treat 0 as unbounded
    if (argValues[0]) {
      const b = Number(argValues[0].toUint?.() ?? 0);
      obj.mboxBound = b > 0 ? b : Number.POSITIVE_INFINITY;
    }
  }
}
