// main.js

import { checkAdminAccess, getNextFullMockTestNumber, saveFullMockTest, uploadFile } from './modules/firebase.js';
import { initListeningUI, collectListeningData } from './modules/listening.js';
import { initReadingUI, collectReadingData } from './modules/reading.js';
import { initWritingUI, collectWritingData } from './modules/writing.js';

let currentStepIndex = 0;
const steps = ['step-info', 'step-listening', 'step-reading', 'step-writing', 'step-review'];
let fullMockDataCache = null;
let testId = '';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAdminAccess();
        const nextTarget = await getNextFullMockTestNumber();
        testId = `full-mock-test-${nextTarget}`;
        document.getElementById('testNumberBadge').textContent = `Test ID: ${testId}`;

        // Init modules
        initListeningUI();
        initReadingUI();
        initWritingUI();

        // Setup Navigation
        document.getElementById('nextStepBtn').addEventListener('click', handleNext);
        document.getElementById('prevStepBtn').addEventListener('click', handlePrev);
        document.getElementById('saveTestBtn').addEventListener('click', handleSave);
        document.getElementById('backBtn').addEventListener('click', () => {
            if(confirm("Discard all progress and go back?")) {
                window.location.href = '../index.html';
            }
        });

    } catch(err) {
        console.error("Initialization Failed", err);
    }
});

async function handleNext() {
    // Validate current step before moving forward
    try {
        if (currentStepIndex === 0) {
            const title = document.getElementById('testTitle').value.trim();
            if (!title) throw new Error("Test Title is required.");
        } 
        else if (currentStepIndex === 1) {
            await collectListeningData(); // purely to trigger throw if invalid
        }
        else if (currentStepIndex === 2) {
            await collectReadingData();
        }
        else if (currentStepIndex === 3) {
            await collectWritingData();
        }

        // Move step
        document.querySelector(`.wizard-stepper .step[data-target="${steps[currentStepIndex]}"]`).classList.add('completed');
        currentStepIndex++;
        updateWizardUI();

        // Special handling if reaching Review step
        if (currentStepIndex === steps.length - 1) {
             await generateReviewData();
        }

    } catch(err) {
        alert(err.message);
    }
}

function handlePrev() {
    if (currentStepIndex > 0) {
        document.querySelector(`.wizard-stepper .step[data-target="${steps[currentStepIndex]}"]`).classList.remove('active');
        currentStepIndex--;
        updateWizardUI();
    }
}

function updateWizardUI() {
    // Buttons
    document.getElementById('prevStepBtn').style.visibility = currentStepIndex === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('nextStepBtn');
    
    if (currentStepIndex === steps.length - 1) {
        nextBtn.style.display = 'none';
        document.getElementById('saveTestBtn').disabled = false;
    } else {
        nextBtn.style.display = 'block';
        document.getElementById('saveTestBtn').disabled = true;
    }

    // Step Icons
    document.querySelectorAll('.wizard-stepper .step').forEach((el, idx) => {
        if(idx === currentStepIndex) el.classList.add('active');
        else if(idx > currentStepIndex) el.classList.remove('active', 'completed');
    });

    // Content Display
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active-step'));
    document.getElementById(steps[currentStepIndex]).classList.add('active-step');
}

async function generateReviewData() {
    const errorContainer = document.getElementById('validationErrors');
    const errorList = document.getElementById('validationErrorList');
    errorList.innerHTML = '';
    errorContainer.style.display = 'none';
    document.getElementById('saveTestBtn').disabled = true;

    try {
        const title = document.getElementById('testTitle').value.trim();
        const listeningData = await collectListeningData();
        const readingData = await collectReadingData();
        const writingData = await collectWritingData();

        fullMockDataCache = {
            testId: testId,
            title: title,
            totalTime: 150,
            stages: [listeningData, readingData, writingData]
        };

        // Populate Review UI
        document.getElementById('reviewTitle').textContent = title;
        document.getElementById('reviewListeningMode').textContent = listeningData.audioMode === 'single' ? 'Single Master File' : 'Separate Files';
        document.getElementById('reviewListeningSections').textContent = listeningData.sections.length;
        document.getElementById('reviewListeningQuestions').textContent = listeningData.sections.reduce((ac, s) => ac + s.content.length, 0); // Approx
        
        document.getElementById('reviewReadingPassages').textContent = readingData.passages.length;
        document.getElementById('reviewReadingQuestions').textContent = readingData.passages.reduce((ac, s) => ac + s.questions.length, 0);
        
        document.getElementById('reviewWritingTask1').textContent = writingData.tasks[0] ? 'Yes' : 'No';
        document.getElementById('reviewWritingTask2').textContent = writingData.tasks[1] ? 'Yes' : 'No';

        document.getElementById('saveTestBtn').disabled = false;
    } catch(err) {
        const li = document.createElement('li');
        li.textContent = err.message;
        errorList.appendChild(li);
        errorContainer.style.display = 'block';
    }
}

async function handleSave() {
    if(!fullMockDataCache) return;
    
    if(!confirm("Are you sure you want to save this test? Large audio files may take a minute to upload.")) return;

    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    overlay.style.display = 'flex';

    try {
        // 1. Process Listening Audio Uploads
        const lData = fullMockDataCache.stages[0];
        if (lData.audioMode === 'single' && lData.globalAudioUrl && typeof lData.globalAudioUrl === 'object') {
            loadingText.textContent = "Uploading master listening audio...";
            const ext = lData.globalAudioUrl.file.name.split('.').pop();
            const filePath = `fullmock-audio/${testId}/master.${ext}`;
            lData.globalAudioUrl = await uploadFile(lData.globalAudioUrl.file, filePath);
        } else if (lData.audioMode === 'separate') {
            for (let i = 0; i < lData.sections.length; i++) {
                const s = lData.sections[i];
                if (typeof s.audioUrl === 'object') {
                    loadingText.textContent = `Uploading listening audio part ${i+1}...`;
                    const ext = s.audioUrl.file.name.split('.').pop();
                    const filePath = `fullmock-audio/${testId}/part${i+1}.${ext}`;
                    s.audioUrl = await uploadFile(s.audioUrl.file, filePath);
                }
            }
        }
        delete lData.audioMode; // Cleanup custom non-schema fields before saving

        // 2. Process Reading Images Uploads
        const rData = fullMockDataCache.stages[1];
        for(let i=0; i < rData.passages.length; i++) {
             const p = rData.passages[i];
             if(p.imageUrl && typeof p.imageUrl === 'object') {
                  loadingText.textContent = `Uploading reading passage ${i+1} image...`;
                  const ext = p.imageUrl.file.name.split('.').pop();
                  const filePath = `fullmock-images/${testId}/passage${i+1}.${ext}`;
                  p.imageUrl = await uploadFile(p.imageUrl.file, filePath);
             } else {
                  delete p.imageUrl;
             }
        }

        // 3. Process Writing Images Uploads
        const wData = fullMockDataCache.stages[2];
        for(let i=0; i < wData.tasks.length; i++) {
             const t = wData.tasks[i];
             if(t.imageUrl && typeof t.imageUrl === 'object') {
                  loadingText.textContent = `Uploading writing task ${i+1} image...`;
                  const ext = t.imageUrl.file.name.split('.').pop();
                  const filePath = `fullmock-images/${testId}/writing-task${i+1}.${ext}`;
                  t.imageUrl = await uploadFile(t.imageUrl.file, filePath);
             } else {
                  delete t.imageUrl;
             }
        }

        // 4. Save to Firestore
        loadingText.textContent = "Finalizing and saving to database...";
        await saveFullMockTest(fullMockDataCache, testId);

        alert("Full Mock Test saved successfully!");
        window.location.href = '../index.html';

    } catch(err) {
        console.error("Save Error:", err);
        alert("Failed to save test. See console for details: " + err.message);
        overlay.style.display = 'none';
    }
}
