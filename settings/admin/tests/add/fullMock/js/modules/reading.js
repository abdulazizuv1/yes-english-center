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

        const { questions, nextQNum } = extractReadingQuestions(block.querySelector('.questions-container'), globalQNum, i + 1);
        globalQNum = nextQNum;

        if (questions.length === 0) throw new Error(`Reading Passage ${i+1}: Must contain at least one question.`);

        passages.push({ title, instructions, text, questions });
    }

    return { id: "reading", title: "Reading Test", duration: 60, passages, totalQuestions: globalQNum - 1 };
}

function extractReadingQuestions(container, startQNum, passageNum) {
    const items = container.querySelectorAll('.question-item');
    const result = [];
    let qNum = startQNum;

    // The test page numbers questions by their ORDER and skips entries with an
    // empty `question` field. A question saved without text or answer therefore
    // silently shifts every following number — so we validate instead of saving.
    const fail = (msg) => { throw new Error(`Reading Passage ${passageNum}, Question ${qNum}: ${msg}`); };
    const requireText = (value, what = 'question text') => {
        if (!value || !value.trim()) fail(`${what} is empty.`);
        return value;
    };
    const requireAnswer = (value) => {
        if (!value || !value.trim()) fail('answer is missing.');
        return value;
    };
    // The test page renders matching options with options.map(...) — must be an array
    const collectOptionRows = (rows) => {
        const options = [];
        rows.forEach(row => {
            const label = row.querySelector('.option-label')?.value?.trim();
            const text = row.querySelector('.option-text')?.value?.trim();
            if (label) options.push({ label, text: text || "" });
        });
        return options;
    };

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
                question: requireText(el.querySelector('.question-text')?.value || ""),
                postfix: el.querySelector('.question-postfix')?.value || "",
                answer: [requireAnswer(el.querySelector('.question-answer')?.value || "")],
                wordLimit: parseInt(el.querySelector('.question-word-limit')?.value) || null
            });
            qNum++;
        } else if (type === 'true-false-notgiven') {
            result.push({
                type: 'true-false-notgiven', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: requireText(el.querySelector('.question-text')?.value || ""),
                answer: requireAnswer(el.querySelector('.question-answer')?.value || "")
            });
            qNum++;
        } else if (type === 'yes-no-notgiven') {
            result.push({
                type: 'yes-no-notgiven', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: requireText(el.querySelector('.question-text')?.value || ""),
                answer: requireAnswer(el.querySelector('.question-answer')?.value || "")
            });
            qNum++;
        } else if (type === 'multiple-choice') {
            const options = {};
            el.querySelectorAll('.mc-option-item').forEach(opt => {
                const letter = opt.querySelector('input[type="radio"]').value;
                const text = opt.querySelector('.option-text')?.value?.trim() || "";
                if (text) options[letter] = text;
            });
            if (Object.keys(options).length === 0) fail('multiple-choice has no options.');
            result.push({
                type: 'multiple-choice', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: requireText(el.querySelector('.question-text')?.value || ""),
                options,
                answer: requireAnswer(el.querySelector('input[type="radio"]:checked')?.value || "")
            });
            qNum++;
        } else if (type === 'paragraph-matching') {
            const options = collectOptionRows(
                el.querySelectorAll('#pm-options-' + el.dataset.questionId + ' .option-row, .pm-options .option-row'));
            if (options.length === 0) fail('paragraph-matching has no options.');
            result.push({
                type: 'paragraph-matching', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: requireText(el.querySelector('.question-text')?.value || ""),
                answer: requireAnswer(el.querySelector('.question-answer')?.value || ""),
                options
            });
            qNum++;
        } else if (type === 'match-person') {
            const options = collectOptionRows(el.querySelectorAll('.match-options .option-row'));
            if (options.length === 0) fail('match-person has no options.');
            result.push({
                type: 'match-person', questionId: `q${qNum}`,
                groupInstruction: gi || null,
                question: requireText(el.querySelector('.question-text')?.value || ""),
                answer: requireAnswer(el.querySelector('.question-answer')?.value || ""),
                options
            });
            qNum++;
        } else if (type === 'multi-select') {
            // Saved in the site-compatible "question-group" format: the test page
            // renders type question-group / groupType multi-select and grades each
            // sub-question by its correctAnswer field. The old flat "multi-select"
            // format was invisible to the test page and shifted all numbering.
            const options = {};
            el.querySelectorAll('.multi-select-options-list .option-row').forEach(row => {
                const label = row.querySelector('.option-label')?.value?.trim();
                const text = row.querySelector('.option-text')?.value?.trim();
                if (label && text) options[label] = text;
            });
            const subAnswers = [];
            el.querySelectorAll('.subquestion-answer-input').forEach(inp => {
                const v = inp.value.trim().toUpperCase();
                if (v) subAnswers.push(v);
            });
            if (Object.keys(options).length === 0) fail('multi-select has no options.');
            if (subAnswers.length === 0) fail('multi-select has no answer letters.');
            subAnswers.forEach(a => {
                if (!options[a]) fail(`multi-select answer "${a}" does not match any option letter.`);
            });
            result.push({
                type: 'question-group',
                groupType: 'multi-select',
                questionId: subAnswers.length > 1 ? `q${qNum}_${qNum + subAnswers.length - 1}` : `q${qNum}`,
                groupInstruction: gi || null,
                text: requireText(el.querySelector('.multi-select-text')?.value || ""),
                options,
                questions: subAnswers.map((ans, idx) => ({
                    questionId: `q${qNum + idx}`,
                    correctAnswer: ans
                }))
            });
            qNum += subAnswers.length;
        }
    });

    return { questions: result, nextQNum: qNum };
}
