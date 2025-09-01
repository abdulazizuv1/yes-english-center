import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBw36xP5tVYO2D0T-XFQQAGFA4wrJ8If8k",
  authDomain: "yes-english-center.firebaseapp.com",
  projectId: "yes-english-center",
  storageBucket: "yes-english-center.appspot.com",
  messagingSenderId: "203211203853",
  appId: "1:203211203853:web:7d499925c3aa830eaefc44",
  measurementId: "G-4LHEBLG2KK",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();
let currentAudioSection = 0;
let audioInitialized = false;

let sections = [],
  currentSectionIndex = 0,
  answersSoFar = {},
  currentAudio = null;
let isPaused = false,
  pausedTime = 0,
  timerStartTime = null,
  audioCurrentTime = 0;
let currentQuestionNumber = 1;
let savedHighlights = {};

function saveCurrentHighlights() {
  const questionList = document.getElementById("question-list");
  if (!questionList) return;
  
  const highlights = questionList.querySelectorAll('.highlighted');
  const sectionKey = `section_${currentSectionIndex}`;
  
  if (!savedHighlights[sectionKey]) {
    savedHighlights[sectionKey] = [];
  }
  
  savedHighlights[sectionKey] = [];
  
  highlights.forEach((highlight, index) => {
    const parent = highlight.parentNode;
    const parentHtml = parent.outerHTML || parent.innerHTML;
    const highlightText = highlight.textContent;
    const highlightHtml = highlight.outerHTML;
    
    // Создаем уникальный идентификатор для highlight
    const highlightId = `highlight_${currentSectionIndex}_${index}_${Date.now()}`;
    highlight.setAttribute('data-highlight-id', highlightId);
    
    savedHighlights[sectionKey].push({
      id: highlightId,
      text: highlightText,
      html: highlightHtml,
      parentSelector: getElementSelector(parent),
      textBefore: getTextBefore(highlight),
      textAfter: getTextAfter(highlight)
    });
  });
  
  // Сохраняем в localStorage
  localStorage.setItem('testHighlights', JSON.stringify(savedHighlights));
}

// Функция для восстановления highlights в текущей секции
function restoreHighlights() {
  const sectionKey = `section_${currentSectionIndex}`;
  const highlights = savedHighlights[sectionKey];
  
  if (!highlights || highlights.length === 0) return;
  
  setTimeout(() => {
    highlights.forEach(highlightData => {
      restoreSingleHighlight(highlightData);
    });
  }, 100); // Небольшая задержка для обеспечения рендеринга содержимого
}

// Функция для восстановления одного highlight
function restoreSingleHighlight(highlightData) {
  const questionList = document.getElementById("question-list");
  if (!questionList) return;
  
  // Более простой и надежный подход - ищем точное совпадение текста
  const walker = document.createTreeWalker(
    questionList,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let textNode;
  while (textNode = walker.nextNode()) {
    const nodeText = textNode.textContent;
    const targetText = highlightData.text;
    
    const index = nodeText.indexOf(targetText);
    if (index !== -1) {
      // Дополнительная проверка - убеждаемся что это не уже подсвеченный текст
      const parent = textNode.parentNode;
      if (parent && parent.classList && parent.classList.contains('highlighted')) {
        continue; // Пропускаем уже подсвеченные элементы
      }
      
      try {
        // Создаем новый highlight
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + targetText.length);
        
        const span = document.createElement("span");
        span.className = "highlighted";
        span.style.backgroundColor = "#ffeb3b";
        span.setAttribute('data-highlight-id', highlightData.id);
        
        range.surroundContents(span);
        break; // Выходим после успешного восстановления
      } catch (e) {
        // Если не удается обернуть, пробуем другой способ
        try {
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + targetText.length);
          
          const contents = range.extractContents();
          const span = document.createElement("span");
          span.className = "highlighted";
          span.style.backgroundColor = "#ffeb3b";
          span.setAttribute('data-highlight-id', highlightData.id);
          span.appendChild(contents);
          range.insertNode(span);
          break;
        } catch (e2) {
          console.warn('Failed to restore highlight:', e2);
        }
      }
    }
  }
}

function getElementSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className) return `.${element.className.split(' ')[0]}`;
  return element.tagName.toLowerCase();
}

function getTextBefore(node) {
  let text = "";
  let current = node;
  
  while (current && text.length < 50) {
    if (current.previousSibling) {
      current = current.previousSibling;
      if (current.nodeType === Node.TEXT_NODE) {
        text = current.textContent + text;
      } else if (current.textContent) {
        text = current.textContent + text;
      }
    } else {
      current = current.parentNode;
      if (!current || current.id === 'question-list') break;
    }
  }
  
  return text;
}

function getTextAfter(node) {
  let text = "";
  let current = node;
  
  while (current && text.length < 50) {
    if (current.nextSibling) {
      current = current.nextSibling;
      if (current.nodeType === Node.TEXT_NODE) {
        text += current.textContent;
      } else if (current.textContent) {
        text += current.textContent;
      }
    } else {
      current = current.parentNode;
      if (!current || current.id === 'question-list') break;
    }
  }
  
  return text;
}
function loadSavedHighlights() {
  try {
    const saved = localStorage.getItem('testHighlights');
    if (saved) {
      savedHighlights = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error loading highlights:', e);
    savedHighlights = {};
  }
}

window.togglePause = function () {
  const pauseBtn = document.getElementById("pauseBtn");
  const pauseModal = document.getElementById("pauseModal");

  if (!isPaused) {
    isPaused = true;
    clearInterval(window.listeningTimerInterval);
    pausedTime = getCurrentRemainingTime();
    if (pauseBtn) pauseBtn.textContent = "Resume";
    if (pauseModal) pauseModal.style.display = "flex";

    if (currentAudio && !currentAudio.paused) {
      audioCurrentTime = currentAudio.currentTime;
      currentAudio.pause();
    }
    toggleTestInteraction(false);
  } else {
    isPaused = false;
    if (pauseBtn) pauseBtn.textContent = "Pause";
    if (pauseModal) pauseModal.style.display = "none";

    if (currentAudio && audioCurrentTime) {
      currentAudio.currentTime = audioCurrentTime;
      currentAudio.play().catch(console.warn);
    }
    toggleTestInteraction(true);
    startTimer(pausedTime, document.getElementById("time"));
  }
};

function toggleTestInteraction(enable) {
  const selectors = [
    ".main-content",
    ".bottom-controls",
    ".question-nav",
    ".test-header button",
    "input",
    "select",
    "button:not(.resume-btn)",
  ];

  selectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      if (el) {
        el.style.pointerEvents = enable ? "auto" : "none";
        if (
          el.tagName === "INPUT" ||
          el.tagName === "SELECT" ||
          el.tagName === "BUTTON"
        ) {
          el.disabled = !enable;
        }
      }
    });
  });

  document.body.style.cursor = enable ? "auto" : "wait";
}

function getCurrentRemainingTime() {
  if (!timerStartTime) return 40 * 60;
  const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
  return Math.max(0, 40 * 60 - elapsed);
}

function generateQuestionNav() {
  [1, 2, 3, 4].forEach((section) => {
    const container = document.getElementById(`section${section}Numbers`);
    if (!container) return;
    container.innerHTML = "";

    const start = (section - 1) * 10 + 1;
    const end = section * 10;
    for (let i = start; i <= end; i++) {
      const num = document.createElement("div");
      num.className = "nav-number";
      num.textContent = i;
      num.onclick = () => jumpToQuestion(i);
      container.appendChild(num);
    }
  });
}

function updateQuestionNav() {
  document.querySelectorAll(".nav-number").forEach((num, index) => {
    const qId = `q${index + 1}`;
    const questionNumber = index + 1;
    const isAnswered = isAnswerValid(answersSoFar[qId]);

    num.className = "nav-number";

    if (questionNumber === currentQuestionNumber) {
      num.style.background = "#3b82f6";
      num.style.color = "white";
      num.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.3)";
    } else if (isAnswered) {
      num.style.background = "#10b981";
      num.style.color = "white";
      num.style.boxShadow = "none";
    } else {
      num.style.background = "#e5e7eb";
      num.style.color = "#6b7280";
      num.style.boxShadow = "none";
    }
  });
  updateSectionIndicator();
}

function jumpToQuestion(questionNum) {
  const targetSection = Math.floor((questionNum - 1) / 10);
  const shouldRender = targetSection !== currentSectionIndex;

  // Сохраняем highlights перед переключением секции
  if (shouldRender) {
    saveCurrentHighlights();
  }

  currentQuestionNumber = questionNum;

  if (shouldRender) {
    currentSectionIndex = targetSection;
    renderSection(currentSectionIndex);
  }
  updateQuestionNav();

  setTimeout(
    () => {
      const el = document.getElementById(`q${questionNum}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    shouldRender ? 200 : 0
  );
}

function updateSectionIndicator() {
  const indicator = document.getElementById("sectionIndicator");
  if (!indicator) return;

  const progress = analyzeTestProgress();
  const progressPercent = Math.round(
    (progress.answered / progress.total) * 100
  );

  indicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <span>Section ${currentSectionIndex + 1} of ${
    sections.length
  }</span>
            <div style="flex: 1; background: #e5e7eb; border-radius: 10px; height: 8px;">
                <div style="background: linear-gradient(90deg, #10b981, #3b82f6); height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
            </div>
            <span style="font-size: 0.9em; color: #6b7280;">${
              progress.answered
            }/${progress.total}</span>
        </div>
    `;
}

let selectedRange = null;
document.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  if (selection.toString().length > 0) {
    try {
      selectedRange = selection.getRangeAt(0);
    } catch (e) {
      selectedRange = null;
    }
  }
});

document.addEventListener("contextmenu", (e) => {
  if (selectedRange && e.target.closest(".questions-panel")) {
    e.preventDefault();
    const menu = document.getElementById("contextMenu");
    if (menu) {
      menu.style.display = "block";
      menu.style.left = Math.min(e.pageX, window.innerWidth - 150) + "px";
      menu.style.top = Math.min(e.pageY, window.innerHeight - 100) + "px";
    }
  }
});

document.addEventListener("click", (e) => {
  const menu = document.getElementById("contextMenu");
  if (menu && !e.target.closest("#contextMenu")) menu.style.display = "none";
});
window.highlightSelection = () => {
  if (selectedRange) {
    const span = document.createElement("span");
    span.className = "highlighted";
    span.style.backgroundColor = "#ffeb3b";
    
    try {
      selectedRange.surroundContents(span);
    } catch (e) {
      const contents = selectedRange.extractContents();
      span.appendChild(contents);
      selectedRange.insertNode(span);
    }
    
    window.getSelection().removeAllRanges();
    selectedRange = null;
    
    // Сохраняем highlights после добавления нового
    saveCurrentHighlights();
  }
  document.getElementById("contextMenu").style.display = "none";
};


window.removeHighlight = function () {
  if (selectedRange) {
    const container = selectedRange.commonAncestorContainer;
    const highlighted =
      container.nodeType === Node.TEXT_NODE
        ? container.parentElement.closest(".highlighted")
          ? [container.parentElement.closest(".highlighted")]
          : []
        : Array.from(container.querySelectorAll(".highlighted")).filter((el) =>
            selectedRange.intersectsNode(el)
          );

    highlighted.forEach((element) => {
      const parent = element.parentNode;
      parent.insertBefore(
        document.createTextNode(element.textContent),
        element
      );
      parent.removeChild(element);
      parent.normalize();
    });
    
    // Сохраняем highlights после удаления
    saveCurrentHighlights();
  }

  window.getSelection().removeAllRanges();
  selectedRange = null;
  document.getElementById("contextMenu").style.display = "none";
};

onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("Please log in to take the test.");
    window.location.href = "/";
  } else loadTest();
});

async function loadTest() {
  try {
    const testId =
      new URLSearchParams(window.location.search).get("testId") || "test-1";
    const docSnap = await getDoc(doc(db, "listeningTests", testId));

    if (!docSnap.exists()) throw new Error(`Test ${testId} not found`);

    const data = docSnap.data();
    sections = data.sections || data.parts?.sections || data.parts || [];

    if (sections.length === 0) throw new Error("No sections found");

    document.title = data.title || "Listening Test";
    initializeTest();
  } catch (error) {
    console.error("Error loading test:", error);
    const questionList = document.getElementById("question-list");
    if (questionList)
      questionList.innerHTML = `<p class='error'>${error.message}</p>`;
  }
}

function initializeTest() {
  generateQuestionNav();
  currentQuestionNumber = 1;
  audioInitialized = false;
  currentAudioSection = 0;
  
  // Загружаем сохраненные highlights
  loadSavedHighlights();
  
  renderSection(0);
  updateQuestionNav();
  startTimer(40 * 60, document.getElementById("time"));
}
function renderSection(index) {
  // Сохраняем highlights текущей секции перед переключением
  if (currentSectionIndex !== index) {
    saveCurrentHighlights();
    currentSectionIndex = index; // Обновляем индекс после сохранения
  }
  
  const section = sections[index];
  if (!section) return;

  handleAudio(section, index);
  renderContent(section, index);
  updateNavButtons(index);
  
  // Восстанавливаем highlights после рендеринга
  setTimeout(() => {
    restoreHighlights();
  }, 150);
}

function handleAudio(section, index) {
  if (audioInitialized) return;

  const container = document.getElementById("audio-container");
  if (!container) return;

  initializeSequentialAudio();
  audioInitialized = true;
}

function initializeSequentialAudio() {
  const container = document.getElementById("audio-container");
  playAudioForSection(0);

  function playAudioForSection(sectionIndex) {
    if (sectionIndex >= sections.length) return;

    const section = sections[sectionIndex];
    if (!section.audioUrl) {
      setTimeout(() => playAudioForSection(sectionIndex + 1), 100);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    container.innerHTML = `
            <audio controls autoplay style="width:100%; margin-bottom: 20px;" id="sectionAudio">
                <source src="${section.audioUrl}" type="audio/mpeg" />
                Your browser does not support the audio element.
            </audio>
            <div style="text-align: center; margin-top: 10px; color: #6b7280;">
                Playing: Section ${sectionIndex + 1} Audio
            </div>
        `;

    currentAudio = document.getElementById("sectionAudio");
    currentAudioSection = sectionIndex;

    if (currentAudio) {
      currentAudio.addEventListener("ended", () => {
        setTimeout(() => playAudioForSection(sectionIndex + 1), 1000);
      });
    }
  }
}

function renderContent(section, index) {
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

    section.content.forEach((item, itemIndex) => {
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
            "background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;";
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
              "background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;";
            instructionDiv.innerHTML = `<p style="white-space: pre-line; margin: 0;">${currentGroupInstruction}</p>`;
            questionList.appendChild(instructionDiv);
            currentGroupInstruction = null;
          }

          gapFillContainer = document.createElement("div");
          gapFillContainer.style.cssText =
            "background: #fafafa; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0;";
        }
        renderGapFillQuestion(item, gapFillContainer);
      } else {
        if (gapFillContainer) {
          questionList.appendChild(gapFillContainer);
          gapFillContainer = null;
        }

        if (currentGroupInstruction && item.type === "question") {
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
    ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach(
      (key) => {
        if (section[key]) renderLegacyGroup(section[key], key);
      }
    );
  }
}

function renderInstructions(instructions) {
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

function renderTextItem(item) {
  const questionList = document.getElementById("question-list");
  const text = item.value || item.title || item.text || "";

  if (item.title && !item.value) {
    questionList.innerHTML += `<h4 style="text-align: center; margin: 20px 0; color: #1f2937; font-weight: 600;">${text}</h4>`;
  } else {
    questionList.innerHTML += `<p style="margin: 10px 0; padding: 0 20px; color: #4b5563;">${text}</p>`;
  }
}

function renderGapFillQuestion(question, container) {
  const qId = question.questionId;
  const number = qId.replace(/\D/g, "");

  const questionDiv = document.createElement("div");
  questionDiv.id = qId;
  questionDiv.style.cssText =
    "display: flex; align-items: center; margin: 12px 0;";

  let textContent = question.title || question.text || question.value || "";

  textContent = textContent.replace(
    /_____/g,
    `<input type="text" value="${
      answersSoFar[qId] || ""
    }" data-qid="${qId}" class="gap-fill" style="min-width: 120px; padding: 6px 10px; border: 2px solid #d1d5db; border-radius: 6px; margin: 0 5px;" placeholder="Answer"/>`
  );

  questionDiv.innerHTML = `
        <div style="background: #3b82f6; color: white; min-width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; margin-right: 12px; font-size: 12px;">${number}</div>
        <div style="flex: 1;">${textContent}</div>
    `;

  container.appendChild(questionDiv);
}

function renderContentItem(item) {
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
  }
}

function renderQuestion(question) {
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
          answersSoFar[qId] === key ? "checked" : ""
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

function renderQuestionGroup(group) {
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

    groupDiv.innerHTML = `
            ${instructionsHtml}
            <div style="margin: 25px 0; padding: 20px; border: 2px solid #3b82f6; border-radius: 10px; background: #f8fafc;">
                ${
                  group.instructions
                    ? `<h4 style="color: #dc2626; margin-bottom: 15px;">${group.instructions}</h4>`
                    : ""
                }
                <p style="font-weight: 600; margin-bottom: 15px;">${
                  group.text
                }</p>
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
                            }" value="${key}" ${
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
                        <div style="flex: 1; margin-right: 15px;">${
                          q.text
                        }</div>
                        <select data-qid="${q.questionId || q.QuestionId || q.qId || q.editorId}" style="padding: 8px; border: 2px solid #d1d5db; border-radius: 6px;">
                            <option value="">Select...</option>
                            ${Object.keys(group.options || {})
                              .sort()
                              .map(
                                (key) =>
                                  `<option value="${key}" ${
                                    answersSoFar[q.questionId] === key
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

function renderMatchingQuestion(item) {
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
                    <select data-qid="${q.questionId || q.QuestionId || q.qId || q.editorId}" style="padding: 8px; border: 2px solid #d1d5db; border-radius: 6px;">
                        <option value="">Select...</option>
                        ${Object.keys(item.options || {})
                          .sort()
                          .map(
                            (key) =>
                              `<option value="${key}" ${
                                answersSoFar[q.questionId] === key
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

function isOptionSelectedInMultiGroup(group, optionKey, questionIds) {
  return questionIds.some((qId) => {
    return answersSoFar[qId] === optionKey;
  });
}

function renderTable(table) {
  const questionList = document.getElementById("question-list");
  const tableDiv = document.createElement("div");

  let instructionsHtml = "";
  if (table.groupInstruction) {
    instructionsHtml = `<div class="group-instruction" style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <p style="white-space: pre-line;">${table.groupInstruction}</p>
        </div>`;
  }

  let tableHtml = `${instructionsHtml}<h4 style="margin-bottom: 15px;">${table.title}</h4><table style="width: 100%; border-collapse: collapse;">`;
  tableHtml += `<thead><tr>${table.columns
    .map(
      (col) =>
        `<th style="border: 1px solid #ddd; padding: 8px; background: #f8f9fa;">${col}</th>`
    )
    .join("")}</tr></thead><tbody>`;

  table.rows.forEach((row) => {
    tableHtml += "<tr>";
    table.columns.forEach((col) => {
      let content = row[col.toLowerCase().replace(/\s+/g, "")] || "";
      content = content.replace(/___q(\d+)___/g, (match, num) => {
        const qId = `q${num}`;
        return `<input type="text" value="${
          answersSoFar[qId] || ""
        }" data-qid="${qId}" class="gap-fill" style="padding: 4px; border: 1px solid #ccc;" />`;
      });
      tableHtml += `<td style="border: 1px solid #ddd; padding: 8px;">${content}</td>`;
    });
    tableHtml += "</tr>";
  });

  tableHtml += "</tbody></table>";
  tableDiv.innerHTML = tableHtml;
  questionList.appendChild(tableDiv);
}

function renderLegacyGroup(group, key) {
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
                        (key) =>
                          `<p><strong>${key}</strong> ${group.options[key]}</p>`
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
                        <div style="flex: 1; margin-right: 15px;">${
                          q.text
                        }</div>
                        <select data-qid="${
                          q.qId
                        }" style="padding: 8px; border: 2px solid #d1d5db; border-radius: 6px;">
                            <option value="">Select...</option>
                            ${Object.keys(group.options || {})
                              .sort()
                              .map(
                                (key) =>
                                  `<option value="${key}" ${
                                    answersSoFar[q.qId] === key
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
    questionList.appendChild(groupDiv);
  }
}

function updateNavButtons(index) {
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const finishBtn = document.getElementById("finishBtn");

  if (backBtn) backBtn.style.display = index > 0 ? "inline-block" : "none";
  if (nextBtn)
    nextBtn.style.display =
      index < sections.length - 1 ? "inline-block" : "none";
  if (finishBtn)
    finishBtn.style.display =
      index === sections.length - 1 ? "inline-block" : "none";
}

document.addEventListener("input", (e) => {
  const qId = e.target.dataset.qid;
  if (e.target.classList.contains("gap-fill") && qId) {
    answersSoFar[qId] = e.target.value.trim();
    updateQuestionNav();
    localStorage.setItem("listeningTestAnswers", JSON.stringify(answersSoFar));
  }
});

document.addEventListener("change", (e) => {
  const qId = e.target.name || e.target.dataset.qid;
  const groupId = e.target.dataset.groupId;

  if (!qId && !groupId) return;

  if (e.target.type === "radio") {
    answersSoFar[qId] = e.target.value;
  } else if (e.target.type === "checkbox") {
    if (groupId && groupId.includes("_")) {
      handleMultiSelectGroupChange(e.target, groupId);
    } else if (qId) {
      const checked = Array.from(
        document.querySelectorAll(`input[type="checkbox"][data-qid="${qId}"]`)
      )
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      answersSoFar[qId] = checked;
    }
  } else if (e.target.tagName === "SELECT") {
    answersSoFar[qId] = e.target.value;
  }

  updateQuestionNav();
  localStorage.setItem("listeningTestAnswers", JSON.stringify(answersSoFar));
});

function handleMultiSelectGroupChange(checkbox, groupId) {
  const allCheckboxes = document.querySelectorAll(
    `input[type="checkbox"][data-group-id="${groupId}"]`
  );
  const selectedOptions = Array.from(allCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  let maxAllowed = 0;
  let questionIds = [];

  sections.forEach((section) => {
    if (section.content) {
      section.content.forEach((item) => {
        if (
          item.type === "question-group" &&
          item.groupType === "multi-select" &&
          item.questionId === groupId
        ) {
          if (item.questions && Array.isArray(item.questions)) {
            maxAllowed = item.questions.length;
            questionIds = item.questions.map((q) => q.questionId);
          } else if (groupId.includes("_")) {
            questionIds = groupId.split("_").map((num) => `q${num}`);
            maxAllowed = questionIds.length;
          }
        }
      });
    }
  });

  if (selectedOptions.length > maxAllowed) {
    checkbox.checked = false;
    alert(`You can only select ${maxAllowed} options for this question.`);
    return;
  }

  questionIds.forEach((qId) => {
    delete answersSoFar[qId];
  });

  selectedOptions.forEach((option, index) => {
    if (questionIds[index]) {
      answersSoFar[questionIds[index]] = option;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const nextBtn = document.getElementById("nextBtn");
  const backBtn = document.getElementById("backBtn");
  const finishBtn = document.getElementById("finishBtn");

  if (nextBtn)
    nextBtn.onclick = () => {
      if (currentSectionIndex < sections.length - 1) {
        currentSectionIndex++;
        currentQuestionNumber = currentSectionIndex * 10 + 1;
        renderSection(currentSectionIndex);
        updateQuestionNav();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

  if (backBtn)
    backBtn.onclick = () => {
      if (currentSectionIndex > 0) {
        currentSectionIndex--;
        currentQuestionNumber = currentSectionIndex * 10 + 1;
        renderSection(currentSectionIndex);
        updateQuestionNav();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

  if (finishBtn) finishBtn.onclick = handleFinishTest;

  try {
    const saved = localStorage.getItem("listeningTestAnswers");
    if (saved) answersSoFar = JSON.parse(saved);
  } catch (e) {
    answersSoFar = {};
  }
});

async function handleFinishTest() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please login first");
    return;
  }

  if (!confirm("Submit test? You cannot change answers after submission.")) {
    return;
  }

  const loadingModal = document.getElementById("loadingModal");
  if (loadingModal) {
    loadingModal.style.display = "flex";
  }

  toggleTestInteraction(false);

  try {
    const results = calculateResults();
    const testId =
      new URLSearchParams(window.location.search).get("testId") || "test-1";

    const docRef = await addDoc(collection(db, "resultsListening"), {
      userId: user.uid,
      name: user.email || "unknown",
      testId: testId,
      score: results.correct,
      total: results.total,
      percentage: Math.round((results.correct / results.total) * 100),
      answers: results.answers,
      correctAnswers: results.correctAnswers,
      createdAt: serverTimestamp(),
      completedAt: new Date().toISOString(),
    });

    // Очищаем сохраненные данные включая highlights
    localStorage.removeItem("listeningTestAnswers");
    localStorage.removeItem("testHighlights");
    clearInterval(window.listeningTimerInterval);

    if (loadingModal) {
      loadingModal.style.display = "none";
    }

    window.location.href = `/pages/mock/listening/resultListening.html?id=${docRef.id}`;
  } catch (error) {
    console.error("Error saving result:", error);

    if (loadingModal) {
      loadingModal.style.display = "none";
    }

    toggleTestInteraction(true);
    alert("Error submitting test. Please try again.");
  }
}

function calculateResults() {
    const answers = {}, correctAnswers = {};
    let correct = 0, total = 0;
    
    sections.forEach((section, sectionIndex) => {
        if (section.content) {
            section.content.forEach((item, itemIndex) => {
                if (item.type === "question") {
                    const qId = item.questionId;
                    const userAns = answersSoFar[qId];
                    const expected = [item.correctAnswer];
                    
                    answers[qId] = userAns || null;
                    correctAnswers[qId] = expected;
                    
                    const isCorrect = checkAnswerCorrectness(userAns, expected);
                    if (isCorrect) correct++;
                    total++;
                    
                } else if (item.type === "question-group") {
                    if (item.groupType === "multi-select" && item.questions && Array.isArray(item.questions)) {
                        item.questions.forEach((question, qIndex) => {
                            const qId = question.questionId;
                            const userAns = answersSoFar[qId];
                            const expectedAnswer = question.correctAnswer;
                            
                            answers[qId] = userAns || null;
                            correctAnswers[qId] = [expectedAnswer];
                            
                            const isCorrect = checkAnswerCorrectness(userAns, [expectedAnswer]);
                            if (isCorrect) correct++;
                            total++;
                        });
                        
                    } else if (item.questions) {
                        item.questions.forEach(q => {
                            const qId = q.questionId;
                            const userAns = answersSoFar[qId];
                            const expected = [q.correctAnswer];
                            
                            answers[qId] = userAns || null;
                            correctAnswers[qId] = expected;
                            
                            const isCorrect = checkAnswerCorrectness(userAns, expected);
                            if (isCorrect) correct++;
                            total++;
                        });
                    }
                } else if (item.type === "matching" && item.questions) {
                    // ИСПРАВЛЕНО: Обработка matching вопросов
                    item.questions.forEach(q => {
                        const qId = q.questionId;
                        const userAns = answersSoFar[qId];
                        const expected = [q.correctAnswer];
                        
                        answers[qId] = userAns || null;
                        correctAnswers[qId] = expected;
                        
                        const isCorrect = checkAnswerCorrectness(userAns, expected);
                        if (isCorrect) correct++;
                        total++;
                    });
                } else if (item.type === "table" && item.answer) {
                    Object.keys(item.answer).forEach(qId => {
                        const userAns = answersSoFar[qId];
                        const expected = [item.answer[qId]];
                        
                        answers[qId] = userAns || null;
                        correctAnswers[qId] = expected;
                        
                        const isCorrect = checkAnswerCorrectness(userAns, expected);
                        if (isCorrect) correct++;
                        total++;
                    });
                }
            });
        }
        
        // ДОБАВЛЕНО: Обработка legacy matching вопросов
        ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach(key => {
            if (section[key] && section[key].matchingQuestions) {
                section[key].matchingQuestions.forEach(q => {
                    const qId = q.qId;
                    const userAns = answersSoFar[qId];
                    const expected = [q.correctAnswer];
                    
                    answers[qId] = userAns || null;
                    correctAnswers[qId] = expected;
                    
                    const isCorrect = checkAnswerCorrectness(userAns, expected);
                    if (isCorrect) correct++;
                    total++;
                });
            }
        });
    });
    
    return { answers, correctAnswers, correct, total };
}

function checkAnswerCorrectness(userAns, expected) {
  if (
    !expected ||
    expected.length === 0 ||
    userAns === null ||
    userAns === undefined
  ) {
    return false;
  }

  if (Array.isArray(userAns)) {
    if (!Array.isArray(expected[0])) return false;
    const userSet = new Set(userAns.map((a) => String(a).toLowerCase().trim()));
    const expectedSet = new Set(
      expected[0].map((a) => String(a).toLowerCase().trim())
    );
    return (
      userSet.size === expectedSet.size &&
      [...userSet].every((x) => expectedSet.has(x))
    );
  }

  const userAnswer = String(userAns).toLowerCase().trim();
  const expectedAnswers = expected.map((a) => String(a).toLowerCase().trim());

  return expectedAnswers.some((exp) => {
    if (exp.includes("/")) {
      const alternatives = exp
        .split("/")
        .map((alt) => alt.trim().toLowerCase());
      return alternatives.some((alt) => {
        const cleanAlt = alt.replace(/[()]/g, "").trim();
        const cleanUser = userAnswer.replace(/[()]/g, "").trim();
        return cleanUser === cleanAlt;
      });
    }
    return userAnswer === exp;
  });
}

function isAnswerValid(answer) {
  return (
    answer !== undefined &&
    answer !== null &&
    answer !== "" &&
    (!Array.isArray(answer) || answer.length > 0)
  );
}

function analyzeTestProgress() {
    let total = 0, answered = 0;
    
    sections.forEach(section => {
        if (section.content) {
            section.content.forEach(item => {
                if (item.type === "question") {
                    total++;
                    if (isAnswerValid(answersSoFar[item.questionId])) answered++;
                } else if (item.type === "question-group" && item.questions) {
                    item.questions.forEach(q => {
                        total++;
                        if (isAnswerValid(answersSoFar[q.questionId])) answered++;
                    });
                } else if (item.type === "matching" && item.questions) {
                    // ИСПРАВЛЕНО: Правильный подсчет matching вопросов
                    item.questions.forEach(q => {
                        total++;
                        if (isAnswerValid(answersSoFar[q.questionId])) answered++;
                    });
                } else if (item.type === "table" && item.answer) {
                    Object.keys(item.answer).forEach(qId => {
                        total++;
                        if (isAnswerValid(answersSoFar[qId])) answered++;
                    });
                }
            });
        }
        
        // ДОБАВЛЕНО: Обработка legacy matching вопросов
        ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach(key => {
            if (section[key] && section[key].matchingQuestions) {
                section[key].matchingQuestions.forEach(q => {
                    total++;
                    if (isAnswerValid(answersSoFar[q.qId])) answered++;
                });
            }
        });
    });
    
    return { total, answered };
}

function startTimer(duration, display) {
  if (!display) return;
  clearInterval(window.listeningTimerInterval);
  timerStartTime = Date.now();

  window.listeningTimerInterval = setInterval(() => {
    if (isPaused) return;

    const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    const remaining = duration - elapsed;

    if (remaining <= 0) {
      clearInterval(window.listeningTimerInterval);
      alert("Time's up! Submitting automatically.");
      handleFinishTest();
      return;
    }

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    display.textContent = `${minutes}:${seconds}`;

    if (remaining <= 300) display.style.color = "#dc2626";
    if (remaining === 300) alert("5 minutes remaining!");
    if (remaining === 60) alert("1 minute remaining!");

    pausedTime = remaining;
  }, 1000);
}

window.openReview = () => {
  const progress = analyzeTestProgress();
  alert(
    `Progress: ${progress.answered}/${
      progress.total
    } questions answered (${Math.round(
      (progress.answered / progress.total) * 100
    )}%)`
  );
};
