// Listening stage: section flow and instruction bands. Question
// rendering itself lives in the shared engine (pages/mock/engine/) —
// the same renderers the standalone listening and reading tests use.
import { state } from "./state.js";
import { handleSectionAudio } from "./audio.js";
import { saveCurrentHighlights, restoreHighlights } from "./highlights.js";
import { updateNavigationButtons } from "./navigation.js";
import { engineCtx } from "./engineCtx.js";
import {
  repairListeningIds,
  normalizeListeningItem,
  renderItem,
} from "../../engine/index.js";

// Tracks the last group instruction shown while rendering a section so the
// same instruction isn't repeated before every question in the group.
let lastListeningInstruction = null;
// True from the moment an instruction band renders until the first gradeable
// item after it — a text/subheading in that window that merely repeats part
// of the band (same sentence saved in both places) is skipped.
let listeningInstructionFresh = false;

// Initialize Listening
function initializeListening() {
  repairListeningIds(state.stageData.listening.sections);
  state.currentSectionIndex = 0;
  state.audioInitialized = false; // Сбрасываем флаг аудио
  state.currentAudioSection = 0;   // Сбрасываем текущую секцию аудио
  renderListeningSection(0);
}

function renderListeningSection(index) {
  // Save current highlights before switching
  if (state.currentSectionIndex !== index) {
    saveCurrentHighlights();
    state.currentSectionIndex = index;
  }

  const section = state.stageData.listening.sections[index];
  if (!section) return;

  // Enhanced audio handling
  handleSectionAudio(section, index);

  // Render questions in unified block
  const questionList = document.getElementById("listening-questions");
  questionList.innerHTML = `
    <div class="listening-content-block">
      <div class="section-title" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0;">Section ${index + 1}: ${
    section.title || `Section ${index + 1}`
  }</h2>
      </div>
  `;

  // Section-level instructions live OUTSIDE content[] and come in two
  // shapes: an {heading, details, note} object (add tool) or a plain
  // groupInstruction string (imported tests). Both render at the top;
  // per-item groupInstruction bands then render inline as the content
  // flows.
  lastListeningInstruction = null;
  listeningInstructionFresh = false;
  const content = Array.isArray(section.content) ? section.content : [];

  if (section.instructions && typeof section.instructions === "object") {
    const { heading, details, note } = section.instructions;
    if (heading || details || note) {
      questionList.insertAdjacentHTML("beforeend", `
        <div class="group-instruction">
          ${heading ? `<strong>${heading}</strong><br>` : ""}
          ${details || ""}${note ? `<br><em>${note}</em>` : ""}
        </div>
      `);
      // If the first item's groupInstruction repeats the section block
      // verbatim, don't show it twice.
      lastListeningInstruction = normalizeInstruction(
        [heading, details, note].filter(Boolean).join(" ")
      );
      listeningInstructionFresh = true;
    }
  }

  [
    typeof section.instructions === "string" ? section.instructions : "",
    typeof section.groupInstruction === "string" ? section.groupInstruction : "",
  ].forEach((text) => {
    const norm = normalizeInstruction(text);
    if (!norm || norm === lastListeningInstruction) return;
    questionList.insertAdjacentHTML("beforeend", `<div class="group-instruction">${instructionBlockHTML(text)}</div>`);
    lastListeningInstruction = norm;
    listeningInstructionFresh = true;
  });

  content.forEach((item) => renderListeningContentItem(item));

  updateNavigationButtons();

  // Restore highlights after rendering
  setTimeout(() => {
    restoreHighlights();
  }, 150);
}

// Whitespace/case-insensitive comparison so the same instruction typed with
// different spacing (or split across section fields) never shows twice.
function normalizeInstruction(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

// groupInstruction strings often hold several lines ("Questions 1-10\n\n
// Write ONE WORD..."). Show the first line bold — it is the "Questions X-Y"
// range in real papers — and keep the remaining line breaks.
function instructionBlockHTML(text) {
  const s = String(text).trim();
  const nl = s.indexOf("\n");
  if (nl === -1) return s;
  const first = s.slice(0, nl).trim();
  const rest = s.slice(nl + 1).trim().replace(/\n/g, "<br>");
  return `<strong>${first}</strong><br>${rest}`;
}

// Renders an item's groupInstruction as an instruction block, but only
// when it changes — so a run of items sharing one instruction shows it
// once (real IELTS layout).
function renderListeningInstructionFor(item) {
  const gi = item && item.groupInstruction;
  if (!gi) return;
  const norm = normalizeInstruction(gi);
  if (!norm || norm === lastListeningInstruction) return;
  lastListeningInstruction = norm;
  listeningInstructionFresh = true;
  const questionList = document.getElementById("listening-questions");
  const div = document.createElement("div");
  div.className = "group-instruction";
  div.innerHTML = instructionBlockHTML(gi);
  questionList.appendChild(div);
}

function renderListeningContentItem(item) {
  const questionList = document.getElementById("listening-questions");

  // Show the shared instruction ahead of ANY item that carries one — text
  // blocks and subheadings included, not just gradeable questions.
  renderListeningInstructionFor(item);

  if (!item.type) return;

  if (item.type === "text" || item.type === "subheading" || item.type === "title") {
    const value = item.value || item.text || item.title || "";
    // Right after an instruction band, drop a text/subheading whose whole
    // content is already inside the band (e.g. "Write ONE WORD AND/OR A
    // NUMBER..." saved both as section groupInstruction and as a
    // subheading) — otherwise the same sentence prints twice.
    const norm = normalizeInstruction(value);
    if (
      listeningInstructionFresh &&
      norm.length >= 12 &&
      lastListeningInstruction &&
      lastListeningInstruction.includes(norm)
    ) {
      return;
    }
    questionList.insertAdjacentHTML("beforeend",
      item.type === "text"
        ? `<p class="listening-text">${value}</p>`
        : `<h4 class="listening-subheading">${value}</h4>`);
    return;
  }

  // Everything gradeable renders through the shared engine
  const normalized = normalizeListeningItem(item);
  if (!normalized) return;
  if (normalized.kind !== "content") listeningInstructionFresh = false;
  renderItem(normalized, questionList, engineCtx);
}

export { initializeListening, renderListeningSection };
