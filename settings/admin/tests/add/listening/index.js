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
  getDocs,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let nextTestNumber = 1;
let sectionCount = 0;
let questionIdCounter = 0;
let singleAudioFile = null;
let audioUploadType = 'single';

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

// Get the next test number
async function getNextTestNumber() {
  try {
    const testsRef = collection(db, "listeningTests");
    const testsSnapshot = await getDocs(testsRef);

    let maxNumber = 0;
    testsSnapshot.forEach((docSnapshot) => {
      const docId = docSnapshot.id;
      if (docId && docId.startsWith("test-")) {
        const number = parseInt(docId.replace("test-", ""));
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    nextTestNumber = maxNumber + 1;
    document.getElementById(
      "testNumber"
    ).textContent = `This will be Listening Test ${nextTestNumber}`;
    console.log("📊 Next test number will be:", nextTestNumber);

    return nextTestNumber;
  } catch (error) {
    console.error("Error getting next test number:", error);
    return 1;
  }
}

// Upload audio file to Firebase Storage
async function uploadAudioFile(file, testNumber, sectionNumber) {
  try {
    const fileName = `part${sectionNumber}.mp3`;
    const storagePath = `listening-audio/test-${testNumber}/${fileName}`;
    const storageRef = ref(storage, storagePath);
    
    console.log(`🎵 Uploading audio file: ${storagePath}`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`✅ Audio uploaded successfully: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error("❌ Error uploading audio file:", error);
    throw error;
  }
}

// Add a new section
function addSection() {
  if (sectionCount >= 4) {
    alert("Maximum 4 sections allowed per listening test");
    return;
  }

  sectionCount++;
  const sectionNumber = sectionCount;

  const sectionHTML = `
    <div class="section-container" data-section="${sectionNumber}">
      <div class="section-header">
        <div class="section-title">
          <span class="section-number">${sectionNumber}</span>
          Section ${sectionNumber}
        </div>
        ${
          sectionCount > 1
            ? `<button type="button" class="remove-section-btn" onclick="removeSection(${sectionNumber})">Remove Section</button>`
            : ""
        }
      </div>
      
      <div class="form-group">
        <label>Section Title</label>
        <input type="text" class="section-title-input" placeholder="e.g., Transport survey">
      </div>
      
      <div class="audio-upload" id="audioUpload${sectionNumber}" style="display: ${audioUploadType === 'separate' ? 'block' : 'none'};">
        <input type="file" id="audioFile${sectionNumber}" accept="audio/*" onchange="handleAudioUpload(${sectionNumber})">
        <label for="audioFile${sectionNumber}" class="audio-upload-label">
          <svg class="audio-upload-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          <div class="audio-upload-text">Upload Audio File</div>
          <div class="audio-upload-hint">Click to select or drag and drop audio file (MP3, WAV, etc.)</div>
        </label>
      </div>
      
      <div class="audio-preview" id="audioPreview${sectionNumber}">
        <div class="audio-preview-info">
          <span class="audio-preview-name" id="audioPreviewName${sectionNumber}"></span>
          <span class="audio-preview-size" id="audioPreviewSize${sectionNumber}"></span>
        </div>
        <div class="audio-preview-controls">
          <button type="button" onclick="playAudio(${sectionNumber})">▶ Play</button>
          <button type="button" onclick="pauseAudio(${sectionNumber})">⏸ Pause</button>
          <button type="button" onclick="removeAudio(${sectionNumber})" class="remove-audio">🗑 Remove</button>
        </div>
        <audio id="audioPlayer${sectionNumber}" style="display: none;"></audio>
      </div>
      
      <div class="instructions-section">
        <h4>Section Instructions *</h4>
        <div class="instructions-row">
          <div class="form-group">
            <label>Heading *</label>
            <input type="text" class="instructions-heading" placeholder="e.g., Questions 1-10">
          </div>
          <div class="form-group">
            <label>Details *</label>
            <input type="text" class="instructions-details" placeholder="e.g., Complete the notes below.">
          </div>
          <div class="form-group">
            <label>Note *</label>
            <input type="text" class="instructions-note" placeholder="e.g., Write ONE WORD AND/OR A NUMBER for each answer.">
          </div>
        </div>
      </div>
      
      <div class="questions-section">
        <div class="questions-header">
          <span class="questions-title">Questions</span>
        </div>
        <div class="questions-container" id="questions${sectionNumber}">
          <!-- Questions will be added here -->
        </div>
        <div class="add-question-dropdown" style="margin-top: 10px;">
          <button type="button" class="add-question-btn" onclick="toggleQuestionMenu(${sectionNumber})">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Add Question
          </button>
          <div class="question-types-menu" id="questionMenu${sectionNumber}">
            <div class="question-type-option" onclick="addQuestion(${sectionNumber}, 'text')">
              <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              Text Only
            </div>
            <div class="question-type-option" onclick="addQuestion(${sectionNumber}, 'subheading')">
              <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12h18M3 6h18M3 18h12"></path>
              </svg>
              Subheading
            </div>
            <div class="question-type-option" onclick="addQuestion(${sectionNumber}, 'gap-fill')">
              <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
              Gap Fill
            </div>
            <div class="question-type-option" onclick="addQuestion(${sectionNumber}, 'multiple-choice')">
              <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
              </svg>
              Multiple Choice
            </div>
            <div class="question-type-option" onclick="addQuestion(${sectionNumber}, 'table')">
              <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="15" x2="21" y2="15"></line>
                <line x1="9" y1="3" x2="9" y2="21"></line>
                <line x1="21" y1="3" x2="21" y2="21"></line>
              </svg>
              Table Completion
            </div>
            <div class="question-type-option" onclick="addQuestion(${sectionNumber}, 'question-group')">
              <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="7.5,4.21 12,6.81 16.5,4.21"></polyline>
                <polyline points="7.5,19.79 7.5,14.6 3,12"></polyline>
                <polyline points="21,12 16.5,14.6 16.5,19.79"></polyline>
              </svg>
              Question Group
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document
    .getElementById("sectionsContainer")
    .insertAdjacentHTML("beforeend", sectionHTML);
  updateSectionCount();
  updateAddSectionButton();
  
  // Debug: Check if the Add Question button was created
  const addQuestionBtn = document.querySelector(`button[onclick="toggleQuestionMenu(${sectionNumber})"]`);
  if (addQuestionBtn) {
    console.log(`✅ Add Question button created for section ${sectionNumber}:`, addQuestionBtn);
  } else {
    console.error(`❌ Add Question button NOT found for section ${sectionNumber}`);
  }
  
  // Setup drag and drop for audio upload
  setupDragAndDrop(sectionNumber);
  
  // Ensure audio upload visibility matches current audio upload type
  const audioUpload = document.getElementById(`audioUpload${sectionNumber}`);
  if (audioUpload) {
    audioUpload.style.display = audioUploadType === 'separate' ? 'block' : 'none';
  }
}

// Setup drag and drop for audio upload
function setupDragAndDrop(sectionNumber) {
  const uploadArea = document.getElementById(`audioUpload${sectionNumber}`);
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('audio/')) {
      document.getElementById(`audioFile${sectionNumber}`).files = files;
      handleAudioUpload(sectionNumber);
    } else {
      alert('Please drop an audio file');
    }
  });
}

window.handleCancel = function(event) {
  if (event) event.preventDefault();
  const message = "All unsaved progress will be lost. Are you sure you want to cancel?";
  if (confirm(message)) {
    window.location.href = "../index.html";
  }
};

// Handle audio file upload
window.handleAudioUpload = function(sectionNumber) {
  const fileInput = document.getElementById(`audioFile${sectionNumber}`);
  const file = fileInput.files[0];
  
  if (!file) return;
  
  if (!file.type.startsWith('audio/')) {
    alert('Please select an audio file');
    fileInput.value = '';
    return;
  }
  
  // Show preview
  const preview = document.getElementById(`audioPreview${sectionNumber}`);
  const name = document.getElementById(`audioPreviewName${sectionNumber}`);
  const size = document.getElementById(`audioPreviewSize${sectionNumber}`);
  const audioPlayer = document.getElementById(`audioPlayer${sectionNumber}`);
  
  name.textContent = file.name;
  size.textContent = formatFileSize(file.size);
  
  // Create object URL for preview
  const audioURL = URL.createObjectURL(file);
  audioPlayer.src = audioURL;
  audioPlayer.dataset.fileName = file.name;
  
  preview.classList.add('show');
  
  console.log(`🎵 Audio file selected for section ${sectionNumber}:`, file.name);
};

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Play audio
window.playAudio = function(sectionNumber) {
  const audioPlayer = document.getElementById(`audioPlayer${sectionNumber}`);
  audioPlayer.play();
};

// Pause audio
window.pauseAudio = function(sectionNumber) {
  const audioPlayer = document.getElementById(`audioPlayer${sectionNumber}`);
  audioPlayer.pause();
};

// Remove audio
window.removeAudio = function(sectionNumber) {
  if (confirm('Are you sure you want to remove this audio file?')) {
    const fileInput = document.getElementById(`audioFile${sectionNumber}`);
    const preview = document.getElementById(`audioPreview${sectionNumber}`);
    const audioPlayer = document.getElementById(`audioPlayer${sectionNumber}`);
    
    fileInput.value = '';
    preview.classList.remove('show');
    audioPlayer.src = '';
    audioPlayer.dataset.fileName = '';
    
    console.log(`🗑 Audio file removed for section ${sectionNumber}`);
  }
};

// Toggle question type menu
window.toggleQuestionMenu = function (sectionNumber) {
  const menu = document.getElementById(`questionMenu${sectionNumber}`);
  console.log(`🎯 Toggling question menu for section ${sectionNumber}`, menu);
  
  if (!menu) {
    console.error(`❌ Menu not found for section ${sectionNumber}`);
    return;
  }
  
  menu.classList.toggle("show");
  console.log(`✅ Menu toggled. Classes:`, menu.className);

  document.addEventListener("click", function closeMenu(e) {
    if (!e.target.closest(".add-question-dropdown")) {
      menu.classList.remove("show");
      document.removeEventListener("click", closeMenu);
    }
  });
};

// Add a question to a section
window.addQuestion = function (sectionNumber, type) {
  const container = document.getElementById(`questions${sectionNumber}`);
  const questionId = ++questionIdCounter;

  let questionHTML = "";

  switch (type) {
    case "text":
      questionHTML = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-type-badge text">Text</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <textarea placeholder="Text content" class="question-value" rows="3"></textarea>
        </div>
      `;
      break;

    case "subheading":
      questionHTML = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-type-badge subheading">Subheading</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Subheading text" class="question-value">
        </div>
      `;
      break;

    case "gap-fill":
      questionHTML = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
            <span class="question-type-badge gap-fill">Gap Fill</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (optional, use \n for paragraphs)" class="group-instruction">
          <input type="text" placeholder="Question text (use _____ for gaps)" class="question-text">
          <input type="text" placeholder="Postfix (optional)" class="question-postfix">
          <input type="text" placeholder="Correct answer" class="question-answer">
          <input type="number" placeholder="Word limit (optional)" class="question-word-limit" min="1" max="10">
        </div>
      `;
      break;

    case "multiple-choice":
      questionHTML = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
            <span class="question-type-badge multiple-choice">Multiple Choice</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (optional, use \n for paragraphs)" class="group-instruction">
          <input type="text" placeholder="Question text" class="question-text">
          <div class="question-options">
            <label>Options:</label>
            <div class="mc-options-list">
              <div class="mc-option-item">
                <input type="radio" name="mc-${questionId}" value="A" class="mc-radio">
                <input type="text" placeholder="Option A" class="option-text">
              </div>
              <div class="mc-option-item">
                <input type="radio" name="mc-${questionId}" value="B" class="mc-radio">
                <input type="text" placeholder="Option B" class="option-text">
              </div>
              <div class="mc-option-item">
                <input type="radio" name="mc-${questionId}" value="C" class="mc-radio">
                <input type="text" placeholder="Option C" class="option-text">
              </div>
            </div>
            <button type="button" onclick="addMCOptionToQuestion(${questionId})" style="margin-top: 5px; padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">+ Add Option</button>
          </div>
        </div>
      `;
      break;


    case "table":
      questionHTML = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
            <span class="question-type-badge table">Table</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Table title (optional)" class="table-title">
          <input type="text" placeholder="Group instruction (optional, use \n for paragraphs)" class="group-instruction">
          
          <div class="table-builder">
            <div class="table-controls">
              <div class="control-group">
                <button type="button" onclick="addTableColumn(${questionId})" class="control-btn add-column-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add Column →
                </button>
                <button type="button" onclick="addTableRow(${questionId})" class="control-btn add-row-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add Row ↓
                </button>
                <button type="button" onclick="recalculateTableQuestionNumbers('${questionId}')" class="control-btn recalculate-btn" style="background: #2196F3;" title="Recalculate all question numbers in this table">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Renumber Questions
                </button>
              </div>
            </div>
            
            <div class="table-container">
              <table class="question-table" id="question-table-${questionId}">
                <thead>
                  <tr id="header-row-${questionId}">
                    <th class="header-cell">
                      <input type="text" value="Field" class="header-input" placeholder="Column header">
                      <button type="button" onclick="removeTableColumn(${questionId}, 0)" class="remove-cell-btn">×</button>
                    </th>
                    <th class="header-cell">
                      <input type="text" value="Information" class="header-input" placeholder="Column header">
                      <button type="button" onclick="removeTableColumn(${questionId}, 1)" class="remove-cell-btn">×</button>
                    </th>
                  </tr>
                </thead>
                <tbody id="table-body-${questionId}">
                  <tr class="data-row">
                    <td class="data-cell">
                      <select class="cell-type" onchange="updateCellType(this, ${questionId}, 0, 0)">
                        <option value="text" selected>Text</option>
                        <option value="question">Question (1_____)</option>
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="example">Example</option>
                      </select>
                      <div class="cell-content">
                        <input type="text" class="cell-input" placeholder="Cell content">
                      </div>
                      <button type="button" class="add-question-in-cell-btn" onclick="addQuestionToCell(this, ${questionId}, 0, 0)" title="Add another question" style="display: none;">+</button>
                    </td>
                    <td class="data-cell">
                      <select class="cell-type" onchange="updateCellType(this, ${questionId}, 0, 1)">
                        <option value="text">Text</option>
                        <option value="question" selected>Question (1_____)</option>
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="example">Example</option>
                      </select>
                      <div class="cell-content">
                        <input type="text" class="cell-input" placeholder="Cell content (e.g., 1_____)" data-question-number="1">
                      </div>
                      <button type="button" class="add-question-in-cell-btn" onclick="addQuestionToCell(this, ${questionId}, 0, 1)" title="Add another question">+</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="table-answers">
              <label>Answers (format: q1=answer1, q2=answer2):</label>
              <textarea placeholder="q1=theatre, q2=4.30, q3=station..." class="table-answers-text" rows="3"></textarea>
            </div>
          </div>
        </div>
      `;
      break;

    case "question-group":
      questionHTML = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
            <span class="question-type-badge question-group">Question Group</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (e.g., Questions 11-15 Choose TWO letters, A-E. Use \n for paragraphs)" class="group-instruction">
          <select class="group-type" onchange="handleGroupTypeChange(${questionId})">
            <option value="multi-select">Multi Select</option>
            <option value="matching">Matching</option>
          </select>
          
          <!-- Multi-select: Question text section (visible only for multi-select) -->
          <div class="multi-select-question" id="multi-select-question-${questionId}">
            <input type="text" placeholder="Question text (e.g., Which THREE features does the speaker mention?)" class="question-text">
          </div>
          
          <!-- Options section (visible for both types) -->
          <div class="group-options">
            <label>Options:</label>
            <div class="options-list" id="options-list-${questionId}">
              <div class="option-item">
                <input type="text" value="A" class="option-label">
                <input type="text" placeholder="Option A text" class="option-text">
                <button type="button" onclick="removeOption(this)" class="remove-option-btn">×</button>
              </div>
              <div class="option-item">
                <input type="text" value="B" class="option-label">
                <input type="text" placeholder="Option B text" class="option-text">
                <button type="button" onclick="removeOption(this)" class="remove-option-btn">×</button>
              </div>
            </div>
            <button type="button" onclick="addOption(${questionId})" class="add-option-btn">+ Add Option</button>
          </div>
          
          <!-- Matching: Individual Questions with text (visible only for matching) -->
          <div class="group-questions matching-questions" id="matching-questions-${questionId}" style="display: none;">
            <label>Individual Questions:</label>
            <div class="questions-list" id="group-questions-list-${questionId}">
              <div class="group-question-item">
                <input type="text" placeholder="Question/Statement text" class="group-question-text">
                <input type="text" placeholder="Correct answer (A, B, C, etc.)" class="group-question-answer">
                <button type="button" onclick="removeGroupQuestion(this)" class="remove-group-question-btn">×</button>
              </div>
            </div>
            <button type="button" onclick="addGroupQuestion(${questionId})" class="add-group-question-btn">+ Add Question</button>
          </div>
          
          <!-- Multi-select: Group Answer section (visible only for multi-select) -->
          <div class="group-answer-section multi-select-answers" id="multi-select-answers-${questionId}">
            <label>Correct Answers (comma-separated):</label>
            <input type="text" placeholder="Enter correct answers separated by commas (e.g., A,B,C)" class="group-correct-answers">
            <p class="helper-text">For multi-select, enter the correct option letters separated by commas</p>
          </div>
        </div>
      `;
      break;

  }

  container.insertAdjacentHTML("beforeend", questionHTML);

  // Add event listeners for new question types
  if (type === "question") {
    const formatSelect = container.querySelector(`[data-question-id="${questionId}"] .question-format`);
    const optionsDiv = container.querySelector(`[data-question-id="${questionId}"] .question-options`);
    
    formatSelect.addEventListener('change', function() {
      if (this.value === 'multiple-choice') {
        optionsDiv.style.display = 'block';
      } else {
        optionsDiv.style.display = 'none';
      }
    });
  }
  
  // Add event listeners for table questions to auto-update question numbers
  if (type === "table") {
    const table = document.getElementById(`question-table-${questionId}`);
    if (table) {
      // Add event listeners to all cell inputs
      const cellInputs = table.querySelectorAll('.cell-input');
      cellInputs.forEach(input => {
        input.addEventListener('input', function() {
          updateQuestionNumbersInTable(questionId);
        });
      });
    }
  }

  document
    .getElementById(`questionMenu${sectionNumber}`)
    .classList.remove("show");
  updateQuestionNumbers(sectionNumber);
};

// Table functions
window.addTableColumn = function(questionId) {
  const table = document.getElementById(`question-table-${questionId}`);
  const headerRow = document.getElementById(`header-row-${questionId}`);
  const tbody = document.getElementById(`table-body-${questionId}`);
  const columnIndex = headerRow.children.length;
  
  // Add header cell
  const headerCell = document.createElement('th');
  headerCell.className = 'header-cell';
  headerCell.innerHTML = `
    <input type="text" value="Column ${columnIndex + 1}" class="header-input" placeholder="Column header">
    <button type="button" onclick="removeTableColumn(${questionId}, ${columnIndex})" class="remove-cell-btn">×</button>
  `;
  headerRow.appendChild(headerCell);
  
  // Add cells to all data rows
  const dataRows = tbody.querySelectorAll('.data-row');
  dataRows.forEach((row, rowIndex) => {
    const cell = document.createElement('td');
    cell.className = 'data-cell';
    const questionNumber = getNextQuestionNumber(questionId);
    
    // New columns are typically questions (not text)
    cell.innerHTML = `
      <select class="cell-type" onchange="updateCellType(this, ${questionId}, ${rowIndex}, ${columnIndex})">
        <option value="text">Text</option>
        <option value="question" selected>Question (${questionNumber}_____)</option>
        <option value="multiple-choice">Multiple Choice</option>
        <option value="example">Example</option>
      </select>
      <div class="cell-content">
        <input type="text" class="cell-input" placeholder="Cell content (e.g., ${questionNumber}_____)" data-question-number="${questionNumber}">
      </div>
      <button type="button" class="add-question-in-cell-btn" onclick="addQuestionToCell(this, ${questionId}, ${rowIndex}, ${columnIndex})" title="Add another question">+</button>
    `;
    row.appendChild(cell);
    
    // Add event listeners to new inputs
    const newInputs = cell.querySelectorAll('.cell-input');
    newInputs.forEach(input => {
      input.addEventListener('input', function() {
        updateQuestionNumbersInTable(questionId);
      });
    });
  });
  
  console.log(`✅ Added column to table ${questionId}`);
};

window.addTableRow = function(questionId) {
  const tbody = document.getElementById(`table-body-${questionId}`);
  const headerRow = document.getElementById(`header-row-${questionId}`);
  const columnCount = headerRow.children.length;
  
  const row = document.createElement('tr');
  row.className = 'data-row';
  const rowIndex = tbody.children.length;
  
  for (let i = 0; i < columnCount; i++) {
    const cell = document.createElement('td');
    cell.className = 'data-cell';
    const questionNumber = getNextQuestionNumber(questionId);
    
    // First column is typically text (like "Name of restaurant"), others are questions
    const isFirstColumn = i === 0;
    const defaultType = isFirstColumn ? 'text' : 'question';
    const showAddButton = !isFirstColumn;
    
    cell.innerHTML = `
      <select class="cell-type" onchange="updateCellType(this, ${questionId}, ${rowIndex}, ${i})">
        <option value="text" ${defaultType === 'text' ? 'selected' : ''}>Text</option>
        <option value="question" ${defaultType === 'question' ? 'selected' : ''}>Question (${questionNumber}_____)</option>
        <option value="multiple-choice">Multiple Choice</option>
        <option value="example">Example</option>
      </select>
      <div class="cell-content">
        ${defaultType === 'text' 
          ? `<input type="text" class="cell-input" placeholder="Cell content">` 
          : `<input type="text" class="cell-input" placeholder="Cell content (e.g., ${questionNumber}_____)" data-question-number="${questionNumber}">`
        }
      </div>
      <button type="button" class="add-question-in-cell-btn" onclick="addQuestionToCell(this, ${questionId}, ${rowIndex}, ${i})" title="Add another question" style="display: ${showAddButton ? 'inline-block' : 'none'};">+</button>
    `;
    row.appendChild(cell);
    
    // Add event listeners to new inputs
    const newInputs = cell.querySelectorAll('.cell-input');
    newInputs.forEach(input => {
      input.addEventListener('input', function() {
        updateQuestionNumbersInTable(questionId);
      });
    });
  }
  
  tbody.appendChild(row);
  console.log(`✅ Added row to table ${questionId}`);
};

window.removeTableColumn = function(questionId, columnIndex) {
  const table = document.getElementById(`question-table-${questionId}`);
  const headerRow = document.getElementById(`header-row-${questionId}`);
  const tbody = document.getElementById(`table-body-${questionId}`);
  
  if (headerRow.children.length <= 1) {
    alert("Table must have at least one column");
    return;
  }
  
  if (confirm("Remove this column?")) {
    // Remove header cell
    headerRow.children[columnIndex].remove();
    
    // Remove cells from all data rows
    const dataRows = tbody.querySelectorAll('.data-row');
    dataRows.forEach(row => {
      if (row.children[columnIndex]) {
        row.children[columnIndex].remove();
      }
    });
    
    console.log(`✅ Removed column ${columnIndex} from table ${questionId}`);
  }
};

window.removeTableRow = function(button) {
  const tbody = button.closest('tbody');
  const rows = tbody.querySelectorAll('.data-row');
  
  if (rows.length <= 1) {
    alert("Table must have at least one row");
    return;
  }
  
  if (confirm("Remove this row?")) {
    button.closest('.data-row').remove();
    console.log(`✅ Removed row from table`);
  }
};

// Helper function to get next question number based on ALL questions in ALL sections
function getNextQuestionNumber(questionId) {
  let maxNumber = 0;
  
  // Get all sections
  const allSections = document.querySelectorAll('.section-container');
  
  allSections.forEach(section => {
    // Check regular questions (gap-fill, multiple-choice, etc.)
    const regularQuestions = section.querySelectorAll('.question-item[data-type="gap-fill"], .question-item[data-type="multiple-choice"]');
    maxNumber += regularQuestions.length;
    
    // Check table questions
    const tableQuestions = section.querySelectorAll('.question-item[data-type="table"]');
    tableQuestions.forEach(tableQ => {
      const tableId = tableQ.getAttribute('data-question-id');
      const table = document.getElementById(`question-table-${tableId}`);
      
      if (table) {
        // Count all question inputs in this table
        const cellInputs = table.querySelectorAll('.cell-input[data-question-number]');
        cellInputs.forEach(input => {
          const number = parseInt(input.getAttribute('data-question-number'));
          if (number > maxNumber) maxNumber = number;
        });
        
        // Also check content patterns
        const allInputs = table.querySelectorAll('.cell-input');
        allInputs.forEach(input => {
          const content = input.value.trim();
          const match = content.match(/(\d+)_____/g);
          if (match) {
            match.forEach(m => {
              const number = parseInt(m.match(/(\d+)/)[1]);
              if (number > maxNumber) maxNumber = number;
            });
          }
        });
      }
    });
    
    // Check question group questions
  const questionGroups = section.querySelectorAll('.question-item[data-type="question-group"]');
  questionGroups.forEach(qg => {
    const groupType = qg.querySelector('.group-type')?.value || 'multi-select';
    if (groupType === 'matching') {
      const individualQuestions = qg.querySelectorAll('.group-question-item, .matching-question');
      maxNumber += individualQuestions.length;
    } else {
      const answersInput = qg.querySelector('.group-correct-answers');
      const answersCount = answersInput
        ? answersInput.value
            .split(',')
            .map(answer => answer.trim())
            .filter(answer => answer).length
        : 0;
      maxNumber += answersCount > 0 ? answersCount : 1;
    }
  });
  });
  
  return maxNumber + 1;
}

// Update question numbers in table based on content patterns and reassign if needed
function updateQuestionNumbersInTable(questionId) {
  const table = document.getElementById(`question-table-${questionId}`);
  if (!table) return;
  
  const cellInputs = table.querySelectorAll('.cell-input[data-question-number]');
  const questionNumbers = new Set();
  
  // First pass: collect all question numbers from content patterns (like "1_____")
  cellInputs.forEach(input => {
    const content = input.value.trim();
    // Match patterns like "1_____", "2_____", etc.
    const matches = content.match(/(\d+)_____/g);
    if (matches) {
      matches.forEach(match => {
        const number = parseInt(match.match(/(\d+)/)[1]);
        questionNumbers.add(number);
        // Update data-question-number to match the content
        input.setAttribute('data-question-number', number);
      });
    }
  });
  
  // Second pass: for cells without explicit patterns, keep their assigned numbers
  cellInputs.forEach(input => {
    const existingNumber = input.getAttribute('data-question-number');
    if (existingNumber) {
      questionNumbers.add(parseInt(existingNumber));
    }
  });
  
  console.log(`📊 Updated question numbers for table ${questionId}:`, Array.from(questionNumbers).sort((a, b) => a - b));
}

// Recalculate and reassign all question numbers in a table to be sequential
window.recalculateTableQuestionNumbers = function(questionId) {
  const table = document.getElementById(`question-table-${questionId}`);
  if (!table) return;
  
  // Get the starting question number (based on all previous questions in the test)
  let currentQuestionNumber = 1;
  
  // Count all questions before this table
  const allSections = document.querySelectorAll('.section-container');
  allSections.forEach(section => {
    const questionItems = section.querySelectorAll('.question-item');
    questionItems.forEach(item => {
      const itemId = item.getAttribute('data-question-id');
      
      // Stop if we reached the current table
      if (itemId === questionId) {
        return;
      }
      
      const type = item.getAttribute('data-type');
      if (type === 'gap-fill' || type === 'multiple-choice') {
        currentQuestionNumber++;
      } else if (type === 'table' && itemId !== questionId) {
        // Count questions in previous tables
        const prevTable = document.getElementById(`question-table-${itemId}`);
        if (prevTable) {
          const prevInputs = prevTable.querySelectorAll('.cell-input[data-question-number]');
          const prevCellTypes = prevTable.querySelectorAll('.cell-type');
          let questionCells = 0;
          prevCellTypes.forEach(typeSelect => {
            if (typeSelect.value === 'question' || typeSelect.value === 'multiple-choice') {
              questionCells++;
            }
          });
          currentQuestionNumber += questionCells;
        }
      } else if (type === 'question-group') {
        const groupType = item.querySelector('.group-type')?.value || 'multi-select';
        if (groupType === 'matching') {
          const groupQuestions = item.querySelectorAll('.group-question-item, .matching-question');
          currentQuestionNumber += groupQuestions.length;
        } else {
          const answersInput = item.querySelector('.group-correct-answers');
          const answersCount = answersInput
            ? answersInput.value
                .split(',')
                .map(answer => answer.trim())
                .filter(answer => answer).length
            : 0;
          currentQuestionNumber += answersCount > 0 ? answersCount : 1;
        }
      }
    });
  });
  
  // Now reassign numbers to all question cells in this table
  const tbody = document.getElementById(`table-body-${questionId}`);
  if (!tbody) return;
  
  const dataRows = tbody.querySelectorAll('.data-row');
  dataRows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('.data-cell');
    cells.forEach((cell, cellIndex) => {
      const cellType = cell.querySelector('.cell-type').value;
      
      if (cellType === 'question' || cellType === 'multiple-choice') {
        const cellInputs = cell.querySelectorAll('.cell-input[data-question-number]');
        cellInputs.forEach(input => {
          input.setAttribute('data-question-number', currentQuestionNumber);
          
          // Update the visual representation in the select dropdown
          const cellTypeSelect = cell.querySelector('.cell-type');
          const selectedOption = cellTypeSelect.querySelector(`option[value="${cellType}"]`);
          if (selectedOption && cellType === 'question') {
            selectedOption.textContent = `Question (${currentQuestionNumber}_____)`;
          }
          
          currentQuestionNumber++;
        });
      }
    });
  });
  
  console.log(`✅ Recalculated table ${questionId} question numbers. Next number: ${currentQuestionNumber}`);
  alert(`✅ Question numbers recalculated! Questions now numbered from their correct starting position.`);
};

// Update cell type and regenerate content
window.updateCellType = function(select, questionId, rowIndex, colIndex) {
  const cell = select.closest('.data-cell');
  const cellContent = cell.querySelector('.cell-content');
  const addButton = cell.querySelector('.add-question-in-cell-btn');
  const cellType = select.value;
  
  // Get question number or assign new one
  let questionNumber = getNextQuestionNumber(questionId);
  const existingInput = cell.querySelector('.cell-input[data-question-number]');
  if (existingInput && existingInput.getAttribute('data-question-number')) {
    questionNumber = existingInput.getAttribute('data-question-number');
  }
  
  let contentHTML = '';
  
  switch(cellType) {
    case 'text':
      contentHTML = `<input type="text" class="cell-input" placeholder="Cell content">`;
      // Hide the + button for text cells
      if (addButton) addButton.style.display = 'none';
      break;
    case 'question':
      contentHTML = `<input type="text" class="cell-input" placeholder="Cell content (e.g., ${questionNumber}_____)" data-question-number="${questionNumber}">`;
      // Show the + button for question cells
      if (addButton) addButton.style.display = 'inline-block';
      break;
    case 'multiple-choice':
      contentHTML = `
        <div class="mc-cell-content">
          <input type="text" class="cell-input" placeholder="Question text" data-question-number="${questionNumber}">
          <div class="mc-options">
            <div class="mc-option">
              <input type="radio" name="mc_${questionId}_${rowIndex}_${colIndex}" value="A" class="mc-radio">
              <input type="text" placeholder="Option A" class="mc-option-text">
            </div>
            <div class="mc-option">
              <input type="radio" name="mc_${questionId}_${rowIndex}_${colIndex}" value="B" class="mc-radio">
              <input type="text" placeholder="Option B" class="mc-option-text">
            </div>
            <div class="mc-option">
              <input type="radio" name="mc_${questionId}_${rowIndex}_${colIndex}" value="C" class="mc-radio">
              <input type="text" placeholder="Option C" class="mc-option-text">
            </div>
          </div>
        </div>
      `;
      // Show the + button for MC cells
      if (addButton) addButton.style.display = 'inline-block';
      break;
    case 'example':
      contentHTML = `<input type="text" class="cell-input" placeholder="Example: Good food" data-example="true">`;
      // Hide the + button for example cells
      if (addButton) addButton.style.display = 'none';
      break;
  }
  
  cellContent.innerHTML = contentHTML;
  
  // Add event listeners to new inputs
  const newInputs = cellContent.querySelectorAll('.cell-input');
  newInputs.forEach(input => {
    input.addEventListener('input', function() {
      updateQuestionNumbersInTable(questionId);
    });
  });
  
  console.log(`✅ Updated cell type to ${cellType} for table ${questionId}, row ${rowIndex}, col ${colIndex}`);
};

// Add another question to the same cell
window.addQuestionToCell = function(button, questionId, rowIndex, colIndex) {
  const cell = button.closest('.data-cell');
  const cellContent = cell.querySelector('.cell-content');
  const cellType = cell.querySelector('.cell-type').value;
  const nextQuestionNumber = getNextQuestionNumber(questionId);
  
  // Don't allow adding questions to non-question cell types
  if (cellType !== 'question' && cellType !== 'multiple-choice') {
    alert('You can only add multiple questions to Question or Multiple Choice cells');
    return;
  }
  
  // Create separator with better styling
  const separator = document.createElement('div');
  separator.className = 'question-separator';
  separator.style.cssText = 'margin: 10px 0; padding: 5px 0; border-top: 1px dashed #ccc; color: #666; font-size: 11px;';
  separator.innerHTML = `<span style="background: #f0f0f0; padding: 2px 8px; border-radius: 3px;">Question ${nextQuestionNumber}</span>`;
  
  // Create new question content based on type
  let newQuestionHTML = '';
  
  switch(cellType) {
    case 'question':
      newQuestionHTML = `<input type="text" class="cell-input" placeholder="${nextQuestionNumber}_____" data-question-number="${nextQuestionNumber}" style="margin-top: 5px;">`;
      break;
    case 'multiple-choice':
      newQuestionHTML = `
        <div class="mc-cell-content" style="margin-top: 5px;">
          <input type="text" class="cell-input" placeholder="Question ${nextQuestionNumber} text" data-question-number="${nextQuestionNumber}">
          <div class="mc-options" style="margin-top: 5px;">
            <div class="mc-option">
              <input type="radio" name="mc_${questionId}_${rowIndex}_${colIndex}_${nextQuestionNumber}" value="A" class="mc-radio">
              <input type="text" placeholder="Option A" class="mc-option-text">
            </div>
            <div class="mc-option">
              <input type="radio" name="mc_${questionId}_${rowIndex}_${colIndex}_${nextQuestionNumber}" value="B" class="mc-radio">
              <input type="text" placeholder="Option B" class="mc-option-text">
            </div>
            <div class="mc-option">
              <input type="radio" name="mc_${questionId}_${rowIndex}_${colIndex}_${nextQuestionNumber}" value="C" class="mc-radio">
              <input type="text" placeholder="Option C" class="mc-option-text">
            </div>
          </div>
        </div>
      `;
      break;
  }
  
  const newQuestionDiv = document.createElement('div');
  newQuestionDiv.className = 'additional-question';
  newQuestionDiv.setAttribute('data-question-number', nextQuestionNumber);
  newQuestionDiv.innerHTML = newQuestionHTML;
  
  cellContent.appendChild(separator);
  cellContent.appendChild(newQuestionDiv);
  
  // Add event listeners to new inputs
  const newInputs = newQuestionDiv.querySelectorAll('.cell-input');
  newInputs.forEach(input => {
    input.addEventListener('input', function() {
      updateQuestionNumbersInTable(questionId);
    });
  });
  
  // Add remove button for this additional question
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '×';
  removeBtn.className = 'remove-additional-question-btn';
  removeBtn.style.cssText = 'margin-left: 5px; padding: 2px 8px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;';
  removeBtn.onclick = function() {
    if (confirm('Remove this additional question?')) {
      separator.remove();
      newQuestionDiv.remove();
      updateQuestionNumbersInTable(questionId);
    }
  };
  separator.appendChild(removeBtn);
  
  console.log(`✅ Added question ${nextQuestionNumber} to cell ${rowIndex},${colIndex} in table ${questionId}`);
};

// Single Audio Upload Functions
window.handleSingleAudioUpload = function() {
  const fileInput = document.getElementById('singleAudioFile');
  const file = fileInput.files[0];
  
  if (!file) return;
  
  singleAudioFile = file;
  
  // Show preview
  const preview = document.getElementById('singleAudioPreview');
  const previewName = document.getElementById('singleAudioPreviewName');
  const previewSize = document.getElementById('singleAudioPreviewSize');
  
  previewName.textContent = file.name;
  previewSize.textContent = formatFileSize(file.size);
  preview.style.display = 'block';
  
  // Setup audio player
  const audioPlayer = document.getElementById('singleAudioPlayer');
  const audioURL = URL.createObjectURL(file);
  audioPlayer.src = audioURL;
  
  console.log(`🎵 Single audio file uploaded: ${file.name}`);
};

window.playSingleAudio = function() {
  const audioPlayer = document.getElementById('singleAudioPlayer');
  audioPlayer.play();
};

window.pauseSingleAudio = function() {
  const audioPlayer = document.getElementById('singleAudioPlayer');
  audioPlayer.pause();
};

window.removeSingleAudio = function() {
  singleAudioFile = null;
  
  const fileInput = document.getElementById('singleAudioFile');
  const preview = document.getElementById('singleAudioPreview');
  const audioPlayer = document.getElementById('singleAudioPlayer');
  
  fileInput.value = '';
  preview.style.display = 'none';
  audioPlayer.src = '';
  
  console.log('🗑 Single audio file removed');
};

// Question Group functions
window.addOption = function (questionId) {
  const optionsList = document.getElementById(`options-list-${questionId}`);
  const existingOptions = optionsList.querySelectorAll(".option-item").length;
  const nextLetter = String.fromCharCode(65 + existingOptions);

  const optionHTML = `
    <div class="option-item">
      <input type="text" value="${nextLetter}" class="option-label">
      <input type="text" placeholder="Option ${nextLetter} text" class="option-text">
      <button type="button" onclick="removeOption(this)" class="remove-option-btn">×</button>
    </div>
  `;

  optionsList.insertAdjacentHTML("beforeend", optionHTML);
};

window.addGroupQuestion = function(questionId) {
  const questionsList = document.getElementById(`group-questions-list-${questionId}`);
  
  const questionHTML = `
    <div class="group-question-item">
      <input type="text" placeholder="Question/Statement" class="group-question-text">
      <input type="text" placeholder="Correct answer (A, B, C, etc.)" class="group-question-answer">
      <button type="button" onclick="removeGroupQuestion(this)" class="remove-group-question-btn">×</button>
    </div>
  `;
  
  questionsList.insertAdjacentHTML("beforeend", questionHTML);
};

window.removeGroupQuestion = function(button) {
  const questionsList = button.closest(".questions-list");
  if (questionsList.querySelectorAll(".group-question-item").length <= 1) {
    alert("Question group must have at least one question");
    return;
  }
  
  if (confirm("Remove this question?")) {
    button.closest(".group-question-item").remove();
  }
};

// Handle group type change (multi-select vs matching)
window.handleGroupTypeChange = function(questionId) {
  const groupType = document.querySelector(`[data-question-id="${questionId}"] .group-type`).value;
  
  const multiSelectQuestion = document.getElementById(`multi-select-question-${questionId}`);
  const matchingQuestions = document.getElementById(`matching-questions-${questionId}`);
  const multiSelectAnswers = document.getElementById(`multi-select-answers-${questionId}`);
  
  if (groupType === 'multi-select') {
    // Show: question text and group answers
    // Hide: individual questions
    multiSelectQuestion.style.display = 'block';
    multiSelectAnswers.style.display = 'block';
    matchingQuestions.style.display = 'none';
  } else if (groupType === 'matching') {
    // Show: individual questions
    // Hide: question text and group answers
    multiSelectQuestion.style.display = 'none';
    multiSelectAnswers.style.display = 'none';
    matchingQuestions.style.display = 'block';
  }
};

// Single Question functions
window.addMCOptionToQuestion = function(questionId) {
  const optionsList = document.querySelector(`[data-question-id="${questionId}"] .mc-options-list`);
  const existingOptions = optionsList.querySelectorAll(".mc-option-item").length;
  const nextLetter = String.fromCharCode(65 + existingOptions);

  const optionHTML = `
    <div class="mc-option-item">
      <input type="radio" name="mc-answer-${questionId}" value="${nextLetter}">
      <label>${nextLetter}</label>
      <input type="text" placeholder="Option ${nextLetter} text" class="option-text" data-option="${nextLetter}">
      <button type="button" onclick="removeMCOptionFromQuestion(this)" style="padding: 2px 8px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
    </div>
  `;

  optionsList.insertAdjacentHTML("beforeend", optionHTML);
};

window.removeMCOptionFromQuestion = function(button) {
  const optionsList = button.closest(".mc-options-list");
  if (optionsList.querySelectorAll(".mc-option-item").length <= 2) {
    alert("Multiple choice question must have at least 2 options");
    return;
  }
  
  if (confirm("Remove this option?")) {
    button.closest(".mc-option-item").remove();
  }
};

// Remove option
window.removeOption = function (button) {
  button.parentElement.remove();
};

// Toggle options edit
window.toggleOptionsEdit = function (questionId, type) {
  const preview = document.getElementById(`options-preview-${questionId}`);
  const edit = document.getElementById(`options-edit-${questionId}`);

  if (edit.style.display === "none") {
    edit.style.display = "block";
    preview.style.display = "none";
  } else {
    updateOptionsPreview(questionId, type);
    edit.style.display = "none";
    preview.style.display = "block";
  }
};

// Update options preview
function updateOptionsPreview(questionId, type) {
  const optionsList = document.getElementById(`options-list-${questionId}`);
  const preview = document.getElementById(`options-preview-${questionId}`);
  
  const options = [];
  optionsList.querySelectorAll(".option-item").forEach((item) => {
    const label = item.querySelector(".option-label").value.trim();
    const text = item.querySelector(".option-text").value.trim();
    if (label && text) {
      options.push({ label, text });
    }
  });

  if (options.length === 0) {
    preview.innerHTML = '<span style="color: #666; font-style: italic;">No options added yet</span>';
  } else {
    preview.innerHTML = options
      .map(
        (opt) =>
          `<span style="display: inline-block; margin: 2px; padding: 3px 8px; background: #f0f0f0; border-radius: 3px; font-size: 12px;">${opt.label}: ${opt.text}</span>`
      )
      .join("");
  }
}

// Add matching question
window.addMatchingQuestion = function (questionId) {
  const container = document.getElementById(`matching-questions-${questionId}`);
  
  const matchingHTML = `
    <div class="matching-question">
      <input type="text" placeholder="Question/Statement" class="matching-question-text">
      <input type="text" placeholder="Correct answer (A, B, C, etc.)" class="matching-answer">
      <button type="button" onclick="removeMatchingQuestion(this)" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
    </div>
  `;
  
  container.insertAdjacentHTML("beforeend", matchingHTML);
};

// Remove matching question
window.removeMatchingQuestion = function (button) {
  const container = button.closest(".matching-questions");
  if (container.querySelectorAll(".matching-question").length <= 1) {
    alert("Matching question must have at least one question");
    return;
  }
  
  if (confirm("Remove this matching question?")) {
    button.closest(".matching-question").remove();
  }
};

// Add option for Multiple Choice
window.addMCOption = function (questionId) {
  const container = document.getElementById(`mc-options-${questionId}`);
  const existingOptions = container.querySelectorAll(".mc-option").length;
  const nextLetter = String.fromCharCode(65 + existingOptions);

  const optionHTML = `
    <div class="mc-option">
      <input type="radio" name="mc-answer-${questionId}" value="${nextLetter}">
      <label>${nextLetter}</label>
      <input type="text" placeholder="Option ${nextLetter} text" class="option-text" data-option="${nextLetter}">
      <button type="button" onclick="removeMCOption(this)" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", optionHTML);
};

// Remove option for Multiple Choice
window.removeMCOption = function (button) {
  const mcOption = button.closest(".mc-option");
  const container = mcOption.parentElement;
  
  if (container.querySelectorAll(".mc-option").length <= 2) {
    alert("Multiple choice question must have at least 2 options");
    return;
  }
  
  if (confirm("Remove this option?")) {
    mcOption.remove();
  }
};

// Remove a question
window.removeQuestion = function (questionId) {
  const question = document.querySelector(`[data-question-id="${questionId}"]`);
  if (question && confirm("Are you sure you want to remove this question?")) {
    const section = question.closest('.section-container');
    const sectionNumber = section ? parseInt(section.dataset.section) : null;
    question.remove();
    if (sectionNumber) updateQuestionNumbers(sectionNumber);
  }
};

function updateQuestionNumbers(sectionNumber) {
  const items = document.querySelectorAll(`#questions${sectionNumber} .question-item`);
  let counter = 0;
  items.forEach((item) => {
    const numEl = item.querySelector('.question-index');
    if (numEl) {
      counter++;
      numEl.textContent = counter;
    }
  });
}

// Remove a section
window.removeSection = function (sectionNumber) {
  if (
    confirm(
      "Are you sure you want to remove this section and all its content?"
    )
  ) {
    const section = document.querySelector(`[data-section="${sectionNumber}"]`);
    if (section) {
      section.remove();
      sectionCount--;
      updateSectionCount();
      updateAddSectionButton();
      renumberSections();
    }
  }
};

// Renumber sections after removal
function renumberSections() {
  const sections = document.querySelectorAll(".section-container");
  sections.forEach((section, index) => {
    const newNumber = index + 1;
    section.dataset.section = newNumber;
    section.querySelector(".section-number").textContent = newNumber;
    section.querySelector(
      ".section-title"
    ).childNodes[2].textContent = ` Section ${newNumber}`;

    // Update all IDs and references
    const oldId = section.querySelector(".section-number").textContent;
    section.querySelectorAll(`[id*="${oldId}"]`).forEach((element) => {
      element.id = element.id.replace(/\d+/, newNumber);
    });

    // Update onclick handlers
    const removeBtn = section.querySelector(".remove-section-btn");
    if (removeBtn) {
      removeBtn.setAttribute("onclick", `removeSection(${newNumber})`);
    }

    const questionMenu = section.querySelector(".question-types-menu");
    if (questionMenu) {
      questionMenu.id = `questionMenu${newNumber}`;
    }

    const questionsContainer = section.querySelector(".questions-container");
    if (questionsContainer) {
      questionsContainer.id = `questions${newNumber}`;
    }

    const addQuestionBtn = section.querySelector(".add-question-btn");
    if (addQuestionBtn) {
      addQuestionBtn.setAttribute(
        "onclick",
        `toggleQuestionMenu(${newNumber})`
      );
    }
  });
}

// Update section count display
function updateSectionCount() {
  document.getElementById("sectionCount").textContent = sectionCount;
}

// Update add section button state
function updateAddSectionButton() {
  const btn = document.getElementById("addSectionBtn");
  if (sectionCount >= 4) {
    btn.disabled = true;
    btn.textContent = "Maximum 4 Sections Reached";
  } else {
    btn.disabled = false;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
      Add Section
    `;
  }
}

// Preview the test
window.previewTest = function () {
  const previewContent = document.getElementById("previewContent");
  const sections = document.querySelectorAll(".section-container");

  if (sections.length === 0) {
    alert("Please add at least one section first");
    return;
  }

  let previewHTML = "<h3>Test Preview</h3>";

  sections.forEach((section, index) => {
    const title =
      section.querySelector(".section-title-input").value || "Untitled Section";
    const questions = Array.from(section.querySelectorAll(".question-item")).filter(q => !['text','subheading'].includes(q.dataset.type));

    previewHTML += `
      <div class="preview-section">
        <h4>Section ${index + 1}: ${title}</h4>
        <div class="preview-questions">
          <strong>Questions (${questions.length}):</strong>
          ${Array.from(questions)
            .map((q, i) => {
              const type = q.dataset.type;
              const questionText =
                q.querySelector(".question-text").value || "No question text";
              return `
              <div class="preview-question">
                <span class="preview-question-number">${i + 1}.</span>
                ${questionText}
                <span class="preview-answer">[${type.replace(/-/g, " ")}]</span>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `;
  });

  previewContent.innerHTML = previewHTML;
  document.getElementById("previewModal").style.display = "flex";
};

// Close preview
window.closePreview = function () {
  document.getElementById("previewModal").style.display = "none";
};

// Collect test data
function collectTestData() {
  const testTitle = document.getElementById("testTitle").value.trim();
  const timeLimit = parseInt(document.getElementById("timeLimit").value);
  
  const sections = [];
  const sectionElements = document.querySelectorAll(".section-container");
  let nextQuestionNumber = 1;
  let totalQuestionCount = 0;

  const allocateQuestionNumbers = (count) => {
    const allocationSize = Math.max(0, count);
    const numbers = [];
    for (let i = 0; i < allocationSize; i++) {
      numbers.push(nextQuestionNumber++);
    }
    if (numbers.length) {
      totalQuestionCount += numbers.length;
    }
    return numbers;
  };

  const registerExistingQuestionNumbers = (numbers) => {
    if (!Array.isArray(numbers) || numbers.length === 0) return;
    const uniqueNumbers = Array.from(
      new Set(
        numbers
          .map((num) => parseInt(num, 10))
          .filter((num) => Number.isFinite(num))
      )
    ).sort((a, b) => a - b);
    if (!uniqueNumbers.length) return;
    totalQuestionCount += uniqueNumbers.length;
    const highest = uniqueNumbers[uniqueNumbers.length - 1];
    if (highest >= nextQuestionNumber) {
      nextQuestionNumber = highest + 1;
    }
  };

  const toQuestionId = (number) => `q${number}`;
  const formatMultiSelectGroupId = (numbers) => {
    if (!numbers.length) return "";
    return `q${numbers.join("_")}`;
  };
  const formatMatchingGroupId = (numbers) => {
    if (!numbers.length) return "";
    if (numbers.length === 1) return `q${numbers[0]}`;
    return `q${numbers[0]}_${numbers[numbers.length - 1]}`;
  };

  sectionElements.forEach((sectionEl) => {
    const sectionData = {
      sectionNumber: parseInt(sectionEl.dataset.section),
      title: sectionEl.querySelector(".section-title-input").value.trim(),
      audioUrl: "", // Will be set after upload
      content: [],
      instructions: {
        heading: sectionEl.querySelector(".instructions-heading").value.trim(),
        details: sectionEl.querySelector(".instructions-details").value.trim(),
        note: sectionEl.querySelector(".instructions-note").value.trim(),
      },
    };

    const questionElements = sectionEl.querySelectorAll(".question-item");
    questionElements.forEach((questionEl) => {
      const type = questionEl.dataset.type;
      const questionId = questionEl.dataset.questionId;

      let questionData = {
        type: type,
      };

      switch (type) {
        case "text":
          const textValue = questionEl.querySelector(".question-value").value.trim();
          questionData.type = "text";
          if (textValue) questionData.value = textValue;
          break;

        case "subheading":
          const subheadingValue = questionEl.querySelector(".question-value").value.trim();
          questionData.type = "subheading";
          if (subheadingValue) {
            questionData.value = subheadingValue;
          }
          break;

        case "gap-fill":
          const gapFillGroupInstruction = questionEl.querySelector(".group-instruction")?.value.trim();
          const gapFillTextElement = questionEl.querySelector(".question-text");
          const gapFillText = gapFillTextElement ? gapFillTextElement.value.trim() : "";
          const gapFillPostfix = questionEl.querySelector(".question-postfix")?.value.trim();
          const gapFillAnswerElement = questionEl.querySelector(".question-answer");
          const gapFillAnswer = gapFillAnswerElement ? gapFillAnswerElement.value.trim() : "";
          const gapFillWordLimitValue = questionEl.querySelector(".question-word-limit")?.value;
          
          const [gapFillNumber] = allocateQuestionNumbers(1);
          questionData.type = "question";
          questionData.questionId = toQuestionId(gapFillNumber);
          questionData.format = "gap-fill";
          if (gapFillGroupInstruction) questionData.groupInstruction = gapFillGroupInstruction;
          questionData.text = gapFillText;
          if (gapFillPostfix) questionData.postfix = gapFillPostfix;
          questionData.correctAnswer = gapFillAnswer;
          if (gapFillWordLimitValue) questionData.wordLimit = parseInt(gapFillWordLimitValue);
          break;

        case "multiple-choice":
          const mcGroupInstruction = questionEl.querySelector(".group-instruction")?.value.trim();
          const mcTextElement = questionEl.querySelector(".question-text");
          const mcText = mcTextElement ? mcTextElement.value.trim() : "";
          
          const [multipleChoiceNumber] = allocateQuestionNumbers(1);
          questionData.type = "question";
          questionData.questionId = toQuestionId(multipleChoiceNumber);
          questionData.format = "multiple-choice";
          if (mcGroupInstruction) questionData.groupInstruction = mcGroupInstruction;
          questionData.text = mcText;
          
          questionData.options = {};
          questionEl.querySelectorAll(".mc-option-item").forEach(optionEl => {
            const optionLetter = optionEl.querySelector('input[type="radio"]').value;
            const optionText = optionEl.querySelector(".option-text").value.trim();
            if (optionText) {
              questionData.options[optionLetter] = optionText;
            }
          });
          questionData.correctAnswer = questionEl.querySelector('input[type="radio"]:checked')?.value || "";
          break;


        case "table":
          const tableTitle = questionEl.querySelector(".table-title")?.value.trim();
          const tableGroupInstruction = questionEl.querySelector(".group-instruction")?.value.trim();
          const tableAnswersElement = questionEl.querySelector(".table-answers-text");
          const tableAnswersText = tableAnswersElement ? tableAnswersElement.value.trim() : "";
          
          questionData.type = "table";
          if (tableTitle) questionData.title = tableTitle;
          if (tableGroupInstruction) questionData.groupInstruction = tableGroupInstruction;
          
          // Get columns from header
          questionData.columns = [];
          const headerRow = questionEl.querySelector(`#header-row-${questionId}`);
          if (headerRow) {
            headerRow.querySelectorAll(".header-input").forEach(colEl => {
              const colName = colEl.value.trim();
              if (colName) questionData.columns.push(colName);
            });
          }
          
          // Get rows from table body and organize questions by number
          questionData.rows = [];
          questionData.questions = {}; // Store questions by their numbers
          
          const tbody = questionEl.querySelector(`#table-body-${questionId}`);
          if (tbody) {
            tbody.querySelectorAll(".data-row").forEach((rowEl, rowIndex) => {
              const rowData = {};
              const cells = rowEl.querySelectorAll(".data-cell");
              
              cells.forEach((cellEl, cellIndex) => {
                const cellType = cellEl.querySelector(".cell-type").value;
                const cellContent = cellEl.querySelector(".cell-content");
                // ВАЖНО: Убираем пробелы из имени колонки, чтобы совпадало с рендерингом
                const columnName = questionData.columns[cellIndex]?.toLowerCase().replace(/\s+/g, "") || `column${cellIndex + 1}`;
                
                if (cellType === "question") {
                  // Process all questions in this cell (including additional questions)
                  let cellValue = '';
                  
                  // Get main question input
                  const mainInput = cellContent.querySelector('.cell-input[data-question-number]');
                  if (mainInput) {
                    const questionNumber = mainInput.getAttribute('data-question-number');
                    const content = mainInput.value.trim();
                    if (content) {
                      // Keep the content as-is - user controls the format
                      // If they want "1_____", they type it
                      // If they want "Good for people who are 1_____ interested", they type it
                      // Just ensure the question number pattern uses the correct number if present
                      let formattedContent = content;
                      if (content.match(/\d+_____/)) {
                        // Replace any question number pattern with the correct one
                        formattedContent = content.replace(/(\d+)_____/g, `${questionNumber}_____`);
                      }
                      // Otherwise keep content as-is (e.g., plain text or text with _____ but no number)
                      cellValue += formattedContent;
                      
                      // Store question by its number
                      if (!questionData.questions[questionNumber]) {
                        questionData.questions[questionNumber] = {
                          questionId: `q${questionNumber}`,
                          text: formattedContent,
                          row: rowIndex,
                          column: cellIndex,
                          columnName: columnName
                        };
                      }
                    }
                  }
                  
                  // Get additional questions in the same cell
                  const additionalQuestions = cellContent.querySelectorAll('.additional-question');
                  additionalQuestions.forEach((addQDiv, addQIndex) => {
                    const addInput = addQDiv.querySelector('.cell-input[data-question-number]');
                    if (addInput) {
                      const questionNumber = addInput.getAttribute('data-question-number');
                      const content = addInput.value.trim();
                      if (content) {
                        if (cellValue) cellValue += '<br>';
                        
                        // Keep the content as-is - user controls the format
                        let formattedContent = content;
                        if (content.match(/\d+_____/)) {
                          // Replace any question number pattern with the correct one
                          formattedContent = content.replace(/(\d+)_____/g, `${questionNumber}_____`);
                        }
                        // Otherwise keep content as-is
                        cellValue += formattedContent;
                        
                        // Store question by its number
                        if (!questionData.questions[questionNumber]) {
                          questionData.questions[questionNumber] = {
                            questionId: `q${questionNumber}`,
                            text: formattedContent,
                            row: rowIndex,
                            column: cellIndex,
                            columnName: columnName
                          };
                        }
                      }
                    }
                  });
                  
                  rowData[columnName] = cellValue;
                } else if (cellType === "multiple-choice") {
                  // Process multiple choice questions (main + additional)
                  let cellValue = '';
                  
                  // Process main MC question
                  const mainMcContent = cellContent.querySelector('.mc-cell-content');
                  if (mainMcContent) {
                    const mainInput = mainMcContent.querySelector('.cell-input');
                    if (mainInput) {
                      const questionNumber = mainInput.getAttribute('data-question-number');
                      const questionText = mainInput.value.trim();
                      const options = mainMcContent.querySelectorAll('.mc-option');
                      const correctAnswer = mainMcContent.querySelector('input[type="radio"]:checked')?.value || '';
                      
                      if (questionText) {
                        cellValue += `Q${questionNumber}: ${questionText}<br>`;
                        
                        options.forEach(option => {
                          const letter = option.querySelector('.mc-radio').value;
                          const text = option.querySelector('.mc-option-text').value.trim();
                          if (text) {
                            cellValue += `${letter}. ${text}`;
                            if (letter === correctAnswer) cellValue += ' ✓';
                            cellValue += '<br>';
                          }
                        });
                        
                        // Store multiple choice question by its number
                        if (!questionData.questions[questionNumber]) {
                          questionData.questions[questionNumber] = {
                            questionId: `q${questionNumber}`,
                            text: questionText,
                            format: 'multiple-choice',
                            options: {},
                            correctAnswer: correctAnswer,
                            row: rowIndex,
                            column: cellIndex,
                            columnName: columnName
                          };
                          
                          options.forEach(option => {
                            const letter = option.querySelector('.mc-radio').value;
                            const text = option.querySelector('.mc-option-text').value.trim();
                            if (text) {
                              questionData.questions[questionNumber].options[letter] = text;
                            }
                          });
                        }
                      }
                    }
                  }
                  
                  // Process additional MC questions in the same cell
                  const additionalMcQuestions = cellContent.querySelectorAll('.additional-question .mc-cell-content');
                  additionalMcQuestions.forEach((mcEl, qIndex) => {
                    const addInput = mcEl.querySelector('.cell-input');
                    if (addInput) {
                      const questionNumber = addInput.getAttribute('data-question-number');
                      const questionText = addInput.value.trim();
                      const options = mcEl.querySelectorAll('.mc-option');
                      const correctAnswer = mcEl.querySelector('input[type="radio"]:checked')?.value || '';
                      
                      if (questionText) {
                        if (cellValue) cellValue += '<br>';
                        cellValue += `Q${questionNumber}: ${questionText}<br>`;
                        
                        options.forEach(option => {
                          const letter = option.querySelector('.mc-radio').value;
                          const text = option.querySelector('.mc-option-text').value.trim();
                          if (text) {
                            cellValue += `${letter}. ${text}`;
                            if (letter === correctAnswer) cellValue += ' ✓';
                            cellValue += '<br>';
                          }
                        });
                        
                        // Store multiple choice question by its number
                        if (!questionData.questions[questionNumber]) {
                          questionData.questions[questionNumber] = {
                            questionId: `q${questionNumber}`,
                            text: questionText,
                            format: 'multiple-choice',
                            options: {},
                            correctAnswer: correctAnswer,
                            row: rowIndex,
                            column: cellIndex,
                            columnName: columnName
                          };
                          
                          options.forEach(option => {
                            const letter = option.querySelector('.mc-radio').value;
                            const text = option.querySelector('.mc-option-text').value.trim();
                            if (text) {
                              questionData.questions[questionNumber].options[letter] = text;
                            }
                          });
                        }
                      }
                    }
                  });
                  
                  rowData[columnName] = cellValue;
                } else if (cellType === "example") {
                  // This is an example cell
                  const questions = cellContent.querySelectorAll('.cell-input[data-question-number]');
                  let cellValue = '';
                  
                  questions.forEach((input, qIndex) => {
                    const content = input.value.trim();
                    if (content) {
                      if (qIndex > 0) cellValue += '<br>';
                      cellValue += `Example<br>${content}`;
                    }
                  });
                  
                  rowData[columnName] = cellValue;
                } else {
                  // Regular text cell (no question numbers)
                  let cellValue = '';
                  
                  // Check if there are inputs with question numbers (shouldn't be for text cells)
                  const questionsWithNumbers = cellContent.querySelectorAll('.cell-input[data-question-number]');
                  if (questionsWithNumbers.length > 0) {
                    // If there are question-numbered inputs, process them
                    questionsWithNumbers.forEach((input, qIndex) => {
                      const content = input.value.trim();
                      if (content) {
                        if (qIndex > 0) cellValue += '<br>';
                        cellValue += content;
                      }
                    });
                  } else {
                    // Pure text cell without question numbers
                    const textInputs = cellContent.querySelectorAll('.cell-input');
                    textInputs.forEach((input, qIndex) => {
                      const content = input.value.trim();
                      if (content) {
                        if (qIndex > 0) cellValue += '<br>';
                        cellValue += content;
                      }
                    });
                  }
                  
                  rowData[columnName] = cellValue;
                }
              });
              
              questionData.rows.push(rowData);
            });
          }
          
          // Parse answers
          questionData.answer = {};
          if (tableAnswersText) {
            const answerPairs = tableAnswersText.split(',');
            answerPairs.forEach(pair => {
              const [key, value] = pair.split('=');
              if (key && value) {
                questionData.answer[key.trim()] = value.trim();
              }
            });
          }
          
          // Debug logging
          console.log(`📋 Table data collected:`, {
            title: questionData.title,
            columns: questionData.columns,
            rowCount: questionData.rows.length,
            rows: questionData.rows,
            questions: questionData.questions,
            answers: questionData.answer
          });

          const tableQuestionNumbers = Object.keys(questionData.questions || {})
            .map(num => parseInt(num, 10))
            .filter(num => Number.isFinite(num));
          registerExistingQuestionNumbers(tableQuestionNumbers);
          break;

        case "question-group":
          const groupTypeElement = questionEl.querySelector(".group-type");
          const groupType = groupTypeElement ? groupTypeElement.value : "multi-select";
          const questionGroupGroupInstruction = questionEl.querySelector(".group-instruction")?.value.trim();
          
          questionData.type = "question-group";
          questionData.groupType = groupType;
          if (questionGroupGroupInstruction) questionData.groupInstruction = questionGroupGroupInstruction;
          
          // Get options (common for both types)
          questionData.options = {};
          questionEl.querySelectorAll(".option-item").forEach(optionEl => {
            const optionLabel = optionEl.querySelector(".option-label").value.trim();
            const optionText = optionEl.querySelector(".option-text").value.trim();
            if (optionLabel && optionText) {
              questionData.options[optionLabel] = optionText;
            }
          });
          
          if (groupType === "multi-select") {
            // Multi-select: has question text and group answers
            const groupQuestionTextElement = questionEl.querySelector(".question-text");
            const groupQuestionText = groupQuestionTextElement ? groupQuestionTextElement.value.trim() : "";
            questionData.text = groupQuestionText;
            
            // Get group answers (comma-separated correct answers)
            const groupCorrectAnswers = questionEl.querySelector(".group-correct-answers")?.value.trim();
            const answersArray = groupCorrectAnswers
              ? groupCorrectAnswers.split(',').map(a => a.trim()).filter(a => a)
              : [];

            if (answersArray.length) {
              const questionNumbers = allocateQuestionNumbers(answersArray.length);
              questionData.questionId = formatMultiSelectGroupId(questionNumbers);
              questionData.questions = questionNumbers.map((number, index) => ({
                type: "question",
                questionId: toQuestionId(number),
                correctAnswer: answersArray[index]
              }));
            } else {
              questionData.questions = [];
            }
          } else if (groupType === "matching") {
            // Matching: has individual questions with text
            const matchingQuestions = [];
            const matchingItems = questionEl.querySelectorAll(".group-question-item, .matching-question");
            matchingItems.forEach((qEl) => {
              const questionTextElement = qEl.querySelector(".group-question-text") || qEl.querySelector(".matching-question-text");
              const correctAnswerElement = qEl.querySelector(".group-question-answer") || qEl.querySelector(".matching-answer");
              const questionText = questionTextElement ? questionTextElement.value.trim() : "";
              const correctAnswer = correctAnswerElement ? correctAnswerElement.value.trim() : "";
              if (questionText && correctAnswer) {
                matchingQuestions.push({
                  text: questionText,
                  correctAnswer: correctAnswer
                });
              }
            });

            if (matchingQuestions.length) {
              const questionNumbers = allocateQuestionNumbers(matchingQuestions.length);
              questionData.questionId = formatMatchingGroupId(questionNumbers);
              questionData.questions = matchingQuestions.map((question, index) => ({
                ...question,
                type: "question",
                questionId: toQuestionId(questionNumbers[index])
              }));
            } else {
              questionData.questions = [];
            }
          }
          break;

        case "gap-fill":
          questionData.format = "gap-fill";
          const gapFillTextElement2 = questionEl.querySelector(".question-text");
          questionData.text = gapFillTextElement2 ? gapFillTextElement2.value.trim() : "";
          const gapFillPrefixElement = questionEl.querySelector(".question-prefix");
          questionData.prefix = gapFillPrefixElement ? gapFillPrefixElement.value.trim() : "";
          const gapFillAnswerElement2 = questionEl.querySelector(".question-answer");
          questionData.correctAnswer = gapFillAnswerElement2 ? gapFillAnswerElement2.value.trim() : "";
          const gapFillWordLimitValue2 = questionEl.querySelector(".question-word-limit")?.value;
          if (gapFillWordLimitValue2) {
            questionData.wordLimit = parseInt(gapFillWordLimitValue2);
          }
          break;

        case "multiple-choice":
          questionData.format = "multiple-choice";
          const mcTextElement2 = questionEl.querySelector(".question-text");
          questionData.text = mcTextElement2 ? mcTextElement2.value.trim() : "";
          questionData.correctAnswer = questionEl.querySelector('input[type="radio"]:checked')?.value || "";
          questionData.options = {};
          
          questionEl.querySelectorAll(".option-text").forEach((optionEl) => {
            const optionLetter = optionEl.dataset.option;
            const optionText = optionEl.value.trim();
            if (optionText) {
              questionData.options[optionLetter] = optionText;
            }
          });
          break;

        case "multi-select":
          questionData.groupType = "multi-select";
          {
            const multiSelectGroupInstruction = questionEl.querySelector(".group-instruction");
            questionData.groupInstruction = multiSelectGroupInstruction ? multiSelectGroupInstruction.value.trim() : "";
            const multiSelectText = questionEl.querySelector(".question-text");
            questionData.text = multiSelectText ? multiSelectText.value.trim() : "";
            const multiSelectInstructions = questionEl.querySelector(".question-select-count");
            questionData.instructions = multiSelectInstructions ? multiSelectInstructions.value.trim() : "";
            const multiSelectAnswer = questionEl.querySelector(".question-answer");
            const answersArray = multiSelectAnswer
              ? multiSelectAnswer.value
                  .trim()
                  .split(",")
                  .map(a => a.trim())
                  .filter(a => a)
              : [];
            questionData.correctAnswers = answersArray;

            if (answersArray.length) {
              const questionNumbers = allocateQuestionNumbers(answersArray.length);
              questionData.questionId = formatMultiSelectGroupId(questionNumbers);
              questionData.questions = questionNumbers.map((number, index) => ({
                type: "question",
                questionId: toQuestionId(number),
                correctAnswer: answersArray[index]
              }));
            } else {
              questionData.questions = [];
            }

            // Get options from preview
            const optionsPreview = document.getElementById(`options-preview-${questionId}`);
            if (optionsPreview) {
              const optionSpans = optionsPreview.querySelectorAll("span");
              questionData.options = {};
              optionSpans.forEach(span => {
                const text = span.textContent;
                const match = text.match(/^([A-Z]):\s*(.+)$/);
                if (match) {
                  questionData.options[match[1]] = match[2];
                }
              });
            }
          }
          break;

        case "matching":
          questionData.groupType = "matching";
          {
            const matchingGroupInstruction = questionEl.querySelector(".group-instruction");
            questionData.groupInstruction = matchingGroupInstruction ? matchingGroupInstruction.value.trim() : "";
            const matchingText = questionEl.querySelector(".question-text");
            questionData.text = matchingText ? matchingText.value.trim() : "";
            
            // Get options
            const matchingOptionsPreview = document.getElementById(`options-preview-${questionId}`);
            if (matchingOptionsPreview) {
              const matchingOptionSpans = matchingOptionsPreview.querySelectorAll("span");
              questionData.options = {};
              matchingOptionSpans.forEach(span => {
                const text = span.textContent;
                const match = text.match(/^([A-Z]):\s*(.+)$/);
                if (match) {
                  questionData.options[match[1]] = match[2];
                }
              });
            }
            
            // Collect matching questions within this block
            const matchingQuestions = [];
            questionEl.querySelectorAll(".matching-question").forEach(matchQ => {
              const questionTextElement = matchQ.querySelector(".matching-question-text");
              const correctAnswerElement = matchQ.querySelector(".matching-answer");
              const questionText = questionTextElement ? questionTextElement.value.trim() : "";
              const correctAnswer = correctAnswerElement ? correctAnswerElement.value.trim() : "";
              if (questionText && correctAnswer) {
                matchingQuestions.push({
                  text: questionText,
                  correctAnswer: correctAnswer
                });
              }
            });

            if (matchingQuestions.length) {
              const questionNumbers = allocateQuestionNumbers(matchingQuestions.length);
              questionData.questionId = formatMatchingGroupId(questionNumbers);
              questionData.questions = matchingQuestions.map((question, index) => ({
                ...question,
                type: "question",
                questionId: toQuestionId(questionNumbers[index])
              }));
            } else {
              questionData.questions = [];
            }
          }
          break;
      }

      sectionData.content.push(questionData);
    });

    sections.push(sectionData);
  });

  return {
    title: testTitle,
    parts: {
      testId: `ielts-listening-${nextTestNumber}`,
      title: testTitle,
      sections: sections,
      metadata: {
        totalQuestions: totalQuestionCount,
        timeLimit: timeLimit,
        version: "1.0",
        createdAt: new Date().toISOString().split('T')[0],
      }
    },
    createdAt: new Date(),
  };
}

// Validate form
function validateForm() {
  console.log(`🔍 Starting validation. Audio upload type: ${audioUploadType}`);
  
  const testTitle = document.getElementById("testTitle").value.trim();
  const timeLimit = document.getElementById("timeLimit").value;
  const sections = document.querySelectorAll(".section-container");

  if (!testTitle) {
    alert("Please enter a test title");
    return false;
  }

  if (!timeLimit || parseInt(timeLimit) < 10) {
    alert("Please enter a valid time limit (minimum 10 minutes)");
    return false;
  }

  if (sections.length === 0) {
    alert("Please add at least one section");
    return false;
  }

  for (let section of sections) {
    const questions = section.querySelectorAll(".question-item");

    if (questions.length === 0) {
      alert("Please add at least one question for each section");
      return false;
    }

    // Validate questions
    for (let question of questions) {
      const type = question.dataset.type;
      console.log(`🔍 Validating question type: ${type}`);
      
      if (type === "text" || type === "subheading") {
        const textElement = question.querySelector(".question-value");
        if (!textElement) {
          alert("Please fill in all text fields");
          return false;
        }
        const text = textElement.value.trim();
        if (!text) {
          alert("Please fill in all text fields");
          return false;
        }
        continue;
      }

      // Check question text only for types that have it (skip table and question-group as they have their own validation)
      if (type !== "table" && type !== "question-group") {
        const questionTextElement = question.querySelector(".question-text");
        console.log(`🔍 Checking question text for type ${type}:`, {
          element: questionTextElement,
          value: questionTextElement ? questionTextElement.value.trim() : 'no element'
        });
        
        if (!questionTextElement) {
          alert("Please fill in all question texts");
          return false;
        }
        const questionText = questionTextElement.value.trim();
        if (!questionText) {
          alert("Please fill in all question texts");
          return false;
        }
      } else {
        console.log(`🔍 Skipping question text validation for ${type} type`);
      }

      if (type === "multiple-choice") {
        const selectedAnswer = question.querySelector('input[type="radio"]:checked');
        if (!selectedAnswer) {
          alert("Please select the correct answer for all multiple choice questions");
          return false;
        }
        
        const options = question.querySelectorAll(".option-text");
        let hasEmptyOption = false;
        options.forEach(opt => {
          if (!opt.value.trim()) hasEmptyOption = true;
        });
        if (hasEmptyOption) {
          alert("Please fill in all multiple choice options");
          return false;
        }
      } else if (type === "gap-fill") {
        const questionTextElement = question.querySelector(".question-text");
        const answerElement = question.querySelector(".question-answer");
        
        if (!questionTextElement || !questionTextElement.value.trim()) {
          alert("Please fill in question text for all gap fill questions");
          return false;
        }
        
        if (!answerElement || !answerElement.value.trim()) {
          alert("Please provide answers for all gap fill questions");
          return false;
        }
      } else if (type === "table") {
        // Validate table completion questions
        const tableAnswersElement = question.querySelector(".table-answers-text");
        if (!tableAnswersElement) {
          alert("Please provide answers for all table completion questions");
          return false;
        }
        const tableAnswers = tableAnswersElement.value.trim();
        if (!tableAnswers) {
          alert("Please provide answers for all table completion questions");
          return false;
        }
        
        // Check if all table cells are filled
        const table = question.querySelector(".question-table");
        if (table) {
          const headerInputs = table.querySelectorAll(".header-input");
          
          // Check header inputs
          for (let headerInput of headerInputs) {
            if (!headerInput.value.trim()) {
              alert("Please fill in all table column headers");
              return false;
            }
          }
          
          // Check cell inputs - validate main questions and additional questions
          const dataRows = table.querySelectorAll(".data-row");
          for (let row of dataRows) {
            const cells = row.querySelectorAll(".data-cell");
            for (let cell of cells) {
              const cellType = cell.querySelector(".cell-type").value;
              const cellContent = cell.querySelector(".cell-content");
              
              if (cellType === "question") {
                // Check main input for question cells (must be filled)
                const mainInput = cellContent.querySelector('.cell-input[data-question-number]');
                if (mainInput && !mainInput.value.trim()) {
                  alert("Please fill in all question cells in the table");
                  return false;
                }
                
                // Check additional questions
                const additionalQuestions = cellContent.querySelectorAll('.additional-question');
                for (let addQ of additionalQuestions) {
                  const addInput = addQ.querySelector('.cell-input[data-question-number]');
                  if (addInput && !addInput.value.trim()) {
                    alert("Please fill in all additional questions in table cells");
                    return false;
                  }
                }
              } else if (cellType === "text" || cellType === "example") {
                // Text and example cells are optional - no validation needed
                // They can be empty or filled
              } else if (cellType === "multiple-choice") {
                // Check main MC question
                const mainMcContent = cellContent.querySelector(".mc-cell-content");
                if (mainMcContent) {
                  const questionText = mainMcContent.querySelector(".cell-input")?.value.trim();
                  if (!questionText) {
                    alert("Please fill in all table cells");
                    return false;
                  }
                  
                  const options = mainMcContent.querySelectorAll(".mc-option-text");
                  for (let option of options) {
                    if (!option.value.trim()) {
                      alert("Please fill in all table cell options");
                      return false;
                    }
                  }
                  
                  // Check if correct answer is selected
                  const hasCorrectAnswer = mainMcContent.querySelector('input[type="radio"]:checked');
                  if (!hasCorrectAnswer) {
                    alert("Please select the correct answer for all multiple choice questions in the table");
                    return false;
                  }
                }
                
                // Check additional MC questions
                const additionalMcQuestions = cellContent.querySelectorAll('.additional-question .mc-cell-content');
                for (let addMcEl of additionalMcQuestions) {
                  const questionText = addMcEl.querySelector(".cell-input")?.value.trim();
                  if (!questionText) {
                    alert("Please fill in all additional questions in table cells");
                    return false;
                  }
                  
                  const options = addMcEl.querySelectorAll(".mc-option-text");
                  for (let option of options) {
                    if (!option.value.trim()) {
                      alert("Please fill in all options for additional questions in table cells");
                      return false;
                    }
                  }
                  
                  // Check if correct answer is selected
                  const hasCorrectAnswer = addMcEl.querySelector('input[type="radio"]:checked');
                  if (!hasCorrectAnswer) {
                    alert("Please select the correct answer for all multiple choice questions in the table");
                    return false;
                  }
                }
              }
            }
          }
        }
      } else if (type === "question-group") {
        const groupTypeElement = question.querySelector(".group-type");
        const groupType = groupTypeElement ? groupTypeElement.value : "multi-select";
        
        // Check if options are filled (common for both types)
        const optionItems = question.querySelectorAll(".option-item");
        if (optionItems.length === 0) {
          alert("Please add at least one option for question group questions");
          return false;
        }
        for (let optionItem of optionItems) {
          const optionText = optionItem.querySelector(".option-text");
          if (!optionText || !optionText.value.trim()) {
            alert("Please fill in all option texts for question group questions");
            return false;
          }
        }
        
        if (groupType === "multi-select") {
          // Multi-select validation
          const groupQuestionTextElement = question.querySelector(".question-text");
          if (!groupQuestionTextElement || !groupQuestionTextElement.value.trim()) {
            alert("Please fill in the question text for multi-select question");
            return false;
          }
          
          // Check group answer field
          const groupAnswerElement = question.querySelector(".group-correct-answers");
          if (!groupAnswerElement || !groupAnswerElement.value.trim()) {
            alert("Please provide the correct answers (comma-separated) for multi-select question");
            return false;
          }
        } else if (groupType === "matching") {
          // Matching validation
          const groupQuestionItems = question.querySelectorAll(".group-question-item");
          if (groupQuestionItems.length === 0) {
            alert("Please add at least one question for matching type");
            return false;
          }
          for (let groupQuestionItem of groupQuestionItems) {
            const answer = groupQuestionItem.querySelector(".group-question-answer");
            
            if (!answer || !answer.value.trim()) {
              alert("Please provide answers for all matching questions");
              return false;
            }
          }
        }
      } else if (type === "multi-select" || type === "matching") {
        const optionsPreview = document.getElementById(`options-preview-${question.dataset.questionId}`);
        if (!optionsPreview || optionsPreview.textContent.includes("No options added yet")) {
          alert("Please add options for all multi-select and matching questions");
          return false;
        }
      }
    }
  }

  // Check that at least one audio file is uploaded
  let hasAudio = false;
  
  if (audioUploadType === 'single') {
    hasAudio = !!singleAudioFile;
  } else if (audioUploadType === 'separate') {
    // Check if at least one section has an audio file
    for (let section of sections) {
      const sectionNumber = section.dataset.section;
      const audioFileInput = document.getElementById(`audioFile${sectionNumber}`);
      if (audioFileInput && audioFileInput.files[0]) {
        hasAudio = true;
        break;
      }
    }
  }
  
  if (!hasAudio) {
    alert("Please upload at least one audio file");
    return false;
  }

  return true;
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");
  const loader = document.getElementById("loader");

  submitBtn.disabled = true;
  submitText.textContent = "Adding test...";
  loader.style.display = "inline-block";

  try {
    // Upload audio files first
    const sections = document.querySelectorAll(".section-container");
    const audioUrls = {};

    if (audioUploadType === 'single') {
      // Upload single audio file for all sections
      console.log(`🎵 Uploading single audio file for test ${nextTestNumber}...`);
      const audioUrl = await uploadAudioFile(singleAudioFile, nextTestNumber, 0);
      
      // Assign same audio URL to all sections
      sections.forEach(section => {
        const sectionNumber = parseInt(section.dataset.section);
        audioUrls[sectionNumber] = audioUrl;
      });
    } else {
      // Upload separate audio files for each section
      for (let section of sections) {
        const sectionNumber = parseInt(section.dataset.section);
        const audioFileInput = document.getElementById(`audioFile${sectionNumber}`);
        const audioFile = audioFileInput ? audioFileInput.files[0] : null;
        
        console.log(`🎵 Uploading audio for section ${sectionNumber}...`);
        const audioUrl = await uploadAudioFile(audioFile, nextTestNumber, sectionNumber);
        audioUrls[sectionNumber] = audioUrl;
      }
    }

    // Collect test data
    const testData = collectTestData();

    // Add audio URLs to sections
    testData.parts.sections.forEach((section, index) => {
      section.audioUrl = audioUrls[section.sectionNumber];
    });

    console.log("💾 Saving test data:", testData);

    const docId = `test-${nextTestNumber}`;
    await setDoc(doc(db, "listeningTests", docId), testData);
    console.log("✅ Test added with ID:", docId);

    const successModal = document.getElementById("successModal");
    const successMessage = document.getElementById("successMessage");
    successMessage.textContent = `Listening Test ${nextTestNumber} has been added successfully!`;
    successModal.style.display = "flex";

    nextTestNumber++;
  } catch (error) {
    console.error("❌ Error adding test:", error);
    alert(`❌ Error adding test: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = "Add Listening Test";
    loader.style.display = "none";
  }
}

// Reset form for adding another test
window.resetForm = function () {
  document.getElementById("successModal").style.display = "none";

  document.getElementById("sectionsContainer").innerHTML = "";
  document.getElementById("testTitle").value = "";
  document.getElementById("timeLimit").value = "30";
  sectionCount = 0;
  questionIdCounter = 0;

  updateSectionCount();
  updateAddSectionButton();

  getNextTestNumber();

  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎧 Listening Test Add page loaded");

  await checkAdminAccess();

  await getNextTestNumber();

  document
    .getElementById("addSectionBtn")
    .addEventListener("click", addSection);
  document.getElementById("previewBtn").addEventListener("click", previewTest);
  document
    .getElementById("listeningTestForm")
    .addEventListener("submit", handleFormSubmit);

  // Add first section by default
  addSection();

  // Setup audio upload type change handler
  document.querySelectorAll('input[name="audioUploadType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      audioUploadType = this.value;
      const singleAudioUpload = document.getElementById('singleAudioUpload');
      const sectionsContainer = document.getElementById('sectionsContainer');
      
      if (this.value === 'single') {
        singleAudioUpload.style.display = 'block';
        // Hide individual audio uploads in sections
        sectionsContainer.querySelectorAll('.audio-upload').forEach(upload => {
          upload.style.display = 'none';
        });
      } else {
        singleAudioUpload.style.display = 'none';
        // Show individual audio uploads in sections
        sectionsContainer.querySelectorAll('.audio-upload').forEach(upload => {
          upload.style.display = 'block';
        });
      }
    });
  });
  
  // Show single audio upload initially (since single is checked by default)
  document.getElementById('singleAudioUpload').style.display = 'block';
  
  console.log("✅ Page initialized successfully");
});
