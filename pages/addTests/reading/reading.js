// reading-add.js

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
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let nextTestNumber = 1;
let passageCount = 0;
let questionIdCounter = 0;
let sharedOptions = {
  "paragraph-matching": [],
  "match-person": [],
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
          <div class="add-question-dropdown">
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
        <div class="questions-container" id="questions${passageNumber}">
          <!-- Questions will be added here -->
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
      break;

    case "true-false-notgiven":
      questionHTML = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-type-badge tfng">True/False/Not Given</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
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
            <span class="question-type-badge ynng">Yes/No/Not Given</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
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
            <span class="question-type-badge mc">Multiple Choice</span>
            <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Question" class="question-text">
          <div class="mc-options">
            <div class="mc-option">
              <input type="radio" name="mc-answer-${questionId}" value="A">
              <label>A</label>
              <input type="text" placeholder="Option A text" class="option-text" data-option="A">
            </div>
            <div class="mc-option">
              <input type="radio" name="mc-answer-${questionId}" value="B">
              <label>B</label>
              <input type="text" placeholder="Option B text" class="option-text" data-option="B">
            </div>
            <div class="mc-option">
              <input type="radio" name="mc-answer-${questionId}" value="C">
              <label>C</label>
              <input type="text" placeholder="Option C text" class="option-text" data-option="C">
            </div>
            <div class="mc-option">
              <input type="radio" name="mc-answer-${questionId}" value="D">
              <label>D</label>
              <input type="text" placeholder="Option D text" class="option-text" data-option="D">
            </div>
          </div>
        </div>
      `;
      break;

    case "paragraph-matching":
      // Используем существующие опции или создаем стандартные
      if (sharedOptions["paragraph-matching"].length === 0) {
        sharedOptions["paragraph-matching"] = [
          { label: "A", text: "Paragraph A" },
          { label: "B", text: "Paragraph B" },
          { label: "C", text: "Paragraph C" },
          { label: "D", text: "Paragraph D" },
          { label: "E", text: "Paragraph E" },
          { label: "F", text: "Paragraph F" },
        ];
      }

      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}">
      <div class="question-header">
        <span class="question-type-badge pm">Paragraph Matching</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional, e.g., 'Questions 14-18\nReading Passage 2 has six paragraphs...')" class="group-instruction" rows="2"></textarea>
      <input type="text" placeholder="Question/Information to find" class="question-text">
      <input type="text" placeholder="Correct answer (A, B, C, etc.)" class="question-answer">
      <div class="options-container">
        <label style="display: block; margin: 10px 0 5px; font-weight: 600;">
          Options (shared across all paragraph matching questions):
          <button type="button" onclick="toggleOptionsEdit(${questionId}, 'paragraph-matching')" style="margin-left: 10px; padding: 2px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Edit Options</button>
        </label>
        <div class="pm-options" id="pm-options-${questionId}" style="display: none;">
          ${sharedOptions["paragraph-matching"]
            .map(
              (opt) => `
            <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
              <input type="text" value="${opt.label}" class="option-label" style="width: 40px; text-align: center;">
              <input type="text" value="${opt.text}" class="option-text" data-label="${opt.label}" style="flex: 1;">
              <button type="button" onclick="removeOption(this, 'paragraph-matching')" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>
            </div>
          `
            )
            .join("")}
          <button type="button" onclick="addOption(${questionId}, 'paragraph-matching')" style="margin-top: 5px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>
        </div>
        <div class="options-preview" id="options-preview-${questionId}">
          ${sharedOptions["paragraph-matching"]
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
      // Используем существующие опции или создаем стандартные
      if (sharedOptions["match-person"].length === 0) {
        sharedOptions["match-person"] = [
          { label: "A", text: "" },
          { label: "B", text: "" },
        ];
      }

      questionHTML = `
    <div class="question-item" data-question-id="${questionId}" data-type="${type}">
      <div class="question-header">
        <span class="question-type-badge mp">Match Person/Feature</span>
        <button type="button" class="remove-btn" onclick="removeQuestion(${questionId})">Remove</button>
      </div>
      <textarea placeholder="Group instruction (optional)" class="group-instruction" rows="2"></textarea>
      <input type="text" placeholder="Statement to match" class="question-text">
      <input type="text" placeholder="Correct answer letter (A, B, C, etc.)" class="question-answer">
      <div class="options-container">
        <label style="display: block; margin: 10px 0 5px; font-weight: 600;">
          Options (shared across all match person questions):
          <button type="button" onclick="toggleOptionsEdit(${questionId}, 'match-person')" style="margin-left: 10px; padding: 2px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Edit Options</button>
        </label>
        <div class="match-options" id="match-options-${questionId}" style="display: none;">
          ${sharedOptions["match-person"]
            .map(
              (opt) => `
            <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
              <input type="text" value="${opt.label}" class="option-label" style="width: 40px; text-align: center;">
              <input type="text" value="${opt.text}" placeholder="Enter name/text" class="option-text" data-label="${opt.label}" style="flex: 1;">
              <button type="button" onclick="removeOption(this, 'match-person')" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>
            </div>
          `
            )
            .join("")}
          <button type="button" onclick="addOption(${questionId}, 'match-person')" style="margin-top: 5px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">+ Add Option</button>
        </div>
        <div class="options-preview" id="options-preview-${questionId}">
          ${sharedOptions["match-person"]
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

  document
    .getElementById(`questionMenu${passageNumber}`)
    .classList.remove("show");
};

// Toggle options edit view
window.toggleOptionsEdit = function (questionId, type) {
  const optionsDiv = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  const previewDiv = document.getElementById(`options-preview-${questionId}`);

  if (optionsDiv.style.display === "none") {
    optionsDiv.style.display = "block";
    previewDiv.style.display = "none";
  } else {
    // Save changes to shared options
    updateSharedOptions(questionId, type);
    optionsDiv.style.display = "none";
    previewDiv.style.display = "block";
    // Update preview
    updateAllOptionsPreview(type);
  }
};

// Update shared options from inputs
function updateSharedOptions(questionId, type) {
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  const newOptions = [];

  container.querySelectorAll(".option-row").forEach((row) => {
    const label = row.querySelector(".option-label").value.trim();
    const text = row.querySelector(".option-text").value.trim();
    if (label) {
      newOptions.push({ label, text });
    }
  });

  sharedOptions[type] = newOptions;
}

// Update all previews of the same type
function updateAllOptionsPreview(type) {
  document
    .querySelectorAll(`.question-item[data-type="${type}"]`)
    .forEach((item) => {
      const questionId = item.dataset.questionId;
      const previewDiv = document.getElementById(
        `options-preview-${questionId}`
      );
      if (previewDiv) {
        previewDiv.innerHTML = sharedOptions[type]
          .map(
            (opt) =>
              `<span style="display: inline-block; margin: 2px; padding: 3px 8px; background: #f0f0f0; border-radius: 3px; font-size: 12px;">${
                opt.label
              }: ${opt.text || "(empty)"}</span>`
          )
          .join("");
      }
    });
}

// Add new option
window.addOption = function (questionId, type) {
  const container = document.getElementById(
    `${type === "paragraph-matching" ? "pm" : "match"}-options-${questionId}`
  );
  const existingOptions = container.querySelectorAll(".option-row").length;
  const nextLetter = String.fromCharCode(65 + existingOptions);

  const optionHTML = `
    <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
      <input type="text" value="${nextLetter}" class="option-label" style="width: 40px; text-align: center;">
      <input type="text" placeholder="Enter text" class="option-text" data-label="${nextLetter}" style="flex: 1;">
      <button type="button" onclick="removeOption(this, '${type}')" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>
    </div>
  `;

  // Insert before the Add button
  const addButton = container.querySelector('button[onclick*="addOption"]');
  addButton.insertAdjacentHTML("beforebegin", optionHTML);
};

// Remove option
window.removeOption = function (button, type) {
  button.parentElement.remove();
};

window.addMatchOption = function (questionId) {
  const container = document.getElementById(`match-options-${questionId}`);
  const existingOptions = container.querySelectorAll(".option-row").length;
  const nextLetter = String.fromCharCode(65 + existingOptions); // A, B, C, etc.

  const optionHTML = `
    <div class="option-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
      <span style="min-width: 25px; font-weight: bold;">${nextLetter}</span>
      <input type="text" placeholder="Option ${nextLetter}" class="option-text" data-label="${nextLetter}" style="flex: 1;">
      <button type="button" onclick="this.parentElement.remove()" style="padding: 2px 10px; background: #ff4444; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", optionHTML);
};

// Remove a question
window.removeQuestion = function (questionId) {
  const question = document.querySelector(`[data-question-id="${questionId}"]`);
  if (question && confirm("Are you sure you want to remove this question?")) {
    question.remove();
  }
};

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

    // Update instructions
    const instructionsInput = passage.querySelector(".passage-instructions");
    if (instructionsInput) {
      instructionsInput.value = `You should spend about 20 minutes on Questions ${getQuestionRange(
        newNumber
      )}`;
    }

    // Update question menu ID
    const questionMenu = passage.querySelector(".question-types-menu");
    if (questionMenu) {
      questionMenu.id = `questionMenu${newNumber}`;
    }

    // Update questions container ID
    const questionsContainer = passage.querySelector(".questions-container");
    if (questionsContainer) {
      questionsContainer.id = `questions${newNumber}`;
    }

    // Update onclick handlers
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

    // Update question type options
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
    const questions = passage.querySelectorAll(".question-item");

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

// Collect test data
function collectTestData() {
  const passages = [];
  const passageElements = document.querySelectorAll(".passage-container");

  passageElements.forEach((passageEl) => {
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

      // Добавляем groupInstruction если есть
      const groupInstruction = questionEl
        .querySelector(".group-instruction")
        ?.value.trim();
      if (groupInstruction) {
        questionData.groupInstruction = groupInstruction;
      }

      // Обработка разных типов вопросов
      // Обработка разных типов вопросов
      if (type === "text-question") {
        // Для text-question собираем все возможные поля
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

        // Для gap-fill добавляем title и subheading
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

          questionData.options = sharedOptions[type].map((opt) => ({
            label: opt.label,
            text: opt.text,
          }));
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

    // Validate each question
    // Validate each question
    for (let question of questions) {
      const type = question.dataset.type;

      // Text-question не требует ответа
      if (type === "text-question") {
        const text = question.querySelector(".question-text").value.trim();
        if (!text) {
          alert("Please fill in text for all text-only items");
          return false;
        }
        continue; // Пропускаем остальные проверки
      }

      const questionText = question
        .querySelector(".question-text")
        .value.trim();
      if (!questionText) {
        alert("Please fill in all question texts");
        return false;
      }

      // Остальная валидация как была...

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

  // Disable submit button and show loader
  submitBtn.disabled = true;
  submitText.textContent = "Adding test...";
  loader.style.display = "inline-block";

  try {
    // Collect test data
    const testData = collectTestData();

    console.log("💾 Saving test data:", testData);

    // Save to Firestore with specific document ID
    const docId = `test-${nextTestNumber}`;
    await setDoc(doc(db, "readingTests", docId), testData);
    console.log("✅ Test added with ID:", docId);

    // Show success message
    const successModal = document.getElementById("successModal");
    const successMessage = document.getElementById("successMessage");
    successMessage.textContent = `Reading Test ${nextTestNumber} has been added successfully!`;
    successModal.style.display = "flex";

    // Update next test number
    nextTestNumber++;
  } catch (error) {
    console.error("❌ Error adding test:", error);
    alert(`❌ Error adding test: ${error.message}`);
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitText.textContent = "Add Reading Test";
    loader.style.display = "none";
  }
}

// Reset form for adding another test
window.resetForm = function () {
  // Hide success modal
  document.getElementById("successModal").style.display = "none";

  // Clear passages
  document.getElementById("passagesContainer").innerHTML = "";
  passageCount = 0;
  questionIdCounter = 0;

  // Update displays
  updatePassageCount();
  updateAddPassageButton();

  // Update test number
  getNextTestNumber();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📚 Reading Test Add page loaded");

  // Check admin access
  await checkAdminAccess();

  // Get next test number
  await getNextTestNumber();

  // Setup event listeners
  document
    .getElementById("addPassageBtn")
    .addEventListener("click", addPassage);
  document.getElementById("previewBtn").addEventListener("click", previewTest);
  document
    .getElementById("readingTestForm")
    .addEventListener("submit", handleFormSubmit);

  // Add first passage automatically
  addPassage();

  console.log("✅ Page initialized successfully");
});
