// listening.js - Full Mock Listening Module
import { uploadFile } from './firebase.js';

export let listeningSectionCount = 0;
let globalListeningAudioFile = null;

export function initListeningUI() {
    // Audio Type toggle
    document.querySelectorAll('input[name="listeningAudioType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isSingle = e.target.value === 'single';
            document.getElementById('singleAudioZone').style.display = isSingle ? 'block' : 'none';
            document.querySelectorAll('.section-audio-upload').forEach(el => el.style.display = isSingle ? 'none' : 'block');
        });
    });

    // Global Audio handlers
    const globalInput = document.getElementById('globalAudioFile');
    if (globalInput) {
        globalInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('audio/')) { alert('Please upload a valid audio file'); e.target.value = ''; return; }
            globalListeningAudioFile = file;
            document.getElementById('globalAudioPreviewName').textContent = file.name;
            document.getElementById('globalAudioPreviewSize').textContent = window.utils.formatFileSize(file.size);
            document.getElementById('globalAudioPlayer').src = URL.createObjectURL(file);
            document.getElementById('globalAudioPreview').classList.add('show');
        });
    }

    document.getElementById('playGlobalAudioBtn')?.addEventListener('click', () => document.getElementById('globalAudioPlayer').play());
    document.getElementById('pauseGlobalAudioBtn')?.addEventListener('click', () => document.getElementById('globalAudioPlayer').pause());
    document.getElementById('removeGlobalAudioBtn')?.addEventListener('click', () => {
        document.getElementById('globalAudioFile').value = '';
        globalListeningAudioFile = null;
        document.getElementById('globalAudioPreview').classList.remove('show');
        document.getElementById('globalAudioPlayer').pause();
        document.getElementById('globalAudioPlayer').src = '';
    });

    document.getElementById('addListeningSectionBtn')?.addEventListener('click', addListeningSection);
}

window.listeningLogic = {
    addQuestion(sectionId, type) {
        const container = document.getElementById(`listening-questions-${sectionId}`);
        const qId = window.utils.getUniqueId();
        container.insertAdjacentHTML('beforeend', window.utils.generateQuestionHTML(type, qId));
        // After adding, update question numbers in this section
        window.utils.updateQuestionNumbers(container);
    },
    removeSection(sectionId) {
        if (confirm("Remove this listening part?")) {
            document.querySelector(`#listening-section-${sectionId}`).remove();
            listeningSectionCount--;
        }
    },
    handleSectionAudioUpload(sectionId) {
        const input = document.getElementById(`listeningAudioFile${sectionId}`);
        const file = input.files[0];
        if (!file || !file.type.startsWith('audio/')) { alert('Please upload an audio file'); input.value = ''; return; }
        document.getElementById(`listeningAudioPreviewName${sectionId}`).textContent = file.name;
        document.getElementById(`listeningAudioPreviewSize${sectionId}`).textContent = window.utils.formatFileSize(file.size);
        document.getElementById(`listeningAudioPlayer${sectionId}`).src = URL.createObjectURL(file);
        document.getElementById(`listeningAudioPreview${sectionId}`).classList.add('show');
    },
    playSectionAudio(id) { document.getElementById(`listeningAudioPlayer${id}`).play(); },
    pauseSectionAudio(id) { document.getElementById(`listeningAudioPlayer${id}`).pause(); },
    removeSectionAudio(id) {
        document.getElementById(`listeningAudioFile${id}`).value = '';
        document.getElementById(`listeningAudioPreview${id}`).classList.remove('show');
        const p = document.getElementById(`listeningAudioPlayer${id}`); p.pause(); p.src = '';
    }
};

function addListeningSection() {
    if (listeningSectionCount >= 4) { alert("Maximum 4 sections allowed for Listening."); return; }
    listeningSectionCount++;
    const idx = listeningSectionCount;
    const isSingle = document.querySelector('input[name="listeningAudioType"]:checked').value === 'single';

    const html = `
        <div class="section-block" id="listening-section-${idx}" data-section="${idx}">
            <div class="section-block-header">
                <div class="section-block-title">Part ${idx}</div>
                <button type="button" class="remove-block-btn" onclick="listeningLogic.removeSection(${idx})">Remove Part</button>
            </div>
            <div class="form-group">
                <label>Part Title (e.g., Transport survey)</label>
                <input type="text" class="section-title-input form-input" placeholder="Survey title">
            </div>
            <div class="section-audio-upload" style="display:${isSingle ? 'none' : 'block'};margin-bottom:2rem">
                <div class="audio-upload" id="listeningAudioUpload${idx}">
                    <input type="file" id="listeningAudioFile${idx}" accept="audio/*" onchange="listeningLogic.handleSectionAudioUpload(${idx})">
                    <label for="listeningAudioFile${idx}" class="audio-upload-label">
                        <svg class="audio-upload-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        <div class="audio-upload-text">Upload Part ${idx} Audio</div>
                    </label>
                </div>
                <div class="audio-preview" id="listeningAudioPreview${idx}">
                    <div class="audio-preview-info">
                        <span class="audio-preview-name" id="listeningAudioPreviewName${idx}"></span>
                        <span class="audio-preview-size" id="listeningAudioPreviewSize${idx}"></span>
                    </div>
                    <div class="audio-preview-controls">
                        <button type="button" onclick="listeningLogic.playSectionAudio(${idx})">▶</button>
                        <button type="button" onclick="listeningLogic.pauseSectionAudio(${idx})">⏸</button>
                        <button type="button" onclick="listeningLogic.removeSectionAudio(${idx})" class="remove-audio">🗑</button>
                    </div>
                    <audio id="listeningAudioPlayer${idx}" style="display:none"></audio>
                </div>
            </div>
            <div class="instructions-section" style="background:rgba(139,92,246,0.05);padding:1rem;border-radius:.5rem;margin-bottom:1.5rem">
                <h4 style="margin-bottom:1rem;color:var(--listening-color)">Part Instructions</h4>
                <div class="form-group" style="margin-bottom:.5rem"><input type="text" class="instructions-heading form-input" placeholder="Heading (e.g., Questions 1-10)"></div>
                <div class="form-group" style="margin-bottom:.5rem"><input type="text" class="instructions-details form-input" placeholder="Details (e.g., Complete the notes below)"></div>
                <div class="form-group" style="margin-bottom:0"><input type="text" class="instructions-note form-input" placeholder="Note (e.g., Write ONE WORD ONLY)"></div>
            </div>
            <div>
                <h4 style="margin-bottom:1rem">Questions</h4>
                <div class="questions-container" id="listening-questions-${idx}"></div>
                ${window.utils.generateListeningMenuHTML(idx)}
            </div>
        </div>`;
    document.getElementById('listeningSectionsContainer').insertAdjacentHTML('beforeend', html);
}

// ===== Data Collection =====
export async function collectListeningData(testId) {
    const isSingleAudio = document.querySelector('input[name="listeningAudioType"]:checked').value === 'single';
    let audioMode = isSingleAudio ? 'single' : 'separate';
    let audioUrl = "";

    if (isSingleAudio) {
        if (!globalListeningAudioFile) throw new Error("Listening: Master Audio file required in Single mode.");
        audioUrl = { file: globalListeningAudioFile, type: 'global' };
    }

    const sections = [];
    const sectionBlocks = document.querySelectorAll('#listeningSectionsContainer .section-block');
    if (sectionBlocks.length === 0) throw new Error("Listening: At least one section must be added.");

    let globalQNum = 1;

    for (let i = 0; i < sectionBlocks.length; i++) {
        const block = sectionBlocks[i];
        const title = block.querySelector('.section-title-input').value.trim();
        const heading = block.querySelector('.instructions-heading').value.trim();
        const details = block.querySelector('.instructions-details').value.trim();
        const note = block.querySelector('.instructions-note').value.trim();

        // Only the title is required now — per-question groupInstruction drives
        // the on-screen instructions, so section heading/details are optional.
        if (!title) throw new Error(`Listening Part ${i+1}: Title is required.`);

        let sectionAudioUrl = "";
        if (!isSingleAudio) {
            const input = block.querySelector('.audio-upload input[type="file"]');
            if (!input?.files[0]) throw new Error(`Listening Part ${i+1}: Audio file missing.`);
            sectionAudioUrl = { file: input.files[0], type: 'section', index: i+1 };
        }

        const { questions, nextQNum } = extractListeningQuestions(block.querySelector('.questions-container'), globalQNum);
        globalQNum = nextQNum;

        if (questions.length === 0) throw new Error(`Listening Part ${i+1}: Must contain at least one question.`);

        sections.push({
            sectionNumber: i + 1,
            title, audioUrl: sectionAudioUrl,
            instructions: { heading, details, note },
            content: questions
        });
    }

    return { id: "listening", title: "Listening Test", duration: 30, audioMode, audioUrl, sections, totalQuestions: globalQNum - 1 };
}

function extractListeningQuestions(container, startQNum) {
    const items = container.querySelectorAll('.question-item');
    const result = [];
    let qNum = startQNum;

    items.forEach(el => {
        const type = el.dataset.type;
        const gi = el.querySelector('.group-instruction')?.value?.trim() || "";

        if (type === 'text') {
            result.push({
                type: 'text',
                groupInstruction: gi || null,
                value: el.querySelector('.question-value')?.value || ""
            });
        } else if (type === 'subheading') {
            result.push({
                type: 'subheading',
                groupInstruction: gi || null,
                value: el.querySelector('.question-value')?.value || ""
            });
        } else if (type === 'gap-fill') {
            result.push({
                type: 'question', questionId: `q${qNum}`, format: 'gap-fill',
                groupInstruction: gi || null,
                text: el.querySelector('.question-text')?.value || "",
                postfix: el.querySelector('.question-postfix')?.value || "",
                correctAnswer: el.querySelector('.question-answer')?.value || "",
                wordLimit: parseInt(el.querySelector('.question-word-limit')?.value) || null
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
                type: 'question', questionId: `q${qNum}`, format: 'multiple-choice',
                groupInstruction: gi || null,
                text: el.querySelector('.question-text')?.value || "",
                options,
                correctAnswer: el.querySelector('input[type="radio"]:checked')?.value || ""
            });
            qNum++;
        } else if (type === 'true-false-notgiven') {
            result.push({
                type: 'question', questionId: `q${qNum}`, format: 'true-false-notgiven',
                groupInstruction: gi || null,
                text: el.querySelector('.question-text')?.value || "",
                correctAnswer: el.querySelector('.question-answer')?.value || ""
            });
            qNum++;
        } else if (type === 'table') {
            const tableData = extractTableData(el, el.dataset.questionId, qNum);
            result.push(tableData.data);
            qNum = tableData.nextQNum;
        } else if (type === 'question-group') {
            const groupData = extractQuestionGroupData(el, qNum);
            result.push(groupData.data);
            qNum = groupData.nextQNum;
        }
    });

    return { questions: result, nextQNum: qNum };
}

function extractTableData(el, questionId, startQNum) {
    let qNum = startQNum;
    const data = {
        type: 'table',
        title: el.querySelector('.table-title')?.value?.trim() || "",
        groupInstruction: el.querySelector('.group-instruction')?.value?.trim() || "",
        columns: [],
        rows: [],
        questions: {},
        answer: {}
    };

    // Columns
    el.querySelector(`#header-row-${questionId}`)?.querySelectorAll('.header-input').forEach(h => {
        const v = h.value.trim(); if (v) data.columns.push(v);
    });

    // The admin sees UI counter numbers next to table inputs and types the
    // answer list against them — remember which UI number became which final
    // question number so the answers can be remapped on save.
    const uiToFinal = {};

    // The test page turns ONLY the ___qN___ marker into an input, so every
    // question cell's text must contain exactly that marker with the FINAL
    // number. Normalise whatever the admin typed (___q7___, 1____, ____) —
    // or append the marker if the text has no blank at all.
    const normalizeCellMarker = (content, finalNum) => {
        const marker = `___q${finalNum}___`;
        if (/___q\d+___/.test(content)) return content.replace(/___q\d+___/, marker);
        if (/(?<!_)\d+\s*_{2,}/.test(content)) return content.replace(/(?<!_)\d+\s*_{2,}/, marker);
        if (/_{2,}/.test(content)) return content.replace(/_{2,}/, marker);
        return `${content} ${marker}`;
    };

    const registerGapCell = (inp, ri, ci, colName, appendVal) => {
        const content = inp.value.trim();
        if (!content) return appendVal;
        const ui = parseInt(inp.getAttribute('data-question-number'), 10);
        if (Number.isFinite(ui)) uiToFinal[String(ui)] = qNum;
        const normalized = normalizeCellMarker(content, qNum);
        data.questions[qNum] = { questionId: `q${qNum}`, text: normalized, row: ri, column: ci, columnName: colName };
        qNum++;
        return appendVal ? `${appendVal}<br>${normalized}` : normalized;
    };

    // Rows
    const tbody = el.querySelector(`#table-body-${questionId}`);
    if (tbody) {
        tbody.querySelectorAll('.data-row').forEach((row, ri) => {
            const rowData = {};
            row.querySelectorAll('.data-cell').forEach((cell, ci) => {
                const cellType = cell.querySelector('.cell-type').value;
                const cc = cell.querySelector('.cell-content');
                const colName = data.columns[ci]?.toLowerCase().replace(/\s+/g, '') || `col${ci+1}`;

                if (cellType === 'question') {
                    let val = '';
                    cc.querySelectorAll('.cell-input[data-question-number]').forEach(inp => {
                        val = registerGapCell(inp, ri, ci, colName, val);
                    });
                    cc.querySelectorAll('.additional-question .cell-input[data-question-number]').forEach(inp => {
                        val = registerGapCell(inp, ri, ci, colName, val);
                    });
                    rowData[colName] = val;
                } else if (cellType === 'multiple-choice') {
                    let val = '';
                    cc.querySelectorAll('.mc-cell-content').forEach(mc => {
                        const inp = mc.querySelector('.cell-input');
                        if (inp) {
                            const txt = inp.value.trim();
                            const opts = {}; mc.querySelectorAll('.mc-option').forEach(o => {
                                const l = o.querySelector('.mc-radio')?.value; const t = o.querySelector('.mc-option-text')?.value?.trim();
                                if (l && t) opts[l] = t;
                            });
                            const correct = mc.querySelector('input[type="radio"]:checked')?.value || '';
                            if (txt) {
                                if (!correct) throw new Error(`Listening table: multiple-choice question "${txt.slice(0, 40)}" has no correct answer selected.`);
                                const ui = parseInt(inp.getAttribute('data-question-number'), 10);
                                if (Number.isFinite(ui)) uiToFinal[String(ui)] = qNum;
                                val += `Q${qNum}: ${txt}<br>`;
                                data.questions[qNum] = { questionId: `q${qNum}`, text: txt, format: 'multiple-choice', options: opts, correctAnswer: correct, row: ri, column: ci, columnName: colName };
                                qNum++;
                            }
                        }
                    });
                    rowData[colName] = val;
                } else {
                    let val = '';
                    cc.querySelectorAll('.cell-input').forEach(inp => { const v = inp.value.trim(); if (v) { if (val) val += '<br>'; val += v; } });
                    rowData[colName] = val;
                }
            });
            data.rows.push(rowData);
        });
    }

    // Answers — typed against the UI numbers, saved against the final ones.
    // Unknown keys are a hard error: silently saving them used to produce
    // ungradable tables.
    const answersText = el.querySelector('.table-answers-text')?.value?.trim() || "";
    if (answersText) {
        answersText.split(',').forEach(pair => {
            const [k, v] = pair.split('=');
            if (!k || !v || !v.trim()) return;
            const uiKey = String(parseInt(k.trim().replace(/^q+/i, ''), 10));
            const finalNum = uiToFinal[uiKey];
            if (finalNum === undefined) {
                const valid = Object.keys(uiToFinal).map(n => 'q' + n).join(', ') || 'none';
                throw new Error(`Listening table: answer key "${k.trim()}" does not match any question in this table. Question numbers here: ${valid}.`);
            }
            data.answer[`q${finalNum}`] = v.trim();
        });
    }

    // Every gap question needs an answer, otherwise the test can't be graded
    const finalToUi = {};
    Object.entries(uiToFinal).forEach(([ui, fin]) => { finalToUi[fin] = ui; });
    Object.entries(data.questions).forEach(([num, q]) => {
        if (q.format === 'multiple-choice') return;
        if (!data.answer[`q${num}`]) {
            const label = finalToUi[num] ? `q${finalToUi[num]}` : `q${num}`;
            throw new Error(`Listening table: question ${label} has no answer. Add it to the answers field as "${label}=your answer".`);
        }
    });

    return { data, nextQNum: qNum };
}

function extractQuestionGroupData(el, startQNum) {
    let qNum = startQNum;
    const gt = el.querySelector('.group-type')?.value || 'multi-select';
    const data = {
        type: 'question-group',
        groupInstruction: el.querySelector('.group-instruction')?.value?.trim() || "",
        groupType: gt
    };

    const start = qNum;
    if (gt === 'matching') {
        data.options = {};
        el.querySelectorAll('.options-list .option-item').forEach(item => {
            const label = item.querySelector('.option-label')?.value?.trim();
            const text = item.querySelector('.option-text')?.value?.trim();
            if (label && text) data.options[label] = text;
        });
        data.questions = [];
        el.querySelectorAll('.group-question-item').forEach(item => {
            const text = item.querySelector('.group-question-text')?.value?.trim() || "";
            const answer = item.querySelector('.group-question-answer')?.value?.trim() || "";
            data.questions.push({ questionId: `q${qNum}`, text, correctAnswer: answer });
            qNum++;
        });
    } else {
        data.text = el.querySelector('.question-text')?.value?.trim() || "";
        data.options = {};
        el.querySelectorAll('.options-list .option-item').forEach(item => {
            const label = item.querySelector('.option-label')?.value?.trim();
            const text = item.querySelector('.option-text')?.value?.trim();
            if (label && text) data.options[label] = text;
        });
        const answers = el.querySelector('.group-correct-answers')?.value?.trim() || "";
        const correctAnswers = answers.split(',').map(a => a.trim()).filter(Boolean);
        data.correctAnswers = correctAnswers;
        // Emit one gradeable sub-question per answer letter, with sequential
        // ids — the test page needs `questions[]` to render and grade the group.
        data.questions = correctAnswers.map((ans, i) => ({
            questionId: `q${start + i}`,
            correctAnswer: ans,
        }));
        qNum += correctAnswers.length || 1;
    }

    // Group id spans its sub-questions (e.g. q28_30), matching the test page.
    const end = qNum - 1;
    data.questionId = end > start ? `q${start}_${end}` : `q${start}`;

    return { data, nextQNum: qNum };
}
