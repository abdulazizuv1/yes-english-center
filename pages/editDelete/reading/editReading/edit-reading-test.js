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

// Question types mapping
const QUESTION_TYPES = {
  'gap-fill': 'Gap Fill',
  'true-false-notgiven': 'True/False/Not Given',
  'yes-no-notgiven': 'Yes/No/Not Given',
  'multiple-choice': 'Multiple Choice',
  'paragraph-matching': 'Paragraph Matching',
  'match-person': 'Match Person',
  'match-purpose': 'Match Purpose',
  'table': 'Table Completion',
  'text-question': 'Text/Instruction'
};

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
  document.getElementById("testId").value = testId;
  document.getElementById("testNumber").value = testId.replace("test-", "");
  document.getElementById("testTitle").textContent = `Reading Test ${testId.replace("test-", "")}`;
}

// Display all passages
function displayPassages() {
  const container = document.getElementById("passagesContainer");
  
  if (!currentTest.passages || currentTest.passages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No passages found. Click "Add Passage" to create the first passage.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = currentTest.passages.map((passage, passageIndex) => 
    createPassageCard(passage, passageIndex)
  ).join('');
}

// Create passage card HTML
function createPassageCard(passage, passageIndex) {
  return `
    <div class="passage-card" data-passage-index="${passageIndex}">
      <div class="passage-header">
        <div class="passage-title">Passage ${passageIndex + 1}: ${passage.title || 'Untitled'}</div>
        <div class="passage-actions">
          <button class="btn-edit" onclick="editPassage(${passageIndex})">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit
          </button>
          <button class="btn-delete" onclick="confirmDelete('passage', ${passageIndex})">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete
          </button>
        </div>
      </div>
      <div class="passage-content">
        <div class="passage-form">
          <div class="form-group">
            <label>Title:</label>
            <input type="text" value="${passage.title || ''}" onchange="updatePassage(${passageIndex}, 'title', this.value)">
          </div>
          <div class="form-group">
            <label>Instructions:</label>
            <textarea onchange="updatePassage(${passageIndex}, 'instructions', this.value)">${passage.instructions || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Passage Text:</label>
            <textarea style="min-height: 200px;" onchange="updatePassage(${passageIndex}, 'text', this.value)">${passage.text || ''}</textarea>
          </div>
        </div>
        
        <div class="questions-section">
          <div class="questions-header">
            <h3>Questions (${passage.questions ? passage.questions.length : 0})</h3>
            <button class="btn-add" onclick="addQuestion(${passageIndex})">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Question
            </button>
          </div>
          <div class="questions-list">
            ${passage.questions ? passage.questions.map((question, questionIndex) => 
              createQuestionCard(question, passageIndex, questionIndex)
            ).join('') : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Create question card HTML
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

function addOption(passageIndex, questionIndex) {
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

function removeOption(passageIndex, questionIndex, optionIndex) {
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

// Add new passage
function addPassage() {
  if (!currentTest.passages) {
    currentTest.passages = [];
  }
  
  const newPassage = {
    title: 'New Passage',
    instructions: '',
    text: '',
    questions: []
  };
  
  currentTest.passages.push(newPassage);
  displayPassages(); // Refresh to show new passage
}

// Add new question
function addQuestion(passageIndex) {
  if (!currentTest.passages[passageIndex].questions) {
    currentTest.passages[passageIndex].questions = [];
  }
  
  const newQuestion = {
    type: 'gap-fill',
    question: '',
    answer: ['']
  };
  
  currentTest.passages[passageIndex].questions.push(newQuestion);
  displayPassages(); // Refresh to show new question
}

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
  document.getElementById("saveModal").style.display = "flex";
}

function closeSaveModal() {
  document.getElementById("saveModal").style.display = "none";
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
    
    // Update in Firebase
    const testDocRef = doc(db, "readingTests", testId);
    await updateDoc(testDocRef, currentTest);
    
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
  window.location.href = '../test-reading-edit-select.html';
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
window.addOption = addOption;
window.removeOption = removeOption;
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
