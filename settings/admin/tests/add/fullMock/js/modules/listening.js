// listening.js — Full Mock Listening module. Section/audio flow lives
// here; question forms and collection come from the shared authoring
// engine (pages/mock/engine/author.js). On save every gradeable entry
// gets its final sequential q-number, including the new drag & drop and
// map labelling types.
import { collectAll, assignListeningNumbers } from "/pages/mock/engine/author.js";

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
                ${window.utils.menuHTML('listening', `listening-questions-${idx}`)}
            </div>
        </div>`;
    document.getElementById('listeningSectionsContainer').insertAdjacentHTML('beforeend', html);
}

// ===== Data Collection =====
export async function collectListeningData() {
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

    let n = 1; // global question number across all sections

    for (let i = 0; i < sectionBlocks.length; i++) {
        const block = sectionBlocks[i];
        const title = block.querySelector('.section-title-input').value.trim();
        const heading = block.querySelector('.instructions-heading').value.trim();
        const details = block.querySelector('.instructions-details').value.trim();
        const note = block.querySelector('.instructions-note').value.trim();

        if (!title) throw new Error(`Listening Part ${i+1}: Title is required.`);

        let sectionAudioUrl = "";
        if (!isSingleAudio) {
            const input = block.querySelector('.audio-upload input[type="file"]');
            if (!input?.files[0]) throw new Error(`Listening Part ${i+1}: Audio file missing.`);
            sectionAudioUrl = { file: input.files[0], type: 'section', index: i+1 };
        }

        const items = collectAll(block.querySelector('.questions-container'), 'listening', `Listening Part ${i+1}, `);
        if (items.length === 0) throw new Error(`Listening Part ${i+1}: Must contain at least one question.`);
        n = assignListeningNumbers(items, n);

        sections.push({
            sectionNumber: i + 1,
            title, audioUrl: sectionAudioUrl,
            instructions: { heading, details, note },
            content: items
        });
    }

    return { id: "listening", title: "Listening Test", duration: 30, audioMode, audioUrl, sections, totalQuestions: n - 1 };
}
