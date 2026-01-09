import { readingState } from "./state.js";

export function loadSavedState() {
  const saved = localStorage.getItem(readingState.testStorageKey);
  if (saved) {
    const data = JSON.parse(saved);
    readingState.answersSoFar = data.answers || {};
    readingState.passageHighlights = data.passageHighlights || {};
    readingState.questionHighlights = data.questionHighlights || {};
  }
}

export function saveState() {
  const data = {
    answers: readingState.answersSoFar,
    passageHighlights: readingState.passageHighlights,
    questionHighlights: readingState.questionHighlights,
    timestamp: Date.now(),
  };
  localStorage.setItem(readingState.testStorageKey, JSON.stringify(data));
}

export function assignQuestionIds() {
  let counter = 1;
  for (const passage of readingState.passages) {
    for (const question of passage.questions) {
      if (question.type === "question-group" && question.questions) {
        question.questions.forEach((subQ) => {
          subQ.qId = `q${counter}`;
          subQ.parentGroup = question;
          readingState.orderedQIds.push(subQ.qId);
          counter++;
        });
        question.qIds = question.questions.map((q) => q.qId);
      } else if (question.question) {
        question.qId = `q${counter}`;
        readingState.orderedQIds.push(question.qId);
        counter++;
      } else if (question.type === "table") {
        const columnKeys = question.columns
          .slice(1)
          .map((col) => col.toLowerCase());
        for (const row of question.rows) {
          for (const key of columnKeys) {
            if (typeof row[key] === "string" && row[key].includes("___q")) {
              row[key] = row[key].replace(/___q\d+___/g, () => {
                const qId = `q${counter}`;
                if (!question.qIds) question.qIds = [];
                question.qIds.push(qId);
                readingState.orderedQIds.push(qId);
                counter++;
                return `___${qId}___`;
              });
            }
          }
        }
      }
    }
  }
}

export function clearReadingAnswers() {
  // Clear in-memory answers and highlights
  readingState.answersSoFar = {};
  readingState.passageHighlights = {};
  readingState.questionHighlights = {};

  // Clear localStorage for this test
  try {
    localStorage.removeItem(readingState.testStorageKey);
  } catch (e) {
    console.warn('Failed to clear reading storage:', e);
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
    el.classList && el.classList.remove('has-value');
  });

  // Remove highlight spans
  document.querySelectorAll('.highlighted').forEach((node) => {
    const parent = node.parentNode;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    node.remove();
  });

  // Update UI/navigation and persist cleared state
  try {
    saveState();
  } catch (e) {
    console.warn('saveState not available after clear', e);
  }

  try {
    import("./navigation.js").then((mod) => {
      if (mod.updateQuestionNav) mod.updateQuestionNav();
    });
  } catch (e) {
    if (window.updateQuestionNav) window.updateQuestionNav();
  }
}


