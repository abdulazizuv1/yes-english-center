import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "/config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// State Variables
let currentTest = null;
let testId = getTestIdFromUrl();
let nextSectionNumber = 1;
let nextQuestionNumber = 1;
let totalQuestionCount = 0;
let audioUploadType = 'single'; // 'single' or 'separate'
let singleAudioFile = null;
let singleAudioUrl = '';
let questionIdCounter = 0;

// Get test ID from URL parameters
function getTestIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("testId");
}

// Authentication check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data().role === "admin") {
        await loadTest();
      } else {
        alert("Access Denied: You must be an admin to view this page.");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  } else {
    window.location.href = "/pages/auth/";
  }
});

// Load test data from Firebase
async function loadTest() {
  try {
    if (!testId) {
      throw new Error("No test ID provided in the URL.");
    }
    const testDocRef = doc(db, "listeningTests", testId);
    const testDoc = await getDoc(testDocRef);

    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }

    currentTest = testDoc.data();

    // Hide loading, show content
    document.getElementById("loadingContainer").style.display = "none";
    document.getElementById("listeningTestForm").style.display = "block";

    // Populate fundamental test info based on parts structure
    const parts = currentTest.parts || {};
    populateTestInfo(parts);
    
    // Set audio type based on sections logic
    determineInitialAudioType(parts.sections);

    // Display sections
    if (parts.sections && parts.sections.length > 0) {
      displaySections(parts.sections);
    } else {
      // Default initial state if corrupted or empty
      window.addSection();
    }
    
  } catch (error) {
    console.error("Error loading test:", error);
    document.getElementById("loadingContainer").innerHTML = `
      <div style="color: #f44336; text-align: center; padding: 50px;">
        <h3>❌ Error loading test</h3>
        <p>${error.message}</p>
        <button onclick="location.href='/pages/dashboard/#/admin'" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Return to Dashboard
        </button>
      </div>
    `;
  }
}

// Populate basic test information
function populateTestInfo(parts) {
  document.getElementById("testNumberBadge").textContent = parts.testId || testId;
  document.getElementById("testTitle").textContent = `Edit ${currentTest.title || 'Listening Test'}`;
  
  const titleInput = document.getElementById("testTitleInput");
  if (titleInput) titleInput.value = currentTest.title || "";
  
  const timeLimitInput = document.getElementById("timeLimit");
  if (timeLimitInput && parts.metadata && parts.metadata.timeLimit) {
    timeLimitInput.value = parts.metadata.timeLimit;
  }
}

// Determine initially loaded Audio Upload Type
function determineInitialAudioType(sections) {
  if (currentTest.parts && currentTest.parts.audioUrl) {
      document.getElementById("singleAudio").checked = true;
      audioUploadType = 'single';
      singleAudioUrl = currentTest.parts.audioUrl;
      document.getElementById("singleAudioUpload").style.display = "block";
      
      const preview = document.getElementById("singleAudioPreview");
      const name = document.getElementById("singleAudioPreviewName");
      const player = document.getElementById("singleAudioPlayer");
      
      preview.style.display = "flex";
      name.textContent = "Existing Test Audio (Firebase)";
      document.getElementById("singleAudioPreviewSize").textContent = ""; 
      player.src = singleAudioUrl;
      document.getElementById("singleAudioUploadArea").style.display = "none";
  } else {
      let hasSeparateAudio = false;
      if (sections) {
          sections.forEach(sec => {
              if (sec.audioUrl) hasSeparateAudio = true;
          });
      }
      
      if (hasSeparateAudio) {
          document.getElementById("separateAudio").checked = true;
          audioUploadType = 'separate';
          document.getElementById("singleAudioUpload").style.display = "none";
      } else {
          document.getElementById("singleAudio").checked = true;
          audioUploadType = 'single';
          document.getElementById("singleAudioUpload").style.display = "block";
      }
  }
}

// Upload audio file to Firebase Storage
async function uploadAudioFile(file, testNumber, sectionNumber) {
  try {
    const fileName = `part${sectionNumber}.mp3`;
    const storagePath = `listening-audio/test-${testNumber}/${fileName}`;
    const storageRef = ref(storage, storagePath);
    
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error("❌ Error uploading audio file:", error);
    throw error;
  }
}

// Display existing sections from database
function displaySections(sections) {
  const container = document.getElementById("sectionsContainer");
  if (container) container.innerHTML = "";
  
  if (!sections || sections.length === 0) {
    window.addSection();
    return;
  }
  
  sections.forEach((sectionData, index) => {
    const sectionNumber = sectionData.sectionNumber || (index + 1);
    addSectionComponent(sectionNumber, sectionData);
    if (sectionNumber >= nextSectionNumber) {
      nextSectionNumber = sectionNumber + 1;
    }
  });
  
  updateSectionCount();
  updateAddSectionButton();
}

function addSectionComponent(sectionNumber, sectionData) {
  let title = "";
  let heading = "";
  let details = "";
  let note = "";
  let audioUrl = "";
  
  if (sectionData) {
    title = sectionData.title ? sectionData.title.replace(/"/g, '&quot;') : "";
    if (sectionData.instructions) {
      heading = sectionData.instructions.heading ? sectionData.instructions.heading.replace(/"/g, '&quot;') : "";
      details = sectionData.instructions.details ? sectionData.instructions.details.replace(/"/g, '&quot;') : "";
      note = sectionData.instructions.note ? sectionData.instructions.note.replace(/"/g, '&quot;') : "";
    }
    audioUrl = sectionData.audioUrl || "";
  }
  
  const sectionHTML = `
    <div class="section-container" data-section="${sectionNumber}">
      <div class="section-header">
        <div class="section-title">
          <span class="section-number">${sectionNumber}</span>
          Section ${sectionNumber}
        </div>
        ${
          sectionNumber > 1 || sectionData
            ? `<button type="button" class="remove-section-btn" onclick="removeSection(${sectionNumber})">Remove Section</button>`
            : ""
        }
      </div>
      
      <div class="form-group">
        <label>Section Title</label>
        <input type="text" class="section-title-input" placeholder="e.g., Transport survey" value="${title}">
      </div>
      
      <div class="audio-upload" id="audioUpload${sectionNumber}" style="display: ${audioUploadType === 'separate' ? 'block' : 'none'};">
        <input type="file" id="audioFile${sectionNumber}" accept="audio/*" onchange="handleAudioUpload(${sectionNumber})">
        <label for="audioFile${sectionNumber}" class="audio-upload-label" style="${audioUrl ? 'display:none;' : ''}" id="audioUploadArea${sectionNumber}">
          <svg class="audio-upload-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          <div class="audio-upload-text">Upload Audio File</div>
          <div class="audio-upload-hint">Click to select or drag and drop audio file (MP3, WAV, etc.)</div>
        </label>
      </div>
      
      <div class="audio-preview ${audioUrl ? 'show' : ''}" id="audioPreview${sectionNumber}">
        <div class="audio-preview-info">
          <span class="audio-preview-name" id="audioPreviewName${sectionNumber}">${audioUrl ? 'Existing Test Audio' : ''}</span>
          <span class="audio-preview-size" id="audioPreviewSize${sectionNumber}"></span>
        </div>
        <div class="audio-preview-controls">
          <button type="button" onclick="playAudio(${sectionNumber})">▶ Play</button>
          <button type="button" onclick="pauseAudio(${sectionNumber})">⏸ Pause</button>
          <button type="button" onclick="removeAudio(${sectionNumber})" class="remove-audio">🗑 Remove</button>
        </div>
        <audio id="audioPlayer${sectionNumber}" style="display: none;" src="${audioUrl}"></audio>
      </div>
      
      <div class="instructions-section">
        <h4>Section Instructions *</h4>
        <div class="instructions-row">
          <div class="form-group">
            <label>Heading *</label>
            <input type="text" class="instructions-heading" placeholder="e.g., Questions 1-10" value="${heading}">
          </div>
          <div class="form-group">
            <label>Details *</label>
            <input type="text" class="instructions-details" placeholder="e.g., Complete the notes below." value="${details}">
          </div>
          <div class="form-group">
            <label>Note *</label>
            <input type="text" class="instructions-note" placeholder="e.g., Write ONE WORD AND/OR A NUMBER for each answer." value="${note}">
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

  document.getElementById("sectionsContainer").insertAdjacentHTML("beforeend", sectionHTML);
  
  if (sectionData && sectionData.content && sectionData.content.length > 0) {
    sectionData.content.forEach((qItem) => {
      if (qItem.type === "question") {
        if (qItem.format === "gap-fill") addGapFillQuestion(sectionNumber, qItem);
        else if (qItem.format === "multiple-choice") addMultipleChoiceQuestion(sectionNumber, qItem);
      } else if (qItem.type === "table") {
        addTableQuestion(sectionNumber, qItem);
      } else if (qItem.type === "question-group") {
        addQuestionGroup(sectionNumber, qItem);
      } else if (qItem.type === "text") {
        addTextContent(sectionNumber, qItem);
      } else if (qItem.type === "subheading") {
        addSubheading(sectionNumber, qItem);
      }
    });
  }
  
  renumberSections(); // Update z-indexes to ensure dropdowns overlap subsequent sections

  updateSectionCount();
  updateAddSectionButton();
  setupDragAndDrop(sectionNumber);
}

// Add a new empty section
window.addSection = function() {
  const sectionsCount = document.querySelectorAll(".section-container").length;
  if (sectionsCount >= 4) {
    alert("Maximum 4 sections allowed per listening test");
    return;
  }

  const sectionNumber = nextSectionNumber++;
  addSectionComponent(sectionNumber, null);
  updateSectionCount();
  updateAddSectionButton();
}

// Update counters visually
function updateSectionCount() {
  const sections = document.querySelectorAll(".section-container");
  document.getElementById("sectionCount").textContent = sections.length;
}

function updateAddSectionButton() {
  const sectionsCount = document.querySelectorAll(".section-container").length;
  const addBtn = document.getElementById("addSectionBtn");
  if (addBtn) {
    addBtn.style.display = sectionsCount >= 4 ? "none" : "flex";
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
      window.handleAudioUpload(sectionNumber);
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
    const uploadArea = document.getElementById(`audioUploadArea${sectionNumber}`);
    
    fileInput.value = '';
    preview.classList.remove('show');
    audioPlayer.src = '';
    audioPlayer.dataset.fileName = '';
    
    if (uploadArea) {
       uploadArea.style.display = 'flex';
    }
  }
};

// Toggle question type menu
window.toggleQuestionMenu = function (sectionNumber) {
  const menu = document.getElementById(`questionMenu${sectionNumber}`);
  
  if (!menu) {
    console.error(`❌ Menu not found for section ${sectionNumber}`);
    return;
  }
  
  menu.classList.toggle("show");

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
  
  // Auto-update global numbers
  window.updateGlobalQuestionNumbers();
  
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
      window.updateGlobalQuestionNumbers(); // Update global numbers after removal
    }
  };
  separator.appendChild(removeBtn);
  
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
  
};

// Question Group functions
window.addOption = function (questionId) {
  const optionsList = document.getElementById(`options-list-${questionId}`);
  let maxCode = 64;
  optionsList.querySelectorAll(".option-label").forEach((labelInput) => {
    const val = labelInput.value.trim();
    if (val.length === 1) {
      const code = val.charCodeAt(0);
      if (code > maxCode && code >= 65 && code <= 90) maxCode = code;
    }
  });
  const nextLetter = String.fromCharCode(maxCode + 1);

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
  window.updateGlobalQuestionNumbers(); // Update global numbers after adding a group question
};

window.removeGroupQuestion = function(button) {
  const questionsList = button.closest(".questions-list");
  if (questionsList.querySelectorAll(".group-question-item").length <= 1) {
    alert("Question group must have at least one question");
    return;
  }
  
  if (confirm("Remove this question?")) {
    button.closest(".group-question-item").remove();
    window.updateGlobalQuestionNumbers(); // Update global numbers after removal
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
  window.updateGlobalQuestionNumbers(); // Update global numbers after group type change
};

// Single Question functions
window.addMCOptionToQuestion = function(questionId) {
  const optionsList = document.querySelector(`[data-question-id="${questionId}"] .mc-options-list`);
  let maxCode = 64;
  optionsList.querySelectorAll('input[type="radio"]').forEach((radio) => {
    const val = radio.value;
    if (val.length === 1) {
      const code = val.charCodeAt(0);
      if (code > maxCode && code >= 65 && code <= 90) maxCode = code;
    }
  });
  const nextLetter = String.fromCharCode(maxCode + 1);

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
  window.updateGlobalQuestionNumbers(); // Update global numbers after adding a matching question
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
    window.updateGlobalQuestionNumbers(); // Update global numbers after removal
  }
};

// Add option for Multiple Choice
window.addMCOption = function (questionId) {
  const container = document.getElementById(`mc-options-${questionId}`);
  let maxCode = 64;
  container.querySelectorAll('input[type="radio"]').forEach((radio) => {
    const val = radio.value;
    if (val.length === 1) {
      const code = val.charCodeAt(0);
      if (code > maxCode && code >= 65 && code <= 90) maxCode = code;
    }
  });
  const nextLetter = String.fromCharCode(maxCode + 1);

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
    window.updateGlobalQuestionNumbers(); // Update global numbers after removal
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
      updateSectionCount();
      updateAddSectionButton();
      renumberSections();
      window.updateGlobalQuestionNumbers(); // Update global numbers after section removal
    }
  }
};

// Renumber sections after removal and update z-indexes
function renumberSections() {
  const sections = document.querySelectorAll(".section-container");
  const totalSections = sections.length;
  sections.forEach((section, index) => {
    const newNumber = index + 1;
    section.dataset.section = newNumber;
    section.style.zIndex = totalSections - index; // Ensure earlier sections have higher z-index so dropdowns overlap later sections
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
  // The closing brace for renumberSections was missing, adding it here.
  // This was an existing syntax error in the provided document.
}

// Dynamically recalculate all question numbers globally across all sections
window.updateGlobalQuestionNumbers = function() {
  const allSections = Array.from(document.querySelectorAll('.section-container')).sort((a, b) => {
    return parseInt(a.dataset.section) - parseInt(b.dataset.section);
  });
  
  let globalCount = 1;
  
  allSections.forEach(section => {
    // Only count components that are actually numbered questions (not text or subheadings)
    const questions = section.querySelectorAll('.question-item');
    questions.forEach((qEl) => {
      const type = qEl.dataset.type;
      
      // Question header updating for gap-fill, multiple-choice, table, and question-group
      if (['gap-fill', 'multiple-choice', 'table', 'question-group'].includes(type) && !qEl.dataset.isMatchingItem) {
        
        if (type === 'table') {
           // Tables calculate their internal questions, but the header just needs a single label if we wanted
           // Currently logic for editListening might just label "Table", but we'll try to update internal inputs if needed
           const tableInputs = qEl.querySelectorAll('.cell-input');
           const dataCells = qEl.querySelectorAll('.data-cell');
           dataCells.forEach(cell => {
             const select = cell.querySelector('.cell-type');
             if (select && select.value !== 'text' && select.value !== 'example') {
               const input = cell.querySelector('.cell-input');
               if (input) {
                 // The actual renumbering for table cells depends on your logic, 
                 // often it's too volatile to renumber sequentially if inputs are shared
                 // but we can increment the global count 
                 if (select.value === 'question') {
                    // It counts as a question
                    globalCount++;
                 } else if (select.value === 'multiple-choice') {
                    const extraMcQs = cell.querySelectorAll('.mc-cell-content');
                    if (extraMcQs.length > 0) {
                      globalCount += extraMcQs.length;
                    } else {
                      globalCount++; // the main select one
                    }
                 }
               }
             }
           });
        } 
        else if (type === 'question-group') {
           // Groups increment count based on their options or internal items
           const groupTypeSelect = qEl.querySelector(".group-type");
           const groupType = groupTypeSelect ? groupTypeSelect.value : "multi-select";
           const strongLabel = qEl.querySelector('.question-header strong');
           
           if (groupType === "multi-select") {
              const answersInput = qEl.querySelector('.group-correct-answers');
              let numAnswers = 1;
              if (answersInput && answersInput.value) {
                 numAnswers = answersInput.value.split(',').filter(a => a.trim()).length;
                 if (numAnswers === 0) numAnswers = 1;
              }
              if (strongLabel) {
                 if (numAnswers > 1) {
                    strongLabel.textContent = `Q${globalCount} - ${globalCount + numAnswers - 1}.`;
                 } else {
                    strongLabel.textContent = `Q${globalCount}.`;
                 }
              }
              globalCount += numAnswers;
           } else if (groupType === "matching") {
              const matchingQuestions = qEl.querySelectorAll('.group-question-item, .matching-question');
              matchingQuestions.forEach((mq, idx) => {
                 const labelSpan = mq.querySelector('.matching-q-label') || mq.querySelector('.group-q-label');
                 if (labelSpan) {
                     labelSpan.textContent = `Q${globalCount}.`;
                 }
                 globalCount++;
              });
              if (strongLabel) {
                 strongLabel.textContent = "Matching questions"; 
              }
           }
        } 
        else {
           // gap-fill or multiple-choice
           const strongLabel = qEl.querySelector('.question-header strong');
           if (strongLabel) {
             strongLabel.textContent = `Q${globalCount}.`;
           }
           globalCount++;
        }
      }
    });
  });
  
  // Update the master variables
  totalQuestionCount = globalCount - 1;
  nextQuestionNumber = globalCount;
};


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
  const testTitle = document.getElementById("testTitleInput").value.trim();
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
        case "text": {
          const textValue = questionEl.querySelector(".question-value").value.trim();
          questionData.type = "text";
          if (textValue) questionData.value = textValue;
          break;
        }

        case "subheading": {
          const subheadingValue = questionEl.querySelector(".question-value").value.trim();
          questionData.type = "subheading";
          if (subheadingValue) {
            questionData.value = subheadingValue;
          }
          break;
        }

        case "gap-fill": {
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
        }

        case "multiple-choice": {
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
        }


        case "table": {
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
          console.log({
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
        }

        case "question-group": {
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
        }

        // Duplicate case-blocks removed. The types "gap-fill", "multiple-choice",
        // "multi-select", and "matching" are already handled earlier in this switch.
      }

      sectionData.content.push(questionData);
    });

    sections.push(sectionData);
  });

  return {
    title: testTitle,
    parts: {
      testId: testId,
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

// Validate form (Returns object: { isValid: boolean, emptyFieldsAlert: boolean })
function validateForm() {
  
  const testTitle = document.getElementById("testTitleInput").value.trim();
  const timeLimit = document.getElementById("timeLimit").value;
  const sections = document.querySelectorAll(".section-container");

  if (!testTitle) {
    alert("Please enter a test title before saving.");
    return { isValid: false, emptyFieldsAlert: false };
  }

  if (!timeLimit || parseInt(timeLimit) < 10) {
    alert("Please enter a valid time limit (minimum 10 minutes)");
    return { isValid: false, emptyFieldsAlert: false };
  }

  if (sections.length === 0) {
    alert("Please add at least one section");
    return { isValid: false, emptyFieldsAlert: false };
  }
  
  let hasEmptyFields = false;

  for (let section of sections) {
    const questions = section.querySelectorAll(".question-item");

    if (questions.length === 0) {
       hasEmptyFields = true;
    }

    // Validate questions broadly
    for (let question of questions) {
      const type = question.dataset.type;
      
      if (type === "text" || type === "subheading") {
        const textElement = question.querySelector(".question-value");
        if (!textElement || !textElement.value.trim()) hasEmptyFields = true;
        continue;
      }

      if (type !== "table" && type !== "question-group") {
        const questionTextElement = question.querySelector(".question-text");
        if (!questionTextElement || !questionTextElement.value.trim()) hasEmptyFields = true;
      }

      if (type === "multiple-choice") {
        const selectedAnswer = question.querySelector('input[type="radio"]:checked');
        if (!selectedAnswer) hasEmptyFields = true;
        
        const options = question.querySelectorAll(".option-text");
        options.forEach(opt => {
          if (!opt.value.trim()) hasEmptyFields = true;
        });
      } else if (type === "gap-fill") {
        const answerElement = question.querySelector(".question-answer");
        if (!answerElement || !answerElement.value.trim()) hasEmptyFields = true;
      } else if (type === "table") {
        // Validate table completion questions
        const tableAnswersElement = question.querySelector(".table-answers-text");
        if (!tableAnswersElement || !tableAnswersElement.value.trim()) hasEmptyFields = true;
        
        // Check if all table cells are filled
        const table = question.querySelector(".question-table");
        if (table) {
          const headerInputs = table.querySelectorAll(".header-input");
          
          // Check header inputs
          for (let headerInput of headerInputs) {
            if (!headerInput.value.trim()) {
              hasEmptyFields = true;
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
                  hasEmptyFields = true;
                }
                
                // Check additional questions
                const additionalQuestions = cellContent.querySelectorAll('.additional-question');
                for (let addQ of additionalQuestions) {
                  const addInput = addQ.querySelector('.cell-input[data-question-number]');
                  if (addInput && !addInput.value.trim()) {
                    hasEmptyFields = true;
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
                    hasEmptyFields = true;
                  }
                  
                  const options = mainMcContent.querySelectorAll(".mc-option-text");
                  for (let option of options) {
                    if (!option.value.trim()) {
                      hasEmptyFields = true;
                    }
                  }
                  
                  // Check if correct answer is selected
                  const hasCorrectAnswer = mainMcContent.querySelector('input[type="radio"]:checked');
                  if (!hasCorrectAnswer) {
                    hasEmptyFields = true;
                  }
                }
                
                // Check additional MC questions
                const additionalMcQuestions = cellContent.querySelectorAll('.additional-question .mc-cell-content');
                for (let addMcEl of additionalMcQuestions) {
                  const questionText = addMcEl.querySelector(".cell-input")?.value.trim();
                  if (!questionText) {
                    hasEmptyFields = true;
                  }
                  
                  const options = addMcEl.querySelectorAll(".mc-option-text");
                  for (let option of options) {
                    if (!option.value.trim()) {
                      hasEmptyFields = true;
                    }
                  }
                  
                  // Check if correct answer is selected
                  const hasCorrectAnswer = addMcEl.querySelector('input[type="radio"]:checked');
                  if (!hasCorrectAnswer) {
                    hasEmptyFields = true;
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
          hasEmptyFields = true;
        }
        for (let optionItem of optionItems) {
          const optionText = optionItem.querySelector(".option-text");
          if (!optionText || !optionText.value.trim()) {
            hasEmptyFields = true;
          }
        }
        
        if (groupType === "multi-select") {
          // Multi-select validation
          const groupQuestionTextElement = question.querySelector(".question-text");
          if (!groupQuestionTextElement || !groupQuestionTextElement.value.trim()) {
            hasEmptyFields = true;
          }
          
          // Check group answer field
          const groupAnswerElement = question.querySelector(".group-correct-answers");
          if (!groupAnswerElement || !groupAnswerElement.value.trim()) {
            hasEmptyFields = true;
          }
        } else if (groupType === "matching") {
          // Matching validation
          const groupQuestionItems = question.querySelectorAll(".group-question-item");
          if (groupQuestionItems.length === 0) {
            hasEmptyFields = true;
          }
          for (let groupQuestionItem of groupQuestionItems) {
            const answer = groupQuestionItem.querySelector(".group-question-answer");
            
            if (!answer || !answer.value.trim()) {
              hasEmptyFields = true;
            }
          }
        }
      } else if (type === "multi-select" || type === "matching") {
        const optionsPreview = document.getElementById(`options-preview-${question.dataset.questionId}`);
        if (!optionsPreview || optionsPreview.textContent.includes("No options added yet")) {
          hasEmptyFields = true;
        }
      }
    }
  }

  // Audio Validation
  let hasAudio = false;
  if (audioUploadType === 'single') {
     const audioFileInput = document.getElementById("singleAudioFile");
     if ((audioFileInput && audioFileInput.files[0]) || singleAudioUrl) {
       hasAudio = true;
     }
  } else {
    for (let section of sections) {
      const sectionNumber = parseInt(section.dataset.section);
      const audioFileInput = document.getElementById(`audioFile${sectionNumber}`);
      const matchedSection = currentTest.parts?.sections?.find(s => s.sectionNumber === sectionNumber);
      if ((audioFileInput && audioFileInput.files[0]) || (matchedSection && matchedSection.audioUrl)) {
        hasAudio = true;
        break;
      }
    }
  }
  
  if (!hasAudio) {
    // If no audio is attached anywhere, prompt a strong warning.
    console.warn("No audio files are attached to this test.");
    // We are purposely not hard-rejecting audio for edit tests just in case, but usually it's required
  }

  return { isValid: true, emptyFieldsAlert: hasEmptyFields };
}

// Handle form submission via Confirmation Modal
async function handleFormSubmit(e) {
  e.preventDefault();

  const validationMode = validateForm();
  
  if (!validationMode.isValid) {
    return; // Hard block (e.g. no title)
  }
  
  if (validationMode.emptyFieldsAlert) {
     const confirmationModal = document.getElementById("confirmationModal");
     if (confirmationModal) {
         confirmationModal.style.display = "flex";
     } else {
         executeSaveTest(); // fallback just in case
     }
  } else {
     executeSaveTest(); // perfect, execute right away
  }
}

// Global execution function for saving after modal confirmed
window.executeSaveTest = async function() {
  const confirmationModal = document.getElementById("confirmationModal");
  if (confirmationModal) confirmationModal.style.display = "none";

  const submitBtn = document.getElementById("saveBtn");
  const submitText = document.getElementById("saveText");
  const loader = document.getElementById("saveLoader");

  submitBtn.disabled = true;
  submitText.textContent = "Saving changes...";
  loader.style.display = "inline-block";

  try {
    // Upload audio files first
    const sections = document.querySelectorAll(".section-container");
    const audioUrls = {};

    if (audioUploadType === 'single') {
      // Manage single Audio File Upload
      let finalSingleAudioUrl = singleAudioUrl; // default to existing
      
      if (singleAudioFile) {
        // user selected a new file
        finalSingleAudioUrl = await uploadAudioFile(singleAudioFile, testId.replace('ielts-listening-', ''), 0);
        singleAudioUrl = finalSingleAudioUrl;
      }
      
      // Assign same audio URL to all sections
      sections.forEach(section => {
        const sectionNumber = parseInt(section.dataset.section);
        audioUrls[sectionNumber] = finalSingleAudioUrl;
      });
    } else {
      // Upload separate audio files for each section
      for (let section of sections) {
        const sectionNumber = parseInt(section.dataset.section);
        const audioFileInput = document.getElementById(`audioFile${sectionNumber}`);
        const audioFile = audioFileInput ? audioFileInput.files[0] : null;
        
        if (audioFile) {
          audioUrls[sectionNumber] = await uploadAudioFile(audioFile, testId.replace('ielts-listening-', ''), sectionNumber);
        } else {
           // use existing url if available
           const matchedSection = currentTest.parts?.sections?.find(s => s.sectionNumber === sectionNumber);
           audioUrls[sectionNumber] = matchedSection ? matchedSection.audioUrl : "";
        }
      }
    }

    // Collect test data from building DOM tree
    const testData = collectTestData();

    // Add audio URLs to sections
    testData.parts.sections.forEach((section) => {
      section.audioUrl = audioUrls[section.sectionNumber];
    });

    // Update global single audio prop if using single
    if (audioUploadType === 'single') {
       testData.parts.audioUrl = singleAudioUrl;
    }

    // Persist to document
    const testDocRef = doc(db, "listeningTests", testId);
    
    // We only update parts and title to preserve creation dates
    await updateDoc(testDocRef, {
        title: testData.title,
        parts: testData.parts
    });

    const successModal = document.getElementById("successModal");
    const successMessage = document.getElementById("successMessage");
    successMessage.textContent = `Listening Test has been updated successfully!`;
    successModal.style.display = "flex";

  } catch (error) {
    console.error("❌ Error updating test:", error);
    alert(`❌ Error updating test: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = "Save Changes";
    loader.style.display = "none";
  }
}

// Global functions for inline HTML event handlers
window.saveTest = function() {
  document.getElementById("listeningTestForm").dispatchEvent(new Event("submit"));
};

window.goBack = function() {
    const message = "All unsaved progress will be lost. Are you sure you want to go back?";
    if (confirm(message)) {
      window.location.href = "/pages/dashboard/#/admin";
    }
}

// Initialize page DOM events exclusively
document.addEventListener("DOMContentLoaded", () => {
  // Setup audio upload type change handler
  document
    .getElementById("listeningTestForm")
    .addEventListener("submit", handleFormSubmit);

  // Setup audio upload type change handler
  document.querySelectorAll('input[name="audioUploadType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      audioUploadType = this.value;
      const singleAudioUpload = document.getElementById('singleAudioUpload');
      const sectionsContainer = document.getElementById('sectionsContainer');
      
      if (this.value === 'single') {
        singleAudioUpload.style.display = 'block';
        sectionsContainer.querySelectorAll('.audio-upload').forEach(upload => {
          upload.style.display = 'none';
        });
      } else {
        singleAudioUpload.style.display = 'none';
        sectionsContainer.querySelectorAll('.audio-upload').forEach(upload => {
          upload.style.display = 'block';
        });
      }
    });
  });
});

// Restore functions to render existing content
function addTextContent(sectionNumber, item) {
    const questionId = ++questionIdCounter;
    const container = document.getElementById(`questions${sectionNumber}`);
    
    const html = `
        <div class="question-item" data-question-id="${questionId}" data-type="text">
          <div class="question-header">
            <span class="question-type-badge text">Text</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <textarea placeholder="Text content" class="question-value" rows="3">${item.value ? item.value.replace(/</g, "&lt;") : ""}</textarea>
        </div>
    `;
    container.insertAdjacentHTML("beforeend", html);
}

function addSubheading(sectionNumber, item) {
    const questionId = ++questionIdCounter;
    const container = document.getElementById(`questions${sectionNumber}`);
    
    const html = `
        <div class="question-item" data-question-id="${questionId}" data-type="subheading">
          <div class="question-header">
            <span class="question-type-badge subheading">Subheading</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Subheading text" class="question-value" value="${item.value ? item.value.replace(/"/g, "&quot;") : ""}">
        </div>
    `;
    container.insertAdjacentHTML("beforeend", html);
}

function addGapFillQuestion(sectionNumber, item) {
    const questionId = ++questionIdCounter;
    const container = document.getElementById(`questions${sectionNumber}`);
    
    const qLabel = totalQuestionCount + 1;
    totalQuestionCount++;
    nextQuestionNumber++;

    const html = `
        <div class="question-item" data-question-id="${questionId}" data-type="gap-fill">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index">${qLabel}</span>.</span>
            <span class="question-type-badge gap-fill">Gap Fill</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (optional, use \\n for paragraphs)" class="group-instruction" value="${item.groupInstruction ? item.groupInstruction.replace(/"/g, "&quot;") : ""}">
          <input type="text" placeholder="Question text (use _____ for gaps)" class="question-text" value="${item.text ? item.text.replace(/"/g, "&quot;") : ""}">
          <input type="text" placeholder="Postfix (optional)" class="question-postfix" value="${item.postfix ? item.postfix.replace(/"/g, "&quot;") : ""}">
          <input type="text" placeholder="Correct answer" class="question-answer" value="${item.correctAnswer || ""}">
          <input type="number" placeholder="Word limit (optional)" class="question-word-limit" min="1" max="10" value="${item.wordLimit || ""}">
        </div>
    `;
    container.insertAdjacentHTML("beforeend", html);
}

function addMultipleChoiceQuestion(sectionNumber, item) {
    const questionId = ++questionIdCounter;
    const container = document.getElementById(`questions${sectionNumber}`);
    
    const qLabel = totalQuestionCount + 1;
    totalQuestionCount++;
    nextQuestionNumber++;

    let optionsSection = ``;
    if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
        optionsSection = Object.keys(item.options).map(key => {
            const optValue = key;
            const optText = item.options[key];
            return `
           <div class="mc-option-item">
             <input type="radio" name="mc-${questionId}" value="${optValue}" class="mc-radio" ${(item.correctAnswer || item.answer) === optValue ? "checked" : ""}>
             <input type="text" placeholder="Option ${optValue}" class="option-text" value="${optText ? optText.replace(/"/g, "&quot;") : ""}">
           </div>
            `;
        }).join("");
    } else if (Array.isArray(item.options)) {
        optionsSection = item.options.map(opt => {
            const optValue = opt.value || opt.id || opt;
            const optText = opt.text || opt.value || opt;
            return `
           <div class="mc-option-item">
             <input type="radio" name="mc-${questionId}" value="${optValue}" class="mc-radio" ${(item.correctAnswer || item.answer) === optValue ? "checked" : ""}>
             <input type="text" placeholder="Option ${optValue}" class="option-text" value="${optText ? optText.replace(/"/g, "&quot;") : ""}">
           </div>
            `;
        }).join("");
    } else {
        // Fallback
        optionsSection = `
           <div class="mc-option-item">
             <input type="radio" name="mc-${questionId}" value="A" class="mc-radio">
             <input type="text" placeholder="Option A" class="option-text">
           </div>
           <div class="mc-option-item">
             <input type="radio" name="mc-${questionId}" value="B" class="mc-radio">
             <input type="text" placeholder="Option B" class="option-text">
           </div>
        `;
    }

    const html = `
        <div class="question-item" data-question-id="${questionId}" data-type="multiple-choice">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index">${qLabel}</span>.</span>
            <span class="question-type-badge multiple-choice">Multiple Choice</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (optional, use \\n for paragraphs)" class="group-instruction" value="${item.groupInstruction ? item.groupInstruction.replace(/"/g, "&quot;") : ""}">
          <input type="text" placeholder="Question text" class="question-text" value="${item.text ? item.text.replace(/"/g, "&quot;") : ""}">
          <div class="question-options">
            <label>Options:</label>
            <div class="mc-options-list">
              ${optionsSection}
            </div>
            <button type="button" onclick="addMCOptionToQuestion(${questionId})" style="margin-top: 5px; padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">+ Add Option</button>
          </div>
        </div>
    `;
    container.insertAdjacentHTML("beforeend", html);
}

function addTableQuestion(sectionNumber, item) {
    const questionId = ++questionIdCounter;
    const container = document.getElementById(`questions${sectionNumber}`);
    
    // We will let the display flow naturally format questions by updating counter post-injection
    const qLabel = totalQuestionCount + 1;

    let headersHTML = "";
    if (item.columns && item.columns.length > 0) {
        item.columns.forEach((col, idx) => {
            headersHTML += `
                <th class="header-cell">
                  <input type="text" value="${col.replace(/"/g, "&quot;")}" class="header-input" placeholder="Column header">
                  <button type="button" onclick="removeTableColumn(${questionId}, ${idx})" class="remove-cell-btn">×</button>
                </th>
            `;
        });
    }

    let rowsHTML = "";
    if (item.rows && item.rows.length > 0) {
        item.rows.forEach((rowObj, rowIdx) => {
            rowsHTML += `<tr class="data-row">`;
            item.columns.forEach((col, colIdx) => {
                const cellContentStr = rowObj[col] || "";
                
                // Heuristic to restore question inputs inside tables for the edit view
                let typeSelected = "text";
                if (cellContentStr.includes("_____")) {
                    typeSelected = "question";
                } else if (cellContentStr.includes("<br>") && cellContentStr.match(/Q\d+:/)) {
                    typeSelected = "multiple-choice";
                } else if (cellContentStr.toLowerCase().startsWith("example")) {
                    typeSelected = "example";
                } else if (cellContentStr.includes("<br>")) {
                    typeSelected = "question"; // fallback for multiple questions in one cell
                }
                
                rowsHTML += `
                    <td class="data-cell">
                        <select class="cell-type" onchange="updateCellType(this, ${questionId}, ${rowIdx}, ${colIdx})">
                        <option value="text" ${typeSelected === 'text' ? 'selected' : ''}>Text</option>
                        <option value="question" ${typeSelected === 'question' ? 'selected' : ''}>Question (1_____)</option>
                        <option value="multiple-choice" ${typeSelected === 'multiple-choice' ? 'selected' : ''}>Multiple Choice</option>
                        <option value="example" ${typeSelected === 'example' ? 'selected' : ''}>Example</option>
                        </select>
                        <div class="cell-content">
                        <!-- We dump the raw string for now since reconstructing dynamic cell inputs is complex -->
                        <!-- The user can edit the raw string or re-select to clear and build -->
                        <input type="text" class="cell-input" placeholder="Cell content" value="${cellContentStr.replace(/"/g, '&quot;')}">
                        </div>
                        <button type="button" class="add-question-in-cell-btn" onclick="addQuestionToCell(this, ${questionId}, ${rowIdx}, ${colIdx})" title="Add another question" style="${typeSelected === 'text' || typeSelected === 'example' ? 'display: none;' : ''}">+</button>
                    </td>
                `;
            });
            rowsHTML += `</tr>`;
        });
    }

    let answersText = "";
    if (item.answer) {
        answersText = Object.entries(item.answer).map(([k, v]) => `${k}=${v}`).join(", ");
    }

    const html = `
        <div class="question-item" data-question-id="${questionId}" data-type="table">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index">${qLabel}</span>.</span>
            <span class="question-type-badge table">Table</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Table title (optional)" class="table-title" value="${item.title ? item.title.replace(/"/g, "&quot;") : ""}">
          <input type="text" placeholder="Group instruction (optional, use \\n for paragraphs)" class="group-instruction" value="${item.groupInstruction ? item.groupInstruction.replace(/"/g, "&quot;") : ""}">
          
          <div class="table-builder">
            <div class="table-controls">
              <div class="control-group">
                <button type="button" onclick="addTableColumn(${questionId})" class="control-btn add-column-btn">
                  Add Column →
                </button>
                <button type="button" onclick="addTableRow(${questionId})" class="control-btn add-row-btn">
                  Add Row ↓
                </button>
                <button type="button" onclick="recalculateTableQuestionNumbers('${questionId}')" class="control-btn recalculate-btn" style="background: #2196F3;" title="Recalculate all question numbers in this table">
                  Renumber Questions
                </button>
              </div>
            </div>
            
            <div class="table-container">
              <table class="question-table" id="question-table-${questionId}">
                <thead>
                  <tr id="header-row-${questionId}">
                    ${headersHTML}
                  </tr>
                </thead>
                <tbody id="table-body-${questionId}">
                   ${rowsHTML}
                </tbody>
              </table>
            </div>
            
            <div class="table-answers">
              <label>Answers:(format: q1=answer1, q2=answer2):</label>
              <textarea placeholder="q1=theatre, q2=4.30, q3=station..." class="table-answers-text" rows="3">${answersText}</textarea>
            </div>
          </div>
        </div>
    `;
    container.insertAdjacentHTML("beforeend", html);
    
    // Increment global counters safely for table boundaries
    if (item.questions) {
        totalQuestionCount += Object.keys(item.questions).length;
        nextQuestionNumber += Object.keys(item.questions).length;
    }
}

function addQuestionGroup(sectionNumber, item) {
    const questionId = ++questionIdCounter;
    const container = document.getElementById(`questions${sectionNumber}`);
    
    const qLabel = totalQuestionCount + 1;
    
    // Handle multi-select options formatting
    let optionsListHTML = "";
    if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
        Object.entries(item.options).forEach(([k, v]) => {
           optionsListHTML += `
              <div class="option-item">
                <input type="text" value="${k}" class="option-label">
                <input type="text" placeholder="Option text" class="option-text" value="${v ? v.replace(/"/g, "&quot;") : ""}">
                <button type="button" onclick="removeOption(this)" class="remove-option-btn">×</button>
              </div>
           `;
        });
    } else if (Array.isArray(item.options)) {
        item.options.forEach(opt => {
            const optValue = opt.value || opt.id || "";
            const optText = opt.text || opt.value || "";
            optionsListHTML += `
              <div class="option-item">
                <input type="text" value="${optValue}" class="option-label">
                <input type="text" placeholder="Option text" class="option-text" value="${optText ? optText.replace(/"/g, "&quot;") : ""}">
                <button type="button" onclick="removeOption(this)" class="remove-option-btn">×</button>
              </div>
            `;
        });
    }
    
    const isMultiSelect = item.groupType === "multi-select";
    
    // Group correct answers
    let correctAnswersStr = "";
    if (isMultiSelect && item.questions) {
        correctAnswersStr = item.questions.map(q => q.correctAnswer).join(", ");
        totalQuestionCount += item.questions.length;
        nextQuestionNumber += item.questions.length;
    }

    let matchingQuestionsHTML = "";
    if (!isMultiSelect && item.questions) {
         item.questions.forEach(mq => {
              matchingQuestionsHTML += `
                  <div class="group-question-item">
                    <input type="text" placeholder="Question/Statement text" class="group-question-text" value="${mq.text ? mq.text.replace(/"/g, '&quot;') : ""}">
                    <input type="text" placeholder="Correct answer (A, B, C, etc.)" class="group-question-answer" value="${mq.correctAnswer ? mq.correctAnswer : ""}">
                    <button type="button" onclick="removeGroupQuestion(this)" class="remove-group-question-btn">×</button>
                  </div>
              `;
         });
         totalQuestionCount += item.questions.length;
         nextQuestionNumber += item.questions.length;
    }


    const html = `
        <div class="question-item" data-question-id="${questionId}" data-type="question-group">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index">${qLabel}</span>.</span>
            <span class="question-type-badge question-group">Question Group</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (e.g., Questions 11-15 Choose TWO letters, A-E. Use \\n for paragraphs)" class="group-instruction" value="${item.groupInstruction ? item.groupInstruction.replace(/"/g, "&quot;") : ""}">
          <select class="group-type" onchange="handleGroupTypeChange(${questionId})">
            <option value="multi-select" ${isMultiSelect ? "selected" : ""}>Multi Select</option>
            <option value="matching" ${!isMultiSelect ? "selected" : ""}>Matching</option>
          </select>
          
          <div class="multi-select-question" id="multi-select-question-${questionId}" style="display: ${isMultiSelect ? 'block' : 'none'};">
            <input type="text" placeholder="Question text (e.g., Which THREE features does the speaker mention?)" class="question-text" value="${item.text ? item.text.replace(/"/g, "&quot;") : ""}">
          </div>
          
          <div class="group-options">
            <label>Options:</label>
            <div class="options-list" id="options-list-${questionId}">
              ${optionsListHTML}
            </div>
            <button type="button" onclick="addOption(${questionId})" class="add-option-btn">+ Add Option</button>
          </div>
          
          <div class="group-questions matching-questions" id="matching-questions-${questionId}" style="display: ${!isMultiSelect ? 'block' : 'none'};">
            <label>Individual Questions:</label>
            <div class="questions-list" id="group-questions-list-${questionId}">
              ${matchingQuestionsHTML}
            </div>
            <button type="button" onclick="addGroupQuestion(${questionId})" class="add-group-question-btn">+ Add Question</button>
          </div>
          
          <div class="group-answer-section multi-select-answers" id="multi-select-answers-${questionId}" style="display: ${isMultiSelect ? 'block' : 'none'};">
            <label>Correct Answers (comma-separated):</label>
            <input type="text" placeholder="Enter correct answers separated by commas (e.g., A,B,C)" class="group-correct-answers" value="${correctAnswersStr}">
            <p class="helper-text">For multi-select, enter the correct option letters separated by commas</p>
          </div>
        </div>
    `;
    
    container.insertAdjacentHTML("beforeend", html);
}
