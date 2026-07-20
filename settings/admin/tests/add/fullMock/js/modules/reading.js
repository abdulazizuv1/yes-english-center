// reading.js — Full Mock Reading module. Passage flow lives here;
// question forms and collection come from the shared authoring engine.
// Reading questions carry no fixed ids in Firestore — the test pages
// number them by order at render time — so collection just validates
// and counts.
import { collectAll, assignReadingNumbers } from "/pages/mock/engine/author.js";
import { normalizeReadingQuestions } from "/pages/mock/engine/normalize.js";
import { gradeItems } from "/pages/mock/engine/grade.js";

export let readingPassageCount = 0;

export function initReadingUI() {
    document.getElementById('addReadingPassageBtn')?.addEventListener('click', addReadingPassage);
}

window.readingLogic = {
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
                ${window.utils.menuHTML('reading', `reading-questions-${idx}`)}
            </div>
        </div>`;
    document.getElementById('readingPassagesContainer').insertAdjacentHTML('beforeend', html);
}

// ===== Data Collection =====
export async function collectReadingData() {
    const passages = [];
    const passageBlocks = document.querySelectorAll('#readingPassagesContainer .section-block');
    if (passageBlocks.length === 0) throw new Error("Reading: At least one passage must be added.");

    let totalQuestions = 0;

    for (let i = 0; i < passageBlocks.length; i++) {
        const block = passageBlocks[i];
        const title = block.querySelector('.passage-title-input').value.trim();
        const text = block.querySelector('.passage-text-input').value.trim();
        const instructions = block.querySelector('.passage-instructions').value.trim();

        if (!title || !text) throw new Error(`Reading Passage ${i+1}: Title and Content are required.`);

        const questions = collectAll(block.querySelector('.questions-container'), 'reading', `Reading Passage ${i+1}, `);
        if (questions.length === 0) throw new Error(`Reading Passage ${i+1}: Must contain at least one question.`);

        // Count gradeable rows exactly the way the test engine will:
        // number a clone by order (as the test pages do), then grade it
        const clone = structuredClone(questions);
        let c = 1;
        clone.forEach((q) => {
            if (q.question && q.type !== 'drag_drop') q.qId = `q${c++}`;
            if (q.type === 'question-group' && q.questions) q.questions.forEach((s) => { s.qId = `q${c++}`; });
            if (q.type === 'drag_drop' && q.slots) q.slots.forEach((s) => { s.qId = `q${c++}`; });
            if (q.type === 'map-labelling' && q.questions) q.questions.forEach((s) => { s.qId = `q${c++}`; });
            if (q.type === 'table' && q.rows) {
                const keys = (q.columns || []).slice(1).map((x) => x.toLowerCase());
                q.rows.forEach((row) => keys.forEach((k) => {
                    if (typeof row[k] === 'string') row[k] = row[k].replace(/___q\d+___/g, () => `___q${c++}___`);
                }));
            }
        });
        totalQuestions += gradeItems(normalizeReadingQuestions(clone), {}).total;

        passages.push({ title, instructions, text, questions });
    }

    // table markers/answers must be saved against the final global numbers
    assignReadingNumbers(passages);

    return { id: "reading", title: "Reading Test", duration: 60, passages, totalQuestions };
}
