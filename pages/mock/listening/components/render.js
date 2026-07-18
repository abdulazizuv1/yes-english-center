// Listening test: section flow and instruction bands. Question rendering
// itself lives in the shared engine (pages/mock/engine/) — the same
// renderers the reading test and the full mock use.
import { listeningState } from "./state.js";
import { handleAudio } from "./audio.js";
import { restoreHighlights, saveCurrentHighlights } from "./highlights.js";
import { updateNavButtons } from "./navigation.js";
import { engineCtx } from "./engineCtx.js";
import {
  repairListeningIds,
  normalizeListeningItem,
  normalizeListeningSection,
  renderItem,
} from "../../engine/index.js";

// Tracks the last group instruction shown while rendering a section so the
// same instruction isn't repeated before every question in the group.
let lastInstruction = null;
let instructionFresh = false;

export function renderSection(index) {
  if (listeningState.currentSectionIndex !== index) {
    saveCurrentHighlights();
    listeningState.currentSectionIndex = index;
  }

  const section = listeningState.sections[index];
  if (!section) return;

  handleAudio(section, index);
  renderContent(section, index);
  updateNavButtons(index);

  setTimeout(() => {
    restoreHighlights();
  }, 150);
}

export function renderContent(section, index) {
  const questionList = document.getElementById("question-list");
  if (!questionList) return;

  repairListeningIds(listeningState.sections);

  questionList.innerHTML = `
        <div class="section-title" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0;">Section ${index + 1}: ${
    section.title || `Section ${index + 1}`
  }</h2>
        </div>
    `;

  lastInstruction = null;
  instructionFresh = false;

  // Section-level instructions (outside content[]): object or string form
  if (section.instructions && typeof section.instructions === "object") {
    const { heading, details, note } = section.instructions;
    if (heading || details || note) {
      questionList.insertAdjacentHTML(
        "beforeend",
        `<div class="group-instruction">${heading ? `<strong>${heading}</strong><br>` : ""}${details || ""}${note ? `<br><em>${note}</em>` : ""}</div>`
      );
      lastInstruction = normalizeInstruction([heading, details, note].filter(Boolean).join(" "));
      instructionFresh = true;
    }
  }
  [
    typeof section.instructions === "string" ? section.instructions : "",
    typeof section.groupInstruction === "string" ? section.groupInstruction : "",
  ].forEach((text) => {
    const norm = normalizeInstruction(text);
    if (!norm || norm === lastInstruction) return;
    questionList.insertAdjacentHTML(
      "beforeend",
      `<div class="group-instruction">${instructionBlockHTML(text)}</div>`
    );
    lastInstruction = norm;
    instructionFresh = true;
  });

  if (section.content) {
    section.content.forEach((item) => renderContentItem(item, questionList));
  } else {
    // very old flat sections (multiSelect / matching keys, no content[])
    normalizeListeningSection(section).forEach((normalized) =>
      renderItem(normalized, questionList, engineCtx)
    );
  }
}

function normalizeInstruction(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function instructionBlockHTML(text) {
  const s = String(text).trim();
  const nl = s.indexOf("\n");
  if (nl === -1) return s;
  const first = s.slice(0, nl).trim();
  const rest = s.slice(nl + 1).trim().replace(/\n/g, "<br>");
  return `<strong>${first}</strong><br>${rest}`;
}

function renderContentItem(item, questionList) {
  // Instruction band ahead of ANY item that carries one, shown once per group
  const gi = item && item.groupInstruction;
  if (gi) {
    const norm = normalizeInstruction(gi);
    if (norm && norm !== lastInstruction) {
      lastInstruction = norm;
      instructionFresh = true;
      questionList.insertAdjacentHTML(
        "beforeend",
        `<div class="group-instruction">${instructionBlockHTML(gi)}</div>`
      );
    }
  }

  if (!item.type) return;

  if (item.type === "text" || item.type === "subheading" || item.type === "title") {
    const value = item.value || item.text || item.title || "";
    const norm = normalizeInstruction(value);
    // Right after an instruction band, drop a text/subheading that merely
    // repeats part of it — otherwise the same sentence prints twice.
    if (instructionFresh && norm.length >= 12 && lastInstruction && lastInstruction.includes(norm)) {
      return;
    }
    questionList.insertAdjacentHTML(
      "beforeend",
      item.type === "text"
        ? `<p class="listening-text text-paragraph">${value}</p>`
        : `<h4 class="listening-subheading">${value}</h4>`
    );
    return;
  }

  const normalized = normalizeListeningItem(item);
  if (!normalized) return;
  if (normalized.kind !== "content") instructionFresh = false;
  renderItem(normalized, questionList, engineCtx);
}
