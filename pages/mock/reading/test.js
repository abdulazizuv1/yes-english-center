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
  storageBucket: "yes-english-center.firebasestorage.app",
  messagingSenderId: "203211203853",
  appId: "1:203211203853:web:7d499925c3aa830eaefc44",
  measurementId: "G-4LHEBLG2KK",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let currentPassageIndex = 0;
let passages = [];
let answersSoFar = {};
let orderedQIds = [];
let currentTestId = "test-1";
let currentQuestionIndex = 0;

// Pause functionality variables
let isPaused = false;
let pausedTime = 0;

// Create pause modal
function createPauseModal() {
  const modal = document.createElement("div");
  modal.className = "pause-modal";
  modal.id = "pauseModal";
  modal.innerHTML = `
       <div class="pause-modal-content">
           <h2>Reading Test Paused</h2>
           <p>Your test has been paused. Click resume when you're ready to continue.</p>
           <button class="resume-btn" onclick="togglePause()">Resume Test</button>
       </div>
   `;
  document.body.appendChild(modal);
}

// Toggle pause function
window.togglePause = function () {
  const pauseBtn = document.getElementById("pauseBtn");
  const pauseModal = document.getElementById("pauseModal");

  if (!isPaused) {
    // Pause the test
    isPaused = true;
    clearInterval(window.readingTimerInterval);
    pauseBtn.textContent = "Resume";
    pauseBtn.classList.add("paused");
    pauseModal.style.display = "flex";

    // Disable interaction with test
    document.querySelector(".passage-panel").style.pointerEvents = "none";
    document.querySelector(".questions-panel").style.pointerEvents = "none";
    document.querySelector(".bottom-controls").style.pointerEvents = "none";
    document.querySelector(".question-nav").style.pointerEvents = "none";
  } else {
    // Resume the test
    isPaused = false;
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("paused");
    pauseModal.style.display = "none";

    // Enable interaction with test
    document.querySelector(".passage-panel").style.pointerEvents = "auto";
    document.querySelector(".questions-panel").style.pointerEvents = "auto";
    document.querySelector(".bottom-controls").style.pointerEvents = "auto";
    document.querySelector(".question-nav").style.pointerEvents = "auto";

    // Resume timer with remaining time
    const display = document.getElementById("time");
    startTimer(pausedTime, display);
  }
};

// Question navigation functions
function generateQuestionNav() {
  const part1 = document.getElementById("part1Numbers");
  const part2 = document.getElementById("part2Numbers");
  const part3 = document.getElementById("part3Numbers");

  // Generate question numbers for each part
  for (let i = 1; i <= 13; i++) {
    const num = document.createElement("div");
    num.className = "nav-number";
    num.textContent = i;
    num.onclick = () => jumpToQuestion(i);
    part1.appendChild(num);
  }

  for (let i = 14; i <= 26; i++) {
    const num = document.createElement("div");
    num.className = "nav-number";
    num.textContent = i;
    num.onclick = () => jumpToQuestion(i);
    part2.appendChild(num);
  }

  for (let i = 27; i <= 40; i++) {
    const num = document.createElement("div");
    num.className = "nav-number";
    num.textContent = i;
    num.onclick = () => jumpToQuestion(i);
    part3.appendChild(num);
  }
}

function updateQuestionNav() {
  const allNumbers = document.querySelectorAll(".nav-number");
  allNumbers.forEach((num, index) => {
    num.classList.remove("current", "answered");

    const qId = `q${index + 1}`;
    if (answersSoFar[qId] && answersSoFar[qId].trim() !== "") {
      num.classList.add("answered");
    }

    // Highlight current question based on passage
    if (
      index + 1 >= getPassageStartQuestion(currentPassageIndex) &&
      index + 1 <= getPassageEndQuestion(currentPassageIndex)
    ) {
      if (index === currentQuestionIndex) {
        num.classList.add("current");
      }
    }
  });
}

function getPassageStartQuestion(passageIndex) {
  if (passageIndex === 0) return 1;
  if (passageIndex === 1) return 14;
  if (passageIndex === 2) return 27;
  return 1;
}

function getPassageEndQuestion(passageIndex) {
  if (passageIndex === 0) return 13;
  if (passageIndex === 1) return 26;
  if (passageIndex === 2) return 40;
  return 13;
}

function jumpToQuestion(questionNum) {
  // Determine which passage contains this question
  let targetPassage = 0;
  if (questionNum >= 14 && questionNum <= 26) targetPassage = 1;
  else if (questionNum >= 27) targetPassage = 2;

  currentPassageIndex = targetPassage;
  currentQuestionIndex = questionNum - 1;
  renderPassage(currentPassageIndex);
  updateQuestionNav();

  // Scroll to the specific question
  setTimeout(() => {
    const questionElement = document.getElementById(`q${questionNum}`);
    if (questionElement) {
      questionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}

// Highlight functionality
let selectedText = "";
let selectedRange = null;

document.addEventListener("mouseup", function () {
  const selection = window.getSelection();
  if (selection.toString().length > 0) {
    selectedText = selection.toString();
    selectedRange = selection.getRangeAt(0);
  }
});

document.addEventListener("contextmenu", function (e) {
  if (selectedText.length > 0)  {
    e.preventDefault();
    const contextMenu = document.getElementById("contextMenu");
    contextMenu.style.display = "block";
    contextMenu.style.left = e.pageX + "px";
    contextMenu.style.top = e.pageY + "px";
  }
});

document.addEventListener("click", function () {
  document.getElementById("contextMenu").style.display = "none";
});

window.highlightSelection = function () {
  if (selectedRange) {
    const span = document.createElement("span");
    span.className = "highlighted";
    try {
      selectedRange.surroundContents(span);
    } catch (e) {
      // If can't surround (crosses element boundaries), extract and wrap
      const contents = selectedRange.extractContents();
      span.appendChild(contents);
      selectedRange.insertNode(span);
    }
    window.getSelection().removeAllRanges();
    selectedText = "";
    selectedRange = null;
  }
  document.getElementById("contextMenu").style.display = "none";
};

window.removeHighlight = function () {
  if (selectedRange) {
    // Найти все highlighted элементы в выделенном диапазоне
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
  }

  window.getSelection().removeAllRanges();
  selectedText = "";
  selectedRange = null;
  document.getElementById("contextMenu").style.display = "none";
};

// Modified assignQuestionIds function
function assignQuestionIds() {
  let counter = 1;
  for (const passage of passages) {
    for (const question of passage.questions) {
      // Only assign qId to questions that have a 'question' field
      if (question.question) {
        question.qId = `q${counter}`;
        orderedQIds.push(question.qId);
        counter++;
      }

      if (question.type === "table") {
        // Get the column keys in visible order (excluding the first column)
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
                orderedQIds.push(qId);
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

// Load test function
async function loadTest() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get("testId") || "test-1";
    currentTestId = testId;

    console.log("🎯 Loading reading test with ID:", testId);

    const docRef = doc(db, "readingTests", testId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      passages = data.passages;
      assignQuestionIds();
      generateQuestionNav();
      renderPassage(currentPassageIndex);
      updateQuestionNav();
      console.log("✅ Reading test loaded successfully");
    } else {
      document.getElementById("passageText").innerHTML = "Test not found.";
      console.error("❌ Reading test not found:", testId);
    }
  } catch (error) {
    console.error("❌ Error loading reading test:", error);
    document.getElementById("passageText").innerHTML =
      "Error loading test: " + error.message;
  }
}


function renderPassage(index) {
  const passage = passages[index];

  // Update passage content
  document.getElementById("passageTitle").textContent = passage.title;
  document.getElementById("passageInstructions").textContent = passage.instructions;

  const formattedText = passage.text
    .split("\n\n")
    .map((p) => `<p>${p.trim()}</p>`)
    .join("");
  document.getElementById("passageText").innerHTML = formattedText;

  // Render questions с группировкой gap-fill
  const questionsList = document.getElementById("questionsList");
  questionsList.innerHTML = "";
  let lastInstruction = null;
  
  // Буфер для группировки gap-fill вопросов
  let gapFillGroup = {
    title: null,
    subtitle: null,
    info: null,
    questions: [],
    startDiv: null
  };

  passage.questions.forEach((q, i) => {
    // Show group instructions
    if (q.groupInstruction && q.groupInstruction !== lastInstruction) {
      // Сначала рендерим накопленную gap-fill группу если есть
      if (gapFillGroup.questions.length > 0) {
        renderGapFillGroupComplete(gapFillGroup, questionsList);
        gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
      }
      
      const instructionDiv = document.createElement("div");
      instructionDiv.className = "group-instruction";
      instructionDiv.innerHTML = q.groupInstruction
        .split("\n")
        .map((line) => `<p>${line}</p>`)
        .join("");
      questionsList.appendChild(instructionDiv);
      lastInstruction = q.groupInstruction;
    }

    const qDiv = document.createElement("div");
    qDiv.className = "question-item";

    // Обработка gap-fill вопросов с группировкой
    if (q.type === "gap-fill") {
      // Если это заголовок/подзаголовок без вопроса
      if (!q.question && (q.title || q.subheading || q.text)) {
        // Если уже есть накопленные вопросы, рендерим их
        if (gapFillGroup.questions.length > 0) {
          renderGapFillGroupComplete(gapFillGroup, questionsList);
          gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
        }
        
        // Начинаем новую группу
        if (q.title) gapFillGroup.title = q.title;
        if (q.subheading) gapFillGroup.subtitle = q.subheading;
        if (q.text) gapFillGroup.info = q.text;
        gapFillGroup.startDiv = qDiv;
      } 
      // Если это вопрос с qId
      else if (q.question && q.qId) {
        gapFillGroup.questions.push(q);
        
        // Проверяем, не последний ли это gap-fill вопрос
        const isLastGapFill = 
          i === passage.questions.length - 1 || 
          passage.questions[i + 1]?.type !== "gap-fill" ||
          (!passage.questions[i + 1]?.question && 
           (passage.questions[i + 1]?.title || passage.questions[i + 1]?.subheading));
        
        if (isLastGapFill) {
          renderGapFillGroupComplete(gapFillGroup, questionsList);
          gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
          return; // Пропускаем добавление qDiv
        }
      }
      return; // Не добавляем отдельные gap-fill элементы
    }
    
    // Рендерим накопленную gap-fill группу перед другими типами вопросов
    if (gapFillGroup.questions.length > 0) {
      renderGapFillGroupComplete(gapFillGroup, questionsList);
      gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
    }

    // Обработка других типов вопросов
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
    }

    // Add all types of questions except gap-fill (они уже добавлены группой)
    if (q.type !== "gap-fill" && (q.qId || q.type === "text-question" || q.type === "table")) {
      questionsList.appendChild(qDiv);
    }
  });

  // Рендерим последнюю gap-fill группу если осталась
  if (gapFillGroup.questions.length > 0) {
    renderGapFillGroupComplete(gapFillGroup, questionsList);
  }

  // Update navigation buttons
  document.getElementById("backBtn").style.display = index > 0 ? "inline-block" : "none";
  document.getElementById("nextBtn").style.display = index < passages.length - 1 ? "inline-block" : "none";
  document.getElementById("finishBtn").style.display = index === passages.length - 1 ? "inline-block" : "none";
}

// Функция для рендеринга полной группы Gap-Fill вопросов
function renderGapFillGroupComplete(group, container) {
  if (!group.questions.length) return;
  
  // Создаем единую секцию
  const section = document.createElement('div');
  section.className = 'question-item gap-fill-section';
  
  // Добавляем заголовок
  if (group.title) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'gap-fill-title';
    titleDiv.textContent = group.title;
    section.appendChild(titleDiv);
  }
  
  // Добавляем информационный текст
  if (group.info) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'gap-fill-info';
    infoDiv.textContent = group.info;
    section.appendChild(infoDiv);
  }
  
  // Добавляем подзаголовок
  if (group.subtitle) {
    const subtitleDiv = document.createElement('div');
    subtitleDiv.className = 'gap-fill-subtitle';
    subtitleDiv.textContent = group.subtitle;
    section.appendChild(subtitleDiv);
  }
  
  // Контейнер для вопросов
  const questionsContainer = document.createElement('div');
  questionsContainer.className = 'gap-fill-questions';
  
  // Определяем формат (с bullet points или без)
  const hasBullets = group.questions.some(q => 
    q.question && (q.question.includes('•') || 
                   q.question.includes('●') || 
                   q.question.includes('diet consists') ||
                   q.question.includes('nests are created'))
  );
  
  group.questions.forEach(q => {
    const questionDiv = document.createElement('div');
    questionDiv.className = hasBullets ? 'gap-fill-list-item' : 'gap-fill-question';
    questionDiv.id = q.qId;
    
    // Если есть буллеты
    if (hasBullets) {
      // Добавляем bullet
      const bullet = document.createElement('span');
      bullet.className = 'gap-fill-list-bullet';
      questionDiv.appendChild(bullet);
      
      const textWrapper = document.createElement('div');
      textWrapper.style.flex = '1';
      textWrapper.style.display = 'flex';
      textWrapper.style.alignItems = 'baseline';
      textWrapper.style.gap = '8px';
      
      // Номер вопроса
      const numberSpan = document.createElement('span');
      numberSpan.className = 'gap-fill-number';
      numberSpan.textContent = q.qId.replace('q', '');
      
      // Текст с инпутом
      const textSpan = document.createElement('span');
      textSpan.className = 'gap-fill-text';
      textSpan.style.flex = '1';
      
      // Очищаем текст от символов буллетов
      let cleanText = q.question.replace(/^[•●]\s*/, '');
      
      // Заменяем placeholder на input
      const inputHtml = cleanText.replace(
        /\.{3,}|_{3,}|…+|__________+/g,
        `<input type="text" 
                id="input-${q.qId}" 
                class="gap-fill-input" 
                placeholder="type here" />`
      );
      
      textSpan.innerHTML = inputHtml;
      
      textWrapper.appendChild(numberSpan);
      textWrapper.appendChild(textSpan);
      questionDiv.appendChild(textWrapper);
    } else {
      // Обычный формат без буллетов
      const numberSpan = document.createElement('span');
      numberSpan.className = 'gap-fill-number';
      numberSpan.textContent = q.qId.replace('q', '');
      
      const textSpan = document.createElement('span');
      textSpan.className = 'gap-fill-text';
      
      const inputHtml = q.question.replace(
        /\.{3,}|_{3,}|…+|__________+/g,
        `<input type="text" 
                id="input-${q.qId}" 
                class="gap-fill-input" 
                placeholder="type here" />`
      );
      
      textSpan.innerHTML = inputHtml;
      
      questionDiv.appendChild(numberSpan);
      questionDiv.appendChild(textSpan);
    }
    
    questionsContainer.appendChild(questionDiv);
  });
  
  section.appendChild(questionsContainer);
  container.appendChild(section);
  
  // Добавляем обработчики событий
  setTimeout(() => {
    group.questions.forEach(q => {
      const input = document.getElementById(`input-${q.qId}`);
      if (input) {
        input.value = answersSoFar[q.qId] || "";
        
        // Обработчик ввода
        input.addEventListener("input", (e) => {
          answersSoFar[q.qId] = e.target.value;
          updateQuestionNav();
          
          // Автоматическая ширина
          const minWidth = 100;
          const maxWidth = 180;
          const textLength = e.target.value.length;
          const newWidth = Math.min(Math.max(minWidth, textLength * 9), maxWidth);
          e.target.style.width = newWidth + 'px';
        });
        
        // Инициализация ширины если есть значение
        if (input.value) {
          const textLength = input.value.length;
          const newWidth = Math.min(Math.max(100, textLength * 9), 180);
          input.style.width = newWidth + 'px';
        }
      }
    });
  }, 0);
}

function renderGapFillQuestion(q, qDiv) {
  // Обработка заголовков и подзаголовков
  if (!q.question && (q.title || q.subheading || q.text)) {
    // Создаем контейнер для структурных элементов
    const structureDiv = document.createElement('div');
    structureDiv.style.marginBottom = '20px';
    
    if (q.title) {
      const titleElement = document.createElement('h3');
      titleElement.style.cssText = `
        font-size: 20px;
        font-weight: 700;
        color: #1a1a1a;
        text-align: center;
        margin: 25px 0 20px 0;
        padding-bottom: 12px;
        border-bottom: 2px solid #e9ecef;
      `;
      titleElement.textContent = q.title;
      structureDiv.appendChild(titleElement);
    }
    
    if (q.text) {
      const infoElement = document.createElement('div');
      infoElement.style.cssText = `
        font-size: 14px;
        color: #6c757d;
        font-style: italic;
        margin: 15px 0;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #e9ecef;
      `;
      infoElement.textContent = q.text;
      structureDiv.appendChild(infoElement);
    }
    
    if (q.subheading) {
      const subheadingElement = document.createElement('h4');
      subheadingElement.style.cssText = `
        font-size: 16px;
        font-weight: 600;
        color: #495057;
        margin: 20px 0 15px 0;
        padding-left: 12px;
        border-left: 3px solid #3b82f6;
      `;
      subheadingElement.textContent = q.subheading;
      structureDiv.appendChild(subheadingElement);
    }
    
    qDiv.appendChild(structureDiv);
    // Убираем стандартные стили question-item для структурных элементов
    qDiv.style.background = 'transparent';
    qDiv.style.border = 'none';
    qDiv.style.padding = '0';
    return;
  }

  // Обработка реальных вопросов с qId
  if (!q.question || !q.qId) return;

  // Создаем контейнер для вопроса
  const questionContainer = document.createElement('div');
  questionContainer.id = q.qId;
  questionContainer.style.cssText = `
    display: flex;
    align-items: baseline;
    padding: 12px 0;
    border-bottom: 1px solid #e9ecef;
  `;
  
  // Проверяем наличие буллетов в тексте
  const hasBullet = q.question.includes('•') || 
                    q.question.includes('●') || 
                    q.question.includes('diet consists') ||
                    q.question.includes('nests are created') ||
                    q.question.includes('the Recovery Plan');
  
  // Если есть буллеты, добавляем визуальный буллет
  if (hasBullet) {
    const bulletSpan = document.createElement('span');
    bulletSpan.style.cssText = `
      display: inline-block;
      width: 6px;
      height: 6px;
      background: #64748b;
      border-radius: 50%;
      margin: 8px 12px 0 4px;
      flex-shrink: 0;
    `;
    questionContainer.appendChild(bulletSpan);
  }
  
  // Контейнер для номера и текста
  const contentWrapper = document.createElement('div');
  contentWrapper.style.cssText = `
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 12px;
  `;
  
  // Номер вопроса
  const numberSpan = document.createElement('span');
  numberSpan.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #1e40af;
    color: white;
    min-width: 28px;
    height: 28px;
    border-radius: 50%;
    font-weight: 600;
    font-size: 14px;
    flex-shrink: 0;
    line-height: 28px;
    text-align: center;
  `;
  numberSpan.textContent = q.qId.replace('q', '');
  
  // Текст вопроса
  const textSpan = document.createElement('span');
  textSpan.style.cssText = `
    flex: 1;
    font-size: 15px;
    color: #374151;
    line-height: 1.8;
  `;
  
  // Очищаем текст от символов буллетов
  let cleanText = q.question.replace(/^[•●]\s*/, '');
  
  // Создаем HTML с инпутом
  const questionHtml = cleanText.replace(
    /\.{3,}|_{3,}|…+|__________+/g,
    () => {
      const inputId = `${q.qId}`;
      return `<input type="text" 
              id="${inputId}" 
              class="gap-fill-input"
              style="
                background: white;
                border: 2px solid #cbd5e1;
                border-radius: 4px;
                padding: 6px 10px;
                font-size: 14px;
                font-weight: 500;
                min-width: 100px;
                max-width: 180px;
                margin: 0 6px;
                transition: all 0.2s;
                vertical-align: baseline;
              "
              placeholder="type here" />`;
    }
  );
  
  textSpan.innerHTML = questionHtml;
  
  contentWrapper.appendChild(numberSpan);
  contentWrapper.appendChild(textSpan);
  questionContainer.appendChild(contentWrapper);
  
  // Очищаем qDiv и добавляем новое содержимое
  qDiv.innerHTML = '';
  qDiv.appendChild(questionContainer);
  
  // Улучшаем стиль контейнера вопроса
  qDiv.style.cssText = `
    margin-bottom: 8px;
    padding: 12px 20px;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    transition: all 0.2s;
  `;
  
  // Добавляем hover эффект
  qDiv.addEventListener('mouseenter', () => {
    qDiv.style.borderColor = '#3b82f6';
    qDiv.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.1)';
  });
  
  qDiv.addEventListener('mouseleave', () => {
    qDiv.style.borderColor = '#e5e7eb';
    qDiv.style.boxShadow = 'none';
  });
  
  // Добавляем обработчики событий для инпута
  setTimeout(() => {
    const input = document.getElementById(q.qId);
    if (input) {
      // Устанавливаем сохраненное значение
      input.value = answersSoFar[q.qId] || "";
      
      // Обработчик ввода
      input.addEventListener("input", (e) => {
        answersSoFar[q.qId] = e.target.value;
        updateQuestionNav();
        
        // Автоматическая подстройка ширины
        const minWidth = 100;
        const maxWidth = 180;
        const textLength = e.target.value.length;
        const newWidth = Math.min(Math.max(minWidth, textLength * 9), maxWidth);
        e.target.style.width = newWidth + 'px';
        
        // Изменение стиля при заполнении
        if (e.target.value.trim()) {
          e.target.style.background = '#f0fdf4';
          e.target.style.borderColor = '#10b981';
        } else {
          e.target.style.background = 'white';
          e.target.style.borderColor = '#cbd5e1';
        }
      });
      
      // Обработчик фокуса
      input.addEventListener('focus', (e) => {
        e.target.style.borderColor = '#3b82f6';
        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
        if (!e.target.value.trim()) {
          e.target.style.background = '#f0f9ff';
        }
      });
      
      input.addEventListener('blur', (e) => {
        e.target.style.boxShadow = 'none';
        if (!e.target.value.trim()) {
          e.target.style.background = 'white';
          e.target.style.borderColor = '#cbd5e1';
        }
      });
      
      // Инициализация ширины если есть значение
      if (input.value) {
        const textLength = input.value.length;
        const newWidth = Math.min(Math.max(100, textLength * 9), 180);
        input.style.width = newWidth + 'px';
        input.style.background = '#f0fdf4';
        input.style.borderColor = '#10b981';
      }
    }
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
    qDiv.innerHTML += `<p><em>${q.text}</em></p>`;
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
      if (answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        answersSoFar[q.qId] = e.target.value;
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
      select.value = answersSoFar[q.qId] || "";
      select.addEventListener("change", (e) => {
        answersSoFar[q.qId] = e.target.value;
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
               <input type="radio" name="${q.qId}" value="${opt.label}"> 
               ${opt.label}. ${opt.text}
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
      if (answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        answersSoFar[q.qId] = e.target.value;
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
      if (answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
      }
      radio.addEventListener("change", (e) => {
        answersSoFar[q.qId] = e.target.value;
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderTableQuestion(q, qDiv) {
  // Add title before table if exists
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

  // Create table header
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

    // First column (row name)
    const colName = document.createElement("td");
    colName.innerHTML = row.column || "";
    colName.style.border = "1px solid #ddd";
    colName.style.padding = "12px 8px";
    colName.style.fontWeight = "bold";
    colName.style.backgroundColor = "#f1f3f4";
    tr.appendChild(colName);

    // Other columns
    columnKeys.forEach((key) => {
      const td = document.createElement("td");
      const raw = row[key] || "";

      // Process cell content
      let cellContent = String(raw).replace(
        /___(q\d+)___/g,
        function (_, realId) {
          return `<span style="font-weight: bold; color: #1976d2;">${realId
            .toUpperCase()
            .replace(
              "Q",
              ""
            )}:</span> <input type="text" id="${realId}" class="gap_fill_input" placeholder="Your answer..." style="border: 1px solid #ccc; padding: 4px 8px; border-radius: 4px; margin-left: 5px; min-width: 120px;" value="${
            answersSoFar[realId] || ""
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

  // Add event listeners for input fields after adding to DOM
  setTimeout(() => {
    const inputs = qDiv.querySelectorAll('input[type="text"]');
    inputs.forEach((input) => {
      const qId = input.id;
      input.value = answersSoFar[qId] || "";
      input.addEventListener("input", (e) => {
        answersSoFar[qId] = e.target.value;
        updateQuestionNav();
      });
    });
  }, 0);
}

// Timer function with pause support
function startTimer(durationInSeconds, display) {
  clearInterval(window.readingTimerInterval);

  const startTime = Date.now();
  pausedTime = durationInSeconds;

  window.readingTimerInterval = setInterval(() => {
    if (isPaused) return; // Don't update timer if paused

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = durationInSeconds - elapsed;
    pausedTime = remaining; // Save current time

    if (remaining <= 0) {
      clearInterval(window.readingTimerInterval);
      alert("Time's up!");
      handleFinish();
      return;
    }

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    display.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

// Event handlers
document.getElementById("backBtn").addEventListener("click", () => {
  if (currentPassageIndex > 0) {
    currentPassageIndex--;
    renderPassage(currentPassageIndex);
    updateQuestionNav();
  }
});

document.getElementById("nextBtn").addEventListener("click", () => {
  if (currentPassageIndex < passages.length - 1) {
    currentPassageIndex++;
    renderPassage(currentPassageIndex);
    updateQuestionNav();
  }
});

document.getElementById("finishBtn").addEventListener("click", handleFinish);

// Find question function
function findQuestionByQId(qId) {
  for (const p of passages) {
    for (const q of p.questions) {
      if (q.qId === qId) return q;
      if (Array.isArray(q.qIds) && q.qIds.includes(qId)) {
        return { ...q, qId };
      }
    }
  }
  return { answer: [] };
}

// Handle finish function
// Handle finish function
async function handleFinish() {
  // Disable finish button to prevent multiple clicks
  const finishBtn = document.getElementById("finishBtn");
  finishBtn.disabled = true;
  finishBtn.textContent = "Submitting...";
  
  // Show loading modal
  const loadingModal = document.getElementById("loadingModal");
  loadingModal.style.display = "flex";

  // Подсчет результатов ПЕРЕД проверкой пользователя
  const answers = {};
  const correctAnswers = {};
  let correct = 0;
  let total = 0;

  for (const qId of orderedQIds) {
    const q = findQuestionByQId(qId);

    let userAns = answersSoFar[qId];
    if (Array.isArray(userAns)) {
      userAns = userAns[0] || "";
    }
    userAns = typeof userAns === "string" ? userAns.trim().toLowerCase() : "";

    answers[qId] = userAns;
    total++;

    // Get correct answer
    let correctAnsArray = [];

    if (typeof q.answer === "object" && !Array.isArray(q.answer)) {
      const extracted = q.answer[qId];
      correctAnsArray = Array.isArray(extracted) ? extracted : [extracted];
    } else {
      correctAnsArray = Array.isArray(q.answer) ? q.answer : [q.answer];
    }

    correctAnsArray = correctAnsArray
      .filter((a) => typeof a === "string")
      .map((a) => a.trim().toLowerCase());

    correctAnswers[qId] = correctAnsArray;

    const isCorrect = correctAnsArray.includes(userAns);
    if (isCorrect) correct++;
  }

  // Теперь проверяем пользователя
  const auth = getAuth();
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  if (!user) {
    // Hide loading modal and restore button
    loadingModal.style.display = "none";
    finishBtn.disabled = false;
    finishBtn.textContent = "Finish Test";
    
    alert("You must be logged in to submit.");
    window.location.href = "/";
    return;
  }

  try {
    const docRef = await addDoc(collection(db, "resultsReading"), {
      userId: user.uid,
      name: user.email || "unknown",
      testId: currentTestId,
      score: correct,
      total: total,
      answers,
      correctAnswers,
      createdAt: serverTimestamp(),
    });

    window.location.href = `/pages/mock/result.html?id=${docRef.id}`;
    clearInterval(window.readingTimerInterval);
    window.finished = true;
  } catch (e) {
    console.error("❌ Error saving result:", e);
    
    // Hide loading modal and restore button on error
    loadingModal.style.display = "none";
    finishBtn.disabled = false;
    finishBtn.textContent = "Finish Test";
    
    alert("Error submitting your result. Please try again.");
  }
}

// Review function
window.openReview = function () {
  alert("Review functionality - showing all answers and flagged questions");
};

// Initialize when page loads
window.onload = () => {
  createPauseModal(); // Create pause modal
  loadTest().then(() => {
    const display = document.getElementById("time");
    startTimer(60 * 60, display); // 60 minutes
  });
};
