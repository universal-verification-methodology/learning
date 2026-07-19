/**
 * SystemVerilog string / dynamic-array / queue runtime helpers (J4).
 */
import { Value } from "./value.js";

export function isSvString(v) {
  return v != null && typeof v === "object" && v.$s === true;
}

export function makeSvString(s) {
  return { $s: true, str: String(s ?? "") };
}

export function isNewArray(v) {
  return v != null && typeof v === "object" && v.$newArray === true;
}

export function makeNewArray(size) {
  return { $newArray: true, size: Math.max(0, size | 0) };
}

export function isCollectionSlot(slot) {
  return !!(slot && (slot.isDynArray || slot.isQueue || slot.isString));
}

function elemWidth(slot) {
  return slot.width > 0 ? slot.width : 32;
}

function toElem(slot, v) {
  if (isSvString(v)) throw new Error("Cannot store string in array/queue element");
  if (v && v.$h) throw new Error("Cannot store class handle in array/queue element");
  return v.resize(elemWidth(slot));
}

/**
 * Expression-valued methods: size, len, getc, pop_front/back, substr, atoi.
 * Returns a Value, sv-string, or null if not handled.
 */
export function evalCollectionMethod(slot, name, argValues) {
  if (slot.isString) {
    if (name === "len") return Value.fromUint(slot.str.length, 32);
    if (name === "getc") {
      const i = Number(argValues[0]?.toUint?.() ?? 0);
      const c = i >= 0 && i < slot.str.length ? slot.str.charCodeAt(i) & 0xff : 0;
      return Value.fromUint(c, 8);
    }
    if (name === "substr") {
      const i = Number(argValues[0]?.toUint?.() ?? 0);
      const j = Number(argValues[1]?.toUint?.() ?? i);
      return makeSvString(slot.str.slice(i, j + 1));
    }
    if (name === "atoi") {
      const n = parseInt(slot.str, 10);
      return Value.fromUint(Number.isFinite(n) ? n >>> 0 : 0, 32);
    }
    return null;
  }

  if (slot.isDynArray || slot.isQueue) {
    if (name === "size") return Value.fromUint(slot.elems?.length || 0, 32);
    if (slot.isQueue) {
      if (name === "pop_front") {
        if (!slot.elems?.length) return Value.xxxx(elemWidth(slot));
        return slot.elems.shift();
      }
      if (name === "pop_back") {
        if (!slot.elems?.length) return Value.xxxx(elemWidth(slot));
        return slot.elems.pop();
      }
    }
    return null;
  }
  return null;
}

/**
 * Statement / void methods: delete, push_*, putc
 * @returns {boolean} true if handled
 */
export function execCollectionMethod(slot, name, argValues) {
  if (slot.isString) {
    if (name === "putc") {
      const i = Number(argValues[0]?.toUint?.() ?? 0);
      let ch = 0;
      const a1 = argValues[1];
      if (isSvString(a1)) ch = a1.str.charCodeAt(0) & 0xff;
      else if (a1 && typeof a1.toUint === "function") ch = Number(a1.toUint()) & 0xff;
      if (i >= 0 && i < slot.str.length) {
        slot.str = slot.str.slice(0, i) + String.fromCharCode(ch) + slot.str.slice(i + 1);
      }
      return true;
    }
    return false;
  }

  if (slot.isDynArray || slot.isQueue) {
    if (name === "delete") {
      slot.elems = [];
      return true;
    }
    if (slot.isQueue) {
      if (name === "push_back") {
        if (!slot.elems) slot.elems = [];
        slot.elems.push(toElem(slot, argValues[0]));
        return true;
      }
      if (name === "push_front") {
        if (!slot.elems) slot.elems = [];
        slot.elems.unshift(toElem(slot, argValues[0]));
        return true;
      }
    }
    return false;
  }
  return false;
}

export function resizeDynArray(slot, size) {
  if (!slot.isDynArray) throw new Error("new[] only valid for dynamic arrays");
  const w = elemWidth(slot);
  const n = Math.max(0, size | 0);
  const next = [];
  for (let i = 0; i < n; i++) {
    next.push(i < (slot.elems?.length || 0) ? slot.elems[i].clone() : Value.xxxx(w));
  }
  slot.elems = next;
}

export function copyCollection(dst, src) {
  if (dst.isString && src.isString) {
    dst.str = src.str;
    return;
  }
  if ((dst.isDynArray || dst.isQueue) && (src.isDynArray || src.isQueue)) {
    dst.elems = (src.elems || []).map((e) => e.clone());
    return;
  }
  throw new Error("Incompatible collection assignment");
}

export function indexRead(slot, idx) {
  if (slot.isString) {
    const c = idx >= 0 && idx < slot.str.length ? slot.str.charCodeAt(idx) & 0xff : 0;
    return Value.fromUint(c, 8);
  }
  if (slot.isDynArray || slot.isQueue) {
    const e = slot.elems?.[idx];
    return e ? e.clone() : Value.xxxx(elemWidth(slot));
  }
  return null;
}

export function indexWrite(slot, idx, val) {
  if (slot.isString) {
    let ch = 0;
    if (isSvString(val)) ch = val.str.charCodeAt(0) & 0xff;
    else ch = Number(val.toUint?.() ?? 0) & 0xff;
    if (idx >= 0 && idx < slot.str.length) {
      slot.str = slot.str.slice(0, idx) + String.fromCharCode(ch) + slot.str.slice(idx + 1);
    }
    return true;
  }
  if (slot.isDynArray || slot.isQueue) {
    if (!slot.elems) slot.elems = [];
    if (idx < 0) return true;
    while (slot.elems.length <= idx) slot.elems.push(Value.xxxx(elemWidth(slot)));
    slot.elems[idx] = toElem(slot, val);
    return true;
  }
  return false;
}
