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
import { firebaseConfig } from "/config.js";


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let nextTestNumber = 1;
let passageCount = 0;
let questionIdCounter = 0;
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

// Get the next test number
async function getNextTestNumber() {
  try {
    const testsRef = collection(db, "readingTests");
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
    ).textContent = `This will be Reading Test ${nextTestNumber}`;
    console.log("📊 Next test number will be:", nextTestNumber);

    return nextTestNumber;
  } catch (error) {
    console.error("Error getting next test number:", error);
    return 1;
  }
}

// Add a new passage
function addPassage() {
  if (passageCount >= 3) {
    alert("Maximum 3 passages allowed per test");
    return;
  }

  passageCount++;
  const passageNumber = passageCount;

  const passageHTML = `
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
        <input type="text" class="passage-title-input" placeholder="e.g., The discovery of a baby mammoth" required>
      </div>
      
      <div class="form-group">
        <label>Instructions</label>
        <input type="text" class="passage-instructions" placeholder="e.g., You should spend about 20 minutes on Questions 1-13" 
       value="You should spend about 20 minutes on Questions ${getQuestionRange(
         passageNumber
       )}">
        <span class="helper-text">Customize the question numbers for this passage (e.g., Questions 1-13 or Questions 14-26)</span>     
      </div>
      
      <div class="form-group">
        <label>Passage Text *</label>
        <textarea class="passage-text" rows="10" placeholder="Paste or type the full reading passage text here..." required></textarea>
        <span class="helper-text">This is the main text students will read</span>
      </div>
      
      <div class="questions-section">
        <div class="questions-header">
          <span class="questions-title">Questions</span>
        </div>
        <div class="questions-container" id="questions${passageNumber}">
          <!-- Questions will be added here -->
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

  document
    .getElementById("passagesContainer")
    .insertAdjacentHTML("beforeend", passageHTML);
  updatePassageCount();
  updateAddPassageButton();
}

function getQuestionRange(passageNumber) {
  return `corresponding to this passage`;
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

// Add a question to a passage
window.addQuestion = function (passageNumber, type) {
  const container = document.getElementById(`questions${passageNumber}`);
  const questionId = ++questionIdCounter;

  let questionHTML = "";

  switch (type) {
    case "gap-fill":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge gap-fill">Gap Fill</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <input type="text" placeholder="Question text (use _____ for gaps)" class="question-text">
      <input type="text" placeholder="Answer(s) - separate multiple with comma" class="question-answer">
    </div>
  `;
      break;
    case "text-question":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}">
      <div class="question-header">
        <span class="question-type-badge" style="background: #607D8B;">Text/Header</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional, e.g., 'Questions 1-7\nComplete the notes below...')" class="group-instruction" rows="3"></textarea>
      <input type="text" placeholder="Title (optional, e.g., 'Chinese silk')" class="question-title">
      <input type="text" placeholder="Subheading (optional, e.g., 'Early Uses')" class="question-subheading">
      <input type="text" placeholder="Plain text (optional, e.g., 'Clothing')" class="question-text">
      <small style="color: #888;">Fill any or all fields - they will appear as headers/text</small>
    </div>
  `;
      break;

    case "true-false-notgiven":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge tfng">True/False/Not Given</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional, e.g., 'Questions 8-13\nDo the following statements agree with the information given in Reading Passage 1?')" class="group-instruction" rows="2"></textarea>
      <input type="text" placeholder="Statement" class="question-text">
      <select class="question-answer">
        <option value="">Select answer</option>
        <option value="TRUE">TRUE</option>
        <option value="FALSE">FALSE</option>
        <option value="NOT GIVEN">NOT GIVEN</option>
      </select>
    </div>
  `;
      break;

    case "yes-no-notgiven":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge ynng">Yes/No/Not Given</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional, e.g., 'Questions 31-36\nDo the following statements agree with the claims of the writer?')" class="group-instruction" rows="2"></textarea>
      <input type="text" placeholder="Statement" class="question-text">
      <select class="question-answer">
        <option value="">Select answer</option>
        <option value="YES">YES</option>
        <option value="NO">NO</option>
        <option value="NOT GIVEN">NOT GIVEN</option>
      </select>
    </div>
  `;
      break;

    case "multiple-choice":
      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}">
      <div class="question-header">
        <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
        <span class="question-type-badge mc">Multiple Choice</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional, e.g., 'Questions 27-30\nChoose the correct letter, A, B, C or D.')" class="group-instruction" rows="2"></textarea>
      <input type="text" placeholder="Question" class="question-text">
      <div class="mc-options" id="mc-options-${questionId}">
        <div class="mc-option">
          <input type="radio" name="mc-answer-${questionId}" value="A">
          <label>A</label>
          <input type="text" placeholder="Option A text" class="option-text" data-option="A">
          <button type="button" onclick="removeMCOption(this)" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
        </div>
        <div class="mc-option">
          <input type="radio" name="mc-answer-${questionId}" value="B">
          <label>B</label>
          <input type="text" placeholder="Option B text" class="option-text" data-option="B">
          <button type="button" onclick="removeMCOption(this)" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
        </div>
        <div class="mc-option">
          <input type="radio" name="mc-answer-${questionId}" value="C">
          <label>C</label>
          <input type="text" placeholder="Option C text" class="option-text" data-option="C">
          <button type="button" onclick="removeMCOption(this)" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
        </div>
        <div class="mc-option">
          <input type="radio" name="mc-answer-${questionId}" value="D">
          <label>D</label>
          <input type="text" placeholder="Option D text" class="option-text" data-option="D">
          <button type="button" onclick="removeMCOption(this)" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">×</button>
        </div>
      </div>
      <button type="button" onclick="addMCOption(${questionId})" style="margin-top: 10px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>
    </div>
  `;
      break;

    case "paragraph-matching":
      // Initialize passage-specific options if not exists
      if (!sharedOptions[passageNumber]) {
        sharedOptions[passageNumber] = {};
      }
      if (!sharedOptions[passageNumber]["paragraph-matching"]) {
        sharedOptions[passageNumber]["paragraph-matching"] = [
          { label: "A", text: "Paragraph A" },
          { label: "B", text: "Paragraph B" },
          { label: "C", text: "Paragraph C" },
          { label: "D", text: "Paragraph D" },
          { label: "E", text: "Paragraph E" },
          { label: "F", text: "Paragraph F" },
        ];
      }

      const pmOptions = sharedOptions[passageNumber]["paragraph-matching"];
      const isFirstPMQuestion = !document.querySelector(`#questions${passageNumber} .question-item[data-type="paragraph-matching"]`);

      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}" data-passage="${passageNumber}">
      <div class="question-header">
        <span class="question-type-badge pm">Paragraph Matching</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional, e.g., 'Questions 14-18\nReading Passage 2 has six paragraphs...')" class="group-instruction" rows="2"></textarea>
      <input type="text" placeholder="Question/Information to find" class="question-text">
      <input type="text" placeholder="Correct answer (A, B, C, etc.)" class="question-answer">
      <div class="options-container">
        <label style="display: block; margin: 10px 0 5px; font-weight: 600;">
          Options (shared across all paragraph matching questions in this passage):
          <button type="button" onclick="toggleOptionsEdit(${questionId}, 'paragraph-matching', ${passageNumber})" style="margin-left: 10px; padding: 2px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">${isFirstPMQuestion ? 'Edit Options' : 'View Options'}</button>
        </label>
        <div class="pm-options" id="pm-options-${questionId}" style="display: none;" data-is-first="${isFirstPMQuestion}">
          ${pmOptions
            .map(
              (opt) => `
            <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
              <input type="text" value="${opt.label}" class="option-label" style="width: 40px; text-align: center;" ${isFirstPMQuestion ? '' : 'readonly'}>
              <input type="text" value="${opt.text}" class="option-text" data-label="${opt.label}" style="flex: 1;" ${isFirstPMQuestion ? '' : 'readonly'}>
              ${isFirstPMQuestion ? `<button type="button" onclick="removeOption(this, 'paragraph-matching', ${passageNumber})" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>` : ''}
            </div>
          `
            )
            .join("")}
          ${isFirstPMQuestion ? `<button type="button" onclick="addOption(${questionId}, 'paragraph-matching', ${passageNumber})" style="margin-top: 5px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>` : ''}
        </div>
        <div class="options-preview" id="options-preview-${questionId}">
          ${pmOptions
            .map(
              (opt) =>
                `<span style="display: inline-block; margin: 2px; padding: 3px 8px; background: #f0f0f0; border-radius: 3px; font-size: 12px;">${opt.label}: ${opt.text}</span>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
      break;

    case "match-person":
      // Initialize passage-specific options if not exists
      if (!sharedOptions[passageNumber]) {
        sharedOptions[passageNumber] = {};
      }
      if (!sharedOptions[passageNumber]["match-person"]) {
        sharedOptions[passageNumber]["match-person"] = [
          { label: "A", text: "" },
          { label: "B", text: "" },
        ];
      }

      const mpOptions = sharedOptions[passageNumber]["match-person"];
      const isFirstMPQuestion = !document.querySelector(`#questions${passageNumber} .question-item[data-type="match-person"]`);

      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}" data-passage="${passageNumber}">
      <div class="question-header">
        <span class="question-type-badge mp">Match Person/Feature</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional, use \n for paragraphs)" class="group-instruction" rows="2"></textarea>
      <input type="text" placeholder="Statement to match" class="question-text">
      <input type="text" placeholder="Correct answer letter (A, B, C, etc.)" class="question-answer">
      <div class="options-container">
        <label style="display: block; margin: 10px 0 5px; font-weight: 600;">
          Options (shared across all match person questions in this passage):
          <button type="button" onclick="toggleOptionsEdit(${questionId}, 'match-person', ${passageNumber})" style="margin-left: 10px; padding: 2px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">${isFirstMPQuestion ? 'Edit Options' : 'View Options'}</button>
        </label>
        <div class="match-options" id="match-options-${questionId}" style="display: none;" data-is-first="${isFirstMPQuestion}">
          ${mpOptions
            .map(
              (opt) => `
            <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
              <input type="text" value="${opt.label}" class="option-label" style="width: 40px; text-align: center;" ${isFirstMPQuestion ? '' : 'readonly'}>
              <input type="text" value="${opt.text}" placeholder="Enter name/text" class="option-text" data-label="${opt.label}" style="flex: 1;" ${isFirstMPQuestion ? '' : 'readonly'}>
              ${isFirstMPQuestion ? `<button type="button" onclick="removeOption(this, 'match-person', ${passageNumber})" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>` : ''}
            </div>
          `
            )
            .join("")}
          ${isFirstMPQuestion ? `<button type="button" onclick="addOption(${questionId}, 'match-person', ${passageNumber})" style="margin-top: 5px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>` : ''}
        </div>
        <div class="options-preview" id="options-preview-${questionId}">
          ${mpOptions
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

  container.insertAdjacentHTML("beforeend", questionHTML);

  // Set up auto-propagation for first matching questions
  if ((type === "paragraph-matching" || type === "match-person") && 
      (type === "paragraph-matching" ? isFirstPMQuestion : isFirstMPQuestion)) {
    setupOptionAutoPropagate(questionId, type, passageNumber);
  }

  document
    .getElementById(`questionMenu${passageNumber}`)
    .classList.remove("show");
  updateQuestionNumbers(passageNumber);
};

// Set up auto-propagation for first matching question
function setupOptionAutoPropagate(questionId, type, passageNumber) {
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  
  if (!container) return;
  
  // Add input listeners to all option inputs
  const optionInputs = container.querySelectorAll('.option-label, .option-text');
  optionInputs.forEach(input => {
    input.addEventListener('input', () => {
      updateSharedOptionsFromFirstQuestion(questionId, type, passageNumber);
      updateAllOptionsInPassage(type, passageNumber);
    });
  });
}

// Update shared options from the first question as user types
function updateSharedOptionsFromFirstQuestion(questionId, type, passageNumber) {
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  
  if (!container) return;
  
  const newOptions = [];
  container.querySelectorAll(".option-row").forEach((row) => {
    const label = row.querySelector(".option-label").value.trim();
    const text = row.querySelector(".option-text").value;
    if (label) {
      newOptions.push({ label, text });
    }
  });

  if (!sharedOptions[passageNumber]) {
    sharedOptions[passageNumber] = {};
  }
  sharedOptions[passageNumber][type] = newOptions;
}

// Update all matching questions in the same passage
function updateAllOptionsInPassage(type, passageNumber) {
  const questions = document.querySelectorAll(
    `#questions${passageNumber} .question-item[data-type="${type}"]`
  );
  
  questions.forEach((question) => {
    const questionId = question.dataset.questionId;
    const container = document.getElementById(
      `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
    );
    const previewDiv = document.getElementById(`options-preview-${questionId}`);
    
    if (!container || !previewDiv) return;
    
    const isFirst = container.dataset.isFirst === "true";
    const options = sharedOptions[passageNumber]?.[type] || [];
    
    // Update options container for non-first questions
    if (!isFirst) {
      const optionsHTML = options.map(opt => `
        <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
          <input type="text" value="${opt.label}" class="option-label" style="width: 40px; text-align: center;" readonly>
          <input type="text" value="${opt.text}" class="option-text" data-label="${opt.label}" style="flex: 1;" readonly>
        </div>
      `).join("");
      
      const existingRows = container.querySelectorAll('.option-row');
      existingRows.forEach(row => row.remove());
      
      const addButton = container.querySelector('button[onclick*="addOption"]');
      if (addButton) {
        addButton.insertAdjacentHTML('beforebegin', optionsHTML);
      } else {
        container.innerHTML = optionsHTML;
      }
    }
    
    // Update preview
    previewDiv.innerHTML = options
      .map(opt => 
        `<span style="display: inline-block; margin: 2px; padding: 3px 8px; background: #f0f0f0; border-radius: 3px; font-size: 12px;">${opt.label}: ${opt.text || "(empty)"}</span>`
      )
      .join("");
  });
}

// Toggle options edit view
window.toggleOptionsEdit = function (questionId, type, passageNumber) {
  const optionsDiv = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  const previewDiv = document.getElementById(`options-preview-${questionId}`);

  if (optionsDiv.style.display === "none") {
    optionsDiv.style.display = "block";
    previewDiv.style.display = "none";
  } else {
    updateSharedOptions(questionId, type, passageNumber);
    optionsDiv.style.display = "none";
    previewDiv.style.display = "block";
    updateAllOptionsInPassage(type, passageNumber);
  }
};

// Update shared options from inputs
function updateSharedOptions(questionId, type, passageNumber) {
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  
  if (!container) {
    // If the specific container is not found, try to find any visible container of this type in the passage
    const allQuestions = document.querySelectorAll(`#questions${passageNumber} .question-item[data-type="${type}"]`);
    for (let question of allQuestions) {
      const qId = question.dataset.questionId;
      const anyContainer = document.getElementById(
        `${type === "paragraph-matching" ? "pm" : "match"}-options-${qId}`
      );
      if (anyContainer && anyContainer.style.display !== "none") {
        updateSharedOptionsFromContainer(anyContainer, type, passageNumber);
        return;
      }
    }
    return;
  }
  
  updateSharedOptionsFromContainer(container, type, passageNumber);
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

// Update all previews of the same type (deprecated - use updateAllOptionsInPassage instead)
function updateAllOptionsPreview(type, passageNumber) {
  // This function is now handled by updateAllOptionsInPassage
  // Keeping for backward compatibility
  if (passageNumber) {
    updateAllOptionsInPassage(type, passageNumber);
  }
}

// Add new option
window.addOption = function (questionId, type, passageNumber) {
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
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
      updateSharedOptionsFromFirstQuestion(questionId, type, passageNumber);
      updateAllOptionsInPassage(type, passageNumber);
    });
  });
  
  // Immediately update shared options and propagate
  updateSharedOptionsFromFirstQuestion(questionId, type, passageNumber);
  updateAllOptionsInPassage(type, passageNumber);
};

// Remove option
window.removeOption = function (button, type, passageNumber) {
  const container = button.closest(`[id^="pm-options-"], [id^="match-options-"]`);
  const questionId = container.id.split('-').pop();
  
  button.parentElement.remove();
  
  // Update shared options and propagate
  updateSharedOptionsFromFirstQuestion(questionId, type, passageNumber);
  updateAllOptionsInPassage(type, passageNumber);
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
    const passage = question.closest('.passage-container');
    const passageNumber = passage ? parseInt(passage.dataset.passage) : null;
    question.remove();
    if (passageNumber) updateQuestionNumbers(passageNumber);
  }
};

function updateQuestionNumbers(passageNumber) {
  const items = document.querySelectorAll(`#questions${passageNumber} .question-item`);
  let counter = 0;
  items.forEach((item) => {
    const numEl = item.querySelector('.question-index');
    if (numEl) {
      counter++;
      numEl.textContent = counter;
    }
  });
}

// Remove a passage
window.removePassage = function (passageNumber) {
  if (
    confirm(
      "Are you sure you want to remove this passage and all its questions?"
    )
  ) {
    const passage = document.querySelector(`[data-passage="${passageNumber}"]`);
    if (passage) {
      passage.remove();
      passageCount--;
      updatePassageCount();
      updateAddPassageButton();
      renumberPassages();
    }
  }
};

// Renumber passages after removal
function renumberPassages() {
  const passages = document.querySelectorAll(".passage-container");
  passages.forEach((passage, index) => {
    const newNumber = index + 1;
    passage.dataset.passage = newNumber;
    passage.querySelector(".passage-number").textContent = newNumber;
    passage.querySelector(
      ".passage-title"
    ).childNodes[1].textContent = ` Passage ${newNumber}`;

    const instructionsInput = passage.querySelector(".passage-instructions");
    if (instructionsInput) {
      instructionsInput.value = `You should spend about 20 minutes on Questions ${getQuestionRange(
        newNumber
      )}`;
    }

    const questionMenu = passage.querySelector(".question-types-menu");
    if (questionMenu) {
      questionMenu.id = `questionMenu${newNumber}`;
    }

    const questionsContainer = passage.querySelector(".questions-container");
    if (questionsContainer) {
      questionsContainer.id = `questions${newNumber}`;
    }

    const addQuestionBtn = passage.querySelector(".add-question-btn");
    if (addQuestionBtn) {
      addQuestionBtn.setAttribute(
        "onclick",
        `toggleQuestionMenu(${newNumber})`
      );
    }

    const removeBtn = passage.querySelector(".remove-passage-btn");
    if (removeBtn) {
      removeBtn.setAttribute("onclick", `removePassage(${newNumber})`);
    }

    const questionOptions = passage.querySelectorAll(".question-type-option");
    questionOptions.forEach((option) => {
      const type = option.textContent.toLowerCase().replace(/[^a-z-]/g, "");
      option.setAttribute(
        "onclick",
        `addQuestion(${newNumber}, '${getQuestionTypeFromText(
          option.textContent
        )}')`
      );
    });
  });
}

// Get question type from text
function getQuestionTypeFromText(text) {
  const types = {
    "Text Only (No Question)": "text-question",
    "Gap Fill": "gap-fill",
    "True/False/Not Given": "true-false-notgiven",
    "Yes/No/Not Given": "yes-no-notgiven",
    "Multiple Choice": "multiple-choice",
    "Paragraph Matching": "paragraph-matching",
    "Match Person/Feature": "match-person",
  };
  return types[text] || "gap-fill";
}

// Update passage count display
function updatePassageCount() {
  document.getElementById("passageCount").textContent = passageCount;
}

// Update add passage button state
function updateAddPassageButton() {
  const btn = document.getElementById("addPassageBtn");
  if (passageCount >= 3) {
    btn.disabled = true;
    btn.textContent = "Maximum 3 Passages Reached";
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

// Preview the test
window.previewTest = function () {
  const previewContent = document.getElementById("previewContent");
  const passages = document.querySelectorAll(".passage-container");

  if (passages.length === 0) {
    alert("Please add at least one passage first");
    return;
  }

  let previewHTML = "<h3>Test Preview</h3>";

  passages.forEach((passage, index) => {
    const title =
      passage.querySelector(".passage-title-input").value || "Untitled Passage";
    const text =
      passage.querySelector(".passage-text").value || "No text provided";
    const questions = Array.from(passage.querySelectorAll(".question-item")).filter(q => q.dataset.type !== 'text-question');

    previewHTML += `
      <div class="preview-passage">
        <h3>Passage ${index + 1}: ${title}</h3>
        <div class="preview-text">${text.substring(0, 200)}...</div>
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

// Update all shared options before collecting test data
function updateAllSharedOptions() {
  const passages = document.querySelectorAll(".passage-container");
  
  passages.forEach((passage) => {
    const passageNumber = parseInt(passage.dataset.passage);
    
    // Update paragraph-matching options for this passage
    const pmQuestions = passage.querySelectorAll('.question-item[data-type="paragraph-matching"]');
    if (pmQuestions.length > 0) {
      // Find the first question's container (which has the master options)
      for (let question of pmQuestions) {
        const questionId = question.dataset.questionId;
        const container = document.getElementById(`pm-options-${questionId}`);
        if (container && container.dataset.isFirst === "true") {
          updateSharedOptionsFromContainer(container, "paragraph-matching", passageNumber);
          break;
        }
      }
    }
    
    // Update match-person options for this passage
    const mpQuestions = passage.querySelectorAll('.question-item[data-type="match-person"]');
    if (mpQuestions.length > 0) {
      // Find the first question's container (which has the master options)
      for (let question of mpQuestions) {
        const questionId = question.dataset.questionId;
        const container = document.getElementById(`match-options-${questionId}`);
        if (container && container.dataset.isFirst === "true") {
          updateSharedOptionsFromContainer(container, "match-person", passageNumber);
          break;
        }
      }
    }
  });
}

// Collect test data
function collectTestData() {
  // Update all shared options before collecting data
  updateAllSharedOptions();
  
  const passages = [];
  const passageElements = document.querySelectorAll(".passage-container");

  passageElements.forEach((passageEl) => {
    const passageNumber = parseInt(passageEl.dataset.passage);
    const passageData = {
      title: passageEl.querySelector(".passage-title-input").value.trim(),
      instructions: passageEl
        .querySelector(".passage-instructions")
        .value.trim(),
      text: passageEl.querySelector(".passage-text").value.trim(),
      questions: [],
    };

    const questionElements = passageEl.querySelectorAll(".question-item");
    questionElements.forEach((questionEl) => {
      const type = questionEl.dataset.type;
      const questionText = questionEl
        .querySelector(".question-text")
        ?.value.trim();

      let questionData = {
        type: type,
      };

      const groupInstruction = questionEl
        .querySelector(".group-instruction")
        ?.value.trim();
      if (groupInstruction) {
        questionData.groupInstruction = groupInstruction;
      }

      if (type === "text-question") {
        const title = questionEl.querySelector(".question-title")?.value.trim();
        const subheading = questionEl
          .querySelector(".question-subheading")
          ?.value.trim();
        const text = questionEl.querySelector(".question-text")?.value.trim();

        if (title) questionData.title = title;
        if (subheading) questionData.subheading = subheading;
        if (text) questionData.text = text;
      } else {
        questionData.question = questionText;

        if (type === "gap-fill") {
          const title = questionEl
            .querySelector(".question-title")
            ?.value.trim();
          const subheading = questionEl
            .querySelector(".question-subheading")
            ?.value.trim();
          if (title) questionData.title = title;
          if (subheading) questionData.subheading = subheading;

          const answerText = questionEl
            .querySelector(".question-answer")
            .value.trim();
          questionData.answer = answerText
            .split(",")
            .map((a) => a.trim())
            .filter((a) => a);
        } else if (type === "multiple-choice") {
          const selectedAnswer = questionEl.querySelector(
            'input[type="radio"]:checked'
          );
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
          questionData.answer = questionEl
            .querySelector(".question-answer")
            .value.trim();

          // Use the passage-specific shared options
          const passageOptions = sharedOptions[passageNumber]?.[type] || [];
          questionData.options = passageOptions.map((opt) => ({
            label: opt.label,
            text: opt.text,
          }));
          console.log(`💾 Saving ${type} options for question in passage ${passageNumber}:`, questionData.options);
        } else {
          questionData.answer = questionEl
            .querySelector(".question-answer")
            .value.trim();
        }
      }

      passageData.questions.push(questionData);
    });

    passages.push(passageData);
  });

  return {
    testId: `test-${nextTestNumber}`,
    passages: passages,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.email,
  };
}

// Validate form
function validateForm() {
  const passages = document.querySelectorAll(".passage-container");

  if (passages.length === 0) {
    alert("Please add at least one passage");
    return false;
  }

  for (let passage of passages) {
    const title = passage.querySelector(".passage-title-input").value.trim();
    const text = passage.querySelector(".passage-text").value.trim();
    const questions = passage.querySelectorAll(".question-item");

    if (!title) {
      alert("Please enter a title for all passages");
      return false;
    }

    if (!text) {
      alert("Please enter text for all passages");
      return false;
    }

    if (questions.length === 0) {
      alert("Please add at least one question for each passage");
      return false;
    }

    for (let question of questions) {
      const type = question.dataset.type;

      if (type === "text-question") {
        const groupInstruction = question.querySelector(".group-instruction")?.value.trim();
        const title = question.querySelector(".question-title")?.value.trim();
        const subheading = question.querySelector(".question-subheading")?.value.trim();
        const text = question.querySelector(".question-text")?.value.trim();
        
        if (!groupInstruction && !title && !subheading && !text) {
          alert("Please fill in at least one field for text-only items");
          return false;
        }
        continue;
      }

      const questionText = question
        .querySelector(".question-text")
        .value.trim();
      if (!questionText) {
        alert("Please fill in all question texts");
        return false;
      }

      if (type === "multiple-choice") {
        const selectedAnswer = question.querySelector(
          'input[type="radio"]:checked'
        );
        if (!selectedAnswer) {
          alert(
            "Please select the correct answer for all multiple choice questions"
          );
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
        const answer = question.querySelector(".question-answer").value.trim();
        if (!answer) {
          alert("Please provide answers for all gap fill questions");
          return false;
        }
      } else {
        const answer = question.querySelector(".question-answer").value;
        if (!answer) {
          alert("Please provide answers for all questions");
          return false;
        }
      }
    }
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
    const testData = collectTestData();

    console.log("💾 Saving test data:", testData);

    const docId = `test-${nextTestNumber}`;
    await setDoc(doc(db, "readingTests", docId), testData);
    console.log("✅ Test added with ID:", docId);

    const successModal = document.getElementById("successModal");
    const successMessage = document.getElementById("successMessage");
    successMessage.textContent = `Reading Test ${nextTestNumber} has been added successfully!`;
    successModal.style.display = "flex";

    nextTestNumber++;
  } catch (error) {
    console.error("❌ Error adding test:", error);
    alert(`❌ Error adding test: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = "Add Reading Test";
    loader.style.display = "none";
  }
}

// Reset form for adding another test
window.resetForm = function () {
  document.getElementById("successModal").style.display = "none";

  document.getElementById("passagesContainer").innerHTML = "";
  passageCount = 0;
  questionIdCounter = 0;
  sharedOptions = {}; // Reset to empty object for passage-specific options

  updatePassageCount();
  updateAddPassageButton();

  getNextTestNumber();

  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📚 Reading Test Add page loaded");

  await checkAdminAccess();

  await getNextTestNumber();

  document
    .getElementById("addPassageBtn")
    .addEventListener("click", addPassage);
  document.getElementById("previewBtn").addEventListener("click", previewTest);
  document
    .getElementById("readingTestForm")
    .addEventListener("submit", handleFormSubmit);

  addPassage();

  console.log("✅ Page initialized successfully");
});