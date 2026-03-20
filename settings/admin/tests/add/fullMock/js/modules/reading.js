// reading.js - Full Mock Reading Module

export let readingPassageCount = 0;

export function initReadingUI() {
    document.getElementById('addReadingPassageBtn')?.addEventListener('click', addReadingPassage);
}

window.readingLogic = {
    addQuestion(passageId, type) {
        const container = document.getElementById(`reading-questions-${passageId}`);
        const qId = window.utils.getUniqueId();
        container.insertAdjacentHTML('beforeend', window.utils.generateQuestionHTML(type, qId));
        window.utils.updateQuestionNumbers(container);
    },
    removePassage(passageId) {
        if (confirm("Remove this reading passage?")) {
            document.querySelector(`#reading-passage-${passageId}`).remove();
            readingPassageCount--;
        }
    }
};

function addReadingPassage() {
    if (readingPassageCount >= 3) { alert("Maximum 3 passages allowed for Reading."); return; }
    readingPassageCount++;
    const idx = readingPassageCount;

    const html = `
        <div class="section-block" id="reading-passage-${idx}" data-passage="${idx}">
            <div class="section-block-header">
                <div class="section-block-title">Passage ${idx}</div>
                <button type="button" class="remove-block-btn" onclick="readingLogic.removePassage(${idx})">Remove Passage</button>
            </div>
            <div class="form-group">
                <label>Passage Title <span class="required">*</span></label>
                <input type="text" class="passage-title-input form-input" placeholder="e.g., Urban Farming">
            </div>
            <div class="form-group">
                <label>Passage Instructions</label>
                <input type="text" class="passage-instructions form-input" placeholder="e.g., You should spend about 20 minutes on Questions 1-13">
            </div>
            <div class="form-group">
                <label>Passage Content (Text) <span class="required">*</span></label>
                <p class="helper-text" style="margin-bottom:.5rem">Use double newline for paragraphs.</p>
                <textarea class="passage-text-input form-input" rows="8" placeholder="Paste the reading text here..."></textarea>
            </div>
            <div>
                <h4 style="margin-bottom:1rem;color:var(--reading-color)">Questions</h4>
                <div class="questions-container" id="reading-questions-${idx}"></div>
                ${window.utils.generateReadingMenuHTML(idx)}
            </div>
        </div>`;
    document.getElementById('readingPassagesContainer').insertAdjacentHTML('beforeend', html);
}

// ===== Data Collection =====
export async function collectReadingData() {
    const passages = [];
    const passageBlocks = document.querySelectorAll('#readingPassagesContainer .section-block');
    if (passageBlocks.length === 0) throw new Error("Reading: At least one passage must be added.");

    let globalQNum = 1;

    for (let i = 0; i < passageBlocks.length; i++) {
        const block = passageBlocks[i];
        const title = block.querySelector('.passage-title-input').value.trim();
        const text = block.querySelector('.passage-text-input').value.trim();
        const instructions = block.querySelector('.passage-instructions').value.trim();

        if (!title || !text) throw new Error(`Reading Passage ${i+1}: Title and Content are required.`);

        const { questions, nextQNum } = extractReadingQuestions(block.querySelector('.questions-container'), globalQNum);
        globalQNum = nextQNum;

        if (questions.length === 0) throw new Error(`Reading Passage ${i+1}: Must contain at least one question.`);

        passages.push({ title, instructions, text, questions });
    }

    return { id: "reading", title: "Reading Test", duration: 60, passages, totalQuestions: globalQNum - 1 };
}

function extractReadingQuestions(container, startQNum) {
    const items = container.querySelectorAll('.question-item');
    const result = [];
    let qNum = startQNum;

    items.forEach(el => {
        const type = el.dataset.type;
        const gi = el.querySelector('.group-instruction')?.value?.trim() || "";

        if (type === 'text-question') {
            result.push({
                type: 'text-question',
                groupInstruction: gi || null,
                title: el.querySelector('.question-title')?.value?.trim() || "",
                subheading: el.querySelector('.question-subheading')?.value?.trim() || "",
                text: el.querySelector('.question-text')?.value?.trim() || ""
            });
        } else if (type === 'gap-fill') {
            result.push({
                type: 'gap-fill', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: el.querySelector('.question-text')?.value || "",
                postfix: el.querySelector('.question-postfix')?.value || "",
                answer: [el.querySelector('.question-answer')?.value || ""],
                wordLimit: parseInt(el.querySelector('.question-word-limit')?.value) || null
            });
            qNum++;
        } else if (type === 'true-false-notgiven') {
            result.push({
                type: 'true-false-notgiven', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: el.querySelector('.question-text')?.value || "",
                answer: el.querySelector('.question-answer')?.value || ""
            });
            qNum++;
        } else if (type === 'yes-no-notgiven') {
            result.push({
                type: 'yes-no-notgiven', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: el.querySelector('.question-text')?.value || "",
                answer: el.querySelector('.question-answer')?.value || ""
            });
            qNum++;
        } else if (type === 'multiple-choice') {
            const options = {};
            el.querySelectorAll('.mc-option-item').forEach(opt => {
                const letter = opt.querySelector('input[type="radio"]').value;
                const text = opt.querySelector('.option-text')?.value?.trim() || "";
                if (text) options[letter] = text;
            });
            result.push({
                type: 'multiple-choice', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: el.querySelector('.question-text')?.value || "",
                options,
                answer: el.querySelector('input[type="radio"]:checked')?.value || ""
            });
            qNum++;
        } else if (type === 'paragraph-matching') {
            const options = {};
            el.querySelectorAll('#pm-options-' + el.dataset.questionId + ' .option-row, .pm-options .option-row').forEach(row => {
                const label = row.querySelector('.option-label')?.value?.trim();
                const text = row.querySelector('.option-text')?.value?.trim();
                if (label) options[label] = text || "";
            });
            result.push({
                type: 'paragraph-matching', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: el.querySelector('.question-text')?.value || "",
                answer: el.querySelector('.question-answer')?.value || "",
                options
            });
            qNum++;
        } else if (type === 'match-person') {
            const options = {};
            el.querySelectorAll('.match-options .option-row').forEach(row => {
                const label = row.querySelector('.option-label')?.value?.trim();
                const text = row.querySelector('.option-text')?.value?.trim();
                if (label) options[label] = text || "";
            });
            result.push({
                type: 'match-person', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: el.querySelector('.question-text')?.value || "",
                answer: el.querySelector('.question-answer')?.value || "",
                options
            });
            qNum++;
        } else if (type === 'multi-select') {
            const options = {};
            el.querySelectorAll('.multi-select-options-list .option-row').forEach(row => {
                const label = row.querySelector('.option-label')?.value?.trim();
                const text = row.querySelector('.option-text')?.value?.trim();
                if (label) options[label] = text || "";
            });
            const subAnswers = [];
            el.querySelectorAll('.subquestion-answer-input').forEach(inp => {
                subAnswers.push(inp.value.trim().toUpperCase());
            });
            result.push({
                type: 'multi-select',
                questionIds: subAnswers.map((_, idx) => `q${qNum + idx}`),
                groupInstruction: gi || null,
                text: el.querySelector('.multi-select-text')?.value || "",
                options,
                answers: subAnswers
            });
            qNum += Math.max(subAnswers.length, 1);
        }
    });

    return { questions: result, nextQNum: qNum };
}
