import { readingState } from "./state.js";
import { restoreHighlights } from "./highlights.js";
import { saveState } from "./storage.js";
import { updateQuestionNav } from "./navigation.js";

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

  requestAnimationFrame(() => {
    // highlights module restores passage content if there is saved HTML
  });
}

export function restoreInputEventListeners() {
  const inputs = document.querySelectorAll(
    'input[data-question-id], input[id^="q"], input[id^="input-"], select[id^="q"]'
  );

  inputs.forEach((input) => {
    const qId = input.dataset.questionId || input.id.replace("input-", "");

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
    const qId = select.id;
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

  if (readingState.currentPassageIndex !== index) {
    // highlights module has own save function; caller should handle if needed
  }

  forceRenderPassageContent(index);

  const questionsList = document.getElementById("questionsList");
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
    if (q.groupInstruction && q.groupInstruction !== lastInstruction) {
      if (gapFillGroup.questions.length > 0) {
        renderGapFillGroupComplete(gapFillGroup, questionsList);
        gapFillGroup = {
          title: null,
          subtitle: null,
          info: null,
          questions: [],
          startDiv: null,
        };
      }

      const instructionDiv = document.createElement("div");
      instructionDiv.className = "group-instruction";
      instructionDiv.textContent = q.groupInstruction;
      questionsList.appendChild(instructionDiv);
      lastInstruction = q.groupInstruction;
      matchingOptionsShown = false;
    }

    const qDiv = document.createElement("div");
    qDiv.className = "question-item";
    if (q.qId && q.type !== "gap-fill" && q.type !== "question-group" && q.type !== "table") {
      qDiv.id = q.qId;
    }

    if (q.type === "gap-fill") {
      if (!q.question && (q.title || q.subheading || q.text)) {
        if (gapFillGroup.questions.length > 0) {
          renderGapFillGroupComplete(gapFillGroup, questionsList);
          gapFillGroup = {
            title: null,
            subtitle: null,
            info: null,
            questions: [],
            startDiv: null,
          };
        }

        if (q.title) gapFillGroup.title = q.title;
        if (q.subheading) gapFillGroup.subtitle = q.subheading;
        if (q.text) gapFillGroup.info = q.text;
        gapFillGroup.startDiv = qDiv;
      } else if (q.question && q.qId) {
        gapFillGroup.questions.push(q);

        const isLastGapFill =
          i === passage.questions.length - 1 ||
          passage.questions[i + 1]?.type !== "gap-fill" ||
          (!passage.questions[i + 1]?.question &&
            (passage.questions[i + 1]?.title || passage.questions[i + 1]?.subheading));

        if (isLastGapFill) {
          renderGapFillGroupComplete(gapFillGroup, questionsList);
          gapFillGroup = {
            title: null,
            subtitle: null,
            info: null,
            questions: [],
            startDiv: null,
          };
          return;
        }
      }
      return;
    }

    if (gapFillGroup.questions.length > 0) {
      renderGapFillGroupComplete(gapFillGroup, questionsList);
      gapFillGroup = {
        title: null,
        subtitle: null,
        info: null,
        questions: [],
        startDiv: null,
      };
    }

    const isMatchingType =
      q.type === "paragraph-matching" || q.type === "match-person" || q.type === "match-purpose";
    if (isMatchingType && !matchingOptionsShown && Array.isArray(q.options) && q.options.length > 0) {
      const optsDiv = document.createElement("div");
      optsDiv.className = "matching-options-plain";
      const plainText = q.options.map((opt) => `${opt.label}. ${opt.text}`).join("\n");
      optsDiv.textContent = plainText;
      questionsList.appendChild(optsDiv);
      matchingOptionsShown = true;
    }

    switch (q.type) {
      case "text-question":
        renderTextQuestion(q, qDiv);
        break;
      case "true-false-notgiven":
        renderTrueFalseQuestion(q, qDiv);
        break;
      case "paragraph-matching":
      case "match-person":
      case "match-purpose":
        renderMatchingQuestion(q, qDiv);
        break;
      case "multiple-choice":
        renderMultipleChoiceQuestion(q, qDiv);
        break;
      case "yes-no-notgiven":
        renderYesNoQuestion(q, qDiv);
        break;
      case "table":
        renderTableQuestion(q, qDiv);
        break;
      case "question-group":
        renderQuestionGroup(q, qDiv);
        break;
    }

    if (
      q.type !== "gap-fill" &&
      q.type !== "question-group" &&
      (q.qId || q.type === "text-question" || q.type === "table")
    ) {
      questionsList.appendChild(qDiv);
    } else if (q.type === "question-group") {
      questionsList.appendChild(qDiv);
    }
  });

  if (gapFillGroup.questions.length > 0) {
    renderGapFillGroupComplete(gapFillGroup, questionsList);
  }

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

function renderGapFillGroupComplete(group, container) {
  if (!group.questions.length) return;

  const section = document.createElement("div");
  section.className = "gap-fill-section";

  if (group.title) {
    const titleDiv = document.createElement("div");
    titleDiv.className = "gap-fill-title";
    titleDiv.textContent = group.title;
    section.appendChild(titleDiv);
  }

  if (group.info) {
    const infoDiv = document.createElement("div");
    infoDiv.className = "gap-fill-info";
    infoDiv.textContent = group.info;
    section.appendChild(infoDiv);
  }

  if (group.subtitle) {
    const subtitleDiv = document.createElement("div");
    subtitleDiv.className = "gap-fill-subtitle";
    subtitleDiv.textContent = group.subtitle;
    section.appendChild(subtitleDiv);
  }

  const questionsContainer = document.createElement("div");
  questionsContainer.className = "gap-fill-questions";

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
    questionDiv.className = hasBullets ? "gap-fill-list-item" : "gap-fill-question";
    questionDiv.id = q.qId;

    if (hasBullets) {
      const bullet = document.createElement("span");
      bullet.className = "gap-fill-list-bullet";
      questionDiv.appendChild(bullet);

      const textWrapper = document.createElement("div");
      textWrapper.className = "gap-fill-content-wrapper";

      const textSpan = document.createElement("span");
      textSpan.className = "gap-fill-text";

      let cleanText = q.question.replace(/^[•●]\s*/, "");

      const inputHtml = cleanText.replace(
        /\.{3,}|_{3,}|…+|__________+/g,
        `<input type="text"
                id="input-${q.qId}"
                class="gap-fill-input"
                placeholder="${q.qId.replace("q", "")}"
                data-question-id="${q.qId}" />`
      );

      textSpan.innerHTML = inputHtml;

      textWrapper.appendChild(textSpan);
      questionDiv.appendChild(textWrapper);
    } else {
      const textSpan = document.createElement("span");
      textSpan.className = "gap-fill-text";

      const inputHtml = q.question.replace(
        /\.{3,}|_{3,}|…+|__________+/g,
        `<input type="text"
                id="input-${q.qId}"
                class="gap-fill-input"
                placeholder="${q.qId.replace("q", "")}"
                data-question-id="${q.qId}" />`
      );

      textSpan.innerHTML = inputHtml;
      questionDiv.appendChild(textSpan);
    }

    questionsContainer.appendChild(questionDiv);
  });

  section.appendChild(questionsContainer);
  container.appendChild(section);

  setTimeout(() => {
    group.questions.forEach((q) => {
      const input = document.getElementById(`input-${q.qId}`);
      if (input) {
        input.value = readingState.answersSoFar[q.qId] || "";

        if (input.value) {
          input.classList.add("has-value");
        }

        input.addEventListener("input", (e) => {
          readingState.answersSoFar[q.qId] = e.target.value;
          saveState();
          updateQuestionNav();

          if (e.target.value.trim()) {
            input.classList.add("has-value");
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
        input.addEventListener("focus", () => {
          input.classList.add("focused");
        });
        input.addEventListener("blur", () => {
          input.classList.remove("focused");
        });
      }
    });
  }, 0);
}

function renderTextQuestion(q, qDiv) {
  if (q.title) {
    qDiv.innerHTML += `<h3>${q.title}</h3>`;
  }
  if (q.subheading) {
    qDiv.innerHTML += `<h4>${q.subheading}</h4>`;
  }
  if (q.text) {
    qDiv.innerHTML += `<p>${q.text}</p>`;
  }
}

function renderTrueFalseQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  qDiv.innerHTML = `
       <div class="question-number">${q.qId
         .toUpperCase()
         .replace("Q", "")}</div>
       <div class="question-text">${q.question}</div>
       <div class="radio-group">
           <label class="radio-option">
               <input type="radio" name="${q.qId}" value="TRUE" data-question-id="${q.qId}"> TRUE
           </label>
           <label class="radio-option">
               <input type="radio" name="${q.qId}" value="FALSE" data-question-id="${q.qId}"> FALSE
           </label>
           <label class="radio-option">
               <input type="radio" name="${q.qId}" value="NOT GIVEN" data-question-id="${q.qId}"> NOT GIVEN
           </label>
       </div>
   `;

  setTimeout(() => {
    const radios = document.querySelectorAll(`input[name="${q.qId}"]`);
    radios.forEach((radio) => {
      if (readingState.answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        readingState.answersSoFar[q.qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderMatchingQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  qDiv.innerHTML = `
       <div class="question-number">${q.qId
         .toUpperCase()
         .replace("Q", "")}</div>
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
      select.value = readingState.answersSoFar[q.qId] || "";
      select.addEventListener("change", (e) => {
        readingState.answersSoFar[q.qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    }
  }, 0);
}

function renderMultipleChoiceQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  let optionsHtml = '<div class="radio-group">';
  q.options?.forEach((opt) => {
    optionsHtml += `
           <label class="radio-option">
               <input type="radio" name="${q.qId}" value="${opt.label}" data-question-id="${q.qId}"> 
               <span class="mc-option-text"><strong>${opt.label}.</strong> ${opt.text}</span>
           </label>
       `;
  });
  optionsHtml += "</div>";

  qDiv.innerHTML = `
       <div class="question-number">${q.qId
         .toUpperCase()
         .replace("Q", "")}</div>
       <div class="question-text">${q.question}</div>
       ${optionsHtml}
   `;

  setTimeout(() => {
    const radios = document.querySelectorAll(`input[name="${q.qId}"]`);
    radios.forEach((radio) => {
      if (readingState.answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        readingState.answersSoFar[q.qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderYesNoQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  qDiv.innerHTML = `
       <div class="question-number">${q.qId
         .toUpperCase()
         .replace("Q", "")}</div>
       <div class="question-text">${q.question}</div>
       <div class="radio-group">
           <label class="radio-option">
               <input type="radio" name="${q.qId}" value="YES" data-question-id="${q.qId}"> YES
           </label>
           <label class="radio-option">
               <input type="radio" name="${q.qId}" value="NO" data-question-id="${q.qId}"> NO
           </label>
           <label class="radio-option">
               <input type="radio" name="${q.qId}" value="NOT GIVEN" data-question-id="${q.qId}"> NOT GIVEN
           </label>
       </div>
   `;

  setTimeout(() => {
    const radios = document.querySelectorAll(`input[name="${q.qId}"]`);
    radios.forEach((radio) => {
      if (readingState.answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        readingState.answersSoFar[q.qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderTableQuestion(q, qDiv) {
  if (!q.columns || !q.rows) return;

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
        /___(q\d+)___/g,
        function (_, realId) {
          return `<span style="font-weight: bold; color: #1976d2;">${realId
            .toUpperCase()
            .replace(
              "Q",
              ""
            )}:</span> <input type="text" id="${realId}" class="gap_fill_input" placeholder="Your answer..." style="border: 1px solid #ccc; padding: 4px 8px; border-radius: 4px; margin-left: 5px; min-width: 120px;" value="${
            readingState.answersSoFar[realId] || ""
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
      input.value = readingState.answersSoFar[qId] || "";
      input.addEventListener("input", (e) => {
        readingState.answersSoFar[qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderQuestionGroup(group, qDiv) {
  const groupContainer = document.createElement("div");
  groupContainer.className = "multi-select-group";

  if (group.text) {
    const textDiv = document.createElement("h4");
    textDiv.textContent = group.text;
    textDiv.style.cssText = "margin: 0 0 20px 0; color: #1f2937;";
    groupContainer.appendChild(textDiv);
  }

  group.questions.forEach((q) => {
    const hiddenMarker = document.createElement("div");
    hiddenMarker.id = q.qId;
    hiddenMarker.style.display = "none";
    hiddenMarker.dataset.questionGroup = "true";
    groupContainer.appendChild(hiddenMarker);
  });

  const optionsContainer = document.createElement("div");
  optionsContainer.className = "multi-select-options";
  optionsContainer.dataset.groupQids = group.questions.map((q) => q.qId).join(",");

  const selectedAnswers = [];
  group.questions.forEach((q) => {
    if (readingState.answersSoFar[q.qId]) {
      selectedAnswers.push(readingState.answersSoFar[q.qId]);
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

  const indicator = document.createElement("div");
  indicator.className = "selection-indicator";
  indicator.style.cssText =
    "margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 4px; font-size: 0.9em;";
  indicator.textContent = `Select ${group.questions.length} options (${selectedAnswers.length} selected)`;
  groupContainer.appendChild(indicator);

  qDiv.appendChild(groupContainer);

  setTimeout(() => {
    const checkboxes = optionsContainer.querySelectorAll(".multi-select-checkbox");
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
        !group.questions.some((q) => readingState.answersSoFar[q.qId] === cb.value)
      ) {
        cb.checked = false;
      }
    });
    return;
  }

  group.questions.forEach((q) => {
    delete readingState.answersSoFar[q.qId];
  });

  selected.forEach((value, index) => {
    if (group.questions[index]) {
      readingState.answersSoFar[group.questions[index].qId] = value;
    }
  });

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

  const indicator = container.parentElement.querySelector(".selection-indicator");
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


