// Highlights and notes.
//
// The old page saved a copy of the questions' HTML to remember highlights
// and pasted that copy back later. The pasted radio buttons, selects and
// drag slots were not connected to anything, so answers given after that
// were never saved; that was the lost-answers bug. Here a highlight is only
// a position in the text (start and end character) and is painted onto the
// page the engine has just drawn. Nothing the student can answer is ever
// replaced.
import { readingState } from "./state.js";
import { saveSession } from "./session.js";

// Text that moves or changes while the student works (cards in a drag and
// drop, the "Selected 1 / 2" counter, dropdown options) is left out of the
// count, so a saved position always lands on the same words.
const SKIP =
  "select, option, button, textarea, input, script, style, " +
  ".selection-counter, .dd-items-bank, .dd-item, .dd-placed-item, " +
  ".dd-slot-drop-zone, .dd-inline-slot, .no-mark, .note-pop, .cd-menu";

export function textNodesIn(zone) {
  const out = [];
  const walker = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = walker.nextNode())) out.push(n);
  return out;
}

function pointToOffset(nodes, container, offset) {
  const boundary = document.createRange();
  boundary.setStart(container, offset);
  boundary.collapse(true);
  let cum = 0;
  for (const node of nodes) {
    if (node === container) return cum + offset;
    // whole node sits before the boundary: count all of it
    if (boundary.comparePoint(node, node.nodeValue.length) <= 0) cum += node.nodeValue.length;
    else break;
  }
  return cum;
}

/** A browser selection inside `zone` as character offsets, or null. */
export function rangeToOffsets(zone, range) {
  if (!range || range.collapsed) return null;
  if (!zone.contains(range.startContainer) || !zone.contains(range.endContainer)) return null;
  const nodes = textNodesIn(zone);
  const start = pointToOffset(nodes, range.startContainer, range.startOffset);
  const end = pointToOffset(nodes, range.endContainer, range.endOffset);
  return end > start ? { start, end } : null;
}

/** Wraps the text between the mark's offsets. Safe to call on any render. */
export function paintMark(zone, mark) {
  const nodes = textNodesIn(zone);
  let cum = 0;
  const pieces = [];
  for (const node of nodes) {
    const len = node.nodeValue.length;
    const from = Math.max(mark.start, cum);
    const to = Math.min(mark.end, cum + len);
    if (from < to) pieces.push({ node, a: from - cum, b: to - cum });
    cum += len;
    if (cum >= mark.end) break;
  }

  const wrapped = [];
  for (const { node, a, b } of pieces) {
    let target = node;
    if (a > 0) target = target.splitText(a);
    if (b - a < target.nodeValue.length) target.splitText(b - a);
    if (!target.nodeValue.trim()) continue;   // never wrap bare whitespace
    const el = document.createElement("mark");
    el.className = mark.note != null ? "hl has-note" : "hl";
    el.dataset.mark = mark.id;
    target.parentNode.insertBefore(el, target);
    el.appendChild(target);
    wrapped.push(el);
  }
  if (wrapped.length && mark.note != null) wrapped[wrapped.length - 1].classList.add("note-end");
  return wrapped;
}

export function unpaintMark(id) {
  document.querySelectorAll(`mark.hl[data-mark="${CSS.escape(id)}"]`).forEach((el) => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
    parent.normalize();
  });
}

/** Paints every saved mark for this part onto the page. */
export function paintPart(part, zones) {
  for (const mark of readingState.session.marks) {
    if (mark.part !== part) continue;
    const zone = zones[mark.zone];
    if (zone) paintMark(zone, mark);
  }
}

/* ───────────── the right-click menu and the note editor ───────────── */

let menuEl = null;
let noteEl = null;
let pending = null;   // what the open menu will act on

function closeMenu() {
  if (menuEl) menuEl.hidden = true;
  pending = null;
}

function closeNote() {
  if (noteEl) noteEl.hidden = true;
}

// Puts a floating box at (x, y) and keeps it on screen. With no room below,
// it flips above `anchorTop` (the top of the words it belongs to) instead
// of sliding up over them.
function place(el, x, y, anchorTop = null) {
  el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  let top = y;
  if (top + h > vh - 8 && anchorTop !== null) top = anchorTop - h - 8;
  el.style.left = `${Math.max(8, Math.min(x, vw - w - 8))}px`;
  el.style.top = `${Math.max(8, Math.min(top, vh - h - 8))}px`;
}

function persist(onChange) {
  saveSession();
  onChange?.();
}

export function initMarks({ zones, getPart, onChange }) {
  menuEl = document.getElementById("markMenu");
  noteEl = document.getElementById("notePop");
  const noteText = noteEl.querySelector("textarea");
  const marks = () => readingState.session.marks;
  let noteFor = null;      // mark id the note editor belongs to
  let pointerDown = false;
  let selTimer = null;

  const zoneOf = (node) => {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    const host = el?.closest("[data-zone]");
    return host ? host.dataset.zone : null;
  };

  const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  /** The student's current selection, if it sits inside the passage or the questions. */
  const selectionInZone = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const zone = zoneOf(range.commonAncestorContainer);
    if (!zone) return null;
    const offsets = rangeToOffsets(zones[zone], range);
    return offsets ? { zone, offsets, range } : null;
  };

  const overlapping = (zone, { start, end }) => {
    const part = getPart();
    return marks()
      .filter((m) => m.part === part && m.zone === zone && m.start < end && m.end > start)
      .map((m) => m.id);
  };

  const sameOffsets = (a, b) => a && b && a.start === b.start && a.end === b.end;

  /** Shows the menu with only the actions that make sense here. */
  const openMenu = ({ zone, offsets = null, markIds = [], hitId = null }, x, y, anchorTop = null) => {
    pending = { zone, offsets, markIds, hitId };
    const hit = hitId && marks().find((m) => m.id === hitId);
    const show = (act, on) => { menuEl.querySelector(`[data-act="${act}"]`).hidden = !on; };
    show("highlight", !!offsets);
    show("note", !!offsets || (hit && hit.note == null));
    show("editnote", !!(hit && hit.note != null));
    show("clear", markIds.length > 0);
    show("clearall", !!hit);
    place(menuEl, x, y, anchorTop);
  };

  const openNote = (id, x, y, anchorTop = null) => {
    const mark = marks().find((m) => m.id === id);
    if (!mark) return;
    noteFor = id;
    noteText.value = mark.note || "";
    place(noteEl, x, y, anchorTop);
    noteText.focus();
  };

  const piecesOf = (id) => [...document.querySelectorAll(`mark.hl[data-mark="${CSS.escape(id)}"]`)];

  const noteBelow = (id) => {
    const pieces = piecesOf(id);
    if (!pieces.length) return;
    const r = pieces[pieces.length - 1].getBoundingClientRect();
    openNote(id, r.left, r.bottom + 6, r.top);
  };

  const createMark = (withNote) => {
    if (!pending?.offsets) return;
    const { zone, offsets } = pending;
    const mark = { id: newId(), part: getPart(), zone, ...offsets };
    if (withNote) mark.note = "";
    marks().push(mark);
    paintMark(zones[zone], mark);
    window.getSelection()?.removeAllRanges();
    persist(onChange);
    if (withNote) noteBelow(mark.id);
  };

  // a note added to a highlight that is already there
  const addNoteTo = (id) => {
    const mark = marks().find((m) => m.id === id);
    if (!mark) return;
    mark.note = "";
    const pieces = piecesOf(id);
    pieces.forEach((el) => el.classList.add("has-note"));
    pieces[pieces.length - 1]?.classList.add("note-end");
    persist(onChange);
    noteBelow(id);
  };

  const removeMarks = (ids) => {
    ids.forEach(unpaintMark);
    readingState.session.marks = marks().filter((m) => !ids.includes(m.id));
    persist(onChange);
  };

  const finishNote = (remove = false) => {
    if (!noteFor) return closeNote();
    const mark = marks().find((m) => m.id === noteFor);
    const text = noteText.value.trim();
    if (mark) {
      if (remove) removeMarks([mark.id]);
      else if (!text) {
        // an empty note is just a highlight
        delete mark.note;
        piecesOf(mark.id).forEach((el) => el.classList.remove("has-note", "note-end"));
        persist(onChange);
      } else { mark.note = text; persist(onChange); }
    }
    noteFor = null;
    closeNote();
  };

  /* ── the menu appears as soon as text is selected: no right-click needed ── */
  const offerForSelection = (x, y) => {
    const found = selectionInZone();
    if (!found) return;
    if (!menuEl.hidden && sameOffsets(pending?.offsets, found.offsets)) return;   // already showing
    const anchorTop = found.range.getBoundingClientRect().top;
    if (x == null) {
      // keyboard or touch selection: put the menu under the end of it
      const rects = found.range.getClientRects();
      const last = rects[rects.length - 1] || found.range.getBoundingClientRect();
      x = last.left;
      y = last.bottom + 8;
    }
    openMenu({ zone: found.zone, offsets: found.offsets, markIds: overlapping(found.zone, found.offsets) }, x, y, anchorTop);
  };

  document.addEventListener("pointerdown", (e) => {
    if (menuEl.contains(e.target) || noteEl.contains(e.target)) return;
    pointerDown = true;
  }, true);

  document.addEventListener("pointerup", (e) => {
    pointerDown = false;
    if (e.button === 2) return;                          // right button: contextmenu handles it
    if (menuEl.contains(e.target) || noteEl.contains(e.target)) return;
    if (e.target.closest?.("input, textarea, select")) return;
    const x = e.clientX, y = e.clientY + 14;
    // let the browser finish settling the selection (double-click, triple-click)
    setTimeout(() => offerForSelection(x, y), 0);
  }, true);

  // keyboard selections, and touch screens where the selection is adjusted
  // with handles after the finger lifts
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => { if (!pointerDown) offerForSelection(); }, 350);
  });

  // right-click still works, on a selection or on a highlight
  document.addEventListener("contextmenu", (e) => {
    const t = e.target;
    if (t.closest("input, textarea, select")) return;   // keep paste and spelling menus
    const zone = zoneOf(t);
    if (!zone) return;
    const hit = t.closest("mark.hl");
    const found = selectionInZone();
    if (!hit && !found) return;                         // nothing to act on: the browser's own menu
    e.preventDefault();
    if (found) {
      openMenu({ zone: found.zone, offsets: found.offsets, markIds: overlapping(found.zone, found.offsets) }, e.clientX, e.clientY);
    } else {
      openMenu({ zone, markIds: [hit.dataset.mark], hitId: hit.dataset.mark }, e.clientX, e.clientY);
    }
  });

  menuEl.addEventListener("click", (e) => {
    // the page-wide "click outside closes the note" handler must not see
    // this click, or choosing Notes would close the box it just opened
    e.stopPropagation();
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act || !pending) return;
    const { markIds, hitId } = pending;
    if (act === "highlight") createMark(false);
    else if (act === "note") { if (pending.offsets) createMark(true); else if (hitId) addNoteTo(hitId); }
    else if (act === "editnote" && hitId) noteBelow(hitId);
    else if (act === "clear" && markIds.length) { removeMarks(markIds); window.getSelection()?.removeAllRanges(); }
    else if (act === "clearall") {
      const part = getPart();
      removeMarks(marks().filter((m) => m.part === part).map((m) => m.id));
    }
    closeMenu();
  });

  document.addEventListener("click", (e) => {
    // the click that ends a drag-selection must not close the menu it opened
    if (selectionInZone()) return;

    const hit = e.target.closest("mark.hl");
    // a highlight inside an answer option is just part of the option: let the click choose it
    if (hit && !e.target.closest("label, input, select, textarea, button")) {
      const mark = marks().find((m) => m.id === hit.dataset.mark);
      if (mark?.note != null) {
        closeMenu();
        noteBelow(mark.id);
      } else {
        openMenu({ zone: zoneOf(hit), markIds: [hit.dataset.mark], hitId: hit.dataset.mark }, e.clientX, e.clientY + 14, hit.getBoundingClientRect().top);
      }
      return;
    }
    if (!menuEl.hidden) closeMenu();
    if (!noteEl.hidden) finishNote(false);
  });

  noteEl.addEventListener("click", (e) => e.stopPropagation());
  noteEl.querySelector('[data-note="save"]').addEventListener("click", () => finishNote(false));
  noteEl.querySelector('[data-note="delete"]').addEventListener("click", () => finishNote(true));
  noteText.addEventListener("input", () => {
    const mark = marks().find((m) => m.id === noteFor);
    if (mark) { mark.note = noteText.value; saveSession(); }   // a typed note survives a refresh too
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeMenu(); if (!noteEl.hidden) finishNote(false); }
  });
  window.addEventListener("resize", closeMenu);
  // scrolling a pane moves the text away from the menu; the note box stays
  document.addEventListener("scroll", () => closeMenu(), true);
}
