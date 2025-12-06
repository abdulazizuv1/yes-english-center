import { listeningState } from "./state.js";
import { handleAudio } from "./audio.js";
import { restoreHighlights, saveCurrentHighlights } from "./highlights.js";
import { updateNavButtons } from "./navigation.js";

export function renderSection(index) {
  if (listeningState.currentSectionIndex !== index) {
    saveCurrentHighlights();
    listeningState.currentSectionIndex = index;
  }

  const section = listeningState.sections[index];
  if (!section) return;

  handleAudio(section, index);
  renderContent(section, index);
  updateNavButtons(index);

  setTimeout(() => {
    restoreHighlights();
  }, 150);
}

export function renderContent(section, index) {
  const questionList = document.getElementById("question-list");
  if (!questionList) return;

  questionList.innerHTML = `
        <div class="section-title" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0;">Section ${index + 1}: ${
    section.title || `Section ${index + 1}`
  }</h2>
        </div>
    `;

  if (section.instructions) {
    renderInstructions(section.instructions);
  }

  if (section.content) {
    let currentGroupInstruction = null;
    let gapFillContainer = null;

    section.content.forEach((item) => {
      if (item.groupInstruction) {
        currentGroupInstruction = item.groupInstruction;
      }

      if (item.type === "text") {
        if (gapFillContainer) {
          questionList.appendChild(gapFillContainer);
          gapFillContainer = null;
        }

        if (currentGroupInstruction) {
          const instructionDiv = document.createElement("div");
          instructionDiv.className = "group-instruction";
          instructionDiv.style.cssText =
            "background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0;";
          instructionDiv.innerHTML = `<p style="white-space: pre-line; margin: 0;">${currentGroupInstruction}</p>`;
          questionList.appendChild(instructionDiv);
          currentGroupInstruction = null;
        }

        renderTextItem(item);
      } else if (item.type === "question" && item.format === "gap-fill") {
        if (!gapFillContainer) {
          if (currentGroupInstruction) {
            const instructionDiv = document.createElement("div");
            instructionDiv.className = "group-instruction";
            instructionDiv.style.cssText =
              "background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6;  border-radius: 0 8px 8px 0;";
            instructionDiv.innerHTML = `<p style="white-space: pre-line; margin: 0;">${currentGroupInstruction}</p>`;
            questionList.appendChild(instructionDiv);
            currentGroupInstruction = null;
          }

          gapFillContainer = document.createElement("div");
          gapFillContainer.className = "gap-fill-group";
        }
        renderGapFillQuestion(item, gapFillContainer);
      } else {
        if (gapFillContainer) {
          questionList.appendChild(gapFillContainer);
          gapFillContainer = null;
        }

        if (currentGroupInstruction && item.type === "question") {
          // eslint-disable-next-line no-param-reassign
          item.groupInstruction = currentGroupInstruction;
          currentGroupInstruction = null;
        }

        renderContentItem(item);
      }
    });

    if (gapFillContainer) {
      questionList.appendChild(gapFillContainer);
    }
  } else {
    ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach((key) => {
      if (section[key]) renderLegacyGroup(section[key], key);
    });
  }
}

export function renderInstructions(instructions) {
  const questionList = document.getElementById("question-list");

  let instructionHtml =
    '<div class="group-instruction" style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;">';

  if (instructions.heading) {
    instructionHtml += `<h4>${instructions.heading}</h4>`;
  }

  if (instructions.details) {
    instructionHtml += `<p>${instructions.details}</p>`;
  }

  if (instructions.note) {
    instructionHtml += `<p><strong>Note:</strong> ${instructions.note}</p>`;
  }

  instructionHtml += "</div>";
  questionList.innerHTML += instructionHtml;
}

export function renderTextItem(item) {
  const questionList = document.getElementById("question-list");
  const text = item.value || item.title || item.text || "";

  const container = document.createElement("div");
  container.className = "question-item text-item";

  if (item.title && !item.value) {
    container.innerHTML = `<h4 class="text-title">${text}</h4>`;
  } else {
    container.innerHTML = `<p class="text-paragraph">${text}</p>`;
  }

  questionList.appendChild(container);
}

export function renderGapFillQuestion(question, container) {
  const qId = question.questionId;
  const number = qId.replace(/\D/g, "");

  const questionDiv = document.createElement("div");
  questionDiv.id = qId;
  questionDiv.className = "question-item gap-fill-item";

  let textContent = question.title || question.text || question.value || "";

  textContent = textContent.replace(
    /_{3,}/g,
    `<input type="text" value="${
      listeningState.answersSoFar[qId] || ""
    }" data-qid="${qId}" class="gap-fill" placeholder="Answer"/>`
  );

  questionDiv.innerHTML = `
        <div class="question-number">${number}</div>
        <div class="question-text">${textContent}</div>
    `;

  container.appendChild(questionDiv);
}

export function renderContentItem(item) {
  const questionList = document.getElementById("question-list");

  switch (item.type) {
    case "text":
      renderTextItem(item);
      break;
    case "subheading":
      questionList.innerHTML += `<h4 style="margin: 20px 0 10px; color: #dc2626; font-weight: 600;">${
        item.value || item.text
      }</h4>`;
      break;
    case "question":
      if (item.format !== "gap-fill") {
        renderQuestion(item);
      }
      break;
    case "question-group":
      renderQuestionGroup(item);
      break;
    case "table":
      renderTable(item);
      break;
    case "matching":
      renderMatchingQuestion(item);
      break;
    default:
      break;
  }
}

export function renderQuestion(question) {
  const qId = question.questionId;
  const questionDiv = document.createElement("div");
  questionDiv.className = "question-item";
  questionDiv.id = qId;
  questionDiv.style.cssText =
    "margin: 20px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa;";

  const number = qId.replace(/\D/g, "");

  if (question.groupInstruction) {
    const instructionDiv = document.createElement("div");
    instructionDiv.className = "group-instruction";
    instructionDiv.style.cssText =
      "background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;";
    instructionDiv.innerHTML = `<p style="white-space: pre-line; margin: 0;">${question.groupInstruction}</p>`;
    document.getElementById("question-list").appendChild(instructionDiv);
  }

  if (question.format === "multiple-choice") {
    const optionsHtml = Object.keys(question.options || {})
      .sort()
      .map(
        (key) => `
            <label style="display: block; margin: 8px 0; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                <input type="radio" name="${qId}" value="${key}" ${
          listeningState.answersSoFar[qId] === key ? "checked" : ""
        } style="margin-right: 8px;"/> 
                <strong>${key}.</strong> ${question.options[key]}
            </label>
        `
      )
      .join("");

    questionDiv.innerHTML = `
            <div class="question-number" style="display: inline-block; background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; margin-right: 10px;">${number}</div>
            <div class="question-text">
                <div style="font-weight: 500; margin-bottom: 10px;">${question.text}</div>
                <div class="radio-group">${optionsHtml}</div>
            </div>
        `;
  }

  document.getElementById("question-list").appendChild(questionDiv);
}

export function renderQuestionGroup(group) {
  const questionList = document.getElementById("question-list");
  const groupDiv = document.createElement("div");

  let instructionsHtml = "";
  if (group.groupInstruction) {
    instructionsHtml = `<div class="group-instruction" style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <p style="white-space: pre-line;">${group.groupInstruction}</p>
        </div>`;
  }

  if (group.groupType === "multi-select") {
    let questionCount = 0;
    let questionIds = [];

    if (group.questions && Array.isArray(group.questions)) {
      questionCount = group.questions.length;
      questionIds = group.questions.map((q) => q.questionId);
    } else if (group.questionId && group.questionId.includes("_")) {
      questionIds = group.questionId.split("_").map((num) => `q${num}`);
      questionCount = questionIds.length;
    }

    // Добавляем ID для контейнера группы, чтобы навигация могла найти его
    groupDiv.id = `multi-select-group-${group.questionId || questionIds.join("-")}`;
    groupDiv.setAttribute("data-question-ids", JSON.stringify(questionIds));

    groupDiv.innerHTML = `
            ${instructionsHtml}
            <div style="margin: 25px 0; padding: 20px; border: 2px solid #3b82f6; border-radius: 10px; background: #f8fafc;">
                ${
                  group.instructions
                    ? `<h4 style="color: #dc2626; margin-bottom: 15px;">${group.instructions}</h4>`
                    : ""
                }
                <p style="font-weight: 600; margin-bottom: 15px;">${group.text}</p>
                <p style="color: #6b7280; margin-bottom: 15px; font-style: italic;">Select exactly ${questionCount} options:</p>
                <div class="checkbox-group">
                    ${Object.keys(group.options || {})
                      .sort()
                      .map(
                        (key) => `
                        <label style="display: block; margin: 8px 0; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; ${
                          isOptionSelectedInMultiGroup(group, key, questionIds)
                            ? "background: #dbeafe; border-color: #3b82f6;"
                            : ""
                        }">
                            <input type="checkbox" data-group-id="${
                              group.questionId
                            }" data-question-ids="${questionIds.join(",")}" value="${key}" ${
                          isOptionSelectedInMultiGroup(group, key, questionIds)
                            ? "checked"
                            : ""
                        } style="margin-right: 8px;"/> 
                            <strong>${key}.</strong> ${group.options[key]}
                        </label>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `;
    
    // Добавляем ID для каждого вопроса в группе для навигации (после innerHTML)
    questionIds.forEach((qId) => {
      const questionMarker = document.createElement("div");
      questionMarker.id = qId;
      questionMarker.style.display = "none"; // Скрытый маркер для навигации
      groupDiv.appendChild(questionMarker);
    });
  } else if (group.groupType === "matching") {
    groupDiv.innerHTML = `
            ${instructionsHtml}
            <div style="margin: 25px 0; padding: 20px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
                ${group.instructions ? `<h4>${group.instructions}</h4>` : ""}
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="font-weight: 600; margin-bottom: 15px;">${
                      group.text || ""
                    }</p>
                    ${Object.keys(group.options || {})
                      .sort()
                      .map(
                        (key) =>
                          `<p style="margin: 5px 0;"><strong>${key}</strong> ${group.options[key]}</p>`
                      )
                      .join("")}
                </div>
                ${(group.questions || [])
                  .map(
                    (q) => `
                    <div style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background: white; border-radius: 6px;">
                        <div style="background: #10b981; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 15px;">${q.questionId.replace(
                          "q",
                          ""
                        )}</div>
                        <div style="flex: 1; margin-right: 15px;">${q.text}</div>
                        <select data-qid="${q.questionId ||
                          q.QuestionId ||
                          q.qId ||
                          q.editorId}" style="padding: 8px; border: 2px solid #d1d5db; border-radius: 6px;">
                            <option value="">Select...</option>
                            ${Object.keys(group.options || {})
                              .sort()
                              .map(
                                (key) =>
                                  `<option value="${key}" ${
                                    listeningState.answersSoFar[q.questionId] === key
                                      ? "selected"
                                      : ""
                                  }>${key}</option>`
                              )
                              .join("")}
                        </select>
                    </div>
                `
                  )
                  .join("")}
            </div>
        `;
  }

  questionList.appendChild(groupDiv);
}

export function renderMatchingQuestion(item) {
  const questionList = document.getElementById("question-list");
  const matchDiv = document.createElement("div");

  let instructionsHtml = "";
  if (item.groupInstruction) {
    instructionsHtml = `<div class="group-instruction" style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <p style="white-space: pre-line;">${item.groupInstruction}</p>
        </div>`;
  }

  matchDiv.innerHTML = `
        ${instructionsHtml}
        <div style="margin: 25px 0; padding: 20px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
            ${
              item.title
                ? `<h4 style="text-align: center; margin-bottom: 20px;">${item.title}</h4>`
                : ""
            }
            <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                ${Object.keys(item.options || {})
                  .sort()
                  .map(
                    (key) =>
                      `<p style="margin: 5px 0;"><strong>${key}</strong> ${item.options[key]}</p>`
                  )
                  .join("")}
            </div>
            ${(item.questions || [])
              .map(
                (q) => `
                <div id="${
                  q.questionId
                }" style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background: white; border-radius: 6px;">
                    <div style="background: #10b981; color: white; min-width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 15px; font-size: 12px;">${q.questionId.replace(
                      "q",
                      ""
                    )}</div>
                    <div style="flex: 1; margin-right: 15px;">${q.text}</div>
                    <select data-qid="${q.questionId ||
                      q.QuestionId ||
                      q.qId ||
                      q.editorId}" style="padding: 8px; border: 2px solid #d1d5db; border-radius: 6px;">
                        <option value="">Select...</option>
                        ${Object.keys(item.options || {})
                          .sort()
                          .map(
                            (key) =>
                              `<option value="${key}" ${
                                listeningState.answersSoFar[q.questionId] === key
                                  ? "selected"
                                  : ""
                              }>${key}</option>`
                          )
                          .join("")}
                    </select>
                </div>
            `
              )
              .join("")}
        </div>
    `;

  questionList.appendChild(matchDiv);
}

export function isOptionSelectedInMultiGroup(group, optionKey, questionIds) {
  return questionIds.some((qId) => {
    return listeningState.answersSoFar[qId] === optionKey;
  });
}

export function renderTable(table) {
  const questionList = document.getElementById("question-list");
  const tableDiv = document.createElement("div");

  let instructionsHtml = "";
  if (table.groupInstruction) {
    instructionsHtml = `<div class="group-instruction" style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <p style="white-space: pre-line;">${table.groupInstruction}</p>
        </div>`;
  }

  let tableHtml = `${instructionsHtml}<h4 style="margin-bottom: 15px;">${
    table.title || ""
  }</h4><table style="width: 100%; border-collapse: collapse;">`;
  tableHtml += `<thead><tr>${table.columns
    .map(
      (col) =>
        `<th style="border: 1px solid #ddd; padding: 8px; background: #f8f9fa;">${col}</th>`
    )
    .join("")}</tr></thead><tbody>`;

  table.rows.forEach((row) => {
    tableHtml += "<tr>";
    table.columns.forEach((col) => {
      const columnKey = col.toLowerCase().replace(/\s+/g, "");
      let content = row[columnKey] || "";

      content = content.replace(/___q(\d+)___/g, (match, num) => {
        const qId = `q${num}`;
        return `<span class="input-with-number"><input type="text" value="${
          listeningState.answersSoFar[qId] || ""
        }" data-qid="${qId}" class="gap-fill has-number" /><span class="input-number">${num}</span></span>`;
      });

      content = content.replace(/(\d+)_{3,}/g, (match, num) => {
        const qId = `q${num}`;
        return `<span class="input-with-number"><input type="text" value="${
          listeningState.answersSoFar[qId] || ""
        }" data-qid="${qId}" class="gap-fill has-number" /><span class="input-number">${num}</span></span>`;
      });

      tableHtml += `<td style="border: 1px solid #ddd; padding: 8px;">${content}</td>`;
    });
    tableHtml += "</tr>";
  });

  tableHtml += "</tbody></table>";
  tableDiv.innerHTML = tableHtml;
  questionList.appendChild(tableDiv);
}

export function renderLegacyGroup(group, key) {
  const questionList = document.getElementById("question-list");

  if (key === "matching" && group.matchingQuestions) {
    const groupDiv = document.createElement("div");
    groupDiv.innerHTML = `
            <div style="margin: 25px 0; padding: 20px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
                <h4>${group.heading || ""}</h4>
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="font-weight: 600;">${group.question || ""}</p>
                    ${Object.keys(group.options || {})
                      .sort()
                      .map(
                        (keyOpt) =>
                          `<p><strong>${keyOpt}</strong> ${group.options[keyOpt]}</p>`
                      )
                      .join("")}
                </div>
                ${group.matchingQuestions
                  .map(
                    (q) => `
                    <div style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background: white; border-radius: 6px;">
                        <div style="background: #10b981; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 15px;">${q.qId.replace(
                          "q",
                          ""
                        )}</div>
                        <div style="flex: 1; margin-right: 15px;">${q.text}</div>
                        <select data-qid="${
                          q.qId
                        }" style="padding: 8px; border: 2px solid #d1d5db; border-radius: 6px;">
                            <option value="">Select...</option>
                            ${Object.keys(group.options || {})
                              .sort()
                              .map(
                                (keyOpt) =>
                                  `<option value="${keyOpt}" ${
                                    listeningState.answersSoFar[q.qId] === keyOpt
                                      ? "selected"
                                      : ""
                                  }>${keyOpt}</option>`
                              )
                              .join("")}
                        </select>
                    </div>
                `
                  )
                  .join("")}
            </div>
        `;
    questionList.appendChild(groupDiv);
  }
}


