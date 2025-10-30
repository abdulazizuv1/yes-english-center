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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let currentTest = null;
let testId = null;
let itemToDelete = null;
let currentAudioUpload = null;

// Content types mapping
const CONTENT_TYPES = {
  'text': 'Text',
  'question': 'Question',
  'question-group': 'Question Group',
  'subheading': 'Subheading'
};

// Question formats mapping
const QUESTION_FORMATS = {
  'gap-fill': 'Gap Fill',
  'multiple-choice': 'Multiple Choice',
  'multi-select': 'Multi Select',
  'matching': 'Matching'
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
    console.log("🎧 Loading listening test from Firebase...");
    
    const testDocRef = doc(db, "listeningTests", testId);
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
    
    // Display sections
    displaySections();
    
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
  document.getElementById("testTitle").textContent = `Listening Test ${testId.replace("test-", "")}`;
}

// Display all sections
function displaySections() {
  const container = document.getElementById("sectionsContainer");
  
  // Ensure parts structure exists
  if (!currentTest.parts) {
    currentTest.parts = {
      testId: testId,
      title: `IELTS Listening Test ${testId.replace("test-", "")}`,
      sections: []
    };
  }
  
  if (!currentTest.parts.sections || currentTest.parts.sections.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No sections found. Click "Add Section" to create the first section.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = currentTest.parts.sections
    .map((section, sectionIndex) => createSectionCard(section, sectionIndex))
    .filter(card => card !== '') // Remove empty cards
    .join('');
}

// Create section card HTML
function createSectionCard(section, sectionIndex) {
  // Ensure section exists
  if (!section) {
    console.warn(`Section at index ${sectionIndex} is undefined`);
    return '';
  }
  
  return `
    <div class="section-card" data-section-index="${sectionIndex}">
      <div class="section-header-card">
        <div class="section-title">Section ${section.sectionNumber}: ${section.title || 'Untitled'}</div>
        <div class="section-actions">
          <button class="btn-edit" onclick="editSection(${sectionIndex})">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit
          </button>
          <button class="btn-delete" onclick="confirmDelete('section', ${sectionIndex})">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete
          </button>
        </div>
      </div>
      <div class="section-content-card">
        <div class="section-form">
          <div class="form-group">
            <label>Section Number:</label>
            <input type="number" value="${section.sectionNumber || ''}" onchange="updateSection(${sectionIndex}, 'sectionNumber', parseInt(this.value))">
          </div>
          <div class="form-group">
            <label>Title:</label>
            <input type="text" value="${section.title || ''}" onchange="updateSection(${sectionIndex}, 'title', this.value)">
          </div>
          
          <!-- Audio Player Section -->
          <div class="audio-player-container">
            <div class="audio-info">
              <div class="audio-title">Audio File (Part ${section.sectionNumber})</div>
              <div class="audio-actions">
                <button class="btn-audio-upload" onclick="openAudioUpload(${sectionIndex})">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  Upload Audio
                </button>
                ${section.audioUrl ? `
                  <button class="btn-audio-remove" onclick="removeAudio(${sectionIndex})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Remove
                  </button>
                ` : ''}
              </div>
            </div>
            ${section.audioUrl ? `
              <audio controls class="audio-player">
                <source src="${section.audioUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
              </audio>
            ` : `
              <div style="padding: 20px; text-align: center; color: #6b7280; background: #f9fafb; border-radius: 12px; border: 2px dashed #d1d5db;">
                No audio file uploaded yet
              </div>
            `}
          </div>
          
          <div class="form-group">
            <label>Instructions Heading:</label>
            <input type="text" value="${section.instructions?.heading || ''}" onchange="updateSectionInstructions(${sectionIndex}, 'heading', this.value)">
          </div>
          <div class="form-group">
            <label>Instructions Details:</label>
            <textarea onchange="updateSectionInstructions(${sectionIndex}, 'details', this.value)">${section.instructions?.details || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Instructions Note:</label>
            <input type="text" value="${section.instructions?.note || ''}" onchange="updateSectionInstructions(${sectionIndex}, 'note', this.value)">
          </div>
        </div>
        
        <div class="content-section">
          <div class="content-header">
            <h3>Content Items (${section.content ? section.content.length : 0})</h3>
            <button class="btn-add" onclick="addContentItem(${sectionIndex})">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Content
            </button>
          </div>
          <div class="content-list">
            ${section.content ? section.content
              .map((contentItem, contentIndex) => createContentItemCard(contentItem, sectionIndex, contentIndex))
              .filter(card => card !== '') // Remove empty cards
              .join('') : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Create content item card HTML
function createContentItemCard(contentItem, sectionIndex, contentIndex) {
  // Ensure contentItem exists and has required properties
  if (!contentItem) {
    console.warn(`Content item at section ${sectionIndex}, index ${contentIndex} is undefined`);
    return '';
  }
  
  const contentType = contentItem.type || 'text';
  const typeLabel = CONTENT_TYPES[contentType] || contentType;
  
  return `
    <div class="content-item content-type-${contentType}" data-section-index="${sectionIndex}" data-content-index="${contentIndex}">
      <div class="content-item-header">
        <div class="content-type">${typeLabel}</div>
        <div class="content-actions">
          <button class="btn-edit" onclick="editContentItem(${sectionIndex}, ${contentIndex})">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit
          </button>
          <button class="btn-delete" onclick="confirmDelete('content', ${sectionIndex}, ${contentIndex})">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete
          </button>
        </div>
      </div>
      <div class="content-item-body">
        <div class="content-form">
          ${createContentForm(contentItem, sectionIndex, contentIndex)}
        </div>
      </div>
    </div>
  `;
}

// Create content form based on type
function createContentForm(contentItem, sectionIndex, contentIndex) {
  const contentType = contentItem.type || 'text';
  
  let baseForm = `
    <div class="form-group">
      <label>Content Type:</label>
      <select onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'type', this.value); location.reload();">
        ${Object.entries(CONTENT_TYPES).map(([value, label]) => 
          `<option value="${value}" ${contentType === value ? 'selected' : ''}>${label}</option>`
        ).join('')}
      </select>
    </div>
  `;
  
  // Add type-specific form elements
  let typeSpecificForm = '';
  
  switch (contentType) {
    case 'text':
      typeSpecificForm = createTextForm(contentItem, sectionIndex, contentIndex);
      break;
    case 'subheading':
      typeSpecificForm = createSubheadingForm(contentItem, sectionIndex, contentIndex);
      break;
    case 'question':
      typeSpecificForm = createQuestionForm(contentItem, sectionIndex, contentIndex);
      break;
    case 'question-group':
      typeSpecificForm = createQuestionGroupForm(contentItem, sectionIndex, contentIndex);
      break;
  }

  return baseForm + typeSpecificForm;
}

// Create text form
function createTextForm(contentItem, sectionIndex, contentIndex) {
  return `
    <div class="form-group">
      <label>Title (optional):</label>
      <input type="text" value="${contentItem.title || ''}" onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'title', this.value)">
    </div>
    
    <div class="form-group">
      <label>Value:</label>
      <textarea onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'value', this.value)">${contentItem.value || ''}</textarea>
    </div>
  `;
}

// Create subheading form
function createSubheadingForm(contentItem, sectionIndex, contentIndex) {
  return `
    <div class="form-group">
      <label>Value:</label>
      <input type="text" value="${contentItem.value || ''}" onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'value', this.value)">
    </div>
  `;
}

// Create question form
function createQuestionForm(contentItem, sectionIndex, contentIndex) {
  const format = contentItem.format || 'gap-fill';
  
  let baseForm = `
    <div class="form-group">
      <label>Question ID:</label>
      <input type="text" value="${contentItem.questionId || ''}" onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'questionId', this.value)">
    </div>
    
    <div class="form-group">
      <label>Format:</label>
      <select onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'format', this.value); location.reload();">
        ${Object.entries(QUESTION_FORMATS).map(([value, label]) => 
          `<option value="${value}" ${format === value ? 'selected' : ''}>${label}</option>`
        ).join('')}
      </select>
    </div>
    
    <div class="form-group">
      <label>Group Instruction (optional):</label>
      <textarea onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'groupInstruction', this.value)">${contentItem.groupInstruction || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Question Text:</label>
      <textarea onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'text', this.value)">${contentItem.text || ''}</textarea>
    </div>
  `;
  
  // Add format-specific elements
  let formatSpecificForm = '';
  
  switch (format) {
    case 'gap-fill':
      formatSpecificForm = createGapFillForm(contentItem, sectionIndex, contentIndex);
      break;
    case 'multiple-choice':
      formatSpecificForm = createMultipleChoiceForm(contentItem, sectionIndex, contentIndex);
      break;
  }

  return baseForm + formatSpecificForm;
}

// Create gap fill form
function createGapFillForm(contentItem, sectionIndex, contentIndex) {
  return `
    <div class="form-group">
      <label>Postfix (optional):</label>
      <input type="text" value="${contentItem.postfix || ''}" onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'postfix', this.value)">
    </div>
    
    <div class="form-group">
      <label>Correct Answer:</label>
      <input type="text" value="${contentItem.correctAnswer || ''}" onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'correctAnswer', this.value)">
    </div>
    
    <div class="form-group">
      <label>Word Limit:</label>
      <input type="number" value="${contentItem.wordLimit || 1}" onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'wordLimit', parseInt(this.value))">
    </div>
  `;
}

// Create multiple choice form
function createMultipleChoiceForm(contentItem, sectionIndex, contentIndex) {
  return `
    <div class="form-group">
      <label>Options:</label>
      <div class="options-container">
        ${Object.entries(contentItem.options || {}).map(([key, value]) => `
          <div class="option-item">
            <span class="option-label">${key}:</span>
            <input type="text" class="option-text" value="${value}" onchange="updateOption(${sectionIndex}, ${contentIndex}, '${key}', this.value)">
            <button class="option-remove" onclick="removeOption(${sectionIndex}, ${contentIndex}, '${key}')">Remove</button>
          </div>
        `).join('')}
        <button class="add-option-btn" onclick="addOption(${sectionIndex}, ${contentIndex})">Add Option</button>
      </div>
    </div>
    
    <div class="form-group">
      <label>Correct Answer:</label>
      <select onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'correctAnswer', this.value)">
        ${Object.keys(contentItem.options || {}).map(key => 
          `<option value="${key}" ${contentItem.correctAnswer === key ? 'selected' : ''}>${key}</option>`
        ).join('')}
      </select>
    </div>
  `;
}

// Create question group form
function createQuestionGroupForm(contentItem, sectionIndex, contentIndex) {
  return `
    <div class="form-group">
      <label>Group Type:</label>
      <select onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'groupType', this.value)">
        <option value="multi-select" ${contentItem.groupType === 'multi-select' ? 'selected' : ''}>Multi Select</option>
        <option value="matching" ${contentItem.groupType === 'matching' ? 'selected' : ''}>Matching</option>
      </select>
    </div>
    
    <div class="form-group">
      <label>Group Instruction:</label>
      <textarea onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'groupInstruction', this.value)">${contentItem.groupInstruction || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Question ID:</label>
      <input type="text" value="${contentItem.questionId || ''}" onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'questionId', this.value)">
    </div>
    
    <div class="form-group">
      <label>Text:</label>
      <textarea onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'text', this.value)">${contentItem.text || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Instructions:</label>
      <textarea onchange="updateContentItem(${sectionIndex}, ${contentIndex}, 'instructions', this.value)">${contentItem.instructions || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Options:</label>
      <div class="options-container">
        ${Object.entries(contentItem.options || {}).map(([key, value]) => `
          <div class="option-item">
            <span class="option-label">${key}:</span>
            <input type="text" class="option-text" value="${value}" onchange="updateOption(${sectionIndex}, ${contentIndex}, '${key}', this.value)">
            <button class="option-remove" onclick="removeOption(${sectionIndex}, ${contentIndex}, '${key}')">Remove</button>
          </div>
        `).join('')}
        <button class="add-option-btn" onclick="addOption(${sectionIndex}, ${contentIndex})">Add Option</button>
      </div>
    </div>
    
    <div class="form-group">
      <label>Questions in Group:</label>
      <div class="questions-in-group">
        ${(contentItem.questions || []).map((question, questionIndex) => `
          <div class="form-group">
            <label>Question ${questionIndex + 1} ID:</label>
            <input type="text" value="${question.questionId || ''}" onchange="updateQuestionInGroup(${sectionIndex}, ${contentIndex}, ${questionIndex}, 'questionId', this.value)">
            <label>Correct Answer:</label>
            <input type="text" value="${question.correctAnswer || ''}" onchange="updateQuestionInGroup(${sectionIndex}, ${contentIndex}, ${questionIndex}, 'correctAnswer', this.value)">
            ${contentItem.groupType === 'matching' ? `
              <label>Text:</label>
              <input type="text" value="${question.text || ''}" onchange="updateQuestionInGroup(${sectionIndex}, ${contentIndex}, ${questionIndex}, 'text', this.value)">
            ` : ''}
          </div>
        `).join('')}
        <button class="add-option-btn" onclick="addQuestionToGroup(${sectionIndex}, ${contentIndex})">Add Question</button>
      </div>
    </div>
  `;
}

// Update functions
function updateSection(sectionIndex, field, value) {
  if (!currentTest.parts.sections[sectionIndex]) {
    currentTest.parts.sections[sectionIndex] = {};
  }
  currentTest.parts.sections[sectionIndex][field] = value;
  console.log(`Updated section ${sectionIndex} ${field}:`, value);
}

function updateSectionInstructions(sectionIndex, field, value) {
  if (!currentTest.parts.sections[sectionIndex].instructions) {
    currentTest.parts.sections[sectionIndex].instructions = {};
  }
  currentTest.parts.sections[sectionIndex].instructions[field] = value;
  console.log(`Updated section ${sectionIndex} instructions ${field}:`, value);
}

function updateContentItem(sectionIndex, contentIndex, field, value) {
  if (!currentTest.parts.sections[sectionIndex].content) {
    currentTest.parts.sections[sectionIndex].content = [];
  }
  if (!currentTest.parts.sections[sectionIndex].content[contentIndex]) {
    currentTest.parts.sections[sectionIndex].content[contentIndex] = {};
  }
  currentTest.parts.sections[sectionIndex].content[contentIndex][field] = value;
  console.log(`Updated content ${sectionIndex}-${contentIndex} ${field}:`, value);
}

function updateOption(sectionIndex, contentIndex, key, value) {
  if (!currentTest.parts.sections[sectionIndex].content[contentIndex].options) {
    currentTest.parts.sections[sectionIndex].content[contentIndex].options = {};
  }
  currentTest.parts.sections[sectionIndex].content[contentIndex].options[key] = value;
  console.log(`Updated option ${sectionIndex}-${contentIndex} ${key}:`, value);
}

function updateQuestionInGroup(sectionIndex, contentIndex, questionIndex, field, value) {
  if (!currentTest.parts.sections[sectionIndex].content[contentIndex].questions) {
    currentTest.parts.sections[sectionIndex].content[contentIndex].questions = [];
  }
  if (!currentTest.parts.sections[sectionIndex].content[contentIndex].questions[questionIndex]) {
    currentTest.parts.sections[sectionIndex].content[contentIndex].questions[questionIndex] = {};
  }
  currentTest.parts.sections[sectionIndex].content[contentIndex].questions[questionIndex][field] = value;
  console.log(`Updated question in group ${sectionIndex}-${contentIndex}-${questionIndex} ${field}:`, value);
}

// Add/Remove functions
function addOption(sectionIndex, contentIndex) {
  if (!currentTest.parts.sections[sectionIndex].content[contentIndex].options) {
    currentTest.parts.sections[sectionIndex].content[contentIndex].options = {};
  }
  const optionCount = Object.keys(currentTest.parts.sections[sectionIndex].content[contentIndex].options).length;
  const newKey = String.fromCharCode(65 + optionCount); // A, B, C, D, etc.
  currentTest.parts.sections[sectionIndex].content[contentIndex].options[newKey] = '';
  displaySections(); // Refresh to show new option
}

function removeOption(sectionIndex, contentIndex, key) {
  delete currentTest.parts.sections[sectionIndex].content[contentIndex].options[key];
  displaySections(); // Refresh to remove option
}

function addQuestionToGroup(sectionIndex, contentIndex) {
  if (!currentTest.parts.sections[sectionIndex].content[contentIndex].questions) {
    currentTest.parts.sections[sectionIndex].content[contentIndex].questions = [];
  }
  currentTest.parts.sections[sectionIndex].content[contentIndex].questions.push({
    questionId: '',
    correctAnswer: ''
  });
  displaySections(); // Refresh to show new question
}

// Audio upload functions
function openAudioUpload(sectionIndex) {
  currentAudioUpload = { sectionIndex };
  document.getElementById("audioUploadModal").style.display = "flex";
}

function closeAudioUploadModal() {
  document.getElementById("audioUploadModal").style.display = "none";
  currentAudioUpload = null;
  document.getElementById("audioFileInput").value = '';
  document.getElementById("uploadArea").style.display = "block";
  document.getElementById("uploadProgress").style.display = "none";
  document.getElementById("confirmUploadBtn").disabled = true;
}

async function uploadAudioFile() {
  if (!currentAudioUpload) return;
  
  const fileInput = document.getElementById("audioFileInput");
  const file = fileInput.files[0];
  
  if (!file) {
    alert("Please select an audio file");
    return;
  }
  
  const uploadBtn = document.getElementById("confirmUploadBtn");
  const uploadText = document.getElementById("uploadText");
  const uploadLoader = document.getElementById("uploadLoader");
  
  // Disable button and show loader
  uploadBtn.disabled = true;
  uploadText.textContent = "Uploading...";
  uploadLoader.style.display = "inline-block";
  
  // Show progress
  document.getElementById("uploadArea").style.display = "none";
  document.getElementById("uploadProgress").style.display = "block";
  
  try {
    console.log("🎵 Uploading audio file...");
    
    // Create storage reference
    const fileName = `part${currentAudioUpload.sectionIndex + 1}.mp3`;
    const storageRef = ref(storage, `listening-audio/${testId}/${fileName}`);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file);
    console.log("✅ File uploaded successfully");
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log("✅ Download URL obtained:", downloadURL);
    
    // Update section with audio URL
    updateSection(currentAudioUpload.sectionIndex, 'audioUrl', downloadURL);
    
    // Close modal and refresh display
    closeAudioUploadModal();
    displaySections();
    
    // Show success message
    showNotification("✅ Audio file uploaded successfully!", "success");
    
  } catch (error) {
    console.error("❌ Error uploading audio:", error);
    alert(`❌ Error uploading audio: ${error.message}`);
  } finally {
    // Reset button
    uploadBtn.disabled = false;
    uploadText.textContent = "Upload";
    uploadLoader.style.display = "none";
  }
}

function removeAudio(sectionIndex) {
  if (confirm("Are you sure you want to remove this audio file?")) {
    updateSection(sectionIndex, 'audioUrl', '');
    displaySections();
    showNotification("✅ Audio file removed", "success");
  }
}

// Add new section
function addSection() {
  // Ensure parts structure exists
  if (!currentTest.parts) {
    currentTest.parts = {
      testId: testId,
      title: `IELTS Listening Test ${testId.replace("test-", "")}`,
      sections: []
    };
  }
  
  if (!currentTest.parts.sections) {
    currentTest.parts.sections = [];
  }
  
  const newSection = {
    sectionNumber: currentTest.parts.sections.length + 1,
    title: 'New Section',
    audioUrl: '',
    content: [],
    instructions: {
      heading: '',
      details: '',
      note: ''
    }
  };
  
  currentTest.parts.sections.push(newSection);
  displaySections(); // Refresh to show new section
}

// Add new content item
function addContentItem(sectionIndex) {
  if (!currentTest.parts.sections[sectionIndex].content) {
    currentTest.parts.sections[sectionIndex].content = [];
  }
  
  const newContentItem = {
    type: 'text',
    value: ''
  };
  
  currentTest.parts.sections[sectionIndex].content.push(newContentItem);
  displaySections(); // Refresh to show new content item
}

// Delete functions
function confirmDelete(type, sectionIndex, contentIndex = null) {
  itemToDelete = { type, sectionIndex, contentIndex };
  
  let message = '';
  if (type === 'section') {
    message = `section ${sectionIndex + 1}`;
  } else if (type === 'content') {
    message = `content item ${contentIndex + 1} in section ${sectionIndex + 1}`;
  }
  
  document.getElementById("deleteModal").style.display = "flex";
}

function closeDeleteModal() {
  document.getElementById("deleteModal").style.display = "none";
  itemToDelete = null;
}

function deleteItem() {
  if (!itemToDelete) return;

  const { type, sectionIndex, contentIndex } = itemToDelete;
  
  if (type === 'section') {
    currentTest.parts.sections.splice(sectionIndex, 1);
  } else if (type === 'content') {
    currentTest.parts.sections[sectionIndex].content.splice(contentIndex, 1);
  }
  
  closeDeleteModal();
  displaySections(); // Refresh to show changes
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
    console.log("💾 Saving listening test to Firebase...");
    
    // Update in Firebase
    const testDocRef = doc(db, "listeningTests", testId);
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
  window.location.href = '../index.html';
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
window.updateSection = updateSection;
window.updateSectionInstructions = updateSectionInstructions;
window.updateContentItem = updateContentItem;
window.updateOption = updateOption;
window.updateQuestionInGroup = updateQuestionInGroup;
window.addOption = addOption;
window.removeOption = removeOption;
window.addQuestionToGroup = addQuestionToGroup;
window.openAudioUpload = openAudioUpload;
window.closeAudioUploadModal = closeAudioUploadModal;
window.uploadAudioFile = uploadAudioFile;
window.removeAudio = removeAudio;
window.addSection = addSection;
window.addContentItem = addContentItem;
window.confirmDelete = confirmDelete;
window.closeDeleteModal = closeDeleteModal;
window.deleteItem = deleteItem;
window.saveTest = saveTest;
window.closeSaveModal = closeSaveModal;
window.confirmSave = confirmSave;
window.goBack = goBack;

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎧 Edit Listening Test page loaded");

  // Check admin access
  await checkAdminAccess();

  // Get test ID from URL
  testId = getTestIdFromUrl();
  if (!testId) {
    alert("❌ No test ID provided in URL");
    window.location.href = '../test-listening-edit-select.html';
    return;
  }

  // Load test
  await loadTest();

  // Connect modal buttons
  document.getElementById("confirmSaveBtn").addEventListener("click", confirmSave);
  document.getElementById("confirmDeleteBtn").addEventListener("click", deleteItem);
  document.getElementById("confirmUploadBtn").addEventListener("click", uploadAudioFile);

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

  document.getElementById("audioUploadModal").addEventListener("click", (e) => {
    if (e.target.id === "audioUploadModal") {
      closeAudioUploadModal();
    }
  });

  // File input handling
  const fileInput = document.getElementById("audioFileInput");
  const uploadArea = document.getElementById("uploadArea");
  const confirmBtn = document.getElementById("confirmUploadBtn");

  // Click to browse
  uploadArea.addEventListener("click", () => {
    fileInput.click();
  });

  // File selected
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      confirmBtn.disabled = false;
    }
  });

  // Drag and drop
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      confirmBtn.disabled = false;
    }
  });

  console.log("✅ Page initialized successfully");
});
