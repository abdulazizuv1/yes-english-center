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
const auth = getAuth();

// Global variables
let currentPassageIndex = 0;
let passages = [];
let answersSoFar = {};
let orderedQIds = [];
let testStorageKey = "readingTest_temp";
let passageHighlights = {};
let questionHighlights = {};
let selectedText = "";
let selectedRange = null;
let highlightEventListeners = [];

function cleanupHighlightListeners() {
  highlightEventListeners.forEach(({ element, type, listener }) => {
    element.removeEventListener(type, listener);
  });
  highlightEventListeners = [];
}

function addTrackedListener(element, type, listener) {
  element.addEventListener(type, listener);
  highlightEventListeners.push({ element, type, listener });
}

function initializeHighlightSystem() {
  cleanupHighlightListeners();
  
  const mouseUpHandler = function(e) {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      selectedText = selection.toString();
      try {
        selectedRange = selection.getRangeAt(0);
      } catch (err) {
        selectedRange = null;
      }
    }
  };
  
  const contextMenuHandler = function(e) {
    if (selectedText.length > 0) {
      const passagePanel = document.querySelector(".passage-panel");
      const questionsPanel = document.querySelector(".questions-panel");
      
      if (passagePanel && questionsPanel && 
          (passagePanel.contains(e.target) || questionsPanel.contains(e.target))) {
        e.preventDefault();
        const contextMenu = document.getElementById("contextMenu");
        if (contextMenu) {
          contextMenu.style.display = "block";
          contextMenu.style.left = e.pageX + "px";
          contextMenu.style.top = e.pageY + "px";
        }
      }
    }
  };
  
  const clickHandler = function(e) {
    const contextMenu = document.getElementById("contextMenu");
    if (contextMenu && !contextMenu.contains(e.target)) {
      contextMenu.style.display = "none";
    }
  };
  
  addTrackedListener(document, "mouseup", mouseUpHandler);
  addTrackedListener(document, "contextmenu", contextMenuHandler);
  addTrackedListener(document, "click", clickHandler);
}


function loadSavedState() {
  const saved = localStorage.getItem(testStorageKey);
  if (saved) {
    const data = JSON.parse(saved);
    answersSoFar = data.answers || {};
    passageHighlights = data.passageHighlights || {};
    questionHighlights = data.questionHighlights || {};
  }
}

function saveState() {
  const data = {
    answers: answersSoFar,
    passageHighlights: passageHighlights,
    questionHighlights: questionHighlights,
    timestamp: Date.now(),
  };
  localStorage.setItem(testStorageKey, JSON.stringify(data));
}
let currentTestId = "test-1";
let currentQuestionIndex = 0;

let isPaused = false;
let pausedTime = 0;

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

window.togglePause = function () {
  const pauseBtn = document.getElementById("pauseBtn");
  const pauseModal = document.getElementById("pauseModal");

  if (!isPaused) {
    isPaused = true;
    clearInterval(window.readingTimerInterval);
    pauseBtn.textContent = "Resume";
    pauseBtn.classList.add("paused");
    pauseModal.style.display = "flex";

    document.querySelector(".passage-panel").style.pointerEvents = "none";
    document.querySelector(".questions-panel").style.pointerEvents = "none";
    document.querySelector(".bottom-controls").style.pointerEvents = "none";
    document.querySelector(".question-nav").style.pointerEvents = "none";
  } else {
    isPaused = false;
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("paused");
    pauseModal.style.display = "none";

    document.querySelector(".passage-panel").style.pointerEvents = "auto";
    document.querySelector(".questions-panel").style.pointerEvents = "auto";
    document.querySelector(".bottom-controls").style.pointerEvents = "auto";
    document.querySelector(".question-nav").style.pointerEvents = "auto";

    const display = document.getElementById("time");
    startTimer(pausedTime, display);
  }
};

function generateQuestionNav() {
  const part1 = document.getElementById("part1Numbers");
  const part2 = document.getElementById("part2Numbers");
  const part3 = document.getElementById("part3Numbers");

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
  saveCurrentHighlights();

  let targetPassage = 0;
  if (questionNum >= 14 && questionNum <= 26) targetPassage = 1;
  else if (questionNum >= 27) targetPassage = 2;

  currentPassageIndex = targetPassage;
  currentQuestionIndex = questionNum - 1;
  renderPassage(currentPassageIndex);
  updateQuestionNav();

  setTimeout(() => {
    const questionElement = document.getElementById(`q${questionNum}`);
    if (questionElement) {
      questionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}


document.addEventListener("mouseup", function (e) {
  const selection = window.getSelection();
  if (selection.toString().length > 0) {
    selectedText = selection.toString();
    selectedRange = selection.getRangeAt(0);
  }
});

document.addEventListener("contextmenu", function (e) {
  if (selectedText.length > 0) {
    const passagePanel = document.querySelector(".passage-panel");
    const questionsPanel = document.querySelector(".questions-panel");

    if (
      passagePanel &&
      (passagePanel.contains(e.target) || questionsPanel.contains(e.target))
    ) {
      e.preventDefault();
      const contextMenu = document.getElementById("contextMenu");
      contextMenu.style.display = "block";
      contextMenu.style.left = e.pageX + "px";
      contextMenu.style.top = e.pageY + "px";
    }
  }
});

document.addEventListener("click", function () {
  document.getElementById("contextMenu").style.display = "none";
});

window.highlightSelection = function() {
  if (!selectedRange) {
    document.getElementById("contextMenu").style.display = "none";
    return;
  }
  
  try {
    if (selectedRange.collapsed || !selectedRange.toString().trim()) {
      clearSelection();
      return;
    }
    
    const span = document.createElement("span");
    span.className = "highlighted";
    span.setAttribute("data-highlight", "true");
    
    try {
      selectedRange.surroundContents(span);
    } catch (e) {
      const contents = selectedRange.extractContents();
      span.appendChild(contents);
      selectedRange.insertNode(span);
    }
    
    clearSelection();
    saveCurrentHighlights();
  } catch (error) {
    console.warn("Failed to create highlight:", error);
  }
  
  document.getElementById("contextMenu").style.display = "none";
};

let saveHighlightsTimeout;
function saveCurrentHighlights() {
  clearTimeout(saveHighlightsTimeout);
  saveHighlightsTimeout = setTimeout(() => {
    try {
      const passageText = document.getElementById("passageText");
      const questionsList = document.getElementById("questionsList");
      
      if (passageText) {
        const highlights = passageText.querySelectorAll(".highlighted");
        if (highlights.length > 0) {
          // Clean and save HTML
          const cleanedHTML = cleanHighlightHTML(passageText.innerHTML);
          passageHighlights[currentPassageIndex] = cleanedHTML;
        } else {
          // Only delete if we're sure there are no highlights
          delete passageHighlights[currentPassageIndex];
        }
      }
      
      if (questionsList) {
        const highlights = questionsList.querySelectorAll(".highlighted");
        if (highlights.length > 0) {
          const cleanedHTML = cleanHighlightHTML(questionsList.innerHTML);
          questionHighlights[currentPassageIndex] = cleanedHTML;
        } else {
          delete questionHighlights[currentPassageIndex];
        }
      }
      
      saveState();
    } catch (error) {
      console.warn("Failed to save highlights:", error);
    }
  }, 100);
}

function cleanHighlightHTML(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove any invalid or temporary attributes
  temp.querySelectorAll('*').forEach(el => {
    // Keep only essential attributes
    const allowedAttrs = ['class', 'id', 'type', 'name', 'value', 'data-question-id', 'data-group-qids', 'placeholder'];
    const attrs = Array.from(el.attributes);
    attrs.forEach(attr => {
      if (!allowedAttrs.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  return temp.innerHTML;
}


function forceRenderPassageContent(index) {
  const passage = passages[index];
  
  document.getElementById("passageTitle").textContent = passage.title;
  document.getElementById("passageInstructions").textContent = passage.instructions;
  
  const formattedText = passage.text
    .split("\n\n")
    .map(p => `<p>${p.trim()}</p>`)
    .join("");
  
  const passageTextEl = document.getElementById("passageText");
  passageTextEl.innerHTML = formattedText;
  
  requestAnimationFrame(() => {
    restorePassageHighlights(index);
  });
}

function restorePassageHighlights(index) {
  const passageText = document.getElementById("passageText");
  if (passageText && passageHighlights[index]) {
    try {
      passageText.innerHTML = passageHighlights[index];
    } catch (error) {
      console.warn("Failed to restore passage highlights:", error);
      // Fallback to clean content
      const passage = passages[index];
      const formattedText = passage.text
        .split("\n\n")
        .map(p => `<p>${p.trim()}</p>`)
        .join("");
      passageText.innerHTML = formattedText;
    }
  }
}

function restoreHighlights() {
  restorePassageHighlights(currentPassageIndex);
  const questionsList = document.getElementById("questionsList");
  if (questionsList && questionHighlights[currentPassageIndex]) {
    try {
      const savedHTML = questionHighlights[currentPassageIndex];
      
      setTimeout(() => {
        questionsList.innerHTML = savedHTML;
        
        setTimeout(() => {
          restoreInputEventListeners();
        }, 50);
      }, 10);
    } catch (error) {
      console.warn("Failed to restore question highlights:", error);
      setTimeout(() => {
        restoreInputEventListeners();
      }, 50);
    }
  } else {
    setTimeout(() => {
      restoreInputEventListeners();
    }, 10);
  }
}

function restoreInputEventListeners() {
  const inputs = document.querySelectorAll(
    'input[data-question-id], input[id^="q"], input[id^="input-"], select[id^="q"]'
  );

  inputs.forEach((input) => {
    const qId = input.dataset.questionId || input.id.replace("input-", "");

    if (input.type === "text") {
      // Text inputs (gap-fill)
      input.value = answersSoFar[qId] || "";
      if (input.value) {
        input.classList.add("has-value");
      }

      input.addEventListener("input", (e) => {
        answersSoFar[qId] = e.target.value;
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
      if (answersSoFar[qId] === input.value) {
        input.checked = true;
      }
      input.addEventListener("change", (e) => {
        answersSoFar[qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    }
  });

  // Для select элементов
  const selects = document.querySelectorAll('select[id^="q"]');
  selects.forEach((select) => {
    const qId = select.id;
    select.value = answersSoFar[qId] || "";
    select.addEventListener("change", (e) => {
      answersSoFar[qId] = e.target.value;
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
      passages.forEach((passage) => {
        passage.questions.forEach((question) => {
          if (question.type === "question-group" && question.questions) {
            const isSelected = question.questions.some(
              (q) => answersSoFar[q.qId] === checkbox.value
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

window.removeHighlight = function() {
  if (!selectedRange) {
    clearSelection();
    return;
  }
  try {
    const container = selectedRange.commonAncestorContainer;
    let highlightedElements = [];
    
    if (container.nodeType === Node.TEXT_NODE) {
      const parent = container.parentElement;
      if (parent && parent.classList.contains("highlighted")) {
        highlightedElements = [parent];
      }
    } else {
      highlightedElements = Array.from(
        container.querySelectorAll(".highlighted")
      ).filter(el => selectedRange.intersectsNode(el));
    }
    
    highlightedElements.forEach(element => {
      const parent = element.parentNode;
      if (parent) {
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
        parent.normalize();
      }
    });
    
    saveCurrentHighlights();
  } catch (error) {
    console.warn("Failed to remove highlight:", error);
  }
  
  clearSelection();
  document.getElementById("contextMenu").style.display = "none";
};

function clearSelection() {
  window.getSelection().removeAllRanges();
  selectedText = "";
  selectedRange = null;
}

function assignQuestionIds() {
  let counter = 1;
  for (const passage of passages) {
    for (const question of passage.questions) {
      if (question.type === "question-group" && question.questions) {
        // Для question-group назначаем qId каждому подвопросу
        question.questions.forEach((subQ) => {
          subQ.qId = `q${counter}`;
          subQ.parentGroup = question; // Ссылка на родительскую группу
          orderedQIds.push(subQ.qId);
          counter++;
        });
        // Сохраняем ссылку на все qId в группе
        question.qIds = question.questions.map((q) => q.qId);
      } else if (question.question) {
        // Обычные вопросы
        question.qId = `q${counter}`;
        orderedQIds.push(question.qId);
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

async function loadTest() {
  const auth = getAuth();
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  if (!user) {
    alert("You must be logged in to access the reading test.");
    window.location.href = "/";
    return;
  }
  try {
    const cssLink = document.querySelector('link[href*="test.css"]');
    if (cssLink) {
      const timestamp = new Date().getTime();
      cssLink.href = `./test.css?v=${timestamp}`;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get("testId") || "test-1";
    currentTestId = testId;
    testStorageKey = `readingTest_${currentTestId}`;
    loadSavedState();

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
  
  // Save current highlights before switching
  if (currentPassageIndex !== index) {
    saveCurrentHighlights();
  }
  
  // Render passage content
  forceRenderPassageContent(index);
  
  // Render questions
  const questionsList = document.getElementById("questionsList");
  questionsList.innerHTML = "";
  
  let lastInstruction = null;
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
        gapFillGroup = { title: null, subtitle: null, info: null, questions: [], startDiv: null };
      }
      
      const instructionDiv = document.createElement("div");
      instructionDiv.className = "group-instruction";
      instructionDiv.innerHTML = q.groupInstruction
        .split("\n")
        .map(line => `<p>${line}</p>`)
        .join("");
      questionsList.appendChild(instructionDiv);
      lastInstruction = q.groupInstruction;
    }
    
    const qDiv = document.createElement("div");
    qDiv.className = "question-item";
    
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
    
    // Render other question types
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
  
  // Restore highlights after rendering is complete
  requestAnimationFrame(() => {
    restoreHighlights();
  });
  
  // Update navigation
  document.getElementById("backBtn").style.display = 
    index > 0 ? "inline-block" : "none";
  document.getElementById("nextBtn").style.display = 
    index < passages.length - 1 ? "inline-block" : "none";
  document.getElementById("finishBtn").style.display = 
    index === passages.length - 1 ? "inline-block" : "none";
}




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
                placeholder="${q.qId.replace("q", "")}"
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

  // Add input event listeners
  setTimeout(() => {
    group.questions.forEach((q) => {
      const input = document.getElementById(`input-${q.qId}`);
      if (input) {
        // Set saved value
        input.value = answersSoFar[q.qId] || "";

        // Add class if value exists
        if (input.value) {
          input.classList.add("has-value");
        }

        input.addEventListener("input", (e) => {
          answersSoFar[q.qId] = e.target.value;
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

// Остальные функции рендеринга вопросов остаются без изменений
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
        saveState();
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderMatchingQuestion(q, qDiv) {
  if (!q.question || !q.qId) return;

  qDiv.innerHTML = `
    <div class="question-number">${q.qId.toUpperCase().replace("Q", "")}</div>
    <div class="question-text">${q.question}</div>
    <div class="matching-options">
      ${q.options?.map(opt => `
        <label class="matching-option">
          <input type="radio" name="${q.qId}" value="${opt.label}">
          <span class="option-content">
            <span class="option-label">${opt.label}</span>
            <span class="option-text">${opt.text}</span>
          </span>
        </label>
      `).join('') || ''}
    </div>
  `;

  setTimeout(() => {
    const radios = document.querySelectorAll(`input[name="${q.qId}"]`);
    radios.forEach((radio) => {
      if (answersSoFar[q.qId] === radio.value) {
        radio.checked = true;
        radio.closest('.matching-option').classList.add('selected');
      }
      radio.addEventListener('change', (e) => {
        const allOptions = document.querySelectorAll(`input[name="${q.qId}"]`);
        allOptions.forEach(opt => {
          opt.closest('.matching-option').classList.remove('selected');
        });
        
        e.target.closest('.matching-option').classList.add('selected');
        
        answersSoFar[q.qId] = e.target.value;
        saveState();
        updateQuestionNav();
      });
    });
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
        saveState();
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
        saveState();
        updateQuestionNav();
      });
    });
  }, 0);
}

function renderQuestionGroup(group, qDiv) {
  const groupContainer = document.createElement("div");
  groupContainer.className = "multi-select-group";
  

  // Заголовок группы
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
    if (answersSoFar[q.qId]) {
      selectedAnswers.push(answersSoFar[q.qId]);
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
        !group.questions.some((q) => answersSoFar[q.qId] === cb.value)
      ) {
        cb.checked = false;
      }
    });
    return;
  }

  group.questions.forEach((q) => {
    delete answersSoFar[q.qId];
  });

  // Назначаем новые ответы последовательно
  selected.forEach((value, index) => {
    if (group.questions[index]) {
      answersSoFar[group.questions[index].qId] = value;
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

function handleMultiSelectGroupReading(checkbox, group, container) {
  const maxSelections =
    parseInt(container.dataset.maxSelections) || group.questions.length;
  const allCheckboxes = container.querySelectorAll('input[type="checkbox"]');
  const selectedOptions = Array.from(allCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  if (selectedOptions.length > maxSelections) {
    checkbox.checked = false;
    alert(`Please select exactly ${maxSelections} options.`);
    return;
  }

  // Clear all answers for this group first
  group.questions.forEach((q) => {
    delete answersSoFar[q.qId];
  });

  // Assign selected options to question IDs in order
  selectedOptions.sort().forEach((option, index) => {
    if (group.questions[index]) {
      answersSoFar[group.questions[index].qId] = option;
    }
  });

  // Update visual state
  allCheckboxes.forEach((cb) => {
    const label = cb.parentElement;
    if (cb.checked) {
      label.style.background = "#dbeafe";
      label.style.borderColor = "#3b82f6";
    } else {
      label.style.background = "";
      label.style.borderColor = "#d1d5db";
    }
  });

  saveState();
  updateQuestionNav();
}

function handleMultiSelectGroup(checkbox, group) {
  const allCheckboxes = document.querySelectorAll(
    `input[type="checkbox"][data-group-id="${group.questionId}"]`
  );
  const selectedOptions = Array.from(allCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  const maxAllowed = group.questions.length;

  if (selectedOptions.length > maxAllowed) {
    checkbox.checked = false;
    alert(`You can only select ${maxAllowed} options for this question.`);
    return;
  }

  // Clear previous answers for this group
  group.questions.forEach((q) => {
    const qId = q.qId || q.questionId;
    delete answersSoFar[qId];
  });

  // Assign selected options to questions
  selectedOptions.forEach((option, index) => {
    if (group.questions[index]) {
      const qId =
        group.questions[index].qId || group.questions[index].questionId;
      answersSoFar[qId] = option;
    }
  });

  // Update checkbox styles
  allCheckboxes.forEach((cb) => {
    const label = cb.parentElement;
    if (cb.checked) {
      label.style.background = "#dbeafe";
      label.style.borderColor = "#3b82f6";
    } else {
      label.style.background = "";
      label.style.borderColor = "#d1d5db";
    }
  });

  saveState();
  updateQuestionNav();
}

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

document.getElementById("backBtn").addEventListener("click", () => {
  if (currentPassageIndex > 0) {
    saveCurrentHighlights();
    currentPassageIndex--;
    renderPassage(currentPassageIndex);
    updateQuestionNav();
  }
});

document.getElementById("nextBtn").addEventListener("click", () => {
  if (currentPassageIndex < passages.length - 1) {
    saveCurrentHighlights();
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

      // Проверяем table questions
      if (Array.isArray(q.qIds) && q.qIds.includes(qId)) {
        return { ...q, qId };
      }

      // Проверяем question-group
      if (q.type === "question-group" && q.questions) {
        const subQuestion = q.questions.find((subQ) => subQ.qId === qId);
        if (subQuestion) {
          return subQuestion;
        }
      }
    }
  }
  return { answer: [] };
}

async function handleFinish() {
  const finishBtn = document.getElementById("finishBtn");
  finishBtn.disabled = true;
  finishBtn.textContent = "Submitting...";

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

    if (q.correctAnswer) {
      correctAnsArray = [q.correctAnswer];
    } else if (typeof q.answer === "object" && !Array.isArray(q.answer)) {
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

  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error("User not authenticated");
    }
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
    localStorage.removeItem(testStorageKey);
    clearInterval(window.readingTimerInterval);
    window.finished = true;
  } catch (e) {
    console.error("❌ Error saving result:", e);

    loadingModal.style.display = "none";
    finishBtn.disabled = false;
    finishBtn.textContent = "Finish Test";

    alert("Error submitting your result. Please try again.");
  }
}

window.openReview = function () {
  alert("Review functionality - showing all answers and flagged questions");
};

window.onload = () => {
  createPauseModal();
  loadTest().then(() => {
    const display = document.getElementById("time");
    startTimer(60 * 60, display);
  });
};