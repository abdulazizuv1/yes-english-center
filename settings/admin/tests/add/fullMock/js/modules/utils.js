// utils.js - Shared utilities, DOM generators, and formatters

export let questionIdCounter = 0;

// Generates an HTML block for standard question types (Listening/Reading)
export function generateQuestionHTML(type, questionId) {
  let html = "";
  
  switch (type) {
    case "text":
      html = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-type-badge text">Text</span>
            <button type="button" class="remove-btn" onclick="utils.removeQuestion(${questionId})">Remove</button>
          </div>
          <textarea placeholder="Text content" class="question-value" rows="3"></textarea>
        </div>
      `;
      break;

    case "subheading":
      html = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-type-badge subheading">Subheading</span>
            <button type="button" class="remove-btn" onclick="utils.removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Subheading text" class="question-value form-input">
        </div>
      `;
      break;

    case "gap-fill":
      html = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
            <span class="question-type-badge gap-fill">Gap Fill</span>
            <button type="button" class="remove-btn remove-block-btn" onclick="utils.removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (optional, use \\n for paragraphs)" class="group-instruction form-input" style="margin-bottom: 0.5rem;">
          <input type="text" placeholder="Question text (use _____ for gaps)" class="question-text form-input" style="margin-bottom: 0.5rem;">
          <input type="text" placeholder="Postfix (optional)" class="question-postfix form-input" style="margin-bottom: 0.5rem;">
          <input type="text" placeholder="Correct answer" class="question-answer form-input" style="margin-bottom: 0.5rem;">
          <input type="number" placeholder="Word limit (optional)" class="question-word-limit form-input" min="1" max="10">
        </div>
      `;
      break;

    case "multiple-choice":
      html = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
            <span class="question-type-badge multiple-choice">Multiple Choice</span>
            <button type="button" class="remove-btn remove-block-btn" onclick="utils.removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (optional, use \\n for paragraphs)" class="group-instruction form-input" style="margin-bottom: 0.5rem;">
          <input type="text" placeholder="Question text" class="question-text form-input" style="margin-bottom: 0.5rem;">
          <div class="question-options">
            <label style="display:block; margin: 0.5rem 0;">Options:</label>
            <div class="mc-options-list" id="mc-options-${questionId}">
              <div class="mc-option-item" style="display:flex; gap:0.5rem; margin-bottom: 0.5rem;">
                <input type="radio" name="mc-${questionId}" value="A" class="mc-radio">
                <input type="text" placeholder="Option A" class="option-text form-input">
              </div>
              <div class="mc-option-item" style="display:flex; gap:0.5rem; margin-bottom: 0.5rem;">
                <input type="radio" name="mc-${questionId}" value="B" class="mc-radio">
                <input type="text" placeholder="Option B" class="option-text form-input">
              </div>
              <div class="mc-option-item" style="display:flex; gap:0.5rem; margin-bottom: 0.5rem;">
                <input type="radio" name="mc-${questionId}" value="C" class="mc-radio">
                <input type="text" placeholder="Option C" class="option-text form-input">
              </div>
            </div>
            <button type="button" onclick="utils.addMCOptionToQuestion(${questionId})" class="nav-btn secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">+ Add Option</button>
          </div>
        </div>
      `;
      break;

    // Expand as needed for table and true-false-notgiven
    case "true-false-notgiven":
      html = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
            <span class="question-type-badge text">TFNG / YNNG</span>
            <button type="button" class="remove-btn remove-block-btn" onclick="utils.removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (optional)" class="group-instruction form-input" style="margin-bottom: 0.5rem;">
          <input type="text" placeholder="Question text/Statement" class="question-text form-input" style="margin-bottom: 0.5rem;">
          <select class="question-answer settings-select">
            <option value="TRUE">TRUE (or YES)</option>
            <option value="FALSE">FALSE (or NO)</option>
            <option value="NOT GIVEN">NOT GIVEN</option>
          </select>
        </div>
      `;
      break;
        
    case "question-group":
      html = `
        <div class="question-item" data-question-id="${questionId}" data-type="${type}">
          <div class="question-header">
            <span class="question-number" style="margin-right:8px; font-weight:600;">Q<span class="question-index"></span>.</span>
            <span class="question-type-badge question-group">Question Group</span>
            <button type="button" class="remove-btn remove-block-btn" onclick="utils.removeQuestion(${questionId})">Remove</button>
          </div>
          <input type="text" placeholder="Group instruction (Use \\n for paragraphs)" class="group-instruction form-input" style="margin-bottom: 0.5rem;">
          <select class="group-type settings-select" style="margin-bottom: 0.5rem;" onchange="utils.handleGroupTypeChange(${questionId}, this.value)">
            <option value="multi-select">Multi Select</option>
            <option value="matching">Matching</option>
            <option value="paragraph-matching">Paragraph Matching</option>
          </select>
          
          <div class="multi-select-question" id="multi-select-question-${questionId}">
            <input type="text" placeholder="Question text (e.g., Which THREE features...?)" class="question-text form-input" style="margin-bottom: 0.5rem;">
          </div>
          
          <div class="group-options">
            <label style="display:block; margin: 0.5rem 0;">Options:</label>
            <div class="options-list" id="options-list-${questionId}">
              <div class="option-item" style="display:flex; gap:0.5rem; margin-bottom: 0.5rem;">
                <input type="text" value="A" class="option-label form-input" style="width: 50px;">
                <input type="text" placeholder="Option A text" class="option-text form-input">
                <button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button>
              </div>
              <div class="option-item" style="display:flex; gap:0.5rem; margin-bottom: 0.5rem;">
                <input type="text" value="B" class="option-label form-input" style="width: 50px;">
                <input type="text" placeholder="Option B text" class="option-text form-input">
                <button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button>
              </div>
            </div>
            <button type="button" onclick="utils.addGroupOption(${questionId})" class="nav-btn secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">+ Add Option</button>
          </div>
          
          <div class="group-questions matching-questions" id="matching-questions-${questionId}" style="display: none; margin-top: 1rem;">
            <label style="display:block; margin: 0.5rem 0;">Individual Questions:</label>
            <div class="questions-list" id="group-questions-list-${questionId}">
              <div class="group-question-item" style="display:flex; gap:0.5rem; margin-bottom: 0.5rem;">
                <input type="text" placeholder="Question/Statement text" class="group-question-text form-input">
                <input type="text" placeholder="Correct answer (A, B...)" class="group-question-answer form-input" style="width: 150px;">
                <button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button>
              </div>
            </div>
            <button type="button" onclick="utils.addGroupSubQuestion(${questionId})" class="nav-btn secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">+ Add Question</button>
          </div>
          
          <div class="group-answer-section multi-select-answers" id="multi-select-answers-${questionId}" style="margin-top: 1rem;">
            <label>Correct Answers (comma-separated):</label>
            <input type="text" placeholder="e.g., A,B,C" class="group-correct-answers form-input" style="margin-bottom: 0.5rem;">
          </div>
        </div>
      `;
      break;      
  }
  
  return html;
}

export function generateQuestionMenuHTML(containerId, sectionId) {
    return `
        <div class="add-question-wrapper" style="position: relative; margin-top: 1rem;">
            <button type="button" class="add-btn" onclick="document.getElementById('qm-${sectionId}').classList.toggle('show')" style="border-style: solid;">
                Add Question
            </button>
            <div id="qm-${sectionId}" class="question-menu" style="display:none; position:absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <button type="button" class="nav-btn secondary" style="display:block; width:100%; text-align:left; border:none; margin-bottom:2px;" onclick="window.${containerId}.addQuestion(${sectionId}, 'gap-fill'); this.parentElement.classList.remove('show');">Gap Fill</button>
                <button type="button" class="nav-btn secondary" style="display:block; width:100%; text-align:left; border:none; margin-bottom:2px;" onclick="window.${containerId}.addQuestion(${sectionId}, 'multiple-choice'); this.parentElement.classList.remove('show');">Multiple Choice</button>
                <button type="button" class="nav-btn secondary" style="display:block; width:100%; text-align:left; border:none; margin-bottom:2px;" onclick="window.${containerId}.addQuestion(${sectionId}, 'question-group'); this.parentElement.classList.remove('show');">Question Group / Matching</button>
                <button type="button" class="nav-btn secondary" style="display:block; width:100%; text-align:left; border:none; margin-bottom:2px;" onclick="window.${containerId}.addQuestion(${sectionId}, 'true-false-notgiven'); this.parentElement.classList.remove('show');">True/False/Not Given</button>
                <hr style="margin: 0.5rem 0; border:none; border-top: 1px solid #e2e8f0;">
                <button type="button" class="nav-btn secondary" style="display:block; width:100%; text-align:left; border:none; margin-bottom:2px;" onclick="window.${containerId}.addQuestion(${sectionId}, 'text'); this.parentElement.classList.remove('show');">Text Only</button>
                <button type="button" class="nav-btn secondary" style="display:block; width:100%; text-align:left; border:none; margin-bottom:2px;" onclick="window.${containerId}.addQuestion(${sectionId}, 'subheading'); this.parentElement.classList.remove('show');">Subheading</button>
            </div>
        </div>
    `;
}

// Global utilities attached to window for inline onclick handlers
window.utils = {
    removeQuestion: function(id) {
        if(confirm("Remove this question?")) {
            const el = document.querySelector(`[data-question-id="${id}"]`);
            if(el) {
                // Determine which container to update based on where it came from
                const section = el.closest('.section-block');
                el.remove();
                if(section) {
                    const evt = new CustomEvent('questionRemoved', { bubbles: true });
                    section.dispatchEvent(evt);
                }
            }
        }
    },
    
    addMCOptionToQuestion: function(id) {
        const list = document.getElementById(`mc-options-${id}`);
        const nextLetter = String.fromCharCode(65 + list.children.length); // A, B, C...
        const item = document.createElement('div');
        item.className = 'mc-option-item';
        item.style.cssText = 'display:flex; gap:0.5rem; margin-bottom: 0.5rem;';
        item.innerHTML = `
            <input type="radio" name="mc-${id}" value="${nextLetter}" class="mc-radio">
            <input type="text" placeholder="Option ${nextLetter}" class="option-text form-input">
        `;
        list.appendChild(item);
    },

    handleGroupTypeChange: function(id, type) {
        const msQuestion = document.getElementById(`multi-select-question-${id}`);
        const msAnswers = document.getElementById(`multi-select-answers-${id}`);
        const matchQuestions = document.getElementById(`matching-questions-${id}`);
        
        if (type === "multi-select") {
            msQuestion.style.display = "block";
            msAnswers.style.display = "block";
            matchQuestions.style.display = "none";
        } else {
            msQuestion.style.display = "none";
            msAnswers.style.display = "none";
            matchQuestions.style.display = "block";
        }
    },

    addGroupOption: function(id) {
        const list = document.getElementById(`options-list-${id}`);
        const nextLetter = String.fromCharCode(65 + list.children.length);
        const item = document.createElement('div');
        item.className = 'option-item';
        item.style.cssText = 'display:flex; gap:0.5rem; margin-bottom: 0.5rem;';
        item.innerHTML = `
            <input type="text" value="${nextLetter}" class="option-label form-input" style="width: 50px;">
            <input type="text" placeholder="Option ${nextLetter} text" class="option-text form-input">
            <button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button>
        `;
        list.appendChild(item);
    },

    addGroupSubQuestion: function(id) {
        const list = document.getElementById(`group-questions-list-${id}`);
        const item = document.createElement('div');
        item.className = 'group-question-item';
        item.style.cssText = 'display:flex; gap:0.5rem; margin-bottom: 0.5rem;';
        item.innerHTML = `
            <input type="text" placeholder="Question/Statement text" class="group-question-text form-input">
            <input type="text" placeholder="Correct answer (A, B...)" class="group-question-answer form-input" style="width: 150px;">
            <button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button>
        `;
        list.appendChild(item);
    }
};

export function updateQuestionNumbers(containerElement) {
    if (!containerElement) return;
    
    let qIndex = 1;
    const questions = containerElement.querySelectorAll('.question-item');
    
    questions.forEach(q => {
        const type = q.dataset.type;
        // Non-numbered items
        if (type === 'text' || type === 'subheading') return;

        // Special handling for groups
        if (type === 'question-group') {
            const groupSelect = q.querySelector('.group-type');
            if (groupSelect && ['matching', 'paragraph-matching'].includes(groupSelect.value)) {
                // Count subquestions
                const subqs = q.querySelectorAll('.group-question-item');
                const count = subqs.length;
                if(count > 0) {
                     const qSpan = q.querySelector('.question-index');
                     if(qSpan) qSpan.textContent = `${qIndex}-${qIndex + count - 1}`;
                     qIndex += count;
                }
                return;
            } else if (groupSelect && groupSelect.value === 'multi-select') {
                const answerInput = q.querySelector('.group-correct-answers');
                let count = 1;
                if(answerInput && answerInput.value) {
                     count = answerInput.value.split(',').filter(x => x.trim()).length;
                     if(count === 0) count = 1;
                } else {
                     count = 2; // Default multi-select is usually 2
                }
                const qSpan = q.querySelector('.question-index');
                if(qSpan) qSpan.textContent = count > 1 ? `${qIndex}-${qIndex + count - 1}` : `${qIndex}`;
                qIndex += count;
                return;
            }
        }

        // Standard single question
        const qSpan = q.querySelector('.question-index');
        if (qSpan) {
            qSpan.textContent = qIndex;
            qIndex++;
        }
    });

    return qIndex - 1; // Return total number of questions
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Generate unique ID utility
export function getUniqueId() {
    questionIdCounter++;
    return questionIdCounter;
}
