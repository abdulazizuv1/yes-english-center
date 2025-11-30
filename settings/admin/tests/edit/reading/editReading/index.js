import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentTest = null;
let testId = null;
let itemToDelete = null;
let questionIdCounter = 0;
let passageCount = 0;
// Store shared options per passage: sharedOptions[passageNumber][type]
let sharedOptions = {};

// Check if user is admin
async function checkAdminAccess() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        console.log("❌ User not authenticated");
        alert("🔒 Please login first to access this page");
        window.location.href = "/";
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.log("❌ User document not found");
          alert("❌ User data not found. Access denied.");
          window.location.href = "/";
          return;
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        if (userRole !== "admin") {
          console.log("❌ User is not admin. Role:", userRole);
          alert("🚫 Access denied. Admin privileges required.");
          window.location.href = "/";
          return;
        }

        console.log("✅ Admin access granted for:", user.email);
        currentUser = user;
        resolve({ user, userData });
      } catch (error) {
        console.error("❌ Error checking user role:", error);
        alert("❌ Error verifying admin access. Please try again.");
        window.location.href = "/";
      }
    });
  });
}

// Get test ID from URL parameters
function getTestIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('testId');
}

// Load test data from Firebase
async function loadTest() {
  try {
    console.log("📚 Loading test from Firebase...");
    
    const testDocRef = doc(db, "readingTests", testId);
    const testDoc = await getDoc(testDocRef);
    
    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }

    currentTest = testDoc.data();
    console.log("✅ Test loaded successfully");
    
    // Initialize questionIdCounter to avoid conflicts
    questionIdCounter = 0;
    if (currentTest.passages) {
      currentTest.passages.forEach(passage => {
        if (passage.questions) {
          questionIdCounter += passage.questions.length;
        }
      });
    }
    
    // Hide loading, show content
    document.getElementById("loadingContainer").style.display = "none";
    document.getElementById("mainContent").style.display = "block";
    
    // Populate test info
    populateTestInfo();
    
    // Display passages
    displayPassages();
    
  } catch (error) {
    console.error("❌ Error loading test:", error);
    document.getElementById("loadingContainer").innerHTML = `
      <div style="color: #f44336; text-align: center;">
        <h3>❌ Error loading test</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
  }
}

// Populate test information
function populateTestInfo() {
  document.getElementById("testNumber").textContent = `Reading Test ${testId.replace("test-", "")}`;
  document.getElementById("testTitle").textContent = `Reading Test ${testId.replace("test-", "")}`;
  passageCount = currentTest.passages ? currentTest.passages.length : 0;
  updatePassageCount();
  updateAddPassageButton();
}

// Sync all current DOM values to currentTest.passages before regenerating HTML
function syncDOMToData() {
  const passageElements = document.querySelectorAll(".passage-container");
  
  passageElements.forEach((passageEl) => {
    const passageNumber = parseInt(passageEl.dataset.passage);
    const passageIndex = passageNumber - 1;
    
    if (!currentTest.passages[passageIndex]) return;
    
    // Update passage data
    const titleInput = passageEl.querySelector(".passage-title-input");
    const instructionsInput = passageEl.querySelector(".passage-instructions");
    const textInput = passageEl.querySelector(".passage-text");
    
    if (titleInput) currentTest.passages[passageIndex].title = titleInput.value;
    if (instructionsInput) currentTest.passages[passageIndex].instructions = instructionsInput.value;
    if (textInput) currentTest.passages[passageIndex].text = textInput.value;
    
    // Update questions data
    const questionElements = passageEl.querySelectorAll(".question-item");
    questionElements.forEach((questionEl) => {
      const passageIndexAttr = questionEl.dataset.passageIndex;
      const questionIndexAttr = questionEl.dataset.questionIndex;
      
      if (passageIndexAttr === undefined || questionIndexAttr === undefined) return;
      
      const questionIndex = parseInt(questionIndexAttr);
      const type = questionEl.dataset.type;
      
      if (!currentTest.passages[passageIndex].questions[questionIndex]) {
        currentTest.passages[passageIndex].questions[questionIndex] = { type: type };
      }
      
      // Update group instruction
      const groupInstructionEl = questionEl.querySelector(".group-instruction");
      if (groupInstructionEl) {
        currentTest.passages[passageIndex].questions[questionIndex].groupInstruction = groupInstructionEl.value;
      }
      
      if (type === "text-question") {
        const titleEl = questionEl.querySelector(".question-title");
        const subheadingEl = questionEl.querySelector(".question-subheading");
        const textEl = questionEl.querySelector(".question-text");
        if (titleEl) currentTest.passages[passageIndex].questions[questionIndex].title = titleEl.value;
        if (subheadingEl) currentTest.passages[passageIndex].questions[questionIndex].subheading = subheadingEl.value;
        if (textEl) currentTest.passages[passageIndex].questions[questionIndex].text = textEl.value;
      } else {
        // Update question text
        const questionTextEl = questionEl.querySelector(".question-text");
        if (questionTextEl) {
          currentTest.passages[passageIndex].questions[questionIndex].question = questionTextEl.value;
        }
        
        // Update answer
        const answerEl = questionEl.querySelector(".question-answer");
        if (answerEl) {
          if (type === "gap-fill") {
            const answerText = answerEl.value.trim();
            currentTest.passages[passageIndex].questions[questionIndex].answer = answerText.split(",").map((a) => a.trim()).filter((a) => a);
          } else {
            currentTest.passages[passageIndex].questions[questionIndex].answer = answerEl.value;
          }
        }
        
        // Update multiple choice options
        if (type === "multiple-choice") {
          const options = [];
          questionEl.querySelectorAll(".option-text").forEach((optionEl) => {
            const optionLetter = optionEl.dataset.option;
            const optionText = optionEl.value.trim();
            if (optionLetter && optionText) {
              options.push({ label: optionLetter, text: optionText });
            }
          });
          currentTest.passages[passageIndex].questions[questionIndex].options = options;
          
          // Update selected answer
          const selectedAnswer = questionEl.querySelector('input[type="radio"]:checked');
          if (selectedAnswer) {
            currentTest.passages[passageIndex].questions[questionIndex].answer = selectedAnswer.value;
          }
        }
        
        // Update paragraph-matching and match-person shared options
        if (type === "paragraph-matching" || type === "match-person") {
          // Sync options from any visible container of this type in the passage
          const questionId = questionEl.dataset.questionId;
          const container = document.getElementById(
            `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
          );
          
          // If container exists and is visible, sync from it
          if (container && container.style.display !== "none") {
            const newOptions = [];
            container.querySelectorAll(".option-row").forEach((row) => {
              const labelEl = row.querySelector(".option-label");
              const textEl = row.querySelector(".option-text");
              if (labelEl && textEl) {
                const label = labelEl.value.trim();
                const text = textEl.value;
                if (label) {
                  newOptions.push({ label, text });
                }
              }
            });
            
            // Update shared options (even if empty, as user might have deleted all options)
            if (!sharedOptions[passageNumber]) {
              sharedOptions[passageNumber] = {};
            }
            sharedOptions[passageNumber][type] = newOptions;
            
            // Save to all questions of this type in the passage
            currentTest.passages[passageIndex].questions.forEach((q, idx) => {
              if (q.type === type) {
                currentTest.passages[passageIndex].questions[idx].options = newOptions;
              }
            });
          }
        }
      }
    });
  });
}

// Display all passages
function displayPassages() {
  // First, sync all current DOM values to data model
  syncDOMToData();
  
  const container = document.getElementById("passagesContainer");
  
  if (!currentTest.passages || currentTest.passages.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Initialize sharedOptions from existing questions (use first question of each type)
  currentTest.passages.forEach((passage, passageIndex) => {
    const passageNumber = passageIndex + 1;
    if (!sharedOptions[passageNumber]) {
      sharedOptions[passageNumber] = {};
    }
    
    // Initialize paragraph-matching options from first question
    if (!sharedOptions[passageNumber]['paragraph-matching']) {
      const firstPMQuestion = passage.questions?.find(q => q.type === 'paragraph-matching');
      if (firstPMQuestion && firstPMQuestion.options && firstPMQuestion.options.length > 0) {
        sharedOptions[passageNumber]['paragraph-matching'] = firstPMQuestion.options;
      }
    }
    
    // Initialize match-person options from first question
    if (!sharedOptions[passageNumber]['match-person']) {
      const firstMPQuestion = passage.questions?.find(q => q.type === 'match-person');
      if (firstMPQuestion && firstMPQuestion.options && firstMPQuestion.options.length > 0) {
        sharedOptions[passageNumber]['match-person'] = firstMPQuestion.options;
      }
    }
  });

  container.innerHTML = currentTest.passages.map((passage, passageIndex) => 
    createPassageCard(passage, passageIndex + 1)
  ).join('');
  
  // Update question numbers globally and set up auto-propagation
  updateQuestionNumbers();
  
  currentTest.passages.forEach((passage, passageIndex) => {
    const passageNumber = passageIndex + 1;
    
    // Set up auto-propagation for all matching questions
    ['paragraph-matching', 'match-person'].forEach(type => {
      const questions = document.querySelectorAll(`#questions${passageNumber} .question-item[data-type="${type}"]`);
      questions.forEach(question => {
        const questionId = question.dataset.questionId;
        setupOptionAutoPropagate(questionId, type, passageNumber);
      });
    });
  });
}

// Create passage card HTML
function createPassageCard(passage, passageNumber) {
  const passageIndex = passageNumber - 1;
  const questionCount = passage.questions ? passage.questions.filter(q => q.type !== 'text-question').length : 0;
  
  return `
    <div class="passage-container" data-passage="${passageNumber}">
      <div class="passage-header">
        <div class="passage-title">
          <span class="passage-number">${passageNumber}</span>
          Passage ${passageNumber}
        </div>
        ${
          passageCount > 1
            ? `<button type="button" class="remove-passage-btn" onclick="removePassage(${passageNumber})">Remove Passage</button>`
            : ""
        }
      </div>
      
          <div class="form-group">
        <label>Passage Title *</label>
        <input type="text" class="passage-title-input" placeholder="e.g., The discovery of a baby mammoth" value="${(passage.title || '').replace(/"/g, '&quot;')}" onchange="updatePassage(${passageIndex}, 'title', this.value)" required>
          </div>
      
          <div class="form-group">
        <label>Instructions</label>
        <input type="text" class="passage-instructions" placeholder="e.g., You should spend about 20 minutes on Questions 1-13" 
       value="${(passage.instructions || '').replace(/"/g, '&quot;')}" onchange="updatePassage(${passageIndex}, 'instructions', this.value)">
        <span class="helper-text">Customize the question numbers for this passage (e.g., Questions 1-13 or Questions 14-26)</span>     
          </div>
      
          <div class="form-group">
        <label>Passage Text *</label>
        <textarea class="passage-text" rows="10" placeholder="Paste or type the full reading passage text here..." onchange="updatePassage(${passageIndex}, 'text', this.value)" required>${(passage.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        <span class="helper-text">This is the main text students will read</span>
        </div>
        
        <div class="questions-section">
          <div class="questions-header">
          <span class="questions-title">Questions</span>
        </div>
        <div class="questions-container" id="questions${passageNumber}">
          ${passage.questions ? passage.questions.map((question, questionIndex) => 
            createQuestionItem(question, passageNumber, questionIndex, passageIndex)
          ).join('') : ''}
        </div>
        <div class="add-question-dropdown" style="margin-top: 10px;">
          <button type="button" class="add-question-btn" onclick="toggleQuestionMenu(${passageNumber})">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Add Question
            </button>
          <div class="question-types-menu" id="questionMenu${passageNumber}">
            <div class="question-type-option" onclick="addQuestion(${passageNumber}, 'text-question')">Text Only (No Question)</div>
            <div class="question-type-option" onclick="addQuestion(${passageNumber}, 'gap-fill')">Gap Fill</div>
            <div class="question-type-option" onclick="addQuestion(${passageNumber}, 'true-false-notgiven')">True/False/Not Given</div>
            <div class="question-type-option" onclick="addQuestion(${passageNumber}, 'yes-no-notgiven')">Yes/No/Not Given</div>
            <div class="question-type-option" onclick="addQuestion(${passageNumber}, 'multiple-choice')">Multiple Choice</div>
            <div class="question-type-option" onclick="addQuestion(${passageNumber}, 'paragraph-matching')">Paragraph Matching</div>
            <div class="question-type-option" onclick="addQuestion(${passageNumber}, 'match-person')">Match Person/Feature</div>
          </div>
          </div>
        </div>
      </div>
  `;
}

// Create question item HTML (matching add reading structure)
function createQuestionItem(question, passageNumber, questionIndex, passageIndex) {
  const questionId = ++questionIdCounter;
  const type = question.type || 'gap-fill';
  let questionHTML = '';

  switch (type) {
    case "gap-fill":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}" data-passage-index="${passageIndex}" data-question-index="${questionIndex}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge gap-fill">Gap Fill</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId}, ${passageIndex}, ${questionIndex})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional)" class="group-instruction" rows="2" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'groupInstruction', this.value)">${(question.groupInstruction || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <input type="text" placeholder="Question text (use _____ for gaps)" class="question-text" value="${(question.question || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">
      <input type="text" placeholder="Answer(s) - separate multiple with comma" class="question-answer" value="${Array.isArray(question.answer) ? question.answer.join(', ') : (question.answer || '')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'answer', this.value)">
    </div>
  `;
      break;
    case "text-question":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}" data-passage-index="${passageIndex}" data-question-index="${questionIndex}">
      <div class="question-header">
        <span class="question-type-badge" style="background: #607D8B;">Text/Header</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId}, ${passageIndex}, ${questionIndex})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional)" class="group-instruction" rows="3" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'groupInstruction', this.value)">${(question.groupInstruction || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <input type="text" placeholder="Title (optional)" class="question-title" value="${(question.title || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'title', this.value)">
      <input type="text" placeholder="Subheading (optional)" class="question-subheading" value="${(question.subheading || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'subheading', this.value)">
      <input type="text" placeholder="Plain text (optional)" class="question-text" value="${(question.text || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'text', this.value)">
      <small style="color: #888;">Fill any or all fields - they will appear as headers/text</small>
    </div>
  `;
      break;
    case "true-false-notgiven":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}" data-passage-index="${passageIndex}" data-question-index="${questionIndex}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge tfng">True/False/Not Given</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId}, ${passageIndex}, ${questionIndex})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional)" class="group-instruction" rows="2" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'groupInstruction', this.value)">${(question.groupInstruction || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <input type="text" placeholder="Statement" class="question-text" value="${(question.question || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">
      <select class="question-answer" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'answer', this.value)">
        <option value="">Select answer</option>
        <option value="TRUE" ${question.answer === 'TRUE' ? 'selected' : ''}>TRUE</option>
        <option value="FALSE" ${question.answer === 'FALSE' ? 'selected' : ''}>FALSE</option>
        <option value="NOT GIVEN" ${question.answer === 'NOT GIVEN' ? 'selected' : ''}>NOT GIVEN</option>
      </select>
    </div>
  `;
      break;
    case "yes-no-notgiven":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}" data-passage-index="${passageIndex}" data-question-index="${questionIndex}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge ynng">Yes/No/Not Given</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId}, ${passageIndex}, ${questionIndex})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional)" class="group-instruction" rows="2" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'groupInstruction', this.value)">${(question.groupInstruction || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <input type="text" placeholder="Statement" class="question-text" value="${(question.question || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">
      <select class="question-answer" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'answer', this.value)">
        <option value="">Select answer</option>
        <option value="YES" ${question.answer === 'YES' ? 'selected' : ''}>YES</option>
        <option value="NO" ${question.answer === 'NO' ? 'selected' : ''}>NO</option>
        <option value="NOT GIVEN" ${question.answer === 'NOT GIVEN' ? 'selected' : ''}>NOT GIVEN</option>
      </select>
    </div>
  `;
      break;
    case "multiple-choice":
      const mcOptions = question.options || [
        { label: 'A', text: '' },
        { label: 'B', text: '' },
        { label: 'C', text: '' },
        { label: 'D', text: '' }
      ];
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}" data-passage-index="${passageIndex}" data-question-index="${questionIndex}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge mc">Multiple Choice</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId}, ${passageIndex}, ${questionIndex})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional)" class="group-instruction" rows="2" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'groupInstruction', this.value)">${(question.groupInstruction || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <input type="text" placeholder="Question" class="question-text" value="${(question.question || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">
      <div class="mc-options" id="mc-options-${questionId}">
        ${mcOptions.map((opt, optIdx) => `
        <div class="mc-option">
          <input type="radio" name="mc-answer-${questionId}" value="${opt.label}" ${question.answer === opt.label ? 'checked' : ''} onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'answer', this.value)">
          <label>${opt.label}</label>
          <input type="text" placeholder="Option ${opt.label} text" class="option-text" data-option="${opt.label}" value="${(opt.text || '').replace(/"/g, '&quot;')}" onchange="updateMCOption(${passageIndex}, ${questionIndex}, ${optIdx}, this.value)">
          <button type="button" onclick="removeMCOption(${questionId}, ${passageIndex}, ${questionIndex}, ${optIdx})" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
        </div>
        `).join('')}
      </div>
      <button type="button" onclick="addMCOption(${questionId}, ${passageIndex}, ${questionIndex})" style="margin-top: 10px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>
    </div>
  `;
      break;
    case "paragraph-matching":
    case "match-person":
      // Initialize passage-specific options if not exists
      if (!sharedOptions[passageNumber]) {
        sharedOptions[passageNumber] = {};
      }
      if (!sharedOptions[passageNumber][type]) {
        if (question.options && question.options.length > 0) {
          sharedOptions[passageNumber][type] = question.options;
        } else if (type === "paragraph-matching") {
          sharedOptions[passageNumber][type] = [
            { label: "A", text: "Paragraph A" },
            { label: "B", text: "Paragraph B" },
            { label: "C", text: "Paragraph C" },
            { label: "D", text: "Paragraph D" },
            { label: "E", text: "Paragraph E" },
            { label: "F", text: "Paragraph F" },
          ];
        } else {
          sharedOptions[passageNumber][type] = [
            { label: "A", text: "" },
            { label: "B", text: "" },
          ];
        }
      }

      const pmOptions = sharedOptions[passageNumber][type];

      const matchingTypeLabel = type === 'paragraph-matching' ? 'Paragraph Matching' : 'Match Person/Feature';
      const matchingTypeClass = type === 'paragraph-matching' ? 'pm' : 'mp';
      const matchingIdPrefix = type === 'paragraph-matching' ? 'pm' : 'match';
      
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}" data-passage="${passageNumber}" data-passage-index="${passageIndex}" data-question-index="${questionIndex}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge ${matchingTypeClass}">${matchingTypeLabel}</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId}, ${passageIndex}, ${questionIndex})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional, e.g., 'Questions 14-18\nReading Passage 2 has six paragraphs...')" class="group-instruction" rows="2" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'groupInstruction', this.value)">${(question.groupInstruction || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <input type="text" placeholder="${type === 'paragraph-matching' ? 'Question/Information to find' : 'Statement to match'}" class="question-text" value="${(question.question || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">
      <input type="text" placeholder="Correct answer (A, B, C, etc.)" class="question-answer" value="${(question.answer || '').replace(/"/g, '&quot;')}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'answer', this.value)">
      <div class="options-container">
        <label style="display: block; margin: 10px 0 5px; font-weight: 600;">
          Options (shared across all ${matchingTypeLabel.toLowerCase()} questions in this passage):
          <button type="button" onclick="toggleOptionsEdit(${questionId}, '${type}', ${passageNumber})" style="margin-left: 10px; padding: 2px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Edit Options</button>
        </label>
        <div class="${matchingIdPrefix}-options" id="${matchingIdPrefix}-options-${questionId}" style="display: none;" data-passage="${passageNumber}">
          ${pmOptions
            .map(
              (opt) => `
            <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
              <input type="text" value="${opt.label}" class="option-label" style="width: 40px; text-align: center;">
              <input type="text" value="${(opt.text || '').replace(/"/g, '&quot;')}" class="option-text" data-label="${opt.label}" style="flex: 1;">
              <button type="button" onclick="removeOption(this, '${type}', ${passageNumber})" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>
            </div>
          `
            )
            .join("")}
          <button type="button" onclick="addOption(${questionId}, '${type}', ${passageNumber})" style="margin-top: 5px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>
        </div>
        <div class="options-preview" id="options-preview-${questionId}">
          ${pmOptions
            .map(
              (opt) =>
                `<span style="display: inline-block; margin: 2px; padding: 3px 8px; background: #f0f0f0; border-radius: 3px; font-size: 12px;">${
                  opt.label
                }: ${opt.text || "(empty)"}</span>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
      break;
  }

  return questionHTML;
}

// Create question card HTML (old function - keeping for compatibility but not used)
function createQuestionCard(question, passageIndex, questionIndex) {
  const questionType = question.type || 'gap-fill';
  const typeLabel = QUESTION_TYPES[questionType] || questionType;
  
  return `
    <div class="question-card question-type-${questionType}" data-passage-index="${passageIndex}" data-question-index="${questionIndex}">
      <div class="question-header">
        <div class="question-type">${typeLabel}</div>
        <div class="question-actions">
          <button class="btn-edit" onclick="editQuestion(${passageIndex}, ${questionIndex})">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit
          </button>
          <button class="btn-delete" onclick="confirmDelete('question', ${passageIndex}, ${questionIndex})">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete
          </button>
        </div>
      </div>
      <div class="question-content">
        <div class="question-form">
          ${createQuestionForm(question, passageIndex, questionIndex)}
        </div>
      </div>
    </div>
  `;
}

// Create question form based on type
function createQuestionForm(question, passageIndex, questionIndex) {
  const isFirstQuestion = questionIndex === 0;
  const isTextQuestion = question.type === 'text-question';
  
  let baseForm = `
    <div class="form-group">
      <label>Question Type:</label>
      <select onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'type', this.value); location.reload();">
        ${Object.entries(QUESTION_TYPES).map(([value, label]) => 
          `<option value="${value}" ${question.type === value ? 'selected' : ''}>${label}</option>`
        ).join('')}
      </select>
    </div>
  `;
  
  // Only show group instruction for first question
  if (isFirstQuestion) {
    baseForm += `
      <div class="form-group">
        <label>Group Instruction (optional):</label>
        <textarea onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'groupInstruction', this.value)">${question.groupInstruction || ''}</textarea>
      </div>
    `;
  }
  
  // Only show title, subheading, and text for text-question type
  if (isTextQuestion) {
    baseForm += `
      <div class="form-group">
        <label>Title (optional):</label>
        <input type="text" value="${question.title || ''}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'title', this.value)">
      </div>
      
      <div class="form-group">
        <label>Subheading (optional):</label>
        <input type="text" value="${question.subheading || ''}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'subheading', this.value)">
      </div>
      
      <div class="form-group">
        <label>Text (optional):</label>
        <input type="text" value="${question.text || ''}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'text', this.value)">
      </div>
    `;
  }

  // Add type-specific form elements
  let typeSpecificForm = '';
  
  switch (question.type) {
    case 'gap-fill':
      typeSpecificForm = createGapFillForm(question, passageIndex, questionIndex);
      break;
    case 'true-false-notgiven':
    case 'yes-no-notgiven':
      typeSpecificForm = createTrueFalseForm(question, passageIndex, questionIndex);
      break;
    case 'multiple-choice':
      typeSpecificForm = createMultipleChoiceForm(question, passageIndex, questionIndex);
      break;
    case 'paragraph-matching':
    case 'match-person':
    case 'match-purpose':
      typeSpecificForm = createMatchingForm(question, passageIndex, questionIndex);
      break;
    case 'table':
      typeSpecificForm = createTableForm(question, passageIndex, questionIndex);
      break;
    case 'text-question':
      // Text questions don't need additional form elements
      break;
  }

  return baseForm + typeSpecificForm;
}

// Create gap fill form
function createGapFillForm(question, passageIndex, questionIndex) {
  return `
    <div class="form-group">
      <label>Question:</label>
      <textarea onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">${question.question || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Answer(s):</label>
      <div class="answer-input">
        ${(question.answer || []).map((answer, answerIndex) => `
          <div class="option-item">
            <input type="text" value="${answer}" onchange="updateAnswer(${passageIndex}, ${questionIndex}, ${answerIndex}, this.value)">
            <button class="option-remove" onclick="removeAnswer(${passageIndex}, ${questionIndex}, ${answerIndex})">Remove</button>
          </div>
        `).join('')}
        <button class="add-option-btn" onclick="addAnswer(${passageIndex}, ${questionIndex})">Add Answer</button>
      </div>
    </div>
  `;
}

// Create true/false form
function createTrueFalseForm(question, passageIndex, questionIndex) {
  const options = question.type === 'true-false-notgiven' 
    ? ['TRUE', 'FALSE', 'NOT GIVEN']
    : ['YES', 'NO', 'NOT GIVEN'];
    
  return `
    <div class="form-group">
      <label>Question:</label>
      <textarea onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">${question.question || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Answer:</label>
      <select class="answer-select" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'answer', this.value)">
        ${options.map(option => 
          `<option value="${option}" ${question.answer === option ? 'selected' : ''}>${option}</option>`
        ).join('')}
      </select>
    </div>
  `;
}

// Create multiple choice form
function createMultipleChoiceForm(question, passageIndex, questionIndex) {
  return `
    <div class="form-group">
      <label>Question:</label>
      <textarea onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">${question.question || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Options:</label>
      <div class="options-container">
        ${(question.options || []).map((option, optionIndex) => `
          <div class="option-item">
            <span class="option-label">${option.label}:</span>
            <input type="text" class="option-text" value="${option.text}" onchange="updateOption(${passageIndex}, ${questionIndex}, ${optionIndex}, 'text', this.value)">
            <button class="option-remove" onclick="removeOption(${passageIndex}, ${questionIndex}, ${optionIndex})">Remove</button>
          </div>
        `).join('')}
        <button class="add-option-btn" onclick="addOption(${passageIndex}, ${questionIndex})">Add Option</button>
      </div>
    </div>
    
    <div class="form-group">
      <label>Correct Answer:</label>
      <select onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'answer', this.value)">
        ${(question.options || []).map(option => 
          `<option value="${option.label}" ${question.answer === option.label ? 'selected' : ''}>${option.label}</option>`
        ).join('')}
      </select>
    </div>
  `;
}

// Create matching form
function createMatchingForm(question, passageIndex, questionIndex) {
  return `
    <div class="form-group">
      <label>Question:</label>
      <textarea onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'question', this.value)">${question.question || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Options:</label>
      <div class="options-container">
        ${(question.options || []).map((option, optionIndex) => `
          <div class="option-item">
            <span class="option-label">${option.label}:</span>
            <input type="text" class="option-text" value="${option.text}" onchange="updateOption(${passageIndex}, ${questionIndex}, ${optionIndex}, 'text', this.value)">
            <button class="option-remove" onclick="removeOption(${passageIndex}, ${questionIndex}, ${optionIndex})">Remove</button>
          </div>
        `).join('')}
        <button class="add-option-btn" onclick="addOption(${passageIndex}, ${questionIndex})">Add Option</button>
      </div>
    </div>
    
    <div class="form-group">
      <label>Correct Answer:</label>
      <select onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'answer', this.value)">
        ${(question.options || []).map(option => 
          `<option value="${option.label}" ${question.answer === option.label ? 'selected' : ''}>${option.label}</option>`
        ).join('')}
      </select>
    </div>
  `;
}

// Create table form
function createTableForm(question, passageIndex, questionIndex) {
  return `
    <div class="form-group">
      <label>Table Title:</label>
      <input type="text" value="${question.title || ''}" onchange="updateQuestion(${passageIndex}, ${questionIndex}, 'title', this.value)">
    </div>
    
    <div class="form-group">
      <label>Columns:</label>
      <div class="table-container">
        <table class="table-editor">
          <thead>
            <tr>
              ${(question.columns || []).map((column, columnIndex) => `
                <th>
                  <input type="text" value="${column}" onchange="updateTableColumn(${passageIndex}, ${questionIndex}, ${columnIndex}, this.value)">
                </th>
              `).join('')}
              <th>
                <button class="add-option-btn" onclick="addTableColumn(${passageIndex}, ${questionIndex})">Add Column</button>
              </th>
            </tr>
          </thead>
          <tbody>
            ${(question.rows || []).map((row, rowIndex) => `
              <tr>
                ${(question.columns || []).map((column, columnIndex) => `
                  <td>
                    <input type="text" value="${row[Object.keys(row)[columnIndex]] || ''}" onchange="updateTableRow(${passageIndex}, ${questionIndex}, ${rowIndex}, ${columnIndex}, this.value)">
                  </td>
                `).join('')}
                <td>
                  <button class="option-remove" onclick="removeTableRow(${passageIndex}, ${questionIndex}, ${rowIndex})">Remove</button>
                </td>
              </tr>
            `).join('')}
            <tr>
              <td colspan="${(question.columns || []).length + 1}">
                <button class="add-option-btn" onclick="addTableRow(${passageIndex}, ${questionIndex})">Add Row</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="form-group">
      <label>Answers:</label>
      <div class="answer-input">
        ${Object.entries(question.answer || {}).map(([key, value]) => `
          <div class="option-item">
            <span class="option-label">${key}:</span>
            <input type="text" value="${value}" onchange="updateTableAnswer(${passageIndex}, ${questionIndex}, '${key}', this.value)">
            <button class="option-remove" onclick="removeTableAnswer(${passageIndex}, ${questionIndex}, '${key}')">Remove</button>
          </div>
        `).join('')}
        <button class="add-option-btn" onclick="addTableAnswer(${passageIndex}, ${questionIndex})">Add Answer</button>
      </div>
    </div>
  `;
}

// Update functions
function updatePassage(passageIndex, field, value) {
  if (!currentTest.passages[passageIndex]) {
    currentTest.passages[passageIndex] = {};
  }
  currentTest.passages[passageIndex][field] = value;
  console.log(`Updated passage ${passageIndex} ${field}:`, value);
}

function updateQuestion(passageIndex, questionIndex, field, value) {
  if (!currentTest.passages[passageIndex].questions) {
    currentTest.passages[passageIndex].questions = [];
  }
  if (!currentTest.passages[passageIndex].questions[questionIndex]) {
    currentTest.passages[passageIndex].questions[questionIndex] = {};
  }
  currentTest.passages[passageIndex].questions[questionIndex][field] = value;
  console.log(`Updated question ${passageIndex}-${questionIndex} ${field}:`, value);
}

function updateAnswer(passageIndex, questionIndex, answerIndex, value) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].answer) {
    currentTest.passages[passageIndex].questions[questionIndex].answer = [];
  }
  currentTest.passages[passageIndex].questions[questionIndex].answer[answerIndex] = value;
  console.log(`Updated answer ${passageIndex}-${questionIndex}-${answerIndex}:`, value);
}

function updateOption(passageIndex, questionIndex, optionIndex, field, value) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].options) {
    currentTest.passages[passageIndex].questions[questionIndex].options = [];
  }
  if (!currentTest.passages[passageIndex].questions[questionIndex].options[optionIndex]) {
    currentTest.passages[passageIndex].questions[questionIndex].options[optionIndex] = {};
  }
  currentTest.passages[passageIndex].questions[questionIndex].options[optionIndex][field] = value;
  console.log(`Updated option ${passageIndex}-${questionIndex}-${optionIndex} ${field}:`, value);
}

// Add/Remove functions
function addAnswer(passageIndex, questionIndex) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].answer) {
    currentTest.passages[passageIndex].questions[questionIndex].answer = [];
  }
  currentTest.passages[passageIndex].questions[questionIndex].answer.push('');
  displayPassages(); // Refresh to show new answer field
}

function removeAnswer(passageIndex, questionIndex, answerIndex) {
  currentTest.passages[passageIndex].questions[questionIndex].answer.splice(answerIndex, 1);
  displayPassages(); // Refresh to remove answer field
}

// Legacy functions for old question types (not used in new structure)
function addLegacyOption(passageIndex, questionIndex) {
  if (!currentTest.passages[passageIndex] || !currentTest.passages[passageIndex].questions || !currentTest.passages[passageIndex].questions[questionIndex]) {
    console.error("Cannot add option: invalid passage or question index");
    return;
  }
  if (!currentTest.passages[passageIndex].questions[questionIndex].options) {
    currentTest.passages[passageIndex].questions[questionIndex].options = [];
  }
  const optionCount = currentTest.passages[passageIndex].questions[questionIndex].options.length;
  const newLabel = String.fromCharCode(65 + optionCount); // A, B, C, D, etc.
  currentTest.passages[passageIndex].questions[questionIndex].options.push({
    label: newLabel,
    text: ''
  });
  displayPassages(); // Refresh to show new option
}

function removeLegacyOption(passageIndex, questionIndex, optionIndex) {
  if (!currentTest.passages[passageIndex] || !currentTest.passages[passageIndex].questions || !currentTest.passages[passageIndex].questions[questionIndex]) {
    console.error("Cannot remove option: invalid passage or question index");
    return;
  }
  currentTest.passages[passageIndex].questions[questionIndex].options.splice(optionIndex, 1);
  displayPassages(); // Refresh to remove option
}

// Table functions
function updateTableColumn(passageIndex, questionIndex, columnIndex, value) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].columns) {
    currentTest.passages[passageIndex].questions[questionIndex].columns = [];
  }
  currentTest.passages[passageIndex].questions[questionIndex].columns[columnIndex] = value;
  displayPassages(); // Refresh to update table structure
}

function addTableColumn(passageIndex, questionIndex) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].columns) {
    currentTest.passages[passageIndex].questions[questionIndex].columns = [];
  }
  currentTest.passages[passageIndex].questions[questionIndex].columns.push('');
  displayPassages(); // Refresh to show new column
}

function updateTableRow(passageIndex, questionIndex, rowIndex, columnIndex, value) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].rows) {
    currentTest.passages[passageIndex].questions[questionIndex].rows = [];
  }
  if (!currentTest.passages[passageIndex].questions[questionIndex].rows[rowIndex]) {
    currentTest.passages[passageIndex].questions[questionIndex].rows[rowIndex] = {};
  }
  const columnName = currentTest.passages[passageIndex].questions[questionIndex].columns[columnIndex];
  currentTest.passages[passageIndex].questions[questionIndex].rows[rowIndex][columnName] = value;
}

function addTableRow(passageIndex, questionIndex) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].rows) {
    currentTest.passages[passageIndex].questions[questionIndex].rows = [];
  }
  const newRow = {};
  currentTest.passages[passageIndex].questions[questionIndex].columns.forEach(column => {
    newRow[column] = '';
  });
  currentTest.passages[passageIndex].questions[questionIndex].rows.push(newRow);
  displayPassages(); // Refresh to show new row
}

function removeTableRow(passageIndex, questionIndex, rowIndex) {
  currentTest.passages[passageIndex].questions[questionIndex].rows.splice(rowIndex, 1);
  displayPassages(); // Refresh to remove row
}

function updateTableAnswer(passageIndex, questionIndex, key, value) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].answer) {
    currentTest.passages[passageIndex].questions[questionIndex].answer = {};
  }
  currentTest.passages[passageIndex].questions[questionIndex].answer[key] = value;
}

function addTableAnswer(passageIndex, questionIndex) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].answer) {
    currentTest.passages[passageIndex].questions[questionIndex].answer = {};
  }
  const newKey = prompt('Enter answer key (e.g., q1, q2):');
  if (newKey) {
    currentTest.passages[passageIndex].questions[questionIndex].answer[newKey] = '';
    displayPassages(); // Refresh to show new answer
  }
}

function removeTableAnswer(passageIndex, questionIndex, key) {
  delete currentTest.passages[passageIndex].questions[questionIndex].answer[key];
  displayPassages(); // Refresh to remove answer
}


// Toggle question type menu
window.toggleQuestionMenu = function (passageNumber) {
  const menu = document.getElementById(`questionMenu${passageNumber}`);
  menu.classList.toggle("show");

  document.addEventListener("click", function closeMenu(e) {
    if (!e.target.closest(".add-question-dropdown")) {
      menu.classList.remove("show");
      document.removeEventListener("click", closeMenu);
    }
  });
};

// Add a question to a passage (matching add reading functionality)
window.addQuestion = function (passageNumber, type) {
  // Sync DOM to data before adding new question
  syncDOMToData();
  
  const passageIndex = passageNumber - 1;
  if (!currentTest.passages[passageIndex].questions) {
    currentTest.passages[passageIndex].questions = [];
  }
  
  // Preserve shared options for paragraph-matching and match-person
  let options = undefined;
  if (type === 'multiple-choice') {
    options = [
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' }
    ];
  } else if (type === 'paragraph-matching' || type === 'match-person') {
    // If shared options exist, use them; otherwise use empty array
    if (sharedOptions[passageNumber] && sharedOptions[passageNumber][type]) {
      options = sharedOptions[passageNumber][type];
    } else {
      options = [];
    }
  }
  
  const newQuestion = {
    type: type,
    question: '',
    answer: type === 'gap-fill' ? [''] : (type === 'multiple-choice' ? '' : ''),
    options: options
  };
  
  currentTest.passages[passageIndex].questions.push(newQuestion);
  displayPassages(); // Refresh to show new question
  
  // Set up auto-propagation for all matching questions
  if ((type === "paragraph-matching" || type === "match-person")) {
    setTimeout(() => {
      const questions = document.querySelectorAll(`#questions${passageNumber} .question-item[data-type="${type}"]`);
      questions.forEach(question => {
        const questionId = question.dataset.questionId;
        setupOptionAutoPropagate(questionId, type, passageNumber);
      });
    }, 100);
  }
  
  updateQuestionNumbers();
};

// Update question numbers globally across all passages (excluding text-question)
function updateQuestionNumbers() {
  let globalCounter = 0;
  
  // Go through all passages in order from currentTest.passages
  if (currentTest && currentTest.passages) {
    currentTest.passages.forEach((passage, passageIndex) => {
      const passageNumber = passageIndex + 1;
      const items = document.querySelectorAll(`#questions${passageNumber} .question-item`);
      
      items.forEach((item) => {
        const numEl = item.querySelector('.question-index');
        if (numEl && item.dataset.type !== 'text-question') {
          globalCounter++;
          numEl.textContent = globalCounter;
        }
      });
    });
  }
}

// Remove a question
window.removeQuestion = function (questionId, passageIndex, questionIndex) {
  const question = document.querySelector(`[data-question-id="${questionId}"]`);
  if (question && confirm("Are you sure you want to remove this question?")) {
    currentTest.passages[passageIndex].questions.splice(questionIndex, 1);
    displayPassages();
    updateQuestionNumbers();
  }
};

// Remove a passage
window.removePassage = function (passageNumber) {
  if (confirm("Are you sure you want to remove this passage and all its questions?")) {
    const passageIndex = passageNumber - 1;
    currentTest.passages.splice(passageIndex, 1);
    passageCount--;
    updatePassageCount();
    updateAddPassageButton();
    displayPassages();
  }
};

// Update passage count display
function updatePassageCount() {
  document.getElementById("passageCount").textContent = passageCount;
}

// Update add passage button state
function updateAddPassageButton() {
  const btn = document.getElementById("addPassageBtn");
  if (passageCount >= 3) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      Maximum 3 Passages Reached
    `;
  } else {
    btn.disabled = false;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      Add Passage
    `;
  }
}

// Add new passage (matching add reading)
window.addPassage = function() {
  if (passageCount >= 3) {
    alert("Maximum 3 passages allowed per test");
    return;
  }

  if (!currentTest.passages) {
    currentTest.passages = [];
  }

  passageCount++;
  const passageNumber = passageCount;
  const passageIndex = passageNumber - 1;
  
  const newPassage = {
    title: '',
    instructions: `You should spend about 20 minutes on Questions corresponding to this passage`,
    text: '',
    questions: []
  };
  
  currentTest.passages.push(newPassage);
  displayPassages();
  updatePassageCount();
  updateAddPassageButton();
};

// Helper functions for question options
window.updateMCOption = function(passageIndex, questionIndex, optionIndex, value) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].options) {
    currentTest.passages[passageIndex].questions[questionIndex].options = [];
  }
  if (!currentTest.passages[passageIndex].questions[questionIndex].options[optionIndex]) {
    currentTest.passages[passageIndex].questions[questionIndex].options[optionIndex] = { label: String.fromCharCode(65 + optionIndex), text: '' };
  }
  currentTest.passages[passageIndex].questions[questionIndex].options[optionIndex].text = value;
};

window.addMCOption = function(questionId, passageIndex, questionIndex) {
  if (!currentTest.passages[passageIndex].questions[questionIndex].options) {
    currentTest.passages[passageIndex].questions[questionIndex].options = [];
  }
  const existingOptions = currentTest.passages[passageIndex].questions[questionIndex].options.length;
  const nextLetter = String.fromCharCode(65 + existingOptions);
  currentTest.passages[passageIndex].questions[questionIndex].options.push({
    label: nextLetter,
    text: ''
  });
  displayPassages();
};

window.removeMCOption = function(questionId, passageIndex, questionIndex, optionIndex) {
  const options = currentTest.passages[passageIndex].questions[questionIndex].options;
  if (options.length <= 2) {
    alert("Multiple choice question must have at least 2 options");
    return;
  }
  if (confirm("Remove this option?")) {
    options.splice(optionIndex, 1);
    displayPassages();
  }
};

// Set up auto-propagation for matching questions
function setupOptionAutoPropagate(questionId, type, passageNumber) {
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  
  if (!container) return;
  
  // Add input listeners to all option inputs
  const optionInputs = container.querySelectorAll('.option-label, .option-text');
  optionInputs.forEach(input => {
    // Remove existing listeners to avoid duplicates
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    newInput.addEventListener('input', () => {
      updateSharedOptionsFromQuestion(questionId, type, passageNumber);
      updateAllOptionsInPassage(type, passageNumber);
    });
  });
}

// Update shared options from any question as user types
function updateSharedOptionsFromQuestion(questionId, type, passageNumber) {
  if (!questionId || !type || !passageNumber) {
    console.error("updateSharedOptionsFromQuestion: Invalid parameters", { questionId, type, passageNumber });
    return;
  }
  
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  
  if (!container) {
    console.warn("updateSharedOptionsFromQuestion: Container not found", `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`);
    return;
  }
  
  const newOptions = [];
  container.querySelectorAll(".option-row").forEach((row) => {
    const labelEl = row.querySelector(".option-label");
    const textEl = row.querySelector(".option-text");
    if (labelEl && textEl) {
      const label = labelEl.value.trim();
      const text = textEl.value;
      if (label) {
        newOptions.push({ label, text });
      }
    }
  });

  if (!sharedOptions[passageNumber]) {
    sharedOptions[passageNumber] = {};
  }
  sharedOptions[passageNumber][type] = newOptions;
  
  // Update all questions of this type in the same passage in the data model
  const passageIndex = passageNumber - 1;
  if (currentTest.passages[passageIndex]) {
    currentTest.passages[passageIndex].questions.forEach((q, idx) => {
      if (q.type === type) {
        currentTest.passages[passageIndex].questions[idx].options = newOptions;
      }
    });
  }
}

// Update all matching questions in the same passage
function updateAllOptionsInPassage(type, passageNumber) {
  const questions = document.querySelectorAll(
    `#questions${passageNumber} .question-item[data-type="${type}"]`
  );
  
  const options = sharedOptions[passageNumber]?.[type] || [];
  
  questions.forEach((question) => {
    const questionId = question.dataset.questionId;
    const container = document.getElementById(
      `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
    );
    const previewDiv = document.getElementById(`options-preview-${questionId}`);
    
    if (!container || !previewDiv) return;
    
    // Check if this container is currently being edited (visible)
    const isBeingEdited = container.style.display !== "none";
    
    // If not being edited, update the options HTML
    if (!isBeingEdited) {
      const matchingIdPrefix = type === "paragraph-matching" ? "pm" : "match";
      const optionsHTML = options
        .map(
          (opt) => `
        <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
          <input type="text" value="${opt.label}" class="option-label" style="width: 40px; text-align: center;">
          <input type="text" value="${(opt.text || '').replace(/"/g, '&quot;')}" class="option-text" data-label="${opt.label}" style="flex: 1;">
          <button type="button" onclick="removeOption(this, '${type}', ${passageNumber})" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>
        </div>
      `
        )
        .join("") +
        `<button type="button" onclick="addOption(${questionId}, '${type}', ${passageNumber})" style="margin-top: 5px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>`;
      
      container.innerHTML = optionsHTML;
    } else {
      // If being edited, just update the values in existing inputs
      const optionRows = container.querySelectorAll('.option-row');
      optionRows.forEach((row, index) => {
        if (options[index]) {
          const labelEl = row.querySelector('.option-label');
          const textEl = row.querySelector('.option-text');
          if (labelEl) labelEl.value = options[index].label;
          if (textEl) textEl.value = options[index].text;
        }
      });
    }
    
    // Update preview for all questions
    previewDiv.innerHTML = options
      .map(opt => 
        `<span style="display: inline-block; margin: 2px; padding: 3px 8px; background: #f0f0f0; border-radius: 3px; font-size: 12px;">${opt.label}: ${opt.text || "(empty)"}</span>`
      )
      .join("");
  });
}

// Toggle options edit view
window.toggleOptionsEdit = function (questionId, type, passageNumber) {
  // First sync any currently open editor
  syncDOMToData();
  
  const optionsDiv = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  const previewDiv = document.getElementById(`options-preview-${questionId}`);

  if (!optionsDiv || !previewDiv) return;

  if (optionsDiv.style.display === "none" || optionsDiv.style.display === "") {
    // Close any other open editors in this passage for this type
    const allQuestions = document.querySelectorAll(`#questions${passageNumber} .question-item[data-type="${type}"]`);
    allQuestions.forEach(question => {
      const qId = question.dataset.questionId;
      const otherOptionsDiv = document.getElementById(
        `${type === "paragraph-matching" ? "pm" : "match"}-options-${qId}`
      );
      const otherPreviewDiv = document.getElementById(`options-preview-${qId}`);
      if (otherOptionsDiv && otherPreviewDiv && qId !== questionId) {
        // Save options before closing
        updateSharedOptionsFromQuestion(qId, type, passageNumber);
        otherOptionsDiv.style.display = "none";
        otherPreviewDiv.style.display = "block";
      }
    });
    
    // Open this editor
    optionsDiv.style.display = "block";
    previewDiv.style.display = "none";
    
    // Set up auto-propagation for this question
    setupOptionAutoPropagate(questionId, type, passageNumber);
  } else {
    // Save and close
    updateSharedOptionsFromQuestion(questionId, type, passageNumber);
    optionsDiv.style.display = "none";
    previewDiv.style.display = "block";
    updateAllOptionsInPassage(type, passageNumber);
  }
};

// Update shared options from inputs (legacy function - now uses updateSharedOptionsFromQuestion)
function updateSharedOptions(questionId, type, passageNumber) {
  updateSharedOptionsFromQuestion(questionId, type, passageNumber);
}

// Helper function to update shared options from a specific container
function updateSharedOptionsFromContainer(container, type, passageNumber) {
  const newOptions = [];

  container.querySelectorAll(".option-row").forEach((row) => {
    const label = row.querySelector(".option-label").value.trim();
    const text = row.querySelector(".option-text").value.trim();
    if (label) {
      newOptions.push({ label, text });
    }
  });

  if (!sharedOptions[passageNumber]) {
    sharedOptions[passageNumber] = {};
  }
  sharedOptions[passageNumber][type] = newOptions;
  console.log(`📝 Updated ${type} options for passage ${passageNumber}:`, newOptions);
}

// Add new option
window.addOption = function (questionId, type, passageNumber) {
  if (!questionId || !type || !passageNumber) {
    console.error("addOption: Invalid parameters", { questionId, type, passageNumber });
    return;
  }
  
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  
  if (!container) {
    console.error("addOption: Container not found", `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`);
    return;
  }
  
  const existingOptions = container.querySelectorAll(".option-row").length;
  const nextLetter = String.fromCharCode(65 + existingOptions);

  const optionHTML = `
    <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
      <input type="text" value="${nextLetter}" class="option-label" style="width: 40px; text-align: center;">
      <input type="text" placeholder="Enter text" class="option-text" data-label="${nextLetter}" style="flex: 1;">
      <button type="button" onclick="removeOption(this, '${type}', ${passageNumber})" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>
    </div>
  `;

  const addButton = container.querySelector('button[onclick*="addOption"]');
  addButton.insertAdjacentHTML("beforebegin", optionHTML);
  
  // Set up listeners for newly added inputs
  const newRow = addButton.previousElementSibling;
  const newInputs = newRow.querySelectorAll('.option-label, .option-text');
  newInputs.forEach(input => {
    input.addEventListener('input', () => {
      updateSharedOptionsFromQuestion(questionId, type, passageNumber);
      updateAllOptionsInPassage(type, passageNumber);
    });
  });
  
  // Immediately update shared options and propagate
  updateSharedOptionsFromQuestion(questionId, type, passageNumber);
  updateAllOptionsInPassage(type, passageNumber);
};

// Remove option
window.removeOption = function (button, type, passageNumber) {
  if (!button || !type || !passageNumber) {
    console.error("removeOption: Invalid parameters", { button, type, passageNumber });
    return;
  }
  
  const container = button.closest(`[id^="pm-options-"], [id^="match-options-"]`);
  if (!container) {
    console.error("removeOption: Container not found");
    return;
  }
  
  const questionId = container.id.split('-').pop();
  if (!questionId) {
    console.error("removeOption: Question ID not found");
    return;
  }
  
  button.parentElement.remove();
  
  // Update shared options and propagate
  updateSharedOptionsFromQuestion(questionId, type, passageNumber);
  updateAllOptionsInPassage(type, passageNumber);
};

// Delete functions
function confirmDelete(type, passageIndex, questionIndex = null) {
  itemToDelete = { type, passageIndex, questionIndex };
  
  let message = '';
  if (type === 'passage') {
    message = `passage ${passageIndex + 1}`;
  } else if (type === 'question') {
    message = `question ${questionIndex + 1} in passage ${passageIndex + 1}`;
  }
  
  document.getElementById("deleteModal").style.display = "flex";
}

function closeDeleteModal() {
  document.getElementById("deleteModal").style.display = "none";
  itemToDelete = null;
}

function deleteItem() {
  if (!itemToDelete) return;

  const { type, passageIndex, questionIndex } = itemToDelete;
  
  if (type === 'passage') {
    currentTest.passages.splice(passageIndex, 1);
  } else if (type === 'question') {
    currentTest.passages[passageIndex].questions.splice(questionIndex, 1);
  }
  
  closeDeleteModal();
  displayPassages(); // Refresh to show changes
}

// Save functions
function saveTest() {
  if (confirm("Are you sure you want to save the changes to this test?\n\nThis will update the test in the database and affect all users.")) {
    document.getElementById("saveModal").style.display = "flex";
  }
}

function closeSaveModal() {
  document.getElementById("saveModal").style.display = "none";
}

// Collect test data from form (matching add reading structure)
function collectTestData() {
  const passages = [];
  const passageElements = document.querySelectorAll(".passage-container");

  passageElements.forEach((passageEl) => {
    const passageNumber = parseInt(passageEl.dataset.passage);
    const passageIndex = passageNumber - 1;
    const passageData = {
      title: passageEl.querySelector(".passage-title-input").value.trim(),
      instructions: passageEl.querySelector(".passage-instructions").value.trim(),
      text: passageEl.querySelector(".passage-text").value.trim(),
      questions: [],
    };

    const questionElements = passageEl.querySelectorAll(".question-item");
    questionElements.forEach((questionEl) => {
      const type = questionEl.dataset.type;
      const questionText = questionEl.querySelector(".question-text")?.value.trim();
      const groupInstruction = questionEl.querySelector(".group-instruction")?.value.trim();

      let questionData = {
        type: type,
      };

      if (groupInstruction) {
        questionData.groupInstruction = groupInstruction;
      }

      if (type === "text-question") {
        const title = questionEl.querySelector(".question-title")?.value.trim();
        const subheading = questionEl.querySelector(".question-subheading")?.value.trim();
        const text = questionEl.querySelector(".question-text")?.value.trim();

        if (title) questionData.title = title;
        if (subheading) questionData.subheading = subheading;
        if (text) questionData.text = text;
      } else {
        questionData.question = questionText;

        if (type === "gap-fill") {
          const answerText = questionEl.querySelector(".question-answer").value.trim();
          questionData.answer = answerText.split(",").map((a) => a.trim()).filter((a) => a);
        } else if (type === "multiple-choice") {
          const selectedAnswer = questionEl.querySelector('input[type="radio"]:checked');
          questionData.answer = selectedAnswer ? selectedAnswer.value : "";
          questionData.options = [];

          questionEl.querySelectorAll(".option-text").forEach((optionEl) => {
            const optionLetter = optionEl.dataset.option;
            const optionText = optionEl.value.trim();
            if (optionText) {
              questionData.options.push({
                label: optionLetter,
                text: optionText,
              });
            }
          });
        } else if (type === "paragraph-matching" || type === "match-person") {
          questionData.answer = questionEl.querySelector(".question-answer").value.trim();
          const passageOptions = sharedOptions[passageNumber]?.[type] || [];
          questionData.options = passageOptions.map((opt) => ({
            label: opt.label,
            text: opt.text,
          }));
        } else {
          questionData.answer = questionEl.querySelector(".question-answer").value.trim();
        }
      }

      passageData.questions.push(questionData);
    });

    passages.push(passageData);
  });

  return {
    passages: passages,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email,
  };
}

async function confirmSave() {
  const saveBtn = document.getElementById("confirmSaveBtn");
  const saveText = document.getElementById("saveText");
  const saveLoader = document.getElementById("saveLoader");

  // Disable button and show loader
  saveBtn.disabled = true;
  saveText.textContent = "Saving...";
  saveLoader.style.display = "inline-block";

  try {
    console.log("💾 Saving test to Firebase...");
    
    // Collect data from form
    const testData = collectTestData();
    
    // Preserve original metadata
    const updateData = {
      ...testData,
      createdAt: currentTest.createdAt,
      createdBy: currentTest.createdBy,
    };
    
    // Update in Firebase
    const testDocRef = doc(db, "readingTests", testId);
    await updateDoc(testDocRef, updateData);
    
    // Update local copy
    currentTest = { ...currentTest, ...updateData };
    
    console.log("✅ Test saved successfully");
    
    // Close modal
    closeSaveModal();
    
    // Show success message
    showNotification("✅ Test saved successfully!", "success");
    
  } catch (error) {
    console.error("❌ Error saving test:", error);
    alert(`❌ Error saving test: ${error.message}`);
  } finally {
    // Reset button
    saveBtn.disabled = false;
    saveText.textContent = "Save Changes";
    saveLoader.style.display = "none";
  }
}

// Navigation functions
function goBack() {
  if (confirm("Are you sure you want to cancel?\n\nAll unsaved changes will be lost.")) {
    window.location.href = '../index.html';
  }
}

// Show notification
function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === "success" ? "#4CAF50" : "#f44336"};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideInRight 0.3s ease;
    font-weight: 500;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Make functions globally available
window.updatePassage = updatePassage;
window.updateQuestion = updateQuestion;
window.updateAnswer = updateAnswer;
window.updateOption = updateOption;
window.addAnswer = addAnswer;
window.removeAnswer = removeAnswer;
// Note: window.addOption and window.removeOption are defined above for paragraph-matching/match-person
// Legacy functions are not exposed to window to avoid conflicts
window.updateTableColumn = updateTableColumn;
window.addTableColumn = addTableColumn;
window.updateTableRow = updateTableRow;
window.addTableRow = addTableRow;
window.removeTableRow = removeTableRow;
window.updateTableAnswer = updateTableAnswer;
window.addTableAnswer = addTableAnswer;
window.removeTableAnswer = removeTableAnswer;
window.addPassage = addPassage;
window.addQuestion = addQuestion;
window.confirmDelete = confirmDelete;
window.closeDeleteModal = closeDeleteModal;
window.deleteItem = deleteItem;
window.saveTest = saveTest;
window.closeSaveModal = closeSaveModal;
window.confirmSave = confirmSave;
window.goBack = goBack;

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📚 Edit Reading Test page loaded");

  // Check admin access
  await checkAdminAccess();

  // Get test ID from URL
  testId = getTestIdFromUrl();
  if (!testId) {
    alert("❌ No test ID provided in URL");
    window.location.href = '../test-reading-edit-select.html';
    return;
  }

  // Load test
  await loadTest();

  // Connect add passage button
  document.getElementById("addPassageBtn").addEventListener("click", addPassage);

  // Connect modal buttons
  document.getElementById("confirmSaveBtn").addEventListener("click", confirmSave);
  document.getElementById("confirmDeleteBtn").addEventListener("click", deleteItem);

  // Close modals on outside click
  document.getElementById("saveModal").addEventListener("click", (e) => {
    if (e.target.id === "saveModal") {
      closeSaveModal();
    }
  });

  document.getElementById("deleteModal").addEventListener("click", (e) => {
    if (e.target.id === "deleteModal") {
      closeDeleteModal();
    }
  });

  console.log("✅ Page initialized successfully");
});
