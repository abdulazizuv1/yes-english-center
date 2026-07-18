// Reading test: passage flow. Question rendering itself lives in the
// shared engine (pages/mock/engine/) — the same renderers the listening
// test and the full mock use, including drag & drop and map labelling.
import { readingState } from "./state.js";
import { restoreHighlights } from "./highlights.js";
import { saveState } from "./storage.js";
import { updateQuestionNav } from "./navigation.js";
import { engineCtx } from "./engineCtx.js";
import { normalizeReadingQuestions, renderItem } from "../../engine/index.js";

export function forceRenderPassageContent(index) {
  const passage = readingState.passages[index];

  document.getElementById("passageTitle").textContent = passage.title;
  document.getElementById("passageInstructions").textContent = passage.instructions;

  const formattedText = passage.text
    .split("\n\n")
    .map((p) => `<p>${p.trim()}</p>`)
    .join("");

  const passageTextEl = document.getElementById("passageText");
  passageTextEl.innerHTML = formattedText;
}

// Re-attach input listeners after highlight-restore replaces question HTML.
export function restoreInputEventListeners() {
  const inputs = document.querySelectorAll(
    'input[data-question-id], input[id^="q"], input[id^="input-"], select[id^="q"]'
  );

  inputs.forEach((input) => {
    const qId = input.dataset.questionId || input.dataset.qid || input.id.replace("input-", "");

    if (input.type === "text") {
      input.value = readingState.answersSoFar[qId] || "";
      if (input.value) {
        input.classList.add("has-value");
      }

      input.addEventListener("input", (e) => {
        readingState.answersSoFar[qId] = e.target.value;
        saveState();
        updateQuestionNav();

        if (e.target.value.trim()) {
          input.classList.add("has-value");
          const textLength = e.target.value.length;
          input.classList.remove("input-small", "input-medium", "input-large");
          if (textLength > 15) {
            input.classList.add("input-large");
          } else if (textLength > 8) {
            input.classList.add("input-medium");
          } else {
            input.classList.add("input-small");
          }
        } else {
          input.classList.remove(
            "has-value",
            "input-small",
            "input-medium",
            "input-large"
          );
        }
      });

      input.addEventListener("focus", () => input.classList.add("focused"));
      input.addEventListener("blur", () => input.classList.remove("focused"));
    } else if (input.type === "radio") {
      if (readingState.answersSoFar[qId] === input.value) {
        input.checked = true;
      }
      input.addEventListener("change", (e) => {
        readingState.answersSoFar[qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    }
  });

  const selects = document.querySelectorAll('select[id^="q"]');
  selects.forEach((select) => {
    const qId = select.dataset.qid || select.id;
    select.value = readingState.answersSoFar[qId] || "";
    select.addEventListener("change", (e) => {
      readingState.answersSoFar[qId] = e.target.value;
      saveState();
      updateQuestionNav();
    });
  });
}

export function renderPassage(index) {
  const passage = readingState.passages[index];

  forceRenderPassageContent(index);

  const questionsList = document.getElementById("questionsList");
  questionsList.innerHTML = "";

  let lastInstruction = null;
  let matchingOptionsShown = false;

  const items = normalizeReadingQuestions(passage.questions);

  items.forEach((item) => {
    if (item.instruction && item.instruction !== lastInstruction) {
      const instructionDiv = document.createElement("div");
      instructionDiv.className = "group-instruction";
      instructionDiv.textContent = item.instruction;
      questionsList.appendChild(instructionDiv);
      lastInstruction = item.instruction;
      matchingOptionsShown = false;
    }

    if (item.kind === "match" && !matchingOptionsShown && item.options.length > 0) {
      const optsDiv = document.createElement("div");
      optsDiv.className = "matching-options-plain";
      optsDiv.textContent = item.options.map((opt) => `${opt.label}. ${opt.text}`).join("\n");
      questionsList.appendChild(optsDiv);
      matchingOptionsShown = true;
    }

    renderItem(item, questionsList, engineCtx);
  });

  requestAnimationFrame(() => {
    restoreHighlights(restoreInputEventListeners);
  });

  document.getElementById("backBtn").style.display =
    index > 0 ? "inline-block" : "none";
  document.getElementById("nextBtn").style.display =
    index < readingState.passages.length - 1 ? "inline-block" : "none";
  document.getElementById("finishBtn").style.display =
    index === readingState.passages.length - 1 ? "inline-block" : "none";
}
