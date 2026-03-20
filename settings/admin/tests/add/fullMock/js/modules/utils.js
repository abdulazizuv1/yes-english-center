// utils.js - Shared utilities, DOM generators, and formatters
export let questionIdCounter = 0;

export function getUniqueId() { return ++questionIdCounter; }

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, sizes = ['Bytes','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===== LISTENING Question Menu (matches add/listening style) =====
export function generateListeningMenuHTML(sectionId) {
  const menuId = `lqm-${sectionId}`;
  return `
    <div class="add-question-dropdown" style="margin-top:10px;">
      <button type="button" class="add-question-btn" onclick="utils.toggleMenu('${menuId}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Add Question
      </button>
      <div class="question-types-menu" id="${menuId}">
        <div class="question-type-option" onclick="listeningLogic.addQuestion(${sectionId},'text');utils.hideMenu('${menuId}')">
          <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          Text Only</div>
        <div class="question-type-option" onclick="listeningLogic.addQuestion(${sectionId},'subheading');utils.hideMenu('${menuId}')">
          <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h12"/></svg>
          Subheading</div>
        <div class="question-type-option" onclick="listeningLogic.addQuestion(${sectionId},'gap-fill');utils.hideMenu('${menuId}')">
          <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
          Gap Fill</div>
        <div class="question-type-option" onclick="listeningLogic.addQuestion(${sectionId},'multiple-choice');utils.hideMenu('${menuId}')">
          <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
          Multiple Choice</div>
        <div class="question-type-option" onclick="listeningLogic.addQuestion(${sectionId},'table');utils.hideMenu('${menuId}')">
          <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
          Table Completion</div>
        <div class="question-type-option" onclick="listeningLogic.addQuestion(${sectionId},'question-group');utils.hideMenu('${menuId}')">
          <svg class="option-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          Question Group</div>
      </div>
    </div>`;
}

// ===== READING Question Menu =====
export function generateReadingMenuHTML(passageId) {
  const menuId = `rqm-${passageId}`;
  return `
    <div class="add-question-dropdown" style="margin-top:10px;">
      <button type="button" class="add-question-btn" onclick="utils.toggleMenu('${menuId}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Add Question
      </button>
      <div class="question-types-menu" id="${menuId}">
        <div class="question-type-option" onclick="readingLogic.addQuestion(${passageId},'text-question');utils.hideMenu('${menuId}')">Text Only (No Question)</div>
        <div class="question-type-option" onclick="readingLogic.addQuestion(${passageId},'gap-fill');utils.hideMenu('${menuId}')">Gap Fill</div>
        <div class="question-type-option" onclick="readingLogic.addQuestion(${passageId},'true-false-notgiven');utils.hideMenu('${menuId}')">True/False/Not Given</div>
        <div class="question-type-option" onclick="readingLogic.addQuestion(${passageId},'yes-no-notgiven');utils.hideMenu('${menuId}')">Yes/No/Not Given</div>
        <div class="question-type-option" onclick="readingLogic.addQuestion(${passageId},'multiple-choice');utils.hideMenu('${menuId}')">Multiple Choice</div>
        <div class="question-type-option" onclick="readingLogic.addQuestion(${passageId},'paragraph-matching');utils.hideMenu('${menuId}')">Paragraph Matching</div>
        <div class="question-type-option" onclick="readingLogic.addQuestion(${passageId},'match-person');utils.hideMenu('${menuId}')">Match Person/Feature</div>
        <div class="question-type-option" onclick="readingLogic.addQuestion(${passageId},'multi-select');utils.hideMenu('${menuId}')">Multi-Select</div>
      </div>
    </div>`;
}

// ===== Question HTML Generator =====
export function generateQuestionHTML(type, questionId) {
  const rmBtn = `<button type="button" class="remove-btn remove-block-btn" onclick="utils.removeQuestion(${questionId})">Remove</button>`;
  const qNum = `<span class="question-number" style="margin-right:8px;font-weight:600;">Q<span class="question-index"></span>.</span>`;
  switch (type) {
    case 'text':
      return `<div class="question-item" data-question-id="${questionId}" data-type="text">
        <div class="question-header"><span class="question-type-badge text">Text</span>${rmBtn}</div>
        <textarea placeholder="Text content" class="question-value form-input" rows="3"></textarea></div>`;
    case 'subheading':
      return `<div class="question-item" data-question-id="${questionId}" data-type="subheading">
        <div class="question-header"><span class="question-type-badge subheading">Subheading</span>${rmBtn}</div>
        <input type="text" placeholder="Subheading text" class="question-value form-input"></div>`;
    case 'gap-fill':
      return `<div class="question-item" data-question-id="${questionId}" data-type="gap-fill">
        <div class="question-header">${qNum}<span class="question-type-badge gap-fill">Gap Fill</span>${rmBtn}</div>
        <input type="text" placeholder="Group instruction (optional)" class="group-instruction form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Question text (use _____ for gaps)" class="question-text form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Postfix (optional)" class="question-postfix form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Correct answer" class="question-answer form-input" style="margin-bottom:.5rem">
        <input type="number" placeholder="Word limit (optional)" class="question-word-limit form-input" min="1" max="10"></div>`;
    case 'multiple-choice':
      return `<div class="question-item" data-question-id="${questionId}" data-type="multiple-choice">
        <div class="question-header">${qNum}<span class="question-type-badge multiple-choice">Multiple Choice</span>${rmBtn}</div>
        <input type="text" placeholder="Group instruction (optional)" class="group-instruction form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Question text" class="question-text form-input" style="margin-bottom:.5rem">
        <div class="question-options"><label style="display:block;margin:.5rem 0">Options:</label>
          <div class="mc-options-list" id="mc-options-${questionId}">
            <div class="mc-option-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="radio" name="mc-${questionId}" value="A" class="mc-radio"><input type="text" placeholder="Option A" class="option-text form-input"></div>
            <div class="mc-option-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="radio" name="mc-${questionId}" value="B" class="mc-radio"><input type="text" placeholder="Option B" class="option-text form-input"></div>
            <div class="mc-option-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="radio" name="mc-${questionId}" value="C" class="mc-radio"><input type="text" placeholder="Option C" class="option-text form-input"></div>
          </div>
          <button type="button" onclick="utils.addMCOption(${questionId})" class="nav-btn secondary" style="padding:.25rem .5rem;font-size:.75rem">+ Add Option</button>
        </div></div>`;
    case 'true-false-notgiven':
      return `<div class="question-item" data-question-id="${questionId}" data-type="true-false-notgiven">
        <div class="question-header">${qNum}<span class="question-type-badge tfng">True/False/Not Given</span>${rmBtn}</div>
        <textarea placeholder="Group instruction (optional)" class="group-instruction form-input" rows="2" style="margin-bottom:.5rem"></textarea>
        <input type="text" placeholder="Statement" class="question-text form-input" style="margin-bottom:.5rem">
        <select class="question-answer settings-select"><option value="">Select answer</option><option value="TRUE">TRUE</option><option value="FALSE">FALSE</option><option value="NOT GIVEN">NOT GIVEN</option></select></div>`;
    case 'yes-no-notgiven':
      return `<div class="question-item" data-question-id="${questionId}" data-type="yes-no-notgiven">
        <div class="question-header">${qNum}<span class="question-type-badge ynng">Yes/No/Not Given</span>${rmBtn}</div>
        <textarea placeholder="Group instruction (optional)" class="group-instruction form-input" rows="2" style="margin-bottom:.5rem"></textarea>
        <input type="text" placeholder="Statement" class="question-text form-input" style="margin-bottom:.5rem">
        <select class="question-answer settings-select"><option value="">Select answer</option><option value="YES">YES</option><option value="NO">NO</option><option value="NOT GIVEN">NOT GIVEN</option></select></div>`;
    case 'question-group':
      return `<div class="question-item" data-question-id="${questionId}" data-type="question-group">
        <div class="question-header">${qNum}<span class="question-type-badge question-group">Question Group</span>${rmBtn}</div>
        <input type="text" placeholder="Group instruction" class="group-instruction form-input" style="margin-bottom:.5rem">
        <select class="group-type settings-select" style="margin-bottom:.5rem" onchange="utils.handleGroupTypeChange(${questionId},this.value)">
          <option value="multi-select">Multi Select</option><option value="matching">Matching</option></select>
        <div class="multi-select-question" id="multi-select-question-${questionId}">
          <input type="text" placeholder="Question text" class="question-text form-input" style="margin-bottom:.5rem"></div>
        <div class="group-options"><label style="display:block;margin:.5rem 0">Options:</label>
          <div class="options-list" id="options-list-${questionId}">
            <div class="option-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="text" value="A" class="option-label form-input" style="width:50px"><input type="text" placeholder="Option A" class="option-text form-input"><button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button></div>
            <div class="option-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="text" value="B" class="option-label form-input" style="width:50px"><input type="text" placeholder="Option B" class="option-text form-input"><button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button></div>
          </div>
          <button type="button" onclick="utils.addGroupOption(${questionId})" class="nav-btn secondary" style="padding:.25rem .5rem;font-size:.75rem">+ Add Option</button></div>
        <div class="group-questions matching-questions" id="matching-questions-${questionId}" style="display:none;margin-top:1rem">
          <label style="display:block;margin:.5rem 0">Individual Questions:</label>
          <div class="questions-list" id="group-questions-list-${questionId}">
            <div class="group-question-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="text" placeholder="Question/Statement" class="group-question-text form-input"><input type="text" placeholder="Answer (A,B...)" class="group-question-answer form-input" style="width:150px"><button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button></div>
          </div>
          <button type="button" onclick="utils.addGroupSubQuestion(${questionId})" class="nav-btn secondary" style="padding:.25rem .5rem;font-size:.75rem">+ Add Question</button></div>
        <div class="group-answer-section multi-select-answers" id="multi-select-answers-${questionId}" style="margin-top:1rem">
          <label>Correct Answers (comma-separated):</label>
          <input type="text" placeholder="e.g., A,B,C" class="group-correct-answers form-input"></div></div>`;
    case 'table':
      return `<div class="question-item" data-question-id="${questionId}" data-type="table">
        <div class="question-header">${qNum}<span class="question-type-badge table">Table</span>${rmBtn}</div>
        <input type="text" placeholder="Table title (optional)" class="table-title form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Group instruction (optional)" class="group-instruction form-input" style="margin-bottom:.5rem">
        <div class="table-builder">
          <div class="table-controls">
            <button type="button" onclick="utils.addTableColumn(${questionId})" class="control-btn add-column-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Column</button>
            <button type="button" onclick="utils.addTableRow(${questionId})" class="control-btn add-row-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Row</button>
          </div>
          <div class="table-container"><table class="question-table" id="question-table-${questionId}">
            <thead><tr id="header-row-${questionId}">
              <th class="header-cell"><input type="text" value="Field" class="header-input" placeholder="Column header"><button type="button" onclick="utils.removeTableColumn(${questionId},0)" class="remove-cell-btn">×</button></th>
              <th class="header-cell"><input type="text" value="Information" class="header-input" placeholder="Column header"><button type="button" onclick="utils.removeTableColumn(${questionId},1)" class="remove-cell-btn">×</button></th>
            </tr></thead>
            <tbody id="table-body-${questionId}">
              <tr class="data-row">
                <td class="data-cell"><select class="cell-type" onchange="utils.updateCellType(this,${questionId},0,0)"><option value="text" selected>Text</option><option value="question">Question</option><option value="multiple-choice">Multiple Choice</option><option value="example">Example</option></select><div class="cell-content"><input type="text" class="cell-input" placeholder="Cell content"></div><button type="button" class="add-question-in-cell-btn" onclick="utils.addQuestionToCell(this,${questionId},0,0)" style="display:none">+</button></td>
                <td class="data-cell"><select class="cell-type" onchange="utils.updateCellType(this,${questionId},0,1)"><option value="text">Text</option><option value="question" selected>Question</option><option value="multiple-choice">Multiple Choice</option><option value="example">Example</option></select><div class="cell-content"><input type="text" class="cell-input" placeholder="e.g., 1_____" data-question-number="1"></div><button type="button" class="add-question-in-cell-btn" onclick="utils.addQuestionToCell(this,${questionId},0,1)">+</button></td>
              </tr>
            </tbody>
          </table></div>
          <div class="table-answers"><label>Answers (format: q1=answer1, q2=answer2):</label>
            <textarea placeholder="q1=theatre, q2=4.30..." class="table-answers-text" rows="3"></textarea></div>
        </div></div>`;
    case 'text-question':
      return `<div class="question-item" data-question-id="${questionId}" data-type="text-question">
        <div class="question-header"><span class="question-type-badge text-header">Text/Header</span>${rmBtn}</div>
        <textarea placeholder="Group instruction (optional)" class="group-instruction form-input" rows="3" style="margin-bottom:.5rem"></textarea>
        <input type="text" placeholder="Title (optional)" class="question-title form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Subheading (optional)" class="question-subheading form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Plain text (optional)" class="question-text form-input">
        <small style="color:#888">Fill any or all fields</small></div>`;
    case 'paragraph-matching':
      return `<div class="question-item" data-question-id="${questionId}" data-type="paragraph-matching">
        <div class="question-header">${qNum}<span class="question-type-badge pm">Paragraph Matching</span>${rmBtn}</div>
        <textarea placeholder="Group instruction (optional)" class="group-instruction form-input" rows="2" style="margin-bottom:.5rem"></textarea>
        <input type="text" placeholder="Question/Information to find" class="question-text form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Correct answer (A, B, C...)" class="question-answer form-input" style="margin-bottom:.5rem">
        <div class="options-container"><label style="display:block;margin:10px 0 5px;font-weight:600">Options:</label>
          <div class="pm-options" id="pm-options-${questionId}">
            <div class="option-row"><input type="text" value="A" class="option-label" style="width:40px;text-align:center"><input type="text" value="Paragraph A" class="option-text" style="flex:1"><button type="button" onclick="utils.removePMOption(this)" style="padding:2px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>
            <div class="option-row"><input type="text" value="B" class="option-label" style="width:40px;text-align:center"><input type="text" value="Paragraph B" class="option-text" style="flex:1"><button type="button" onclick="utils.removePMOption(this)" style="padding:2px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>
            <div class="option-row"><input type="text" value="C" class="option-label" style="width:40px;text-align:center"><input type="text" value="Paragraph C" class="option-text" style="flex:1"><button type="button" onclick="utils.removePMOption(this)" style="padding:2px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>
          </div>
          <button type="button" onclick="utils.addPMOption(${questionId})" style="margin-top:5px;padding:5px 15px;background:#4CAF50;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px">+ Add Option</button>
        </div></div>`;
    case 'match-person':
      return `<div class="question-item" data-question-id="${questionId}" data-type="match-person">
        <div class="question-header">${qNum}<span class="question-type-badge mp">Match Person/Feature</span>${rmBtn}</div>
        <textarea placeholder="Group instruction (optional)" class="group-instruction form-input" rows="2" style="margin-bottom:.5rem"></textarea>
        <input type="text" placeholder="Statement to match" class="question-text form-input" style="margin-bottom:.5rem">
        <input type="text" placeholder="Correct answer letter (A, B...)" class="question-answer form-input" style="margin-bottom:.5rem">
        <div class="options-container"><label style="display:block;margin:10px 0 5px;font-weight:600">Options:</label>
          <div class="match-options" id="match-options-${questionId}">
            <div class="option-row"><input type="text" value="A" class="option-label" style="width:40px;text-align:center"><input type="text" placeholder="Person/Feature name" class="option-text" style="flex:1"><button type="button" onclick="utils.removePMOption(this)" style="padding:2px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>
            <div class="option-row"><input type="text" value="B" class="option-label" style="width:40px;text-align:center"><input type="text" placeholder="Person/Feature name" class="option-text" style="flex:1"><button type="button" onclick="utils.removePMOption(this)" style="padding:2px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>
          </div>
          <button type="button" onclick="utils.addMatchOption(${questionId})" style="margin-top:5px;padding:5px 15px;background:#4CAF50;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px">+ Add Option</button>
        </div></div>`;
    case 'multi-select':
      return `<div class="question-item" data-question-id="${questionId}" data-type="multi-select">
        <div class="question-header">${qNum}<span class="question-type-badge ms">Multi-Select</span>${rmBtn}</div>
        <textarea placeholder="Group instruction (e.g., Choose TWO letters, A-E)" class="group-instruction form-input" rows="2" style="margin-bottom:.5rem"></textarea>
        <input type="text" placeholder="Question text" class="multi-select-text form-input" style="margin-bottom:.5rem">
        <div class="multi-select-subquestions" id="multi-select-questions-${questionId}" style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
          <div class="multi-select-subquestion" style="padding:10px;background:#f8f9fa;border-radius:6px"><label style="font-weight:600;display:block;margin-bottom:6px">Statement 1:</label><input class="subquestion-answer-input form-input" placeholder="Answer letter" oninput="this.value=this.value.toUpperCase()"></div>
          <div class="multi-select-subquestion" style="padding:10px;background:#f8f9fa;border-radius:6px"><label style="font-weight:600;display:block;margin-bottom:6px">Statement 2:</label><input class="subquestion-answer-input form-input" placeholder="Answer letter" oninput="this.value=this.value.toUpperCase()"></div>
        </div>
        <button type="button" onclick="utils.addMultiSelectSub(${questionId})" style="margin-top:10px;padding:6px 14px;background:#4CAF50;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px">+ Add Sub-question</button>
        <div class="options-container" style="margin-top:15px"><label style="display:block;margin:10px 0 5px;font-weight:600">Options:</label>
          <div class="multi-select-options-list" id="multi-select-options-${questionId}" style="display:flex;flex-direction:column;gap:8px">
            <div class="option-row"><input type="text" value="A" class="option-label" style="width:40px;text-align:center" readonly><input type="text" placeholder="Option A" class="option-text" style="flex:1"><button type="button" onclick="utils.removeMultiSelectOpt(this,${questionId})" style="padding:4px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>
            <div class="option-row"><input type="text" value="B" class="option-label" style="width:40px;text-align:center" readonly><input type="text" placeholder="Option B" class="option-text" style="flex:1"><button type="button" onclick="utils.removeMultiSelectOpt(this,${questionId})" style="padding:4px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>
            <div class="option-row"><input type="text" value="C" class="option-label" style="width:40px;text-align:center" readonly><input type="text" placeholder="Option C" class="option-text" style="flex:1"><button type="button" onclick="utils.removeMultiSelectOpt(this,${questionId})" style="padding:4px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>
          </div>
          <button type="button" onclick="utils.addMultiSelectOpt(${questionId})" style="margin-top:8px;padding:6px 14px;background:#4CAF50;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px">+ Add Option</button>
        </div></div>`;
    default: return '';
  }
}

// ===== Question Number Counting =====
export function updateQuestionNumbers(containerElement) {
  if (!containerElement) return 0;
  let qIndex = 1;
  containerElement.querySelectorAll('.question-item').forEach(q => {
    const type = q.dataset.type;
    if (['text','subheading','text-question'].includes(type)) return;
    if (type === 'question-group') {
      const gt = q.querySelector('.group-type')?.value || 'multi-select';
      if (gt === 'matching') {
        const cnt = q.querySelectorAll('.group-question-item').length;
        const s = q.querySelector('.question-index');
        if (s) s.textContent = cnt > 1 ? `${qIndex}-${qIndex+cnt-1}` : qIndex;
        qIndex += Math.max(cnt, 1); return;
      } else {
        const ai = q.querySelector('.group-correct-answers');
        let cnt = 2;
        if (ai && ai.value) { cnt = ai.value.split(',').filter(x=>x.trim()).length; if(!cnt) cnt=1; }
        const s = q.querySelector('.question-index');
        if (s) s.textContent = cnt > 1 ? `${qIndex}-${qIndex+cnt-1}` : qIndex;
        qIndex += cnt; return;
      }
    }
    if (type === 'table') {
      const tbl = q.querySelector('.question-table');
      if (tbl) {
        let tblCount = 0;
        tbl.querySelectorAll('.cell-type').forEach(sel => {
          if (sel.value === 'question' || sel.value === 'multiple-choice') tblCount++;
        });
        // Also count additional questions in cells
        tbl.querySelectorAll('.additional-question').forEach(() => tblCount++);
        const s = q.querySelector('.question-index');
        if (s) s.textContent = tblCount > 1 ? `${qIndex}-${qIndex+tblCount-1}` : qIndex;
        qIndex += Math.max(tblCount, 1);
      }
      return;
    }
    if (type === 'multi-select') {
      const cnt = q.querySelectorAll('.multi-select-subquestion').length || 2;
      const s = q.querySelector('.question-index');
      if (s) s.textContent = cnt > 1 ? `${qIndex}-${qIndex+cnt-1}` : qIndex;
      qIndex += cnt; return;
    }
    if (type === 'paragraph-matching' || type === 'match-person') {
      const s = q.querySelector('.question-index');
      if (s) s.textContent = qIndex;
      qIndex++; return;
    }
    const s = q.querySelector('.question-index');
    if (s) { s.textContent = qIndex; qIndex++; }
  });
  return qIndex - 1;
}

// ===== window.utils - Global Helper Functions =====
window.utils = {
  generateQuestionHTML, generateListeningMenuHTML, generateReadingMenuHTML,
  getUniqueId, formatFileSize, updateQuestionNumbers,

  toggleMenu(menuId) {
    const m = document.getElementById(menuId);
    if (!m) return;
    m.classList.toggle('show');
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!e.target.closest('.add-question-dropdown')) { m.classList.remove('show'); document.removeEventListener('click', close); }
      });
    }, 0);
  },
  hideMenu(menuId) { const m = document.getElementById(menuId); if (m) m.classList.remove('show'); },

  removeQuestion(id) {
    if (!confirm("Remove this question?")) return;
    const el = document.querySelector(`[data-question-id="${id}"]`);
    if (el) el.remove();
  },
  addMCOption(id) {
    const list = document.getElementById(`mc-options-${id}`);
    if (!list) return;
    const n = String.fromCharCode(65 + list.children.length);
    list.insertAdjacentHTML('beforeend', `<div class="mc-option-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="radio" name="mc-${id}" value="${n}" class="mc-radio"><input type="text" placeholder="Option ${n}" class="option-text form-input"></div>`);
  },
  handleGroupTypeChange(id, type) {
    const ms = document.getElementById(`multi-select-question-${id}`);
    const ma = document.getElementById(`multi-select-answers-${id}`);
    const mq = document.getElementById(`matching-questions-${id}`);
    if (type === 'multi-select') { ms.style.display='block'; ma.style.display='block'; mq.style.display='none'; }
    else { ms.style.display='none'; ma.style.display='none'; mq.style.display='block'; }
  },
  addGroupOption(id) {
    const list = document.getElementById(`options-list-${id}`);
    const n = String.fromCharCode(65 + list.children.length);
    list.insertAdjacentHTML('beforeend', `<div class="option-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="text" value="${n}" class="option-label form-input" style="width:50px"><input type="text" placeholder="Option ${n}" class="option-text form-input"><button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button></div>`);
  },
  addGroupSubQuestion(id) {
    const list = document.getElementById(`group-questions-list-${id}`);
    list.insertAdjacentHTML('beforeend', `<div class="group-question-item" style="display:flex;gap:.5rem;margin-bottom:.5rem"><input type="text" placeholder="Question/Statement" class="group-question-text form-input"><input type="text" placeholder="Answer (A,B...)" class="group-question-answer form-input" style="width:150px"><button type="button" onclick="this.parentElement.remove()" class="remove-block-btn">×</button></div>`);
  },

  // Table helpers
  addTableColumn(qid) {
    const hr = document.getElementById(`header-row-${qid}`);
    const tb = document.getElementById(`table-body-${qid}`);
    const ci = hr.children.length;
    hr.insertAdjacentHTML('beforeend', `<th class="header-cell"><input type="text" value="Column ${ci+1}" class="header-input"><button type="button" onclick="utils.removeTableColumn(${qid},${ci})" class="remove-cell-btn">×</button></th>`);
    tb.querySelectorAll('.data-row').forEach((row, ri) => {
      row.insertAdjacentHTML('beforeend', `<td class="data-cell"><select class="cell-type" onchange="utils.updateCellType(this,${qid},${ri},${ci})"><option value="text">Text</option><option value="question" selected>Question</option><option value="multiple-choice">MC</option><option value="example">Example</option></select><div class="cell-content"><input type="text" class="cell-input" placeholder="Content" data-question-number="1"></div><button type="button" class="add-question-in-cell-btn" onclick="utils.addQuestionToCell(this,${qid},${ri},${ci})">+</button></td>`);
    });
  },
  addTableRow(qid) {
    const tb = document.getElementById(`table-body-${qid}`);
    const hr = document.getElementById(`header-row-${qid}`);
    const cols = hr.children.length, ri = tb.children.length;
    let cells = '';
    for (let i = 0; i < cols; i++) {
      const isFirst = i === 0;
      cells += `<td class="data-cell"><select class="cell-type" onchange="utils.updateCellType(this,${qid},${ri},${i})"><option value="text" ${isFirst?'selected':''}>Text</option><option value="question" ${!isFirst?'selected':''}>Question</option><option value="multiple-choice">MC</option><option value="example">Example</option></select><div class="cell-content">${isFirst ? `<input type="text" class="cell-input" placeholder="Cell content">` : `<input type="text" class="cell-input" placeholder="Content" data-question-number="1">`}</div><button type="button" class="add-question-in-cell-btn" onclick="utils.addQuestionToCell(this,${qid},${ri},${i})" style="display:${isFirst?'none':'inline-block'}">+</button></td>`;
    }
    tb.insertAdjacentHTML('beforeend', `<tr class="data-row">${cells}</tr>`);
  },
  removeTableColumn(qid, ci) {
    const hr = document.getElementById(`header-row-${qid}`);
    if (hr.children.length <= 1) { alert('Need at least 1 column'); return; }
    if (!confirm('Remove this column?')) return;
    hr.children[ci]?.remove();
    document.getElementById(`table-body-${qid}`).querySelectorAll('.data-row').forEach(r => r.children[ci]?.remove());
  },
  updateCellType(select, qid, ri, ci) {
    const cell = select.closest('.data-cell');
    const cc = cell.querySelector('.cell-content');
    const btn = cell.querySelector('.add-question-in-cell-btn');
    const t = select.value;
    if (t === 'text') { cc.innerHTML = `<input type="text" class="cell-input" placeholder="Cell content">`; if(btn) btn.style.display='none'; }
    else if (t === 'question') { cc.innerHTML = `<input type="text" class="cell-input" placeholder="e.g., 1_____" data-question-number="1">`; if(btn) btn.style.display='inline-block'; }
    else if (t === 'multiple-choice') {
      cc.innerHTML = `<div class="mc-cell-content"><input type="text" class="cell-input" placeholder="Question text" data-question-number="1"><div class="mc-options"><div class="mc-option"><input type="radio" name="mc_${qid}_${ri}_${ci}" value="A" class="mc-radio"><input type="text" placeholder="A" class="mc-option-text"></div><div class="mc-option"><input type="radio" name="mc_${qid}_${ri}_${ci}" value="B" class="mc-radio"><input type="text" placeholder="B" class="mc-option-text"></div><div class="mc-option"><input type="radio" name="mc_${qid}_${ri}_${ci}" value="C" class="mc-radio"><input type="text" placeholder="C" class="mc-option-text"></div></div></div>`;
      if(btn) btn.style.display='inline-block';
    }
    else if (t === 'example') { cc.innerHTML = `<input type="text" class="cell-input" placeholder="Example" data-example="true">`; if(btn) btn.style.display='none'; }
  },
  addQuestionToCell(button, qid, ri, ci) {
    const cc = button.closest('.data-cell').querySelector('.cell-content');
    const t = button.closest('.data-cell').querySelector('.cell-type').value;
    if (t !== 'question' && t !== 'multiple-choice') return;
    const sep = document.createElement('div'); sep.className='question-separator'; sep.innerHTML='<span style="background:#f0f0f0;padding:2px 8px;border-radius:3px;font-size:11px">Additional Q</span>';
    const div = document.createElement('div'); div.className='additional-question';
    if (t === 'question') div.innerHTML = `<input type="text" class="cell-input" placeholder="Content" data-question-number="1" style="margin-top:5px">`;
    else div.innerHTML = `<div class="mc-cell-content" style="margin-top:5px"><input type="text" class="cell-input" placeholder="Q text" data-question-number="1"><div class="mc-options" style="margin-top:5px"><div class="mc-option"><input type="radio" name="mc_${qid}_${ri}_${ci}_add" value="A" class="mc-radio"><input type="text" placeholder="A" class="mc-option-text"></div><div class="mc-option"><input type="radio" name="mc_${qid}_${ri}_${ci}_add" value="B" class="mc-radio"><input type="text" placeholder="B" class="mc-option-text"></div></div></div>`;
    const rmBtn = document.createElement('button'); rmBtn.type='button'; rmBtn.textContent='×'; rmBtn.className='remove-block-btn'; rmBtn.style.cssText='margin-left:5px;padding:2px 8px;font-size:14px';
    rmBtn.onclick = () => { if(confirm('Remove?')) { sep.remove(); div.remove(); }};
    sep.appendChild(rmBtn); cc.appendChild(sep); cc.appendChild(div);
  },

  // PM / Match options
  addPMOption(qid) {
    const c = document.getElementById(`pm-options-${qid}`);
    let mx = 64; c.querySelectorAll('.option-label').forEach(l => { const v = l.value.charCodeAt(0); if(v>mx&&v>=65&&v<=90) mx=v; });
    const n = String.fromCharCode(mx+1);
    c.insertAdjacentHTML('beforeend', `<div class="option-row"><input type="text" value="${n}" class="option-label" style="width:40px;text-align:center"><input type="text" placeholder="Paragraph ${n}" class="option-text" style="flex:1"><button type="button" onclick="utils.removePMOption(this)" style="padding:2px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>`);
  },
  addMatchOption(qid) {
    const c = document.getElementById(`match-options-${qid}`);
    let mx = 64; c.querySelectorAll('.option-label').forEach(l => { const v = l.value.charCodeAt(0); if(v>mx&&v>=65&&v<=90) mx=v; });
    const n = String.fromCharCode(mx+1);
    c.insertAdjacentHTML('beforeend', `<div class="option-row"><input type="text" value="${n}" class="option-label" style="width:40px;text-align:center"><input type="text" placeholder="Person/Feature" class="option-text" style="flex:1"><button type="button" onclick="utils.removePMOption(this)" style="padding:2px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>`);
  },
  removePMOption(btn) { if (confirm('Remove?')) btn.parentElement.remove(); },

  // Multi-select helpers
  addMultiSelectSub(qid) {
    const c = document.getElementById(`multi-select-questions-${qid}`);
    const idx = c.children.length + 1;
    c.insertAdjacentHTML('beforeend', `<div class="multi-select-subquestion" style="padding:10px;background:#f8f9fa;border-radius:6px"><label style="font-weight:600;display:block;margin-bottom:6px">Statement ${idx}:</label><input class="subquestion-answer-input form-input" placeholder="Answer letter" oninput="this.value=this.value.toUpperCase()"><button type="button" onclick="this.parentElement.remove()" class="remove-block-btn" style="margin-top:4px">× Remove</button></div>`);
  },
  addMultiSelectOpt(qid) {
    const c = document.getElementById(`multi-select-options-${qid}`);
    let mx = 64; c.querySelectorAll('.option-label').forEach(l => { const v = l.value.charCodeAt(0); if(v>mx&&v>=65&&v<=90) mx=v; });
    const n = String.fromCharCode(mx+1);
    c.insertAdjacentHTML('beforeend', `<div class="option-row"><input type="text" value="${n}" class="option-label" style="width:40px;text-align:center" readonly><input type="text" placeholder="Option ${n}" class="option-text" style="flex:1"><button type="button" onclick="utils.removeMultiSelectOpt(this,${qid})" style="padding:4px 10px;background:#ff4444;color:white;border:none;border-radius:3px;cursor:pointer">×</button></div>`);
  },
  removeMultiSelectOpt(btn, qid) {
    const c = document.getElementById(`multi-select-options-${qid}`);
    if (c.querySelectorAll('.option-row').length <= 2) { alert('Need at least 2 options'); return; }
    if (confirm('Remove?')) btn.parentElement.remove();
  },

  // Legacy compatibility
  toggleQuestionMenu(menuId) { this.toggleMenu(menuId); }
};
