/**
 * Lightweight textarea code-assist for teaching labs.
 * Re-exports assist core + attachAssist(textarea, opts).
 */
export {
  getCompletions,
  ghostSuffix,
  applyCompletion,
  fixForRule,
  fixesForFindings,
  ASSIST_KEYWORDS,
  ASSIST_SNIPPETS,
} from "./hdl-assist-core.js";

import {
  getCompletions,
  ghostSuffix,
  applyCompletion,
  fixForRule,
} from "./hdl-assist-core.js";

/**
 * @param {HTMLTextAreaElement} ta
 * @param {{
 *   enabled?: () => boolean,
 *   onChange?: () => void,
 *   statusEl?: HTMLElement | null,
 * }} [opts]
 */
export function attachAssist(ta, opts = {}) {
  const enabled = opts.enabled || (() => true);
  /** @type {{ items: object[], index: number, replaceFrom: number, replaceTo: number, prefix: string } | null} */
  let state = null;
  const popup = document.createElement("div");
  popup.className = "lab-assist-popup";
  popup.hidden = true;
  const wrap = ta.parentElement;
  if (wrap) {
    if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
    wrap.appendChild(popup);
  }

  function clear() {
    state = null;
    popup.hidden = true;
    popup.innerHTML = "";
    if (opts.statusEl) {
      opts.statusEl.hidden = true;
      opts.statusEl.textContent = "";
    }
  }

  function refresh() {
    if (!enabled() || ta.selectionStart !== ta.selectionEnd) {
      clear();
      return;
    }
    const res = getCompletions(ta.value, ta.selectionStart);
    if (!res.items.length) {
      clear();
      return;
    }
    state = {
      items: res.items,
      index: 0,
      replaceFrom: res.replaceFrom,
      replaceTo: res.replaceTo,
      prefix: res.prefix,
    };
    render();
  }

  function render() {
    if (!state) return;
    const item = state.items[state.index];
    popup.innerHTML = state.items
      .map((it, i) => {
        const active = i === state.index ? " is-active" : "";
        return `<button type="button" class="lab-assist-item${active}" data-i="${i}">
          <span class="k">${escapeHtml(it.kind || "")}</span>
          <span class="l">${escapeHtml(it.label)}</span>
        </button>`;
      })
      .join("");
    popup.hidden = false;
    if (opts.statusEl) {
      opts.statusEl.hidden = false;
      const ghost = ghostSuffix(item, state.prefix);
      opts.statusEl.textContent = `Tab · ${item.label}${ghost ? " → " + ghost : ""}`;
    }
  }

  function accept() {
    if (!state) return false;
    const item = state.items[state.index];
    const { text, cursor } = applyCompletion(ta.value, item, state.replaceFrom, state.replaceTo);
    ta.value = text;
    ta.selectionStart = ta.selectionEnd = cursor;
    clear();
    opts.onChange?.();
    return true;
  }

  ta.addEventListener("input", refresh);
  ta.addEventListener("click", refresh);
  ta.addEventListener("keydown", (e) => {
    if (!state?.items.length) {
      if (e.key === "Tab") return; // allow default / other handlers
      if ((e.ctrlKey || e.metaKey) && e.key === " ") {
        e.preventDefault();
        refresh();
      }
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      accept();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      clear();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.index = (state.index + 1) % state.items.length;
      render();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      state.index = (state.index - 1 + state.items.length) % state.items.length;
      render();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      accept();
    }
  });

  popup.addEventListener("mousedown", (e) => {
    const btn = e.target.closest("[data-i]");
    if (!btn || !state) return;
    e.preventDefault();
    state.index = Number(btn.getAttribute("data-i"));
    accept();
  });

  return { refresh, clear, fixForRule };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
