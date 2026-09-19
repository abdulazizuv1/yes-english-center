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

function place(el, x, y) {
  el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = `${Math.min(x, window.innerWidth - w - 8)}px`;
  el.style.top = `${Math.min(y, window.innerHeight - h - 8)}px`;
}

function persist(onChange) {
  saveSession();
  onChange?.();
}

export function initMarks({ zones, getPart, onChange }) {
  menuEl = document.getElementById("markMenu");
  noteEl = document.getElementById("notePop");
  const noteText = noteEl.querySelector("textarea");
  let noteFor = null;   // mark id the note editor belongs to

  const zoneOf = (node) => {
    const el = node.nodeType === 1 ? node : node.parentElement;
    const host = el?.closest("[data-zone]");
    return host ? host.dataset.zone : null;
  };

  const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const openNote = (id, x, y) => {
    const mark = readingState.session.marks.find((m) => m.id === id);
    if (!mark) return;
    noteFor = id;
    noteText.value = mark.note || "";
    place(noteEl, x, y);
    noteText.focus();
  };

  const createMark = (withNote) => {
    if (!pending?.offsets) return;
    const { zone, offsets } = pending;
    const mark = { id: newId(), part: getPart(), zone, ...offsets };
    if (withNote) mark.note = "";
    readingState.session.marks.push(mark);
    const pieces = paintMark(zones[zone], mark);
    window.getSelection()?.removeAllRanges();
    persist(onChange);
    if (withNote && pieces.length) {
      const r = pieces[pieces.length - 1].getBoundingClientRect();
      openNote(mark.id, r.left, r.bottom + 6);
    }
  };

  const removeMarks = (ids) => {
    ids.forEach(unpaintMark);
    readingState.session.marks = readingState.session.marks.filter((m) => !ids.includes(m.id));
    persist(onChange);
  };

  document.addEventListener("contextmenu", (e) => {
    const t = e.target;
    if (t.closest("input, textarea, select")) return;   // keep paste and spelling menus
    const zone = zoneOf(t);
    if (!zone) return;

    const hit = t.closest("mark.hl");
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const offsets = range && !range.collapsed ? rangeToOffsets(zones[zone], range) : null;

    if (!hit && !offsets) return;          // nothing to act on: native menu
    e.preventDefault();

    pending = { zone, offsets, markId: hit?.dataset.mark || null };
    const mark = hit && readingState.session.marks.find((m) => m.id === hit.dataset.mark);
    menuEl.querySelector('[data-act="highlight"]').hidden = !offsets;
    menuEl.querySelector('[data-act="note"]').hidden = !offsets;
    menuEl.querySelector('[data-act="editnote"]').hidden = !(mark && mark.note != null);
    menuEl.querySelector('[data-act="clear"]').hidden = !hit;
    menuEl.querySelector('[data-act="clearall"]').hidden = !hit;
    place(menuEl, e.clientX, e.clientY);
  });

  menuEl.addEventListener("click", (e) => {
    // the page-wide "click outside closes the note" handler must not see
    // this click, or choosing Notes would close the box it just opened
    e.stopPropagation();
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act || !pending) return;
    const { markId } = pending;
    const x = parseFloat(menuEl.style.left), y = parseFloat(menuEl.style.top);
    if (act === "highlight") createMark(false);
    else if (act === "note") createMark(true);
    else if (act === "editnote" && markId) openNote(markId, x, y);
    else if (act === "clear" && markId) removeMarks([markId]);
    else if (act === "clearall") {
      const part = getPart();
      removeMarks(readingState.session.marks.filter((m) => m.part === part).map((m) => m.id));
    }
    closeMenu();
  });

  // clicking a noted passage opens its note
  document.addEventListener("click", (e) => {
    if (menuEl && !menuEl.hidden && !menuEl.contains(e.target)) closeMenu();
    const noted = e.target.closest("mark.hl.has-note");
    if (noted && !noteEl.contains(e.target)) {
      const r = noted.getBoundingClientRect();
      openNote(noted.dataset.mark, r.left, r.bottom + 6);
      return;
    }
    if (noteEl && !noteEl.hidden && !noteEl.contains(e.target)) finishNote();
  });

  const finishNote = (remove = false) => {
    if (!noteFor) return closeNote();
    const mark = readingState.session.marks.find((m) => m.id === noteFor);
    const text = noteText.value.trim();
    if (mark) {
      if (remove) removeMarks([mark.id]);
      else if (!text) {
        // an empty note is just a highlight
        delete mark.note;
        document.querySelectorAll(`mark.hl[data-mark="${CSS.escape(mark.id)}"]`)
          .forEach((el) => el.classList.remove("has-note", "note-end"));
        persist(onChange);
      } else { mark.note = text; persist(onChange); }
    }
    noteFor = null;
    closeNote();
  };

  noteEl.addEventListener("click", (e) => e.stopPropagation());
  noteEl.querySelector('[data-note="save"]').addEventListener("click", () => finishNote(false));
  noteEl.querySelector('[data-note="delete"]').addEventListener("click", () => finishNote(true));
  noteText.addEventListener("input", () => {
    const mark = readingState.session.marks.find((m) => m.id === noteFor);
    if (mark) { mark.note = noteText.value; saveSession(); }   // a typed note survives a refresh too
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeMenu(); if (!noteEl.hidden) finishNote(false); }
  });
  window.addEventListener("resize", closeMenu);
  document.addEventListener("scroll", closeMenu, true);
}
