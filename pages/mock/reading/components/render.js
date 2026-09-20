// Draws one part: the passage on the left, the questions on the right.
//
// Questions are drawn by the shared engine straight from the saved answers,
// so a radio button, a dropdown or a dragged card appears already chosen.
// After that the page only ever adds highlight wrappers around text; it
// never swaps the questions for a stored copy of their HTML.
import { readingState } from "./state.js?v=3.2";
import { engineCtx } from "./engineCtx.js?v=3.2";
import { renderItem } from "../../engine/index.js?v=3.2";
import { paintPart } from "./marks.js?v=3.2";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Capitalised key phrases ("ONE WORD ONLY", "NOT GIVEN") are bold in the
// real test's instructions.
const boldCaps = (html) =>
  html.replace(/\b([A-Z]{2,}(?:[ /-]+[A-Z]{2,})*)\b/g, "<strong>$1</strong>");

/** Instruction text from the test, laid out the way the real test sets it. */
export function instructionBlock(text) {
  const box = document.createElement("div");
  box.className = "cd-instr";
  const lines = String(text).split("\n").map((l) => l.trimEnd());
  const legend = /^(TRUE|FALSE|NOT GIVEN|YES|NO)\s{2,}(.+)$/;

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (i === 0 && /^Questions?\s+\d+/i.test(t)) {
      const h = document.createElement("h3");
      h.className = "cd-qrange";
      h.textContent = t;
      box.appendChild(h);
      return;
    }
    const m = t.match(legend);
    if (m) {
      const row = document.createElement("div");
      row.className = "cd-legend";
      row.innerHTML = `<strong>${esc(m[1])}</strong><span>${esc(m[2])}</span>`;
      box.appendChild(row);
      return;
    }
    const p = document.createElement("p");
    p.innerHTML = boldCaps(esc(t));
    box.appendChild(p);
  });
  return box;
}

function optionsBox(options) {
  const box = document.createElement("div");
  box.className = "cd-options-box";
  box.innerHTML = options
    .map((o) => `<div class="cd-option-row"><strong>${esc(o.label)}</strong><span>${esc(o.text)}</span></div>`)
    .join("");
  return box;
}

export function renderPart(index, zones) {
  const passage = readingState.passages[index];
  const part = readingState.parts[index];

  document.getElementById("partTitle").textContent = `Part ${index + 1}`;
  document.getElementById("partInstr").textContent = part.qIds.length
    ? `Read the text and answer questions ${part.first}–${part.last}.`
    : "Read the text.";

  // passage: same splitting the test has always used, so authored markup
  // (italics, superscripts) keeps rendering
  const title = passage.title ? `<h2 class="passage-title">${esc(passage.title)}</h2>` : "";
  zones.passage.innerHTML =
    title +
    String(passage.text || "")
      .split("\n\n")
      .map((p) => `<p>${p.trim()}</p>`)
      .join("");

  // questions
  zones.questions.innerHTML = "";
  let lastInstruction = null;
  let optionsShown = false;
  for (const item of readingState.items[index]) {
    if (item.instruction && item.instruction !== lastInstruction) {
      zones.questions.appendChild(instructionBlock(item.instruction));
      lastInstruction = item.instruction;
      optionsShown = false;
    }
    if (item.kind === "match" && !optionsShown && item.options.length) {
      zones.questions.appendChild(optionsBox(item.options));
      optionsShown = true;
    }
    renderItem(item, zones.questions, engineCtx);
  }

  paintPart(index, zones);
}

/* ───────────── finding questions on the page ───────────── */

const QID = /^q\d+$/;

/** The element that holds question `qId` on the current page. */
export function questionEl(qId) {
  let el = document.getElementById(qId);
  if (el && el.style.display === "none") el = el.parentElement;   // multi-select markers
  if (!el) el = document.querySelector(`[data-qid="${qId}"]`) || document.querySelector(`input[name="${qId}"]`);
  if (!el) return null;
  return (
    el.closest(".question-item, .gap-fill-question, .gap-fill-list-item, .matching-question, .multi-select-group, .dd-slot, .dd-inline-slot, td") ||
    el
  );
}

/** Which question a click or focus landed in. */
export function qIdFromTarget(target) {
  if (!(target instanceof Element)) return null;
  const choice = target.closest('input[type="radio"]');
  if (choice?.name && QID.test(choice.name)) return choice.name;
  const withQid = target.closest("[data-qid]");
  if (withQid && QID.test(withQid.dataset.qid)) return withQid.dataset.qid;
  const group = target.closest(".multi-select-group");
  if (group) {
    const marker = group.querySelector("[id]");
    if (marker && QID.test(marker.id)) return marker.id;
  }
  let node = target;
  while (node && node !== document.body) {
    if (node.id && QID.test(node.id)) return node.id;
    node = node.parentElement;
  }
  return null;
}
