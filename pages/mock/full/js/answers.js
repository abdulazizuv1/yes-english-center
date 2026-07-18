// Delegated answer capture for every input type + listener restoration
// after highlight-restore replaces reading question HTML.
import { state } from "./state.js";
import { saveState } from "./storage.js";
import { updateQuestionNav } from "./navigation.js";

// Attach the document-level answer listeners (runs once from the entry).
export function setupAnswerCapture() {

document.addEventListener("change", (e) => {
  // Engine-rendered controls (data-qe) manage their own answers
  if (e.target.dataset && e.target.dataset.qe) return;
  if (e.target.type === "checkbox") {
    const qId = e.target.dataset.qid || e.target.name;
    if (e.target.checked) {
      state.answersSoFar[qId] = e.target.value;
    } else {
      delete state.answersSoFar[qId];
    }
    updateQuestionNav();
  }
});

// Event handlers
document.addEventListener("input", (e) => {
  const input = e.target;
  // Engine-rendered controls (data-qe) manage their own answers
  if (input.dataset && input.dataset.qe) return;
  const qId = input.dataset.qid || input.id || input.dataset.questionId;

  if (
    input.classList.contains("gap-fill") ||
    input.classList.contains("gap-fill-input") ||
    input.classList.contains("gap_fill_input") ||
    input.classList.contains("table-input") // ✅ Добавлен новый класс
  ) {
    state.answersSoFar[qId] = input.value;
    saveState();
    updateQuestionNav();
  }
});

document.addEventListener("change", (e) => {
  const input = e.target;
  // Engine-rendered controls (data-qe) manage their own answers
  if (input.dataset && input.dataset.qe) return;
  const qId = input.name || input.dataset.qid || input.id || input.dataset.questionId;

  if (
    input.classList.contains("matching-select") ||
    input.classList.contains("select-input")
  ) {
    state.answersSoFar[qId] = input.value;
    saveState();
    updateQuestionNav();
    return;
  }

  if (input.type === "radio") {
    state.answersSoFar[qId] = input.value;
    saveState();
    updateQuestionNav();
  }

  // ✅ ИСПРАВЛЕННАЯ логика для multi-select чекбоксов
  if (input.type === "checkbox") {
    const groupId = input.dataset.groupId;
    const maxSelections = parseInt(input.dataset.maxSelections) || 3;
    const optionKey = input.dataset.optionKey || input.value;

    if (groupId) {
      const groupContainer = document.querySelector(
        `[data-group-id="${groupId}"]`
      );
      const checkedBoxes = groupContainer.querySelectorAll(
        'input[type="checkbox"]:checked'
      );

      // ✅ Получаем questionIds для этой группы
      let questionIds = [];

      // Находим группу в данных
      let groupData = null;
      for (const section of state.stageData.listening.sections) {
        if (section.content) {
          groupData = section.content.find(
            (item) =>
              item.type === "question-group" &&
              item.groupType === "multi-select" &&
              item.questionId === groupId
          );
          if (groupData) break;
        }
      }

      if (groupData && groupData.questions) {
        questionIds = groupData.questions.map((q) => q.questionId);
      } else {
        // Fallback
        const sectionStart = state.currentSectionIndex * 10 + 1;
        for (let i = 0; i < maxSelections; i++) {
          questionIds.push(`q${sectionStart + i}`);
        }
      }

      if (input.checked) {
        // Проверяем лимит
        if (checkedBoxes.length > maxSelections) {
          input.checked = false;
          alert(`You can only select ${maxSelections} options.`);
          return;
        }

        // Находим первый свободный questionId
        let assignedQuestionId = null;
        for (const qId of questionIds) {
          if (!state.answersSoFar[qId]) {
            assignedQuestionId = qId;
            break;
          }
        }

        if (assignedQuestionId) {
          state.answersSoFar[assignedQuestionId] = optionKey;
        }
      } else {
        // Удаляем ответ
        for (const qId of questionIds) {
          if (state.answersSoFar[qId] === optionKey) {
            delete state.answersSoFar[qId];
            break;
          }
        }
      }

      // ✅ Обновляем счетчик
      const counter = document.getElementById(`counter-${groupId}`);
      if (counter) {
        const newCheckedBoxes = groupContainer.querySelectorAll(
          'input[type="checkbox"]:checked'
        );
        counter.textContent = newCheckedBoxes.length;

        if (newCheckedBoxes.length === maxSelections) {
          counter.style.color = "#059669";
          counter.style.fontWeight = "bold";
        } else {
          counter.style.color = "#0369a1";
          counter.style.fontWeight = "600";
        }
      }

      // ✅ Обновляем стили лейблов
      const label = input.closest("label");
      if (input.checked) {
        label.style.backgroundColor = "#dbeafe";
        label.style.borderColor = "#3b82f6";
        label.style.borderWidth = "2px";
      } else {
        label.style.backgroundColor = "";
        label.style.borderColor = "#d1d5db";
        label.style.borderWidth = "1px";
      }

      saveState();
      updateQuestionNav();
    }
  }
});
}

// Enhanced input event listener restoration
function restoreInputEventListeners() {
  const inputs = document.querySelectorAll(
    'input[data-question-id], input[id^="reading_q"], input[id^="input-"], select[id^="reading_q"]'
  );

  inputs.forEach((input) => {
    const qId = input.dataset.questionId || input.id.replace("input-", "");

    if (input.type === "text") {
      // Text inputs (gap-fill)
      input.value = state.answersSoFar[qId] || "";
      if (input.value) {
        input.classList.add("has-value");
      }

      input.addEventListener("input", (e) => {
        state.answersSoFar[qId] = e.target.value;
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
      // Radio buttons
      if (state.answersSoFar[qId] === input.value) {
        input.checked = true;
      }
      input.addEventListener("change", (e) => {
        state.answersSoFar[qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    }
  });

  // Для select элементов
  const selects = document.querySelectorAll('select[id^="reading_q"]');
  selects.forEach((select) => {
    const qId = select.id;
    select.value = state.answersSoFar[qId] || "";
    select.addEventListener("change", (e) => {
      state.answersSoFar[qId] = e.target.value;
      saveState();
      updateQuestionNav();
    });
  });
  
  // Восстановление состояния для question-group checkboxes
  const groupContainers = document.querySelectorAll("[data-group-id]");
  groupContainers.forEach((container) => {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      // Найти соответствующий question-group
      state.stageData.reading.passages.forEach((passage) => {
        passage.questions.forEach((question) => {
          if (question.type === "question-group" && question.questions) {
            const isSelected = question.questions.some(
              (q) => state.answersSoFar[q.qId] === checkbox.value
            );
            if (isSelected) {
              checkbox.checked = true;
              const label = checkbox.parentElement;
              if (label) {
                label.style.background = "#dbeafe";
                label.style.borderColor = "#3b82f6";
              }
            }
          }
        });
      });
    });
  });
}
export { restoreInputEventListeners };
