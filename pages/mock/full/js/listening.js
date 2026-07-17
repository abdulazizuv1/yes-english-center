// Listening stage: section rendering, instruction bands, every listening
// question type (gap-fill, TFNG, MC, multi-select, matching, table).
import { state } from "./state.js";
import { handleSectionAudio } from "./audio.js";
import { saveCurrentHighlights, restoreHighlights } from "./highlights.js";
import { updateNavigationButtons } from "./navigation.js";

function extractMaxSelections(text) {
  const matches = text.match(
    /choose\s+(\w+)|select\s+(\w+)|(\d+)\s+(?:letters|options|answers)/i
  );
  if (matches) {
    if (matches[3]) return parseInt(matches[3]);
    const word = matches[1] || matches[2];
    const wordMap = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    return wordMap[word.toLowerCase()] || 3;
  }
  return 3;
}

// Tracks the last group instruction shown while rendering a section so the
// same instruction isn't repeated before every question in the group.
let lastListeningInstruction = null;
// True from the moment an instruction band renders until the first gradeable
// item after it — a text/subheading in that window that merely repeats part
// of the band (same sentence saved in both places) is skipped.
let listeningInstructionFresh = false;

// Initialize Listening
function initializeListening() {
  normalizeListeningQuestionIds(state.stageData.listening.sections);
  state.currentSectionIndex = 0;
  state.audioInitialized = false; // Сбрасываем флаг аудио
  state.currentAudioSection = 0;   // Сбрасываем текущую секцию аудио
  renderListeningSection(0);
}

// Ensures every gradeable listening item has a questionId, and repairs
// multi-select groups saved with only `correctAnswers` (no `questions[]`),
// which older add-tool exports produced (e.g. full mock test 15). A single
// running counter walks all sections so synthesized IDs slot into the real
// 1–40 sequence.
function normalizeListeningQuestionIds(sections) {
  if (!Array.isArray(sections)) return;
  let n = 1;
  const sync = (id) => {
    const num = parseInt(String(id).replace(/\D/g, ""), 10);
    if (Number.isFinite(num)) n = num + 1;
  };
  for (const section of sections) {
    for (const item of section.content || []) {
      if (item.type === "question") {
        if (!item.questionId) item.questionId = `q${n}`;
        sync(item.questionId);
      } else if (item.type === "question-group") {
        if (Array.isArray(item.questions) && item.questions.length) {
          item.questions.forEach((q) => {
            if (!q.questionId) q.questionId = `q${n}`;
            sync(q.questionId);
          });
        } else if (Array.isArray(item.correctAnswers) && item.correctAnswers.length) {
          const start = n;
          item.questions = item.correctAnswers.map((ans, i) => ({
            questionId: `q${start + i}`,
            correctAnswer: ans,
          }));
          n = start + item.correctAnswers.length;
        }
        const ids = (item.questions || []).map((q) => q.questionId);
        if (ids.length && !item.questionId) {
          const first = parseInt(ids[0].slice(1), 10);
          const last = parseInt(ids[ids.length - 1].slice(1), 10);
          item.questionId = last > first ? `q${first}_${last}` : `q${first}`;
        }
      } else if (item.type === "table") {
        // Advance the counter past any ___qN___ placeholders in the cells
        const nums = (JSON.stringify(item).match(/q(\d+)/g) || [])
          .map((s) => parseInt(s.slice(1), 10))
          .filter(Number.isFinite);
        if (nums.length) n = Math.max(n, Math.max(...nums) + 1);
      }
    }
  }
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
  // per-item groupInstruction blocks then render inline as the content
  // flows (see renderListeningInstructionFor).
  lastListeningInstruction = null;
  listeningInstructionFresh = false;
  const content = Array.isArray(section.content) ? section.content : [];

  if (section.instructions && typeof section.instructions === "object") {
    const { heading, details, note } = section.instructions;
    if (heading || details || note) {
      questionList.innerHTML += `
        <div class="group-instruction">
          ${heading ? `<strong>${heading}</strong><br>` : ""}
          ${details || ""}${note ? `<br><em>${note}</em>` : ""}
        </div>
      `;
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
    questionList.innerHTML += `<div class="group-instruction">${instructionBlockHTML(text)}</div>`;
    lastListeningInstruction = norm;
    listeningInstructionFresh = true;
  });

  content.forEach((item) => renderListeningContentItem(item));

  questionList.innerHTML += `</div>`;

  updateNavigationButtons();
  
  // Restore highlights after rendering
  setTimeout(() => {
    restoreHighlights();
  }, 150);
}

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

function renderListeningContentItem(item, itemIndex) {
  const questionList = document.getElementById("listening-questions");

  // Show the shared instruction ahead of ANY item that carries one — text
  // blocks and subheadings included, not just gradeable questions.
  renderListeningInstructionFor(item);

  if (item.type) {
    switch (item.type) {
      case "text":
      case "subheading": {
        const value = item.value || item.text || "";
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
          break;
        }
        questionList.innerHTML +=
          item.type === "text"
            ? `<p class="listening-text">${value}</p>`
            : `<h4 class="listening-subheading">${value}</h4>`;
        break;
      }

      case "question":
        listeningInstructionFresh = false;
        renderListeningQuestion(item);
        break;

      case "question-group":
        listeningInstructionFresh = false;
        renderListeningQuestionGroup(item);
        break;
      case "table":
        listeningInstructionFresh = false;
        renderListeningTable(item);
        break;
    }
  }
}

function renderListeningQuestion(question) {
  const qId = question.questionId; // ✅ БЕЗ префикса listening_
  const questionList = document.getElementById("listening-questions");

  const questionDiv = document.createElement("div");
  questionDiv.className = "question-item";
  questionDiv.id = qId; // ✅ БЕЗ префикса

  if (question.format === "gap-fill") {
    const number = qId.toUpperCase().replace("Q", "");
    const questionText = question.text || "";
    const safeVal = String(state.answersSoFar[qId] ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");

    // Real exam look: the question number is a small box glued to the input,
    // sitting inline exactly where the blank is in the sentence.
    const gapHtml = `<span class="gap-inline"><span class="gap-num">${number}</span><input type="text" data-qid="${qId}" class="gap-fill-input" placeholder=" " value="${safeVal}" /></span>`;

    const blankRe = /(\d+)\s*_+|_+\s*(\d+)|_+/; // first blank marker only
    let inputHtml = blankRe.test(questionText)
      ? questionText.replace(blankRe, gapHtml)
      : `${questionText} ${gapHtml}`;
    if (question.postfix) {
      inputHtml += ` <span class="gap-postfix">${question.postfix}</span>`;
    }

    questionDiv.classList.add("gap-fill-item");
    questionDiv.innerHTML = `<div class="question-text">${inputHtml}</div>`;
  } else if (question.format === "true-false-notgiven") {
    const number = qId.toUpperCase().replace("Q", "");
    const tfOptions = ["TRUE", "FALSE", "NOT GIVEN"];
    questionDiv.innerHTML = `
      <div class="question-number">${number}</div>
      <div class="question-text">
        ${question.text || ""}
        <div class="radio-group">
          ${tfOptions
            .map(
              (opt) => `
            <label class="radio-option">
              <input type="radio" name="${qId}" value="${opt}" ${
                state.answersSoFar[qId] === opt ? "checked" : ""
              }/>
              ${opt}
            </label>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  } else if (question.format === "multiple-choice") {
    let optionsHtml = '<div class="radio-group">';

    Object.keys(question.options)
      .sort()
      .forEach((key) => {
        const checked = state.answersSoFar[qId] === key ? "checked" : "";
        optionsHtml += `
        <label class="radio-option">
          <input type="radio" name="${qId}" value="${key}" ${checked}/> 
          ${key}. ${question.options[key]}
        </label>
      `;
      });

    optionsHtml += "</div>";

    const number = qId.toUpperCase().replace("Q", "");
    questionDiv.innerHTML = `
      <div class="question-number">${number}</div>
      <div class="question-text">
        ${question.text}
        ${optionsHtml}
      </div>
    `;
  }

  questionList.appendChild(questionDiv);
}

function renderListeningQuestionGroup(group) {
  if (group.groupType === "multi-select") {
    renderListeningMultiSelectGroup(group);
  } else if (group.groupType === "matching") {
    renderListeningMatchingGroup(group);
  }
}

function renderListeningMultiSelectGroup(group) {
  const maxSelections =
    (group.questions && group.questions.length) ||
    extractMaxSelections(group.groupInstruction || group.text || "");
  const groupQId = group.questionId;
  const questionList = document.getElementById("listening-questions");

  const groupDiv = document.createElement("div");
  groupDiv.className = "multi-select-group";
  groupDiv.id = groupQId;

  // ✅ ИСПРАВЛЕНО: Получаем реальные номера вопросов
  let questionIds = [];
  if (group.questions && Array.isArray(group.questions)) {
    questionIds = group.questions.map((q) => q.questionId);
  } else {
    // Если нет group.questions, генерируем нужное количество ID
    // На основе maxSelections, а не количества опций
    const sectionStart = state.currentSectionIndex * 10 + 1;

    for (let i = 0; i < maxSelections; i++) {
      questionIds.push(`q${sectionStart + i}`);
    }
  }
  groupDiv.innerHTML = `
    <div data-group-id="${groupQId}" class="multi-select-box">
      ${group.text ? `<p class="group-stem">${group.text}</p>` : ""}
      <div class="selection-counter">
        Selected: <span id="counter-${groupQId}">0</span> / ${maxSelections}
      </div>
      <div class="radio-group">
        ${Object.keys(group.options)
          .sort()
          .map((key) => {
            // ✅ ИСПРАВЛЕНО: Показываем ВСЕ опции, но связываем только с нужными вопросами
            // Проверяем, есть ли ответ для этого ключа среди наших questionIds
            let isChecked = false;
            let linkedQuestionId = null;

            // Ищем, есть ли ответ с этим значением среди наших вопросов
            for (const qId of questionIds) {
              if (state.answersSoFar[qId] === key) {
                isChecked = true;
                linkedQuestionId = qId;
                break;
              }
            }

            return `
            <label class="radio-option">
              <input type="checkbox" 
                data-option-key="${key}"
                data-group-id="${groupQId}" 
                data-max-selections="${maxSelections}"
                value="${key}" 
                ${isChecked ? "checked" : ""}/>
              ${key}. ${group.options[key]}
            </label>
          `;
          })
          .join("")}
      </div>
    </div>
  `;

  questionList.appendChild(groupDiv);

  // ✅ Подсчитываем уже выбранные элементы
  setTimeout(() => {
    const groupContainer = document.querySelector(
      `[data-group-id="${groupQId}"]`
    );

    if (groupContainer) {
      const counter = document.getElementById(`counter-${groupQId}`);
      const checkedBoxes = groupContainer.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      if (counter) {
        counter.textContent = checkedBoxes.length;
      }
    }
  }, 100);
}

function renderListeningMatchingGroup(group) {
  const groupQId = group.questionId; // ✅ БЕЗ префикса listening_
  const questionList = document.getElementById("listening-questions");

  const groupDiv = document.createElement("div");
  groupDiv.className = "matching-group";

  groupDiv.innerHTML = `
    <div class="matching-options-box">
      ${group.text ? `<p class="group-stem">${group.text}</p>` : ""}
      ${Object.keys(group.options)
        .sort()
        .map(
          (key) =>
            `<p style="margin: 5px 0;"><strong>${key}</strong> ${group.options[key]}</p>`
        )
        .join("")}
    </div>
  `;

  group.questions.forEach((matchQ) => {
    const qId = matchQ.questionId; // ✅ БЕЗ префикса listening_
    const matchingDiv = document.createElement("div");
    matchingDiv.className = "matching-question";
    matchingDiv.id = qId;

    matchingDiv.innerHTML = `
      <div class="question-number">${qId.replace("q", "")}</div>
      <div class="matching-question-text">${matchQ.text}</div>
      <select data-qid="${qId}" class="matching-select">
        <option value="">Select...</option>
        ${Object.keys(group.options)
          .sort()
          .map(
            (key) =>
              `<option value="${key}" ${
                state.answersSoFar[qId] === key ? "selected" : ""
              }>${key}. ${group.options[key]}</option>`
          )
          .join("")}
      </select>
    `;

    groupDiv.appendChild(matchingDiv);
  });

  questionList.appendChild(groupDiv);
}
function renderListeningTable(table) {
  const questionList = document.getElementById("listening-questions");
  const tableDiv = document.createElement("div");
  tableDiv.className = "table-group";

  let tableHtml = `<h4 style="margin-bottom: 15px;">${table.title || ""}</h4>`;
  tableHtml += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">`;

  // Header
  tableHtml += `<thead><tr>`;
  table.columns.forEach((col) => {
    tableHtml += `<th style="border: 1px solid #ddd; padding: 12px 8px; background: #f8f9fa; font-weight: bold; text-align: left;">${col}</th>`;
  });
  tableHtml += `</tr></thead>`;

  // Body
  tableHtml += `<tbody>`;
  table.rows.forEach((row, rowIndex) => {
    tableHtml += `<tr style="background: ${
      rowIndex % 2 === 0 ? "#ffffff" : "#f8f9fa"
    };">`;

    table.columns.forEach((col) => {
      const key = col.toLowerCase().replace(/\s+/g, "");
      let content = row[key] || "";

      // ___qX___ marker → numbered box glued to the input (same look as
      // the inline gap-fill questions)
      content = content.replace(/___q(\d+)___/g, (match, num) => {
        const qId = `q${num}`;
        const safeVal = String(state.answersSoFar[qId] ?? "")
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;");
        return `<span class="gap-inline"><span class="gap-num">${num}</span><input type="text" data-qid="${qId}" class="gap-fill-input table-input" placeholder=" " value="${safeVal}" /></span>`;
      });

      tableHtml += `<td style="border: 1px solid #ddd; padding: 12px 8px; vertical-align: top;">${content}</td>`;
    });
    tableHtml += `</tr>`;
  });
  tableHtml += `</tbody></table>`;

  tableDiv.innerHTML = tableHtml;
  questionList.appendChild(tableDiv);

  // ✅ ДОБАВЛЕНО: Проверяем что input поля действительно созданы
  setTimeout(() => {
    const createdInputs = tableDiv.querySelectorAll("input[data-qid]");

    createdInputs.forEach((input) => {});
  }, 100);
}
export { initializeListening, renderListeningSection };
