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
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// Global variables
let testData = null;
let currentStage = "listening"; // 'listening', 'reading', 'writing'
let currentStageIndex = 0;
let stageNames = ["listening", "reading", "writing"];
let stageData = {};
let answersSoFar = {};
let currentSectionIndex = 0;
let currentPassageIndex = 0;
let currentQuestionIndex = 0;
let orderedQIds = [];
let currentTestId = null;
let currentAudio = null;
let isPaused = false;
let pausedTime = 0;
let timerStartTime = null;
let audioWasPaused = false;
let audioCurrentTime = 0;
let currentAudioSection = 0; // Какая секция аудио сейчас играет
let audioInitialized = false; // Было ли аудио инициализировано

// Функция для полной остановки аудио
function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.src = ""; // Очищаем источник
    currentAudio = null;
  }

  // Также останавливаем все аудио элементы на странице
  const allAudio = document.querySelectorAll("audio");
  allAudio.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
    audio.src = "";
  });

  // Очищаем аудио контейнер
  const audioContainer = document.getElementById("audio-container");
  if (audioContainer) {
    audioContainer.innerHTML = "";
  }
}

// Pause functionality
window.togglePause = function () {
  if (currentStage !== "listening") return;

  const pauseBtn = document.getElementById("pauseBtn");
  const pauseModal = document.getElementById("pauseModal");

  if (!isPaused) {
    isPaused = true;
    clearInterval(window.fullMockTimerInterval);
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
  [".main-content", ".bottom-controls", ".question-nav"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.style.pointerEvents = enable ? "auto" : "none";
  });
}

function getCurrentRemainingTime() {
  if (!timerStartTime) return stageDurations[currentStage] * 60;
  const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
  return Math.max(0, stageDurations[currentStage] * 60 - elapsed);
}

// Stage durations in minutes
const stageDurations = {
  listening: 30,
  reading: 60,
  writing: 60,
};

// Question navigation functions
function generateQuestionNav() {
  const questionNav = document.getElementById("questionNav");
  questionNav.innerHTML = "";

  if (currentStage === "listening") {
    // Generate listening navigation (4 sections, 10 questions each)
    for (let section = 1; section <= 4; section++) {
      const navSection = document.createElement("div");
      navSection.className = "nav-section";

      const label = document.createElement("span");
      label.className = "nav-label";
      label.textContent = `Section ${section}:`;

      navSection.appendChild(label);

      const navNumbers = document.createElement("div");
      navNumbers.className = "nav-numbers";
      navNumbers.id = `section${section}Numbers`;

      for (let i = (section - 1) * 10 + 1; i <= section * 10; i++) {
        const num = document.createElement("div");
        num.className = "nav-number";
        num.textContent = i;
        num.onclick = () => jumpToQuestion(i);
        navNumbers.appendChild(num);
      }

      navSection.appendChild(navNumbers);
      questionNav.appendChild(navSection);
    }
  } else if (currentStage === "reading") {
    // Generate reading navigation (3 passages with different question ranges)
    const passageRanges = [
      { start: 1, end: 13, name: "Passage 1" },
      { start: 14, end: 26, name: "Passage 2" },
      { start: 27, end: 40, name: "Passage 3" },
    ];

    passageRanges.forEach((passage, index) => {
      const navSection = document.createElement("div");
      navSection.className = "nav-section";

      const label = document.createElement("span");
      label.className = "nav-label";
      label.textContent = `${passage.name}:`;

      navSection.appendChild(label);

      const navNumbers = document.createElement("div");
      navNumbers.className = "nav-numbers";

      for (let i = passage.start; i <= passage.end; i++) {
        const num = document.createElement("div");
        num.className = "nav-number";
        num.textContent = i;
        num.onclick = () => jumpToQuestion(i);
        navNumbers.appendChild(num);
      }

      navSection.appendChild(navNumbers);
      questionNav.appendChild(navSection);
    });
  } else if (currentStage === "writing") {
    // Writing stage - no question navigation needed
    questionNav.style.display = "none";
  }
}

function updateQuestionNav() {
  const allNumbers = document.querySelectorAll(".nav-number");
  allNumbers.forEach((num, index) => {
    num.classList.remove("current", "answered");

    const questionNum = parseInt(num.textContent);
    let qId = "";

    if (currentStage === "listening") {
      qId = `q${questionNum}`; // ✅ БЕЗ префикса listening_
    } else if (currentStage === "reading") {
      qId = `reading_q${questionNum}`; // reading оставляем как есть
    }

    // Visual improvements
    const isAnswered =
      answersSoFar[qId] !== undefined &&
      answersSoFar[qId] !== "" &&
      answersSoFar[qId] !== null;
    num.style.background = isAnswered ? "#10b981" : "#e5e7eb";
    num.style.color = isAnswered ? "white" : "#6b7280";
    num.style.transform = "scale(1)";
    num.style.boxShadow = "none";

    if (isAnswered) num.classList.add("answered");

    // Current question highlighting
    if (currentStage === "listening") {
      if (
        questionNum >= getSectionStartQuestion(currentSectionIndex) &&
        questionNum <= getSectionEndQuestion(currentSectionIndex)
      ) {
        if (questionNum === currentQuestionIndex + 1) {
          num.classList.add("current");
          num.style.background = "#3b82f6";
          num.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.3)";
        }
      }
    }
    num.onmouseenter = function () {
      if (!this.classList.contains("current")) {
        this.style.transform = "scale(1.1)";
      }
    };
    num.onmouseleave = function () {
      this.style.transform = "scale(1)";
    };
  });
}

function getSectionStartQuestion(sectionIndex) {
  return sectionIndex * 10 + 1;
}

function getSectionEndQuestion(sectionIndex) {
  return (sectionIndex + 1) * 10;
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
  if (currentStage === "listening") {
    // Determine which section contains this question
    let targetSection = Math.floor((questionNum - 1) / 10);

    // Проверяем, нужно ли перерисовывать секцию
    if (currentSectionIndex !== targetSection) {
      currentSectionIndex = targetSection;
      renderListeningSection(currentSectionIndex);
    }
    currentQuestionIndex = questionNum - 1;
  } else if (currentStage === "reading") {
    // Determine which passage contains this question
    let targetPassage = 0;
    if (questionNum >= 14 && questionNum <= 26) targetPassage = 1;
    else if (questionNum >= 27) targetPassage = 2;

    currentPassageIndex = targetPassage;
    currentQuestionIndex = questionNum - 1;
    renderReadingPassage(currentPassageIndex);
  }

  updateQuestionNav();
  updateStageIndicator();

  // Scroll to the specific question
  setTimeout(() => {
    const questionElement = document.getElementById(`q${questionNum}`);
    if (questionElement) {
      questionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}

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
function getInitialSelections(group, optionKey) {
  if (!group.questions || !Array.isArray(group.questions)) return false;

  return group.questions.some((q) => {
    const qId = q.questionId; // ✅ БЕЗ префикса listening_
    const savedAnswer = answersSoFar[qId];
    return savedAnswer === optionKey;
  });
}
document.addEventListener("change", (e) => {
  if (e.target.type === "checkbox") {
    const qId = e.target.dataset.qid || e.target.name;
    if (e.target.checked) {
      answersSoFar[qId] = e.target.value;
    } else {
      delete answersSoFar[qId];
    }
    updateQuestionNav();
  }
});

function updateStageIndicator() {
  const stageIndicator = document.getElementById("stageIndicator");
  const sectionIndicator = document.getElementById("sectionIndicator");

  stageIndicator.textContent = `Stage ${currentStageIndex + 1} of 3`;

  if (currentStage === "listening") {
    sectionIndicator.textContent = `Section ${currentSectionIndex + 1} of 4`;
  } else if (currentStage === "reading") {
    sectionIndicator.textContent = `Passage ${currentPassageIndex + 1} of 3`;
  } else if (currentStage === "writing") {
    sectionIndicator.textContent = `Writing Tasks 1 & 2`;
  }
}

// Authentication check
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("Please log in to take the test.");
    window.location.href = "/login.html";
    return;
  }
  loadTest();
});

// Load test function
async function loadTest() {
  try {
    // Получить testId из URL параметров
    const urlParams = new URLSearchParams(window.location.search);
    currentTestId = urlParams.get("testId") || "test-1";
    console.log("🔄 Loading full mock test...");
    const docRef = doc(db, "fullmockTests", currentTestId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error("❌ Test document not found");
      return;
    }

    testData = docSnap.data();
    console.log("📋 Test data loaded:", testData);

    // Extract stage data
    testData.stages.forEach((stage) => {
      stageData[stage.id] = stage;
    });

    console.log("✅ Full mock test loaded successfully");

    // Start with listening
    initializeStage("listening");
  } catch (error) {
    console.error("❌ Error loading test:", error);
  }
}

// Initialize stage
function initializeStage(stageName) {
  stopAllAudio();

  currentStage = stageName;
  currentStageIndex = stageNames.indexOf(stageName);

  // Update UI
  updateStageTitle();
  showStageContent(stageName);
  generateQuestionNav();
  updateStageIndicator();

  // Start timer for the stage
  const duration = stageDurations[stageName] * 60;
  startTimer(duration, document.getElementById("time"));

  // Initialize stage-specific content
  if (stageName === "listening") {
    initializeListening();
  } else if (stageName === "reading") {
    initializeReading();
  } else if (stageName === "writing") {
    initializeWriting();
  }

  updateQuestionNav();
}

function updateStageTitle() {
  const testTitle = document.getElementById("testTitle");
  const stageNames = {
    listening: "IELTS Full Mock Test - Listening",
    reading: "IELTS Full Mock Test - Reading",
    writing: "IELTS Full Mock Test - Writing",
  };
  testTitle.textContent = stageNames[currentStage];
}

function showStageContent(stageName) {
  // Hide all stage contents
  document.getElementById("listeningStage").style.display = "none";
  document.getElementById("readingStage").style.display = "none";
  document.getElementById("writingStage").style.display = "none";

  // Show current stage
  document.getElementById(`${stageName}Stage`).style.display = "flex";

  // Show/hide question navigation
  const questionNav = document.getElementById("questionNav");
  if (stageName === "writing") {
    questionNav.style.display = "none";
  } else {
    questionNav.style.display = "flex";
  }
}

// Initialize Listening
function initializeListening() {
  const sections = stageData.listening.sections;
  currentSectionIndex = 0;
  audioInitialized = false; // Сбрасываем флаг аудио
  currentAudioSection = 0;   // Сбрасываем текущую секцию аудио
  renderListeningSection(0);
}

function renderListeningSection(index) {
  const section = stageData.listening.sections[index];
  if (!section) return;

  console.log(`🎯 Rendering listening section ${index + 1}`);

  // Enhanced audio handling
  handleSectionAudio(section, index);

  // Render questions
  const questionList = document.getElementById("listening-questions");
  questionList.innerHTML = `
    <div class="section-title" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin: 0;">Section ${index + 1}: ${
    section.title || `Section ${index + 1}`
  }</h2>
    </div>
  `;

  if (section.instructions) {
    questionList.innerHTML += `
      <div class="group-instruction" style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
        ${
          section.instructions.heading
            ? `<h4>${section.instructions.heading}</h4>`
            : ""
        }
        ${
          section.instructions.details
            ? `<p>${section.instructions.details}</p>`
            : ""
        }
      </div>
    `;
  }

  if (section.content && Array.isArray(section.content)) {
    section.content.forEach((item) => renderListeningContentItem(item));
  }

  updateNavigationButtons();
}
function handleSectionAudio(section, index) {
  // Если аудио уже инициализировано, не трогаем его при навигации
  if (audioInitialized) return;
  
  const container = document.getElementById("audio-container");
  if (!container) return;
  
  // Инициализируем аудио только один раз - начинаем с первой секции
  initializeSequentialAudio();
  audioInitialized = true;
}

function initializeSequentialAudio() {
  const container = document.getElementById("audio-container");
  playAudioForSection(0); // Всегда начинаем с первой секции
  
  function playAudioForSection(sectionIndex) {
    if (sectionIndex >= stageData.listening.sections.length) return; // Все аудио проиграно
    
    const section = stageData.listening.sections[sectionIndex];
    if (!section.audioUrl) {
      // Если у секции нет аудио, переходим к следующей
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
    
    currentAudio = document.getElementById('sectionAudio');
    currentAudioSection = sectionIndex;
    
    if (currentAudio) {
      currentAudio.addEventListener('ended', () => {
        // После окончания текущего аудио, играем следующее
        setTimeout(() => playAudioForSection(sectionIndex + 1), 1000);
      });
    }
  }
}

function renderListeningContentItem(item, itemIndex) {
  const questionList = document.getElementById("listening-questions");

  if (item.type) {
    switch (item.type) {
      case "text":
        questionList.innerHTML += `<p style="margin: 15px 0; color: #4b5563;">${
          item.value || item.text || ""
        }</p>`;
        break;

      case "subheading":
        questionList.innerHTML += `<h4 style="margin-top:20px; color: #dc2626; font-weight: 600;">${
          item.value || item.text || ""
        }</h4>`;
        break;

      case "question":
        renderListeningQuestion(item);
        break;

      case "question-group":
        renderListeningQuestionGroup(item);
        break;
      case "table":
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
    const prefix = question.text || "";
    const postfix = question.postfix || "";
    const number = qId.toUpperCase().replace("Q", "");

    questionDiv.innerHTML = `
      <div class="question-number">${number}</div>
      <div class="question-text">
        ${prefix} <input type="text" value="${
      answersSoFar[qId] || ""
    }" data-qid="${qId}" class="gap-fill"/> ${postfix}
      </div>
    `;
  } else if (question.format === "multiple-choice") {
    let optionsHtml = '<div class="radio-group">';

    Object.keys(question.options)
      .sort()
      .forEach((key) => {
        const checked = answersSoFar[qId] === key ? "checked" : "";
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
  const maxSelections = extractMaxSelections(
    group.instructions || group.text || ""
  );
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
    const sectionStart = currentSectionIndex * 10 + 1;

    for (let i = 0; i < maxSelections; i++) {
      questionIds.push(`q${sectionStart + i}`);
    }
  }
  groupDiv.innerHTML = `
    <div data-group-id="${groupQId}" style="margin: 25px 0; padding: 20px; border: 2px solid #3b82f6; border-radius: 10px; background: #f8fafc;">
      <div class="group-instruction">
        <h4>${group.instructions}</h4>
        <p style="font-weight: 600;">${group.text}</p>
        <div class="selection-counter" style="margin-bottom: 15px; padding: 10px; background: #e0f2fe; border-radius: 6px; font-weight: 600; color: #0369a1;">
          Selected: <span id="counter-${groupQId}">0</span> / ${maxSelections}
        </div>
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
              if (answersSoFar[qId] === key) {
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
    <div class="group-instruction">
      <h4>${group.instructions}</h4>
    </div>
    
    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="font-weight: 600; margin-bottom: 10px;">${group.text}</p>
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
                answersSoFar[qId] === key ? "selected" : ""
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

      // ✅ ИСПРАВЛЕНО: Обрабатываем паттерн ___qX___
      content = content.replace(/___q(\d+)___/g, (match, num) => {
        const qId = `q${num}`;

        return `<span style="font-weight: bold; color: #1976d2;">${num}:</span> <input type="text" data-qid="${qId}" class="gap-fill table-input" style="border: 1px solid #ccc; padding: 4px 8px; border-radius: 4px; margin-left: 5px; min-width: 120px;" value="${
          answersSoFar[qId] || ""
        }" placeholder="Your answer..." />`;
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
// Initialize Reading
function initializeReading() {
  const passages = stageData.reading.passages;
  currentPassageIndex = 0;
  assignReadingQuestionIds();
  renderReadingPassage(0);
}

function assignReadingQuestionIds() {
  let counter = 1;
  orderedQIds = [];

  for (const passage of stageData.reading.passages) {
    for (const question of passage.questions) {
      if (question.question) {
        question.qId = `reading_q${counter}`; // Add reading prefix
        orderedQIds.push(question.qId);
        counter++;
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

function renderReadingPassage(index) {
  const passage = stageData.reading.passages[index];

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

  passage.questions.forEach((q, i) => {
    // Show group instructions
    if (q.groupInstruction && q.groupInstruction !== lastInstruction) {
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

    switch (q.type) {
      case "gap-fill":
        renderReadingGapFillQuestion(q, qDiv);
        break;
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
    }

    if (q.qId || q.type === "text-question" || q.type === "table") {
      questionsList.appendChild(qDiv);
    }
  });

  updateNavigationButtons();
}

function renderReadingGapFillQuestion(q, qDiv) {
  if (!q.question && (q.title || q.subheading)) {
    if (q.title) {
      qDiv.innerHTML += `<h3 style="margin-top: 20px; margin-bottom: 10px; font-weight: bold;">${q.title}</h3>`;
    }
    if (q.subheading) {
      qDiv.innerHTML += `<h4 style="margin-top: 15px; margin-bottom: 8px; font-weight: bold; color: #333;">${q.subheading}</h4>`;
    }
    return;
  }

  if (!q.question || !q.qId) return;

  // Extract just the number from qId (remove "reading_q" prefix)
  const questionNumber = q.qId.replace("reading_q", "");

  const questionHtml = `
    <div class="question-number">${questionNumber}</div>
    <div class="question-text">${q.question.replace(
      /\.{3,}|_{3,}|…+|__________+/g,
      `<input type="text" id="${q.qId}" class="gap-fill-input" placeholder="..." />`
    )}</div>
  `;
  qDiv.innerHTML = questionHtml;

  setTimeout(() => {
    const input = document.getElementById(q.qId);
    if (input) {
      input.value = answersSoFar[q.qId] || "";
      input.addEventListener("input", (e) => {
        answersSoFar[q.qId] = e.target.value;
        updateQuestionNav();
      });
    }
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
      select.value = answersSoFar[q.qId] || "";
      select.addEventListener("change", (e) => {
        answersSoFar[q.qId] = e.target.value;
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

// Initialize Writing
function initializeWriting() {
  const writingTasks = stageData.writing.tasks[0]; // Assuming first test

  // Render Task 1
  document.getElementById("task1Question").textContent =
    writingTasks.task1.question;
  if (writingTasks.task1.imageUrl) {
    document.getElementById("task1Image").innerHTML = `
      <img src="${writingTasks.task1.imageUrl}" alt="Task 1 Image" style="max-width: 100%; height: auto; border-radius: 8px;">
    `;
  }

  // Render Task 2
  document.getElementById("task2Question").textContent =
    writingTasks.task2.question;

  // Set up word count functionality
  setupWordCount("task1Answer", "task1WordCount");
  setupWordCount("task2Answer", "task2WordCount");
  // Restore saved writing answers
  const savedTask1 = localStorage.getItem("fullmock_task1Answer");
  const savedTask2 = localStorage.getItem("fullmock_task2Answer");

  if (savedTask1) {
    document.getElementById("task1Answer").value = savedTask1;
    answersSoFar["task1Answer"] = savedTask1;
  }

  if (savedTask2) {
    document.getElementById("task2Answer").value = savedTask2;
    answersSoFar["task2Answer"] = savedTask2;
  }

  updateNavigationButtons();
}

function setupWordCount(textareaId, counterId) {
  const textarea = document.getElementById(textareaId);
  const counter = document.getElementById(counterId);

  // Load existing answer if any
  if (answersSoFar[textareaId]) {
    textarea.value = answersSoFar[textareaId];
  }

  function updateWordCount() {
    const text = textarea.value.trim();
    const wordCount = text === "" ? 0 : text.split(/\s+/).length;
    counter.textContent = wordCount;

    // Save answer В ОБЪЕКТ answersSoFar И в локальное хранилище
    answersSoFar[textareaId] = textarea.value;
    localStorage.setItem(`fullmock_${textareaId}`, textarea.value);
  }

  textarea.addEventListener("input", updateWordCount);
  updateWordCount(); // Initial count
}

// Navigation functions
function updateNavigationButtons() {
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const finishStageBtn = document.getElementById("finishStageBtn");
  const finishBtn = document.getElementById("finishBtn");

  if (currentStage === "listening") {
    backBtn.style.display = currentSectionIndex > 0 ? "inline-block" : "none";
    nextBtn.style.display =
      currentSectionIndex < stageData.listening.sections.length - 1
        ? "inline-block"
        : "none";
    finishStageBtn.style.display =
      currentSectionIndex === stageData.listening.sections.length - 1
        ? "inline-block"
        : "none";
    // Обновляем текст кнопки для listening
    if (finishStageBtn) {
      finishStageBtn.textContent = "Finish Listening";
    }
    finishBtn.style.display = "none";
  } else if (currentStage === "reading") {
    backBtn.style.display = currentPassageIndex > 0 ? "inline-block" : "none";
    nextBtn.style.display =
      currentPassageIndex < stageData.reading.passages.length - 1
        ? "inline-block"
        : "none";
    finishStageBtn.style.display =
      currentPassageIndex === stageData.reading.passages.length - 1
        ? "inline-block"
        : "none";
    // Обновляем текст кнопки для reading
    if (finishStageBtn) {
      finishStageBtn.textContent = "Finish Reading";
    }
    finishBtn.style.display = "none";
  } else if (currentStage === "writing") {
    backBtn.style.display = "none";
    nextBtn.style.display = "none";
    finishStageBtn.style.display = "none";
    finishBtn.style.display = "inline-block";
  }
}

// Event handlers
document.addEventListener("input", (e) => {
  const input = e.target;
  const qId = input.dataset.qid || input.id;

  if (
    input.classList.contains("gap-fill") ||
    input.classList.contains("gap-fill-input") ||
    input.classList.contains("gap_fill_input") ||
    input.classList.contains("table-input") // ✅ Добавлен новый класс
  ) {
    answersSoFar[qId] = input.value;
    updateQuestionNav();
  }
});

document.addEventListener("change", (e) => {
  const input = e.target;
  const qId = input.name || input.dataset.qid || input.id;

  if (
    input.classList.contains("matching-select") ||
    input.classList.contains("select-input")
  ) {
    answersSoFar[qId] = input.value;
    updateQuestionNav();
    return;
  }

  if (input.type === "radio") {
    answersSoFar[qId] = input.value;
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
      for (const section of stageData.listening.sections) {
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
        const sectionStart = currentSectionIndex * 10 + 1;
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
          if (!answersSoFar[qId]) {
            assignedQuestionId = qId;
            break;
          }
        }

        if (assignedQuestionId) {
          answersSoFar[assignedQuestionId] = optionKey;
          console.log(`✅ Assigned ${optionKey} to ${assignedQuestionId}`);
        }
      } else {
        // Удаляем ответ
        for (const qId of questionIds) {
          if (answersSoFar[qId] === optionKey) {
            delete answersSoFar[qId];
            console.log(`❌ Removed ${optionKey} from ${qId}`);
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

      updateQuestionNav();
    }
  }
});

// Navigation button handlers
document.getElementById("nextBtn").onclick = () => {
  if (currentStage === "listening") {
    if (currentSectionIndex < stageData.listening.sections.length - 1) {
      currentSectionIndex++;
      renderListeningSection(currentSectionIndex);
      updateQuestionNav();
      updateStageIndicator();
    }
  } else if (currentStage === "reading") {
    if (currentPassageIndex < stageData.reading.passages.length - 1) {
      currentPassageIndex++;
      renderReadingPassage(currentPassageIndex);
      updateQuestionNav();
      updateStageIndicator();
    }
  }
};

document.getElementById("backBtn").onclick = () => {
  if (currentStage === "listening") {
    if (currentSectionIndex > 0) {
      currentSectionIndex--;
      renderListeningSection(currentSectionIndex);
      updateQuestionNav();
      updateStageIndicator();
    }
  } else if (currentStage === "reading") {
    if (currentPassageIndex > 0) {
      currentPassageIndex--;
      renderReadingPassage(currentPassageIndex);
      updateQuestionNav();
      updateStageIndicator();
    }
  }
};

document.getElementById("finishStageBtn").onclick = () => {
  if (currentStage === "listening") {
    showStageTransition("listening", "reading");
  } else if (currentStage === "reading") {
    showStageTransition("reading", "writing");
  }
};

document.getElementById("finishBtn").onclick = async () => {
  // Disable finish button to prevent multiple clicks
  const finishBtn = document.getElementById("finishBtn");
  finishBtn.disabled = true;
  finishBtn.textContent = "Submitting...";

  // Show loading modal
  const loadingModal = document.getElementById("loadingModal");
  loadingModal.style.display = "flex";

  try {
    await handleFinishTest();
  } catch (error) {
    // Hide loading modal and restore button on error
    loadingModal.style.display = "none";
    finishBtn.disabled = false;
    finishBtn.textContent = "Finish Test";
    console.error("Error in handleFinishTest:", error);
  }
};

// Stage transition
function showStageTransition(fromStage, toStage) {
  const modal = document.getElementById("stageTransitionModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");

  const stageNames = {
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
  };

  modalTitle.textContent = `${stageNames[fromStage]} Complete!`;
  modalMessage.textContent = `You have completed the ${fromStage} section. Ready to start ${toStage}?`;

  modal.style.display = "flex";

  document.getElementById("continueToNextStage").onclick = () => {
    modal.style.display = "none";
    clearInterval(window.fullMockTimerInterval);
    stopAllAudio();
    initializeStage(toStage);
  };
}

// Finish test
async function handleFinishTest() {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit.");
    return;
  }

  // Collect all answers with correct answers for comparison
  const listeningAnswers = {};
  const listeningCorrectAnswers = {};
  const readingAnswers = {};
  const readingCorrectAnswers = {};
  // Получаем значения напрямую из textarea элементов
  const task1Textarea = document.getElementById("task1Answer");
  const task2Textarea = document.getElementById("task2Answer");

  const writingAnswers = {
    task1: task1Textarea ? task1Textarea.value : "",
    task2: task2Textarea ? task2Textarea.value : "",
  };

  // Process listening answers
  let listeningCorrect = 0;
  let listeningTotal = 0;

  console.log("🔍 Processing listening answers...");
  console.log("Current answersSoFar:", answersSoFar);

  for (const section of stageData.listening.sections) {
    if (section.content) {
      section.content.forEach((item) => {
        // ✅ 1. ОБЫЧНЫЕ ВОПРОСЫ
        if (item.type === "question") {
          const qId = item.questionId;
          const userAns = answersSoFar[qId];
          const saveKey = qId.replace("q", "");

          listeningAnswers[saveKey] = userAns !== undefined ? userAns : null;
          listeningCorrectAnswers[saveKey] = item.correctAnswer;

          const isCorrect = checkAnswerCorrectness(userAns, [
            item.correctAnswer,
          ]);
          if (isCorrect) listeningCorrect++;
          listeningTotal++;

          console.log(
            `✅ Question ${qId}: user="${userAns}", correct="${item.correctAnswer}", isCorrect=${isCorrect}`
          );

          // ✅ 2. QUESTION GROUPS (multi-select, matching)
        } else if (item.type === "question-group") {
          // Multi-select группы
          if (item.groupType === "multi-select" && item.questions) {
            item.questions.forEach((q) => {
              const qId = q.questionId;
              const userAns = answersSoFar[qId];
              const saveKey = qId.replace("q", "");

              listeningAnswers[saveKey] = userAns || null;
              listeningCorrectAnswers[saveKey] = q.correctAnswer;

              const isCorrect = checkAnswerCorrectness(userAns, [
                q.correctAnswer,
              ]);
              if (isCorrect) listeningCorrect++;
              listeningTotal++;

              console.log(
                `✅ Multi-select ${qId}: user="${userAns}", correct="${q.correctAnswer}", isCorrect=${isCorrect}`
              );
            });
          }

          // ✅ Matching группы
          if (item.groupType === "matching" && item.questions) {
            item.questions.forEach((q) => {
              const qId = q.questionId;
              const userAns = answersSoFar[qId];
              const saveKey = qId.replace("q", "");

              listeningAnswers[saveKey] = userAns || null;
              listeningCorrectAnswers[saveKey] = q.correctAnswer;

              const isCorrect = checkAnswerCorrectness(userAns, [
                q.correctAnswer,
              ]);
              if (isCorrect) listeningCorrect++;
              listeningTotal++;

              console.log(
                `✅ Matching ${qId}: user="${userAns}", correct="${q.correctAnswer}", isCorrect=${isCorrect}`
              );
            });
          }

          // ✅ 3. ИСПРАВЛЕНО: TABLE ВОПРОСЫ - обрабатываем ОБА формата
        } else if (item.type === "table") {
          console.log("🔍 Processing table:", item);

          if (item.answer && typeof item.answer === "object") {
            Object.keys(item.answer).forEach((key) => {
              let qNum;
              let qId;

              // ✅ ИСПРАВЛЕНО: Обрабатываем ОБА формата ключей
              if (key.startsWith("qq")) {
                // Формат: qq37, qq38, qq39, qq40
                qNum = key.replace("qq", ""); // qq37 -> 37
                qId = `q${qNum}`; // -> q37
              } else if (key.startsWith("q")) {
                // Формат: q1, q2, q3, q4, q5, q6, q7, q8, q9, q10
                qNum = key.replace("q", ""); // q1 -> 1
                qId = key; // -> q1 (уже правильный)
              } else {
                // Формат: просто число 1, 2, 3...
                qNum = key; // 1 -> 1
                qId = `q${key}`; // -> q1
              }

              const userAns = answersSoFar[qId];
              const expected = item.answer[key];

              listeningAnswers[qNum] = userAns !== undefined ? userAns : null;
              listeningCorrectAnswers[qNum] = expected;

              const isCorrect = checkAnswerCorrectness(userAns, [expected]);
              if (isCorrect) listeningCorrect++;
              listeningTotal++;

              console.log(
                `✅ Table ${qId} (from key "${key}" -> qNum=${qNum}): user="${userAns}", correct="${expected}", isCorrect=${isCorrect}`
              );
            });
          }

          // ✅ Дополнительно: обрабатываем rows если нет answer
          else if (item.rows && Array.isArray(item.rows)) {
            item.rows.forEach((row, rowIndex) => {
              Object.keys(row).forEach((key) => {
                const cellContent = row[key];
                if (
                  typeof cellContent === "string" &&
                  cellContent.includes("___q")
                ) {
                  const matches = cellContent.match(/___q(\d+)___/g);
                  if (matches) {
                    matches.forEach((match) => {
                      const qNum = match.match(/\d+/)[0];
                      const qId = `q${qNum}`;
                      const userAns = answersSoFar[qId];

                      // Пытаемся найти правильный ответ в разных форматах
                      const expected =
                        item.answer?.[`qq${qNum}`] || // qq37 формат
                        item.answer?.[`q${qNum}`] || // q37 формат
                        item.answer?.[qNum] || // 37 формат
                        item.correctAnswers?.[qNum] ||
                        item.answers?.[qNum] ||
                        null;

                      listeningAnswers[qNum] =
                        userAns !== undefined ? userAns : null;
                      if (expected) {
                        listeningCorrectAnswers[qNum] = expected;
                      }

                      if (expected) {
                        const isCorrect = checkAnswerCorrectness(userAns, [
                          expected,
                        ]);
                        if (isCorrect) listeningCorrect++;
                        listeningTotal++;

                        console.log(
                          `✅ Table row ${qId}: user="${userAns}", correct="${expected}", isCorrect=${isCorrect}`
                        );
                      } else {
                        listeningTotal++;
                        console.log(
                          `⚠️ Table row ${qId}: user="${userAns}", correct=MISSING`
                        );
                      }
                    });
                  }
                }
              });
            });
          }

          // ✅ 4. MATCHING ВОПРОСЫ (отдельные, не в группах)
        } else if (item.groupType === "matching" && item.questions) {
          item.questions.forEach((q) => {
            const qId = q.questionId;
            const userAns = answersSoFar[qId];
            const saveKey = qId.replace("q", "");

            listeningAnswers[saveKey] = userAns || null;
            listeningCorrectAnswers[saveKey] = q.correctAnswer;

            const isCorrect = checkAnswerCorrectness(userAns, [
              q.correctAnswer,
            ]);
            if (isCorrect) listeningCorrect++;
            listeningTotal++;

            console.log(
              `✅ Standalone Matching ${qId}: user="${userAns}", correct="${q.correctAnswer}", isCorrect=${isCorrect}`
            );
          });
        }
      });
    }
  }

  // Process reading answers (оставляем как есть)
  let readingCorrect = 0;
  let readingTotal = 0;

  for (const qId of orderedQIds) {
    const q = findReadingQuestionByQId(qId);
    let userAns = answersSoFar[qId];
    if (Array.isArray(userAns)) {
      userAns = userAns[0] || "";
    }
    userAns = typeof userAns === "string" ? userAns.trim().toLowerCase() : "";

    readingAnswers[qId] = userAns;
    readingTotal++;

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

    readingCorrectAnswers[qId] = correctAnsArray;

    const isCorrect = correctAnsArray.includes(userAns);
    if (isCorrect) readingCorrect++;
  }

  console.log(`📊 Reading Results: ${readingCorrect}/${readingTotal}`);

  try {
    const docRef = await addDoc(collection(db, "resultFullmock"), {
      userId: user.uid,
      name: user.email || "unknown",
      email: user.email || "unknown",
      testId: currentTestId,
      testTitle: testData?.title || "IELTS Full Mock Test",

      // Listening results
      listeningScore: listeningCorrect,
      listeningTotal: listeningTotal,
      listeningAnswers: listeningAnswers,
      listeningCorrectAnswers: listeningCorrectAnswers,

      // Reading results
      readingScore: readingCorrect,
      readingTotal: readingTotal,
      readingAnswers: readingAnswers,
      readingCorrectAnswers: readingCorrectAnswers,

      // Writing answers
      writingAnswers: writingAnswers,
      task1WordCount: countWords(writingAnswers.task1),
      task2WordCount: countWords(writingAnswers.task2),
      totalWritingWords:
        countWords(writingAnswers.task1) + countWords(writingAnswers.task2),

      // Overall
      totalScore: listeningCorrect + readingCorrect,
      totalPossible: listeningTotal + readingTotal,
      overallPercentage: Math.round(
        ((listeningCorrect + readingCorrect) /
          (listeningTotal + readingTotal)) *
          100
      ),

      // Individual percentages
      listeningPercentage: Math.round(
        (listeningCorrect / listeningTotal) * 100
      ),
      readingPercentage: Math.round((readingCorrect / readingTotal) * 100),

      createdAt: serverTimestamp(),
      submittedAt: new Date().toISOString(),
    });

    // Send writing to Telegram
    await sendWritingToTelegram({
      userId: user.uid,
      name: user.email || "unknown",
      email: user.email || "unknown",
      testId: currentTestId,
      testTitle: testData?.title || "IELTS Full Mock Test",
      task1: writingAnswers.task1,
      task2: writingAnswers.task2,
      task1WordCount: countWords(writingAnswers.task1),
      task2WordCount: countWords(writingAnswers.task2),
      listeningScore: listeningCorrect,
      listeningTotal: listeningTotal,
      readingScore: readingCorrect,
      readingTotal: readingTotal,
      overallScore: listeningCorrect + readingCorrect,
      overallTotal: listeningTotal + readingTotal,
    });

    clearInterval(window.fullMockTimerInterval);
    window.location.href = `/pages/mock/full/resultFullMock.html?id=${docRef.id}`;
  } catch (e) {
    console.error("❌ Error saving result:", e);
    alert("Error submitting your result. Please try again.");
  }
  // Clear saved writing data
  localStorage.removeItem("fullmock_task1Answer");
  localStorage.removeItem("fullmock_task2Answer");
}

// Helper functions
function findReadingQuestionByQId(qId) {
  for (const p of stageData.reading.passages) {
    for (const q of p.questions) {
      if (q.qId === qId) return q;
      if (Array.isArray(q.qIds) && q.qIds.includes(qId)) {
        return { ...q, qId };
      }
    }
  }
  return { answer: [] };
}

function checkAnswerCorrectness(userAns, expected) {
  if (!expected || expected.length === 0) return false;

  if (Array.isArray(userAns) && Array.isArray(expected)) {
    if (userAns.length !== expected.length) return false;
    return (
      expected.every((v) => userAns.includes(v)) &&
      userAns.length === expected.length
    );
  } else {
    const userStr =
      typeof userAns === "string"
        ? userAns.toLowerCase().trim()
        : String(userAns || "")
            .toLowerCase()
            .trim();
    return expected
      .map((a) => String(a).toLowerCase().trim())
      .includes(userStr);
  }
}

function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// Send writing to Telegram bot
async function sendWritingToTelegram(data) {
  try {
    console.log("📱 Sending full mock result to Telegram...");

    const BOT_TOKEN = "8312079942:AAHsxrigaSHGEsdf3EQTB9IVYadU1mVVbwI";
    const CHAT_ID = "53064348";

    const task1Preview =
      data.task1.length > 300
        ? data.task1.substring(0, 300) + "..."
        : data.task1;
    const task2Preview =
      data.task2.length > 300
        ? data.task2.substring(0, 300) + "..."
        : data.task2;

    const message = `🎓 *IELTS FULL MOCK TEST SUBMISSION*

👤 *Student:* ${data.name}
📧 *Email:* ${data.email}
📝 *Test:* ${data.testTitle}
🆔 *Test ID:* ${data.testId}
⏰ *Submitted:* ${new Date().toLocaleString()}

📊 *TEST SCORES:*
👂 *Listening:* ${data.listeningScore}/${data.listeningTotal} (${Math.round(
      (data.listeningScore / data.listeningTotal) * 100
    )}%)
📖 *Reading:* ${data.readingScore}/${data.readingTotal} (${Math.round(
      (data.readingScore / data.readingTotal) * 100
    )}%)
🏆 *Overall:* ${data.overallScore}/${data.overallTotal} (${Math.round(
      (data.overallScore / data.overallTotal) * 100
    )}%)

📝 *WRITING SECTION:*

📋 *TASK 1 (${data.task1WordCount} words)*
${task1Preview}

📋 *TASK 2 (${data.task2WordCount} words)*  
${task2Preview}

📊 *Writing Stats:*
• Task 1: ${data.task1WordCount} words
• Task 2: ${data.task2WordCount} words
• Total: ${data.task1WordCount + data.task2WordCount} words

🏫 *Platform:* YES English Center - Full Mock Test`;

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (response.ok) {
      console.log("✅ Telegram notification sent successfully");
      return true;
    } else {
      const error = await response.json();
      console.error("❌ Telegram API error:", error);

      // Fallback: отправляем без Markdown если ошибка парсинга
      if (error.error_code === 400) {
        const plainMessage = message.replace(/\*/g, "");
        const fallbackResponse = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: CHAT_ID,
              text: plainMessage,
            }),
          }
        );

        if (fallbackResponse.ok) {
          console.log("✅ Telegram notification sent (plain text)");
          return true;
        }
      }
      return false;
    }
  } catch (error) {
    console.error("❌ Telegram notification error:", error);
    return false;
  }
}

// Timer function
function startTimer(durationInSeconds, display) {
  clearInterval(window.fullMockTimerInterval);
  timerStartTime = Date.now();

  window.fullMockTimerInterval = setInterval(() => {
    if (isPaused && currentStage === "listening") return;

    const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    const remaining = durationInSeconds - elapsed;

    if (remaining <= 0) {
      clearInterval(window.fullMockTimerInterval);
      alert("Time's up for this stage!");

      if (currentStage === "listening") {
        showStageTransition("listening", "reading");
      } else if (currentStage === "reading") {
        showStageTransition("reading", "writing");
      } else if (currentStage === "writing") {
        handleFinishTest();
      }
      return;
    }

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    display.textContent = `${minutes}:${seconds}`;

    if (remaining <= 300) display.style.color = "#dc2626";
    if (remaining === 300) alert("5 minutes remaining!");

    pausedTime = remaining;
  }, 1000);
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
  if (
    selectedText.length > 0 &&
    (e.target.closest(".passage-text") || e.target.closest(".questions-panel"))
  ) {
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

window.openReview = function () {
  alert(
    "Review functionality - showing all answers and flagged questions for current stage"
  );
};
window.onload = () => {};
