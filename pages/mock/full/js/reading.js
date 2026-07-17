// Reading stage: passage rendering, question numbering, every reading
// question type (gap-fill groups, TFNG, matching, MC, YNNG, table, groups).
import { state } from "./state.js";
import { saveCurrentHighlights, restoreHighlights } from "./highlights.js";
import { saveState } from "./storage.js";
import { updateQuestionNav, updateNavigationButtons } from "./navigation.js";

// Initialize Reading
function initializeReading() {
  const passages = state.stageData.reading.passages;
  state.currentPassageIndex = 0;
  assignReadingQuestionIds();
  renderReadingPassage(0);
  
  // Block default context menu in reading stage
  const readingStage = document.getElementById("readingStage");
  if (readingStage) {
    readingStage.addEventListener("contextmenu", function(e) {
      // Only prevent if we don't have selected text (let our custom handler deal with it)
      if (state.selectedText.length === 0) {
        e.preventDefault();
      }
    });
  }
}

function assignReadingQuestionIds() {
  let counter = 1;
  state.orderedQIds = [];
  state.readingPassageCounts = [];

  for (const passage of state.stageData.reading.passages) {
    const before = counter;
    for (const question of passage.questions) {
      if (question.question) {
        question.qId = `reading_q${counter}`; // Add reading prefix
        state.orderedQIds.push(question.qId);
        counter++;
      }

      if (question.type === "question-group" && question.questions) {
        question.questions.forEach((subQ) => {
          subQ.qId = `reading_q${counter}`;
          state.orderedQIds.push(subQ.qId);
          counter++;
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
                const qId = `reading_q${counter}`; // Add reading prefix
                if (!question.qIds) question.qIds = [];
                question.qIds.push(qId);
                state.orderedQIds.push(qId);
                counter++;
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

  // Render questions
  const questionsList = document.getElementById("reading-questions");
  questionsList.innerHTML = "";
  let lastInstruction = null;
  let matchingOptionsShown = false;
  let gapFillGroup = {
    title: null,
    subtitle: null,
    info: null,
    questions: [],
    startDiv: null,
  };

  passage.questions.forEach((q, i) => {
    // Show group instructions
    if (q.groupInstruction && q.groupInstruction !== lastInstruction) {
      if (gapFillGroup.questions.length > 0) {
        renderGapFillGroupComplete(gapFillGroup, questionsList);
        gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
      }
      
      const instructionDiv = document.createElement("div");
      instructionDiv.className = "group-instruction";
      // Render as single block with preserved line breaks to avoid fragmented highlights
      instructionDiv.textContent = q.groupInstruction;
      questionsList.appendChild(instructionDiv);
      lastInstruction = q.groupInstruction;
      matchingOptionsShown = false; // reset when a new instruction starts
    }

    const qDiv = document.createElement("div");
    qDiv.className = "question-item";
    // Assign DOM id for single-question types so navigation can scroll to them
    if (q.qId && q.type !== "gap-fill" && q.type !== "question-group" && q.type !== "table") {
      qDiv.id = q.qId;
    }

    if (q.type === "gap-fill") {
      if (!q.question && (q.title || q.subheading || q.text)) {
        if (gapFillGroup.questions.length > 0) {
          renderGapFillGroupComplete(gapFillGroup, questionsList);
          gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
        }
        
        if (q.title) gapFillGroup.title = q.title;
        if (q.subheading) gapFillGroup.subtitle = q.subheading;
        if (q.text) gapFillGroup.info = q.text;
        gapFillGroup.startDiv = qDiv;
      } else if (q.question && q.qId) {
        gapFillGroup.questions.push(q);
        
        const isLastGapFill = i === passage.questions.length - 1 ||
          passage.questions[i + 1]?.type !== "gap-fill" ||
          (!passage.questions[i + 1]?.question && 
           (passage.questions[i + 1]?.title || passage.questions[i + 1]?.subheading));
        
        if (isLastGapFill) {
          renderGapFillGroupComplete(gapFillGroup, questionsList);
          gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
          return;
        }
      }
      return;
    }
    
    if (gapFillGroup.questions.length > 0) {
      renderGapFillGroupComplete(gapFillGroup, questionsList);
      gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
    }
    
    // For matching types, display shared options once as plain text before the first question in the group
    const isMatchingType = q.type === "paragraph-matching" || q.type === "match-person" || q.type === "match-purpose";
    if (isMatchingType && !matchingOptionsShown && Array.isArray(q.options) && q.options.length > 0) {
      const optsDiv = document.createElement("div");
      optsDiv.className = "matching-options-plain";
      optsDiv.style.cssText = "margin: 10px 0 15px; padding: 10px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; white-space: pre-wrap;";
      const plainText = q.options
        .map((opt) => `${opt.label}. ${opt.text}`)
        .join("\n");
      optsDiv.textContent = plainText;
      questionsList.appendChild(optsDiv);
      matchingOptionsShown = true;
    }
    
    // Render other question types
    switch (q.type) {
      case "text-question":
        renderReadingTextQuestion(q, qDiv);
        break;
      case "true-false-notgiven":
        renderReadingTrueFalseQuestion(q, qDiv);
        break;
      case "paragraph-matching":
      case "match-person":
      case "match-purpose":
        renderReadingMatchingQuestion(q, qDiv);
        break;
      case "multiple-choice":
        renderReadingMultipleChoiceQuestion(q, qDiv);
        break;
      case "yes-no-notgiven":
        renderReadingYesNoQuestion(q, qDiv);
        break;
      case "table":
        renderReadingTableQuestion(q, qDiv);
        break;
      case "question-group":
        renderQuestionGroup(q, qDiv);
        break;
    }

    if (q.type !== "gap-fill" && q.type !== "question-group" && 
        (q.qId || q.type === "text-question" || q.type === "table")) {
      questionsList.appendChild(qDiv);
    } else if (q.type === "question-group") {
      questionsList.appendChild(qDiv);
    }
  });
  
  if (gapFillGroup.questions.length > 0) {
    renderGapFillGroupComplete(gapFillGroup, questionsList);
  }

  updateNavigationButtons();
  
  // Restore highlights after rendering
  requestAnimationFrame(() => {
    restoreHighlights();
  });
}

// New gap-fill group rendering function
function renderGapFillGroupComplete(group, container) {
  if (!group.questions.length) return;

  // Create a single section container for the gap fill group
  const section = document.createElement("div");
  section.className = "gap-fill-section";

  // Add title
  if (group.title) {
    const titleDiv = document.createElement("div");
    titleDiv.className = "gap-fill-title";
    titleDiv.textContent = group.title;
    section.appendChild(titleDiv);
  }

  // Add info
  if (group.info) {
    const infoDiv = document.createElement("div");
    infoDiv.className = "gap-fill-info";
    infoDiv.textContent = group.info;
    section.appendChild(infoDiv);
  }

  // Add subtitle
  if (group.subtitle) {
    const subtitleDiv = document.createElement("div");
    subtitleDiv.className = "gap-fill-subtitle";
    subtitleDiv.textContent = group.subtitle;
    section.appendChild(subtitleDiv);
  }

  // Container for all questions
  const questionsContainer = document.createElement("div");
  questionsContainer.className = "gap-fill-questions";

  // Determine if bullets are used
  const hasBullets = group.questions.some(
    (q) =>
      q.question &&
      (q.question.includes("•") ||
        q.question.includes("●") ||
        q.question.includes("diet consists") ||
        q.question.includes("nests are created"))
  );

  group.questions.forEach((q) => {
    const questionDiv = document.createElement("div");
    questionDiv.className = hasBullets
      ? "gap-fill-list-item"
      : "gap-fill-question";
    questionDiv.id = q.qId;

    if (hasBullets) {
      // Add bullet
      const bullet = document.createElement("span");
      bullet.className = "gap-fill-list-bullet";
      questionDiv.appendChild(bullet);

      // Content wrapper
      const textWrapper = document.createElement("div");
      textWrapper.className = "gap-fill-content-wrapper";

      // Text with input (no number span!)
      const textSpan = document.createElement("span");
      textSpan.className = "gap-fill-text";

      // Clean bullet symbol
      let cleanText = q.question.replace(/^[•●]\s*/, "");

      // Replace blank with input, placeholder set to question number
      const inputHtml = cleanText.replace(
        /\.{3,}|_{3,}|…+|__________+/g,
        `<input type="text"
                id="input-${q.qId}"
                class="gap-fill-input"
                placeholder="${q.qId.replace("reading_q", "")}"
                data-question-id="${q.qId}" />`
      );

      textSpan.innerHTML = inputHtml;

      textWrapper.appendChild(textSpan);
      questionDiv.appendChild(textWrapper);
    } else {
      // No bullets, just the text with input (no number span!)
      const textSpan = document.createElement("span");
      textSpan.className = "gap-fill-text";

      const inputHtml = q.question.replace(
        /\.{3,}|_{3,}|…+|__________+/g,
        `<input type="text"
                id="input-${q.qId}"
                class="gap-fill-input"
                placeholder="${q.qId.replace("reading_q", "")}"
                data-question-id="${q.qId}" />`
      );

      textSpan.innerHTML = inputHtml;
      questionDiv.appendChild(textSpan);
    }

    questionsContainer.appendChild(questionDiv);
  });

  section.appendChild(questionsContainer);
  container.appendChild(section);

  // Add input event listeners
  setTimeout(() => {
    group.questions.forEach((q) => {
      const input = document.getElementById(`input-${q.qId}`);
      if (input) {
        // Set saved value
        input.value = state.answersSoFar[q.qId] || "";

        // Add class if value exists
        if (input.value) {
          input.classList.add("has-value");
        }

        input.addEventListener("input", (e) => {
          state.answersSoFar[q.qId] = e.target.value;
          saveState();
          updateQuestionNav();

          if (e.target.value.trim()) {
            input.classList.add("has-value");
            // Size classes
            const textLength = e.target.value.length;
            input.classList.remove(
              "input-small",
              "input-medium",
              "input-large"
            );
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
        input.addEventListener("focus", (e) => {
          input.classList.add("focused");
        });
        input.addEventListener("blur", (e) => {
          input.classList.remove("focused");
        });
      }
    });
  }, 0);
}

function renderReadingTextQuestion(q, qDiv) {
  if (q.title) {
    qDiv.innerHTML += `<h3>${q.title}</h3>`;
  }
  if (q.subheading) {
    qDiv.innerHTML += `<h4>${q.subheading}</h4>`;
  }
  if (q.text) {
    qDiv.innerHTML += `<p><em>${q.text}</em></p>`;
  }
}

function renderReadingTrueFalseQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  // Extract just the number from qId
  const questionNumber = q.qId.replace("reading_q", "");

  qDiv.innerHTML = `
    <div class="question-number">${questionNumber}</div>
    <div class="question-text">${q.question}</div>
    <div class="radio-group">
      <label class="radio-option">
        <input type="radio" name="${q.qId}" value="TRUE"> TRUE
      </label>
      <label class="radio-option">
        <input type="radio" name="${q.qId}" value="FALSE"> FALSE
      </label>
      <label class="radio-option">
        <input type="radio" name="${q.qId}" value="NOT GIVEN"> NOT GIVEN
      </label>
    </div>
  `;

  setTimeout(() => {
    const radios = document.querySelectorAll(`input[name="${q.qId}"]`);
    radios.forEach((radio) => {
      if (state.answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        state.answersSoFar[q.qId] = e.target.value;
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderReadingMatchingQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  // Extract just the number from qId
  const questionNumber = q.qId.replace("reading_q", "");

  qDiv.innerHTML = `
    <div class="question-number">${questionNumber}</div>
    <div class="question-text">${q.question}</div>
    <select id="${q.qId}" class="select-input">
      <option value="">Choose option</option>
      ${q.options
        ?.map(
          (opt) =>
            `<option value="${opt.label}">${opt.label}: ${opt.text}</option>`
        )
        .join("")}
    </select>
  `;

  setTimeout(() => {
    const select = document.getElementById(q.qId);
    if (select) {
      select.value = state.answersSoFar[q.qId] || "";
      select.addEventListener("change", (e) => {
        state.answersSoFar[q.qId] = e.target.value;
        updateQuestionNav();
      });
    }
  }, 0);
}

function renderReadingMultipleChoiceQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  // Extract just the number from qId
  const questionNumber = q.qId.replace("reading_q", "");

  let optionsHtml = '<div class="radio-group">';
  q.options?.forEach((opt) => {
    optionsHtml += `
      <label class="radio-option">
        <input type="radio" name="${q.qId}" value="${opt.label}"> 
        ${opt.label}. ${opt.text}
      </label>
    `;
  });
  optionsHtml += "</div>";

  qDiv.innerHTML = `
    <div class="question-number">${questionNumber}</div>
    <div class="question-text">${q.question}</div>
    ${optionsHtml}
  `;

  setTimeout(() => {
    const radios = document.querySelectorAll(`input[name="${q.qId}"]`);
    radios.forEach((radio) => {
      if (state.answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        state.answersSoFar[q.qId] = e.target.value;
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderReadingYesNoQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  // Extract just the number from qId
  const questionNumber = q.qId.replace("reading_q", "");

  qDiv.innerHTML = `
    <div class="question-number">${questionNumber}</div>
    <div class="question-text">${q.question}</div>
    <div class="radio-group">
      <label class="radio-option">
        <input type="radio" name="${q.qId}" value="YES"> YES
      </label>
      <label class="radio-option">
        <input type="radio" name="${q.qId}" value="NO"> NO
      </label>
      <label class="radio-option">
        <input type="radio" name="${q.qId}" value="NOT GIVEN"> NOT GIVEN
      </label>
    </div>
  `;

  setTimeout(() => {
    const radios = document.querySelectorAll(`input[name="${q.qId}"]`);
    radios.forEach((radio) => {
      if (state.answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        state.answersSoFar[q.qId] = e.target.value;
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderReadingTableQuestion(q, qDiv) {
  if (q.title) {
    const titleDiv = document.createElement("div");
    titleDiv.style.fontSize = "18px";
    titleDiv.style.fontWeight = "bold";
    titleDiv.style.marginBottom = "15px";
    titleDiv.style.marginTop = "20px";
    titleDiv.textContent = q.title;
    qDiv.appendChild(titleDiv);
  }

  const table = document.createElement("table");
  table.classList.add("question-table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.marginBottom = "20px";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  q.columns.forEach((col) => {
    const th = document.createElement("th");
    th.innerHTML = col;
    th.style.border = "1px solid #ddd";
    th.style.padding = "12px 8px";
    th.style.backgroundColor = "#f8f9fa";
    th.style.fontWeight = "bold";
    th.style.textAlign = "left";
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const columnKeys = q.columns.slice(1).map((col) => col.toLowerCase());
  const tbody = document.createElement("tbody");
  q.rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    tr.style.backgroundColor = rowIndex % 2 === 0 ? "#ffffff" : "#f8f9fa";

    const colName = document.createElement("td");
    colName.innerHTML = row.column || "";
    colName.style.border = "1px solid #ddd";
    colName.style.padding = "12px 8px";
    colName.style.fontWeight = "bold";
    colName.style.backgroundColor = "#f1f3f4";
    tr.appendChild(colName);

    columnKeys.forEach((key) => {
      const td = document.createElement("td");
      const raw = row[key] || "";

      let cellContent = String(raw).replace(
        /___(reading_q\d+)___/g, // Look for reading_q pattern
        function (_, realId) {
          // Extract just the number for display
          const questionNumber = realId.replace("reading_q", "");
          return `<span style="font-weight: bold; color: #1976d2;">${questionNumber}:</span> <input type="text" id="${realId}" class="gap_fill_input" placeholder="Your answer..." style="border: 1px solid #ccc; padding: 4px 8px; border-radius: 4px; margin-left: 5px; min-width: 120px;" value="${
            state.answersSoFar[realId] || ""
          }" />`;
        }
      );

      td.innerHTML = cellContent;
      td.style.border = "1px solid #ddd";
      td.style.padding = "12px 8px";
      td.style.verticalAlign = "top";
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  qDiv.appendChild(table);

  setTimeout(() => {
    const inputs = qDiv.querySelectorAll('input[type="text"]');
    inputs.forEach((input) => {
      const qId = input.id;
      input.value = state.answersSoFar[qId] || "";
      input.addEventListener("input", (e) => {
        state.answersSoFar[qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    });
  }, 0);
}

// Question group rendering function
function renderQuestionGroup(group, qDiv) {
  const groupContainer = document.createElement("div");
  groupContainer.className = "multi-select-group";
  

  if (group.instructions) {
    const instrDiv = document.createElement("p");
    instrDiv.textContent = group.instructions;
    instrDiv.style.cssText = "margin: 0 0 10px 0; font-style: italic; color: #374151;";
    groupContainer.appendChild(instrDiv);
  }

  if (group.text) {
    const textDiv = document.createElement("h4");
    textDiv.textContent = group.text;
    textDiv.style.cssText = "margin: 0 0 20px 0; color: #1f2937;";
    groupContainer.appendChild(textDiv);
  }

  // Создаем скрытые элементы для каждого вопроса (для навигации)
  group.questions.forEach((q) => {
    const hiddenMarker = document.createElement("div");
    hiddenMarker.id = q.qId;
    hiddenMarker.style.display = "none";
    hiddenMarker.dataset.questionGroup = "true";
    groupContainer.appendChild(hiddenMarker);
  });

  // Опции с чекбоксами
  const optionsContainer = document.createElement("div");
  optionsContainer.className = "multi-select-options";
  optionsContainer.dataset.groupQids = group.questions
    .map((q) => q.qId)
    .join(",");

  // Получаем уже выбранные ответы
  const selectedAnswers = [];
  group.questions.forEach((q) => {
    if (state.answersSoFar[q.qId]) {
      selectedAnswers.push(state.answersSoFar[q.qId]);
    }
  });

  Object.keys(group.options)
    .sort()
    .forEach((key) => {
      const optionDiv = document.createElement("label");
      optionDiv.style.cssText =
        "display: block; margin: 10px 0; padding: 12px; border: 2px solid #d1d5db; border-radius: 6px; cursor: pointer; transition: all 0.2s;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = key;
      checkbox.className = "multi-select-checkbox";
      checkbox.dataset.groupQids = group.questions.map((q) => q.qId).join(",");

      // Проверяем, выбрана ли эта опция
      if (selectedAnswers.includes(key)) {
        checkbox.checked = true;
        optionDiv.style.background = "#dbeafe";
        optionDiv.style.borderColor = "#3b82f6";
      }

      const textSpan = document.createElement("span");
      textSpan.style.marginLeft = "10px";
      textSpan.innerHTML = `<strong>${key}.</strong> ${group.options[key]}`;

      optionDiv.appendChild(checkbox);
      optionDiv.appendChild(textSpan);
      optionsContainer.appendChild(optionDiv);
    });

  groupContainer.appendChild(optionsContainer);

  // Добавляем индикатор выбранных опций
  const indicator = document.createElement("div");
  indicator.className = "selection-indicator";
  indicator.style.cssText =
    "margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 4px; font-size: 0.9em;";
  indicator.textContent = `Select ${group.questions.length} options (${selectedAnswers.length} selected)`;
  groupContainer.appendChild(indicator);

  qDiv.appendChild(groupContainer);

  // Добавляем обработчики событий
  setTimeout(() => {
    const checkboxes = optionsContainer.querySelectorAll(
      ".multi-select-checkbox"
    );
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        handleMultiSelectChange(group, optionsContainer);
      });
    });
  }, 0);
}

function handleMultiSelectChange(group, container) {
  const checkboxes = container.querySelectorAll(".multi-select-checkbox");
  const selected = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value)
    .sort(); 

  const maxAllowed = group.questions.length;

  if (selected.length > maxAllowed) {
    alert(`Please select exactly ${maxAllowed} options.`);
    checkboxes.forEach((cb) => {
      if (
        cb.checked &&
        !group.questions.some((q) => state.answersSoFar[q.qId] === cb.value)
      ) {
        cb.checked = false;
      }
    });
    return;
  }

  group.questions.forEach((q) => {
    delete state.answersSoFar[q.qId];
  });

  // Назначаем новые ответы последовательно
  selected.forEach((value, index) => {
    if (group.questions[index]) {
      state.answersSoFar[group.questions[index].qId] = value;
    }
  });

  // Обновляем визуальное состояние
  checkboxes.forEach((cb) => {
    const label = cb.parentElement;
    if (cb.checked) {
      label.style.background = "#dbeafe";
      label.style.borderColor = "#3b82f6";
    } else {
      label.style.background = "";
      label.style.borderColor = "#d1d5db";
    }
  });

  // Обновляем индикатор
  const indicator = container.parentElement.querySelector(
    ".selection-indicator"
  );
  if (indicator) {
    indicator.textContent = `Select ${maxAllowed} options (${selected.length} selected)`;
    if (selected.length === maxAllowed) {
      indicator.style.background = "#d1fae5";
    } else {
      indicator.style.background = "#fef3c7";
    }
  }

  saveState();
  updateQuestionNav();
}
export { initializeReading, renderReadingPassage, readingPassageOfQuestion };
