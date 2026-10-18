// Draws one part: the band at the top ("Part 1 · Listen and answer
// questions 1–10") and its questions, laid out like the real test.
//
// Questions are drawn by the shared engine straight from the saved
// answers, so a radio button, a dropdown or a ticked box appears already
// chosen. After that the page only adds highlight wrappers around text; it
// never swaps the questions for a stored copy of their HTML (that is what
// lost answers on the old page).
import { listeningState } from "./state.js?v=3.4";
import { engineCtx } from "./engineCtx.js?v=3.4";
import { normalizeListeningItem, renderItem } from "../../engine/index.js?v=3.4";
import { paintPart } from "./marks.js?v=3.4";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Capitalised key phrases ("ONE WORD AND/OR A NUMBER") are bold in the
// real test's instructions.
const boldCaps = (html) =>
  html.replace(/\b([A-Z]{2,}(?:[ /-]+[A-Z]{2,})*)\b/g, "<strong>$1</strong>");

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

/** Instruction text from the test, set the way the real test sets it. */
function instructionBlock(lines) {
  const box = document.createElement("div");
  box.className = "cd-instr";
  lines
    .flatMap((l) => String(l ?? "").split("\n"))
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((t, i) => {
      if (i === 0 && /^Questions?\s+\d+/i.test(t)) {
        const h = document.createElement("h3");
        h.className = "cd-qrange";
        h.textContent = t;
        box.appendChild(h);
        return;
      }
      const p = document.createElement("p");
      p.innerHTML = boldCaps(esc(t));
      box.appendChild(p);
    });
  return box;
}

export function renderPart(index, zone) {
  const section = listeningState.sections[index];
  const part = listeningState.parts[index];

  document.getElementById("partTitle").textContent = `Part ${index + 1}`;
  document.getElementById("partInstr").textContent = part.qIds.length
    ? `Listen and answer questions ${part.first}–${part.last}.`
    : "Listen to the recording.";

  zone.innerHTML = "";
  let lastInstruction = null;   // a group's instruction is shown once, not per question
  let fresh = false;            // an instruction band was the last thing drawn

  const addInstruction = (lines) => {
    const text = norm(lines.join(" "));
    if (!text || text === lastInstruction) return;
    zone.appendChild(instructionBlock(lines));
    lastInstruction = text;
    fresh = true;
  };

  // the part's own instructions, in either shape the add tool has saved
  const ins = section.instructions;
  if (ins && typeof ins === "object") addInstruction([ins.heading, ins.details, ins.note].filter(Boolean));
  else if (typeof ins === "string") addInstruction([ins]);
  if (typeof section.groupInstruction === "string") addInstruction([section.groupInstruction]);

  // the notes' or form's own heading ("Transport survey"), unless the
  // content already carries it (a table's title, a title line)
  const title = norm(section.title);
  const repeated = (section.content || []).some((item) =>
    ["title", "value", "text", "heading"].some((k) => norm(item?.[k]) === title)
  );
  if (title && !repeated) {
    const h = document.createElement("h3");
    h.className = "cd-notes-title";
    h.textContent = section.title;
    zone.appendChild(h);
  }

  if (Array.isArray(section.content)) {
    for (const item of section.content) {
      if (item?.groupInstruction) addInstruction([item.groupInstruction]);
      if (!item?.type) continue;

      if (item.type === "text" || item.type === "subheading" || item.type === "title") {
        const value = item.value || item.text || item.title || "";
        // a line that only repeats the instruction just above it is dropped
        if (fresh && norm(value).length >= 12 && lastInstruction?.includes(norm(value))) continue;
        zone.insertAdjacentHTML(
          "beforeend",
          item.type === "text"
            ? `<p class="listening-text text-paragraph">${value}</p>`
            : `<h4 class="listening-subheading">${value}</h4>`
        );
        continue;
      }

      const normalized = normalizeListeningItem(item);
      if (!normalized) continue;
      if (normalized.kind !== "content") fresh = false;
      renderItem(normalized, zone, engineCtx);
    }
  } else {
    // very old sections without content[]: the engine already built them
    listeningState.items[index].forEach((item) => renderItem(item, zone, engineCtx));
  }

  paintPart(index, { questions: zone });
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
