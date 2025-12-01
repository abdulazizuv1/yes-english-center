import { listeningState } from "./state.js";
import { updateQuestionNav } from "./navigation.js";

export function loadSavedAnswers() {
  try {
    const saved = localStorage.getItem("listeningTestAnswers");
    if (saved) listeningState.answersSoFar = JSON.parse(saved);
  } catch (e) {
    listeningState.answersSoFar = {};
  }
}

export function setupAnswerPersistence() {
  document.addEventListener("input", (e) => {
    const target = e.target;
    const qId = target.dataset.qid;
    if (target.classList.contains("gap-fill") && qId) {
      listeningState.answersSoFar[qId] = target.value.trim();
      updateQuestionNav();
      localStorage.setItem(
        "listeningTestAnswers",
        JSON.stringify(listeningState.answersSoFar)
      );
    }
  });

  document.addEventListener("change", (e) => {
    const target = e.target;
    const qId = target.name || target.dataset.qid;
    const groupId = target.dataset.groupId;

    if (!qId && !groupId) return;

    if (target.type === "radio") {
      listeningState.answersSoFar[qId] = target.value;
    } else if (target.type === "checkbox") {
      if (groupId && groupId.includes("_")) {
        // логика multi-select обрабатывается в render через отдельную функцию
      } else if (qId) {
        const checked = Array.from(
          document.querySelectorAll(`input[type="checkbox"][data-qid="${qId}"]`)
        )
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);
        listeningState.answersSoFar[qId] = checked;
      }
    } else if (target.tagName === "SELECT") {
      listeningState.answersSoFar[qId] = target.value;
    }

    updateQuestionNav();
    localStorage.setItem(
      "listeningTestAnswers",
      JSON.stringify(listeningState.answersSoFar)
    );
  });
}


