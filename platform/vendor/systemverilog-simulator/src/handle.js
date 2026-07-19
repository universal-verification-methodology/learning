/** Opaque SystemVerilog class handle (not a bit Value). */

/**
 * @param {number|null} oid
 * @returns {{ $h: true, oid: number|null }}
 */
export function makeHandle(oid) {
  return { $h: true, oid };
}

export const NULL_HANDLE = makeHandle(null);

/** @param {any} x */
export function isHandle(x) {
  return Boolean(x && typeof x === "object" && x.$h === true);
}

/** @param {any} x */
export function handleEq(a, b) {
  if (!isHandle(a) || !isHandle(b)) return false;
  return a.oid === b.oid;
}

/** @param {any} h */
export function formatHandle(h) {
  if (!isHandle(h)) return String(h);
  if (h.oid == null) return "null";
  return `obj#${h.oid}`;
}
