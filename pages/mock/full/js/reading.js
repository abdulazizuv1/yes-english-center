// Reading stage: passage flow and question numbering. Question rendering
// itself lives in the shared engine (pages/mock/engine/) — the same
// renderers the standalone listening and reading tests use, including
// drag & drop and map labelling.
import { state } from "./state.js";
import { saveCurrentHighlights, restoreHighlights } from "./highlights.js";
import { updateNavigationButtons } from "./navigation.js";
import { engineCtx } from "./engineCtx.js";
import { normalizeReadingQuestions, renderItem } from "../../engine/index.js";

// Initialize Reading
function initializeReading() {
  state.currentPassageIndex = 0;
  assignReadingQuestionIds();
  renderReadingPassage(0);

  // Block default context menu in reading stage
  const readingStage = document.getElementById("readingStage");
  if (readingStage) {
    readingStage.addEventListener("contextmenu", function (e) {
      // Only prevent if we don't have selected text (let our custom handler deal with it)
      if (state.selectedText.length === 0) {
        e.preventDefault();
      }
    });
  }
}

// The test page numbers reading questions BY ORDER: every gradeable entry
// (or sub-entry) gets the next reading_qN id before rendering/grading.
function assignReadingQuestionIds() {
  let counter = 1;
  state.orderedQIds = [];
  state.readingPassageCounts = [];

  const take = () => `reading_q${counter++}`;

  for (const passage of state.stageData.reading.passages) {
    const before = counter;
    for (const question of passage.questions) {
      if (question.question && question.type !== "drag_drop") {
        question.qId = take();
        state.orderedQIds.push(question.qId);
      }

      if (question.type === "question-group" && question.questions) {
        question.questions.forEach((subQ) => {
          subQ.qId = take();
          state.orderedQIds.push(subQ.qId);
        });
      }

      if (question.type === "drag_drop" && Array.isArray(question.slots)) {
        // inline word-bank gaps and per-slot card matching each take one
        // number per slot; legacy grouped cards (no qIds) stay outside
        // the 1–40 sequence, like the standalone reading test
        question.slots.forEach((s) => {
          if (question.inlineText || s.qId) {
            s.qId = take();
            state.orderedQIds.push(s.qId);
          }
        });
      }

      if (question.type === "map-labelling" && Array.isArray(question.questions)) {
        question.questions.forEach((r) => {
          r.qId = take();
          state.orderedQIds.push(r.qId);
        });
      }

      if (question.type === "table") {
        const columnKeys = question.columns
          .slice(1)
          .map((col) => col.toLowerCase());
        for (const row of question.rows) {
          for (const key of columnKeys) {
            if (typeof row[key] === "string" && row[key].includes("___q")) {
              row[key] = row[key].replace(/___q\d+___/g, () => {
                const qId = take();
                if (!question.qIds) question.qIds = [];
                question.qIds.push(qId);
                state.orderedQIds.push(qId);
                return `___${qId}___`;
              });
            }
          }
        }
      }
    }
    // Number of gradeable questions this passage contributed
    state.readingPassageCounts.push(counter - before);
  }
}

// Which passage (0-based) holds global reading question number `n` (1-based),
// derived from the real per-passage counts so question-groups are counted right.
function readingPassageOfQuestion(n) {
  let start = 1;
  for (let p = 0; p < state.readingPassageCounts.length; p++) {
    const end = start + state.readingPassageCounts[p] - 1;
    if (n >= start && n <= end) return p;
    start = end + 1;
  }
  return 0;
}

function renderReadingPassage(index) {
  // Save current highlights before switching
  if (state.currentPassageIndex !== index) {
    saveCurrentHighlights();
    state.currentPassageIndex = index;
  }

  const passage = state.stageData.reading.passages[index];

  // Update passage content
  document.getElementById("passageTitle").textContent = passage.title;
  document.getElementById("passageInstructions").textContent =
    passage.instructions;

  const formattedText = passage.text
    .split("\n\n")
    .map((p) => `<p>${p.trim()}</p>`)
    .join("");
  document.getElementById("passageText").innerHTML = formattedText;

  // Render questions through the shared engine
  const questionsList = document.getElementById("reading-questions");
  questionsList.innerHTML = "";
  let lastInstruction = null;
  let matchingOptionsShown = false;

  const items = normalizeReadingQuestions(passage.questions);

  items.forEach((item) => {
    // Show group instructions once per group (exact-match dedup, as before)
    if (item.instruction && item.instruction !== lastInstruction) {
      const instructionDiv = document.createElement("div");
      instructionDiv.className = "group-instruction";
      // Render as single block with preserved line breaks to avoid fragmented highlights
      instructionDiv.textContent = item.instruction;
      questionsList.appendChild(instructionDiv);
      lastInstruction = item.instruction;
      matchingOptionsShown = false; // reset when a new instruction starts
    }

    // For matching types, display shared options once as plain text before
    // the first question of the group
    if (item.kind === "match" && !matchingOptionsShown && item.options.length > 0) {
      const optsDiv = document.createElement("div");
      optsDiv.className = "matching-options-plain";
      optsDiv.style.cssText =
        "margin: 10px 0 15px; padding: 10px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; white-space: pre-wrap;";
      optsDiv.textContent = item.options
        .map((opt) => `${opt.label}. ${opt.text}`)
        .join("\n");
      questionsList.appendChild(optsDiv);
      matchingOptionsShown = true;
    }

    renderItem(item, questionsList, engineCtx);
  });

  updateNavigationButtons();

  // Restore highlights after rendering
  requestAnimationFrame(() => {
    restoreHighlights();
  });
}

export { initializeReading, renderReadingPassage, readingPassageOfQuestion };
