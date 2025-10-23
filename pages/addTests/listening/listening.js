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
        <label>Section Title *</label>
        <input type="text" class="section-title-input" placeholder="e.g., Transport survey" required>
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
        <h4>Section Instructions</h4>
        <div class="instructions-row">
          <div class="form-group">
            <label>Heading</label>
            <input type="text" class="instructions-heading" placeholder="e.g., Questions 1-10">
          </div>
          <div class="form-group">
            <label>Details</label>
            <input type="text" class="instructions-details" placeholder="e.g., Complete the notes below.">
          </div>
          <div class="form-group">
            <label>Note</label>
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
          <input type="text" placeholder="Group instruction (optional)" class="group-instruction">
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
          <input type="text" placeholder="Group instruction (optional)" class="group-instruction">
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
          <input type="text" placeholder="Group instruction (optional)" class="group-instruction">
          
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
                        <option value="text">Text</option>
                        <option value="question">Question (2_____)</option>
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="example">Example</option>
                      </select>
                      <div class="cell-content">
                        <input type="text" class="cell-input" placeholder="Cell content" data-question-number="1">
                      </div>
                      <button type="button" class="add-question-in-cell-btn" onclick="addQuestionToCell(this, ${questionId}, 0, 0)" title="Add another question">+</button>
                    </td>
                    <td class="data-cell">
                      <select class="cell-type" onchange="updateCellType(this, ${questionId}, 0, 1)">
                        <option value="text">Text</option>
                        <option value="question" selected>Question (2_____)</option>
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="example">Example</option>
                      </select>
                      <div class="cell-content">
                        <input type="text" class="cell-input" placeholder="Cell content" data-question-number="2">
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
          <input type="text" placeholder="Group instruction (e.g., Questions 11-15 Choose TWO letters, A-E.)" class="group-instruction">
          <select class="group-type" style="margin-bottom: 10px;">
            <option value="multi-select">Multi Select</option>
            <option value="matching">Matching</option>
          </select>
          <input type="text" placeholder="Question text" class="question-text">
          
          <div class="group-options">
            <label>Options:</label>
            <div class="options-list" id="options-list-${questionId}">
              <div class="option-item">
                <input type="text" value="A" class="option-label" style="width: 30px; text-align: center;">
                <input type="text" placeholder="Option A text" class="option-text">
                <button type="button" onclick="removeOption(this)" style="padding: 2px 8px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
              </div>
              <div class="option-item">
                <input type="text" value="B" class="option-label" style="width: 30px; text-align: center;">
                <input type="text" placeholder="Option B text" class="option-text">
                <button type="button" onclick="removeOption(this)" style="padding: 2px 8px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
              </div>
            </div>
            <button type="button" onclick="addOption(${questionId})" style="margin-top: 10px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>
          </div>
          
          <div class="group-questions">
            <label>Individual Questions:</label>
            <div class="questions-list" id="group-questions-list-${questionId}">
              <div class="group-question-item">
                <input type="text" placeholder="Question/Statement" class="group-question-text">
                <input type="text" placeholder="Correct answer (A, B, C, etc.)" class="group-question-answer">
                <button type="button" onclick="removeGroupQuestion(this)" style="padding: 2px 8px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
              </div>
            </div>
            <button type="button" onclick="addGroupQuestion(${questionId})" style="margin-top: 10px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Question</button>
          </div>
          
          <div class="group-answer-section">
            <label>Group Answer:</label>
            <input type="text" placeholder="Enter correct answers separated by commas (e.g., A,B,C)" class="group-correct-answers">
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
    cell.innerHTML = `
      <select class="cell-type" onchange="updateCellType(this, ${questionId}, ${rowIndex}, ${columnIndex})">
        <option value="text">Text</option>
        <option value="question">Question (${questionNumber}_____)</option>
        <option value="multiple-choice">Multiple Choice</option>
        <option value="true-false">True/False</option>
        <option value="example">Example</option>
      </select>
      <div class="cell-content">
        <input type="text" class="cell-input" placeholder="Cell content" data-question-number="${questionNumber}">
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
  
  for (let i = 0; i < columnCount; i++) {
    const cell = document.createElement('td');
    cell.className = 'data-cell';
    const questionNumber = getNextQuestionNumber(questionId);
    cell.innerHTML = `
      <select class="cell-type" onchange="updateCellType(this, ${questionId}, ${tbody.children.length}, ${i})">
        <option value="text">Text</option>
        <option value="question">Question (${questionNumber}_____)</option>
        <option value="multiple-choice">Multiple Choice</option>
        <option value="true-false">True/False</option>
        <option value="example">Example</option>
      </select>
      <div class="cell-content">
        <input type="text" class="cell-input" placeholder="Cell content" data-question-number="${questionNumber}">
      </div>
      <button type="button" class="add-question-in-cell-btn" onclick="addQuestionToCell(this, ${questionId}, ${tbody.children.length}, ${i})" title="Add another question">+</button>
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

// Helper function to get next question number based on content patterns
function getNextQuestionNumber(questionId) {
  const table = document.getElementById(`question-table-${questionId}`);
  const existingQuestions = table.querySelectorAll('.cell-input[data-question-number]');
  let maxNumber = 0;
  
  // First, check existing data-question-number attributes
  existingQuestions.forEach(input => {
    const number = parseInt(input.getAttribute('data-question-number'));
    if (number > maxNumber) maxNumber = number;
  });
  
  // Also check content patterns like "1_____", "2_____", etc.
  const allInputs = table.querySelectorAll('.cell-input');
  allInputs.forEach(input => {
    const content = input.value.trim();
    const match = content.match(/^(\d+)_____/);
    if (match) {
      const number = parseInt(match[1]);
      if (number > maxNumber) maxNumber = number;
    }
  });
  
  return maxNumber + 1;
}

// Update question numbers in table based on content patterns
function updateQuestionNumbersInTable(questionId) {
  const table = document.getElementById(`question-table-${questionId}`);
  if (!table) return;
  
  const cellInputs = table.querySelectorAll('.cell-input');
  const questionNumbers = new Set();
  
  // First pass: collect all question numbers from content
  cellInputs.forEach(input => {
    const content = input.value.trim();
    const match = content.match(/^(\d+)_____/);
    if (match) {
      const number = parseInt(match[1]);
      questionNumbers.add(number);
      // Update data-question-number attribute
      input.setAttribute('data-question-number', number);
    }
  });
  
  // Second pass: update data-question-number for inputs without content patterns
  cellInputs.forEach(input => {
    const content = input.value.trim();
    if (!content.match(/^\d+_____/) && input.getAttribute('data-question-number')) {
      // Keep existing number if no pattern match
      const existingNumber = input.getAttribute('data-question-number');
      questionNumbers.add(parseInt(existingNumber));
    }
  });
  
  console.log(`📊 Updated question numbers for table ${questionId}:`, Array.from(questionNumbers).sort((a, b) => a - b));
}

// Update cell type and regenerate content
window.updateCellType = function(select, questionId, rowIndex, colIndex) {
  const cell = select.closest('.data-cell');
  const cellContent = cell.querySelector('.cell-content');
  const questionNumber = select.closest('.data-cell').querySelector('.cell-input').getAttribute('data-question-number');
  const cellType = select.value;
  
  let contentHTML = '';
  
  switch(cellType) {
    case 'text':
      contentHTML = `<input type="text" class="cell-input" placeholder="Cell content" data-question-number="${questionNumber}">`;
      break;
    case 'question':
      contentHTML = `<input type="text" class="cell-input" placeholder="Cell content" data-question-number="${questionNumber}">`;
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
      break;
    case 'example':
      contentHTML = `<input type="text" class="cell-input" placeholder="Example content" data-question-number="${questionNumber}">`;
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
  
  // Create separator
  const separator = document.createElement('div');
  separator.className = 'question-separator';
  separator.innerHTML = '<hr><span>Question ' + nextQuestionNumber + '</span>';
  
  // Create new question content based on type
  let newQuestionHTML = '';
  
  switch(cellType) {
    case 'text':
      newQuestionHTML = `<input type="text" class="cell-input" placeholder="Cell content" data-question-number="${nextQuestionNumber}">`;
      break;
    case 'question':
      newQuestionHTML = `<input type="text" class="cell-input" placeholder="Cell content" data-question-number="${nextQuestionNumber}">`;
      break;
    case 'multiple-choice':
      newQuestionHTML = `
        <div class="mc-cell-content">
          <input type="text" class="cell-input" placeholder="Question text" data-question-number="${nextQuestionNumber}">
          <div class="mc-options">
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
    case 'example':
      newQuestionHTML = `<input type="text" class="cell-input" placeholder="Example content" data-question-number="${nextQuestionNumber}">`;
      break;
  }
  
  const newQuestionDiv = document.createElement('div');
  newQuestionDiv.className = 'additional-question';
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
      <input type="text" value="${nextLetter}" class="option-label" style="width: 30px; text-align: center;">
      <input type="text" placeholder="Option ${nextLetter} text" class="option-text">
      <button type="button" onclick="removeOption(this)" style="padding: 2px 8px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
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
      <button type="button" onclick="removeGroupQuestion(this)" style="padding: 2px 8px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
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
        questionId: `q${questionId}`,
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
          
          questionData.type = "question";
          questionData.questionId = `q${questionId}`;
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
          
          questionData.type = "question";
          questionData.questionId = `q${questionId}`;
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
                const columnName = questionData.columns[cellIndex]?.toLowerCase() || `column${cellIndex + 1}`;
                
                if (cellType === "question") {
                  // Process all questions in this cell
                  const questions = cellContent.querySelectorAll('.cell-input[data-question-number]');
                  let cellValue = '';
                  
                  questions.forEach((input, qIndex) => {
                    const questionNumber = input.getAttribute('data-question-number');
                    const content = input.value.trim();
                    if (content) {
                      if (qIndex > 0) cellValue += '<br>';
                      cellValue += content.replace(/\d+_____/g, `${questionNumber}_____`);
                      
                      // Store question by its number
                      if (!questionData.questions[questionNumber]) {
                        questionData.questions[questionNumber] = {
                          questionId: `q${questionNumber}`,
                          text: content,
                          row: rowIndex,
                          column: cellIndex,
                          columnName: columnName
                        };
                      }
                    }
                  });
                  
                  rowData[columnName] = cellValue;
                } else if (cellType === "multiple-choice") {
                  // Process multiple choice questions
                  const mcQuestions = cellContent.querySelectorAll('.mc-cell-content');
                  let cellValue = '';
                  
                  mcQuestions.forEach((mcEl, qIndex) => {
                    const questionNumber = mcEl.querySelector('.cell-input').getAttribute('data-question-number');
                    const questionText = mcEl.querySelector('.cell-input').value.trim();
                    const options = mcEl.querySelectorAll('.mc-option');
                    const correctAnswer = mcEl.querySelector('input[type="radio"]:checked')?.value || '';
                    
                    if (questionText) {
                      if (qIndex > 0) cellValue += '<br><br>';
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
                  // Regular text cell
                  const questions = cellContent.querySelectorAll('.cell-input[data-question-number]');
                  let cellValue = '';
                  
                  questions.forEach((input, qIndex) => {
                    const content = input.value.trim();
                    if (content) {
                      if (qIndex > 0) cellValue += '<br>';
                      cellValue += content;
                    }
                  });
                  
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
          break;

        case "question-group":
          const groupTypeElement = questionEl.querySelector(".group-type");
          const groupType = groupTypeElement ? groupTypeElement.value : "multi-select";
          const questionGroupGroupInstruction = questionEl.querySelector(".group-instruction")?.value.trim();
          const groupQuestionTextElement = questionEl.querySelector(".question-text");
          const groupQuestionText = groupQuestionTextElement ? groupQuestionTextElement.value.trim() : "";
          
          questionData.type = "question-group";
          questionData.groupType = groupType;
          questionData.questionId = `q${questionId}`;
          if (questionGroupGroupInstruction) questionData.groupInstruction = questionGroupGroupInstruction;
          questionData.text = groupQuestionText;
          
          // Get options
          questionData.options = {};
          questionEl.querySelectorAll(".option-item").forEach(optionEl => {
            const optionLabel = optionEl.querySelector(".option-label").value.trim();
            const optionText = optionEl.querySelector(".option-text").value.trim();
            if (optionLabel && optionText) {
              questionData.options[optionLabel] = optionText;
            }
          });
          
          // Get individual questions
          questionData.questions = [];
          questionEl.querySelectorAll(".group-question-item").forEach((qEl, index) => {
            const questionTextElement = qEl.querySelector(".group-question-text");
            const correctAnswerElement = qEl.querySelector(".group-question-answer");
            const questionText = questionTextElement ? questionTextElement.value.trim() : "";
            const correctAnswer = correctAnswerElement ? correctAnswerElement.value.trim() : "";
            if (questionText && correctAnswer) {
              questionData.questions.push({
                questionId: `q${questionId}_${index + 1}`,
                text: questionText,
                correctAnswer: correctAnswer
              });
            }
          });
          
          // Get group answer
          const groupAnswerElement = questionEl.querySelector(".group-correct-answers");
          if (groupAnswerElement && groupAnswerElement.value.trim()) {
            questionData.groupAnswer = groupAnswerElement.value.trim();
          }
          
          if (groupType === "multi-select") {
            questionData.instructions = questionEl.querySelector(".question-select-count")?.value.trim();
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
          const multiSelectGroupInstruction = questionEl.querySelector(".group-instruction");
          questionData.groupInstruction = multiSelectGroupInstruction ? multiSelectGroupInstruction.value.trim() : "";
          const multiSelectText = questionEl.querySelector(".question-text");
          questionData.text = multiSelectText ? multiSelectText.value.trim() : "";
          const multiSelectInstructions = questionEl.querySelector(".question-select-count");
          questionData.instructions = multiSelectInstructions ? multiSelectInstructions.value.trim() : "";
          const multiSelectAnswer = questionEl.querySelector(".question-answer");
          questionData.correctAnswers = multiSelectAnswer ? multiSelectAnswer.value.trim().split(",").map(a => a.trim()).filter(a => a) : [];
          
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
          break;

        case "matching":
          questionData.groupType = "matching";
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
          
          // Get matching questions
          questionData.questions = [];
          sectionEl.querySelectorAll(".matching-question").forEach((matchQ, index) => {
            const questionTextElement = matchQ.querySelector(".matching-question-text");
            const correctAnswerElement = matchQ.querySelector(".matching-answer");
            const questionText = questionTextElement ? questionTextElement.value.trim() : "";
            const correctAnswer = correctAnswerElement ? correctAnswerElement.value.trim() : "";
            if (questionText && correctAnswer) {
              questionData.questions.push({
                questionId: `q${questionId}_${index + 1}`,
                text: questionText,
                correctAnswer: correctAnswer,
              });
            }
          });
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
        totalQuestions: sections.reduce((total, section) => total + section.content.length, 0),
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
    const title = section.querySelector(".section-title-input").value.trim();
    const questions = section.querySelectorAll(".question-item");

    if (!title) {
      alert("Please enter a title for all sections");
      return false;
    }

    // Check audio only if separate audio mode is selected
    if (audioUploadType === 'separate') {
      const sectionNumber = section.dataset.section;
      const audioFileInput = document.getElementById(`audioFile${sectionNumber}`);
      console.log(`🔍 Checking audio for section ${sectionNumber}:`, {
        audioFileInput: audioFileInput,
        hasFiles: audioFileInput ? audioFileInput.files.length : 0,
        fileName: audioFileInput && audioFileInput.files[0] ? audioFileInput.files[0].name : 'none'
      });
      
      if (!audioFileInput || !audioFileInput.files[0]) {
        alert("Please upload an audio file for all sections");
        return false;
      }
    }

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

      // Check question text only for types that have it
      if (type !== "table") {
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
        console.log(`🔍 Skipping question text validation for table type`);
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
          
          // Check cell inputs - only check cells that are not empty (have content)
          const dataRows = table.querySelectorAll(".data-row");
          for (let row of dataRows) {
            const cells = row.querySelectorAll(".data-cell");
            for (let cell of cells) {
              const cellType = cell.querySelector(".cell-type").value;
              const cellContent = cell.querySelector(".cell-content");
              
              if (cellType === "question" || cellType === "text") {
                const cellInputs = cellContent.querySelectorAll(".cell-input");
                for (let input of cellInputs) {
                  if (!input.value.trim()) {
                    alert("Please fill in all table cells");
                    return false;
                  }
                }
              } else if (cellType === "multiple-choice") {
                const mcQuestions = cellContent.querySelectorAll(".mc-cell-content");
                for (let mcEl of mcQuestions) {
                  const questionText = mcEl.querySelector(".cell-input").value.trim();
                  if (!questionText) {
                    alert("Please fill in all table cells");
                    return false;
                  }
                  
                  const options = mcEl.querySelectorAll(".mc-option-text");
                  for (let option of options) {
                    if (!option.value.trim()) {
                      alert("Please fill in all table cell options");
                      return false;
                    }
                  }
                }
              }
            }
          }
        }
      } else if (type === "question-group") {
        const groupQuestionTextElement = question.querySelector(".question-text");
        if (!groupQuestionTextElement || !groupQuestionTextElement.value.trim()) {
          alert("Please fill in question text for all question group questions");
          return false;
        }
        
        // Check if options are filled
        const optionItems = question.querySelectorAll(".option-item");
        for (let optionItem of optionItems) {
          const optionText = optionItem.querySelector(".option-text");
          if (!optionText || !optionText.value.trim()) {
            alert("Please fill in all option texts for question group questions");
            return false;
          }
        }
        
        // Check if individual questions are filled
        const groupQuestionItems = question.querySelectorAll(".group-question-item");
        for (let groupQuestionItem of groupQuestionItems) {
          const questionText = groupQuestionItem.querySelector(".group-question-text");
          const answer = groupQuestionItem.querySelector(".group-question-answer");
          
          if (!questionText || !questionText.value.trim()) {
            alert("Please fill in all individual question texts for question group questions");
            return false;
          }
          
          if (!answer || !answer.value.trim()) {
            alert("Please provide answers for all individual questions in question group questions");
            return false;
          }
        }
        
        // Check group answer field
        const groupAnswerElement = question.querySelector(".group-correct-answers");
        if (!groupAnswerElement || !groupAnswerElement.value.trim()) {
          alert("Please provide the group answer for question group questions");
          return false;
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

  // Check single audio file if single audio mode is selected
  if (audioUploadType === 'single' && !singleAudioFile) {
    alert("Please upload the complete test audio file");
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
