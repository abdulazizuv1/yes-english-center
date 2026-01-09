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

export function clearListeningAnswers() {
  // Clear in-memory answers and saved highlights
  listeningState.answersSoFar = {};
  listeningState.savedHighlights = {};

  // Clear localStorage
  try {
    localStorage.removeItem('listeningTestAnswers');
  } catch (e) {
    console.warn('Failed to clear listening storage:', e);
  }

  // Clear inputs/selects/radios/checkboxes in the DOM
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach((el) => {
    if (el.tagName === 'INPUT') {
      const t = el.type.toLowerCase();
      if (t === 'radio' || t === 'checkbox') el.checked = false;
      else el.value = '';
    } else if (el.tagName === 'TEXTAREA') {
      el.value = '';
    } else if (el.tagName === 'SELECT') {
      el.selectedIndex = 0;
    }
  });

  // Remove highlight spans
  document.querySelectorAll('.highlighted').forEach((node) => {
    const parent = node.parentNode;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    node.remove();
  });

  // Update navigation/UI and persist cleared state
  try {
    localStorage.setItem('listeningTestAnswers', JSON.stringify(listeningState.answersSoFar));
  } catch (e) {
    console.warn('Failed to persist cleared listening answers', e);
  }

  try {
    import('./navigation.js').then((mod) => {
      if (mod.updateQuestionNav) mod.updateQuestionNav();
    });
  } catch (e) {
    if (window.updateQuestionNav) window.updateQuestionNav();
  }
}


