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
    const questionIds = target.dataset.questionIds;

    if (!qId && !groupId) return;

    if (target.type === "radio") {
      listeningState.answersSoFar[qId] = target.value;
    } else if (target.type === "checkbox") {
      if (groupId && questionIds) {
        // Multi-select группа: распределяем выбранные опции по вопросам
        const questionIdsArray = questionIds.split(",");
        const allCheckboxes = Array.from(
          document.querySelectorAll(`input[type="checkbox"][data-group-id="${groupId}"]`)
        );
        const checkedOptions = allCheckboxes
          .filter((cb) => cb.checked)
          .map((cb) => cb.value)
          .sort(); // Сортируем для консистентности

        // Распределяем выбранные опции по вопросам по порядку
        // Каждая опция назначается следующему вопросу
        questionIdsArray.forEach((qId, index) => {
          if (index < checkedOptions.length) {
            listeningState.answersSoFar[qId] = checkedOptions[index];
          } else {
            // Если опций меньше, чем вопросов, очищаем оставшиеся
            listeningState.answersSoFar[qId] = null;
          }
        });
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


