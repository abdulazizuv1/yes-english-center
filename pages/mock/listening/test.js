import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBw36xP5tVYO2D0T-XFQQAGFA4wrJ8If8k",
  authDomain: "yes-english-center.firebaseapp.com",
  projectId: "yes-english-center",
  storageBucket: "yes-english-center.appspot.com",
  messagingSenderId: "203211203853",
  appId: "1:203211203853:web:7d499925c3aa830eaefc44",
  measurementId: "G-4LHEBLG2KK",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// Global variables
let sections = [], currentSectionIndex = 0, answersSoFar = {}, currentAudio = null;
let isPaused = false, pausedTime = 0, timerStartTime = null, audioCurrentTime = 0;
let currentQuestionNumber = 1; // Add current question tracking

// Pause functionality
window.togglePause = function() {
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseModal = document.getElementById('pauseModal');
    
    if (!isPaused) {
        isPaused = true;
        clearInterval(window.listeningTimerInterval);
        pausedTime = getCurrentRemainingTime();
        if (pauseBtn) pauseBtn.textContent = 'Resume';
        if (pauseModal) pauseModal.style.display = 'flex';
        
        if (currentAudio && !currentAudio.paused) {
            audioCurrentTime = currentAudio.currentTime;
            currentAudio.pause();
        }
        toggleTestInteraction(false);
    } else {
        isPaused = false;
        if (pauseBtn) pauseBtn.textContent = 'Pause';
        if (pauseModal) pauseModal.style.display = 'none';
        
        if (currentAudio && audioCurrentTime) {
            currentAudio.currentTime = audioCurrentTime;
            currentAudio.play().catch(console.warn);
        }
        toggleTestInteraction(true);
        startTimer(pausedTime, document.getElementById("time"));
    }
};

function toggleTestInteraction(enable) {
    ['.main-content', '.bottom-controls', '.question-nav'].forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.pointerEvents = enable ? 'auto' : 'none';
    });
}

function getCurrentRemainingTime() {
    if (!timerStartTime) return 40 * 60;
    const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    return Math.max(0, (40 * 60) - elapsed);
}

// Navigation
function generateQuestionNav() {
    [1,2,3,4].forEach(section => {
        const container = document.getElementById(`section${section}Numbers`);
        if (!container) return;
        container.innerHTML = '';
        
        const start = (section - 1) * 10 + 1;
        const end = section * 10;
        for (let i = start; i <= end; i++) {
            const num = document.createElement('div');
            num.className = 'nav-number';
            num.textContent = i;
            num.onclick = () => jumpToQuestion(i);
            container.appendChild(num);
        }
    });
}

function updateQuestionNav() {
    document.querySelectorAll('.nav-number').forEach((num, index) => {
        const qId = `q${index + 1}`;
        const questionNumber = index + 1;
        const isAnswered = isAnswerValid(answersSoFar[qId]);
        
        num.className = 'nav-number';
        
        // Check if this is the current selected question
        if (questionNumber === currentQuestionNumber) {
            num.style.background = '#3b82f6';
            num.style.color = 'white';
            num.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';
        } else if (isAnswered) {
            num.style.background = '#10b981';
            num.style.color = 'white';
            num.style.boxShadow = 'none';
        } else {
            num.style.background = '#e5e7eb';
            num.style.color = '#6b7280';
            num.style.boxShadow = 'none';
        }
    });
    updateSectionIndicator();
}

function jumpToQuestion(questionNum) {
    const targetSection = Math.floor((questionNum - 1) / 10);
    const shouldRender = targetSection !== currentSectionIndex;
    
    currentSectionIndex = targetSection;
    currentQuestionNumber = questionNum; // Update current question
    
    if (shouldRender) renderSection(currentSectionIndex);
    updateQuestionNav();
    
    setTimeout(() => {
        const el = document.getElementById(`q${questionNum}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, shouldRender ? 100 : 0);
}

function updateSectionIndicator() {
    const indicator = document.getElementById('sectionIndicator');
    if (!indicator) return;
    
    const progress = analyzeTestProgress();
    const progressPercent = Math.round((progress.answered / progress.total) * 100);
    
    indicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <span>Section ${currentSectionIndex + 1} of ${sections.length}</span>
            <div style="flex: 1; background: #e5e7eb; border-radius: 10px; height: 8px;">
                <div style="background: linear-gradient(90deg, #10b981, #3b82f6); height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
            </div>
            <span style="font-size: 0.9em; color: #6b7280;">${progress.answered}/${progress.total}</span>
        </div>
    `;
}

// Text highlighting
let selectedRange = null;
document.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
        try { selectedRange = selection.getRangeAt(0); } catch(e) { selectedRange = null; }
    }
});

document.addEventListener('contextmenu', (e) => {
    if (selectedRange && e.target.closest('.questions-panel')) {
        e.preventDefault();
        const menu = document.getElementById('contextMenu');
        if (menu) {
            menu.style.display = 'block';
            menu.style.left = Math.min(e.pageX, window.innerWidth - 150) + 'px';
            menu.style.top = Math.min(e.pageY, window.innerHeight - 100) + 'px';
        }
    }
});

document.addEventListener('click', (e) => {
    const menu = document.getElementById('contextMenu');
    if (menu && !e.target.closest('#contextMenu')) menu.style.display = 'none';
});

window.highlightSelection = () => {
    if (selectedRange) {
        const span = document.createElement('span');
        span.className = 'highlighted';
        span.style.backgroundColor = '#ffeb3b';
        try { selectedRange.surroundContents(span); } catch(e) {
            const contents = selectedRange.extractContents();
            span.appendChild(contents);
            selectedRange.insertNode(span);
        }
        window.getSelection().removeAllRanges();
        selectedRange = null;
    }
    document.getElementById('contextMenu').style.display = 'none';
};


window.removeHighlight = function() {
    if (selectedRange) {
        // Найти все highlighted элементы в выделенном диапазоне
        const container = selectedRange.commonAncestorContainer;
        const highlighted = container.nodeType === Node.TEXT_NODE ? 
            container.parentElement.closest('.highlighted') ? [container.parentElement.closest('.highlighted')] : [] :
            Array.from(container.querySelectorAll('.highlighted')).filter(el => selectedRange.intersectsNode(el));
        
        highlighted.forEach(element => {
            const parent = element.parentNode;
            parent.insertBefore(document.createTextNode(element.textContent), element);
            parent.removeChild(element);
            parent.normalize();
        });
    }
    
    window.getSelection().removeAllRanges();
    selectedText = '';
    selectedRange = null;
    document.getElementById('contextMenu').style.display = 'none';
};

// Authentication and loading
onAuthStateChanged(auth, (user) => {
    if (!user) {
        alert("Please log in to take the test.");
        window.location.href = "/login.html";
    } else loadTest();
});

async function loadTest() {
    try {
        console.log("Loading test...");
        const testId = new URLSearchParams(window.location.search).get('testId') || 'test-1';
        const docSnap = await getDoc(doc(db, "listeningTests", testId));
        
        if (!docSnap.exists()) throw new Error(`Test ${testId} not found`);
        
        const data = docSnap.data();
        sections = data.sections || data.parts?.sections || data.parts || [];
        
        if (sections.length === 0) throw new Error("No sections found");
        
        document.title = data.title || "Listening Test";
        initializeTest();
    } catch (error) {
        console.error("Error loading test:", error);
        const questionList = document.getElementById('question-list');
        if (questionList) questionList.innerHTML = `<p class='error'>${error.message}</p>`;
    }
}

function initializeTest() {
    generateQuestionNav();
    currentQuestionNumber = 1; // Set initial question
    renderSection(0);
    updateQuestionNav();
    startTimer(40 * 60, document.getElementById("time"));
}

// Section rendering
function renderSection(index) {
    const section = sections[index];
    if (!section) return;
    
    handleAudio(section, index);
    renderContent(section, index);
    updateNavButtons(index);
}

function handleAudio(section, index) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    const container = document.getElementById("audio-container");
    if (!container) return;
    
    if (section.audioUrl) {
        container.innerHTML = `
            <audio controls autoplay style="width:100%; margin-bottom: 20px;" id="sectionAudio">
                <source src="${section.audioUrl}" type="audio/mpeg" />
                Your browser does not support the audio element.
            </audio>
        `;
        
        currentAudio = document.getElementById('sectionAudio');
        if (currentAudio) {
            currentAudio.addEventListener('ended', () => {
                if (index < sections.length - 1 && !isPaused) {
                    setTimeout(() => {
                        currentSectionIndex++;
                        renderSection(currentSectionIndex);
                        updateQuestionNav();
                    }, 1000);
                }
            });
        }
    } else {
        container.innerHTML = '<div style="padding: 20px; text-align: center;">🎧 No audio available</div>';
    }
}

function renderContent(section, index) {
    const questionList = document.getElementById('question-list');
    if (!questionList) return;
    
    questionList.innerHTML = `
        <div class="section-title" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0;">Section ${index + 1}: ${section.title || `Section ${index + 1}`}</h2>
        </div>
    `;
    
    // Render section-level instructions
    if (section.instructions) {
        renderInstructions(section.instructions);
    }
    
    if (section.content) {
        section.content.forEach(item => renderContentItem(item));
    } else {
        // Legacy format
        ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach(key => {
            if (section[key]) renderLegacyGroup(section[key], key);
        });
    }
}

function renderInstructions(instructions) {
    const questionList = document.getElementById('question-list');
    
    let instructionHtml = '<div class="group-instruction" style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;">';
    
    if (instructions.heading) {
        instructionHtml += `<h4>${instructions.heading}</h4>`;
    }
    
    if (instructions.details) {
        instructionHtml += `<p>${instructions.details}</p>`;
    }
    
    if (instructions.note) {
        instructionHtml += `<p><strong>Note:</strong> ${instructions.note}</p>`;
    }
    
    instructionHtml += '</div>';
    questionList.innerHTML += instructionHtml;
}

function renderContentItem(item) {
    const questionList = document.getElementById('question-list');
    
    // Render groupInstruction if it exists for this item
    
    
    switch (item.type) {
        case "text":
            questionList.innerHTML += `<p style="margin: 15px 0; color: #4b5563;">${item.value || item.text}</p>`;
            break;
        case "subheading":
            questionList.innerHTML += `<h4 style="margin: 20px 0 10px; color: #dc2626; font-weight: 600;">${item.value || item.text}</h4>`;
            break;
        case "question":
            renderQuestion(item);
            break;
        case "question-group":
            renderQuestionGroup(item);
            break;
        case "table":
            renderTable(item);
            break;
    }
}

function renderQuestion(question) {
    const qId = question.questionId;
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.id = qId;
    questionDiv.style.cssText = 'margin: 20px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa;';
    
    const number = qId.replace(/\D/g, '');
    
    if (question.format === "gap-fill") {
        questionDiv.innerHTML = `
            <div class="question-number" style="display: inline-block; background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; margin-right: 10px;">${number}</div>
            <div class="question-text" style="display: inline;">
                ${question.text || ""} <input type="text" value="${answersSoFar[qId] || ""}" data-qid="${qId}" class="gap-fill" style="min-width: 120px; padding: 8px 12px; border: 2px solid #d1d5db; border-radius: 6px;" placeholder="Your answer"/> ${question.postfix || ""}
            </div>
        `;
    } else if (question.format === "multiple-choice") {
        const optionsHtml = Object.keys(question.options || {}).sort().map(key => `
            <label style="display: block; margin: 8px 0; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                <input type="radio" name="${qId}" value="${key}" ${answersSoFar[qId] === key ? "checked" : ""} style="margin-right: 8px;"/> 
                <strong>${key}.</strong> ${question.options[key]}
            </label>
        `).join("");
        
        questionDiv.innerHTML = `
            <div class="question-number" style="display: inline-block; background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; margin-right: 10px;">${number}</div>
            <div class="question-text">
                <div style="font-weight: 500; margin-bottom: 10px;">${question.text}</div>
                <div class="radio-group">${optionsHtml}</div>
            </div>
        `;
    }
    
    document.getElementById('question-list').appendChild(questionDiv);
}

function renderQuestionGroup(group) {
    const questionList = document.getElementById('question-list');
    const groupDiv = document.createElement('div');
    
    // Render groupInstruction if it exists
    let instructionsHtml = '';
    if (group.groupInstruction) {
        instructionsHtml = `<div class="group-instruction" style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <p style="white-space: pre-line;">${group.groupInstruction}</p>
        </div>`;
    }
    
    if (group.groupType === "multi-select") {
        groupDiv.innerHTML = `
            ${instructionsHtml}
            <div style="margin: 25px 0; padding: 20px; border: 2px solid #3b82f6; border-radius: 10px; background: #f8fafc;">
                ${group.instructions ? `<h4 style="color: #dc2626;">${group.instructions}</h4>` : ''}
                <p style="font-weight: 600; margin-bottom: 15px;">${group.text}</p>
                <div class="radio-group">
                    ${Object.keys(group.options || {}).sort().map(key => `
                        <label style="display: block; margin: 8px 0; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                            <input type="checkbox" data-qid="${group.questionId}" value="${key}" ${(answersSoFar[group.questionId] || []).includes(key) ? "checked" : ""} style="margin-right: 8px;"/> 
                            <strong>${key}.</strong> ${group.options[key]}
                        </label>
                    `).join("")}
                </div>
            </div>
        `;
    } else if (group.groupType === "matching") {
        groupDiv.innerHTML = `
            ${instructionsHtml}
            <div style="margin: 25px 0; padding: 20px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
                ${group.instructions ? `<h4>${group.instructions}</h4>` : ''}
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="font-weight: 600; margin-bottom: 15px;">${group.text || ""}</p>
                    ${Object.keys(group.options || {}).sort().map(key => `<p style="margin: 5px 0;"><strong>${key}</strong> ${group.options[key]}</p>`).join("")}
                </div>
                ${(group.questions || []).map(q => `
                    <div style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background: white; border-radius: 6px;">
                        <div style="background: #10b981; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 15px;">${q.questionId.replace("q", "")}</div>
                        <div style="flex: 1; margin-right: 15px;">${q.text}</div>
                        <select data-qid="${q.questionId}" style="padding: 8px; border: 2px solid #d1d5db; border-radius: 6px;">
                            <option value="">Select...</option>
                            ${Object.keys(group.options || {}).sort().map(key => `<option value="${key}" ${answersSoFar[q.questionId] === key ? "selected" : ""}>${key}</option>`).join("")}
                        </select>
                    </div>
                `).join("")}
            </div>
        `;
    }
    
    questionList.appendChild(groupDiv);
}

function renderTable(table) {
    const questionList = document.getElementById('question-list');
    const tableDiv = document.createElement('div');
    
    // Render table instructions if they exist
    let instructionsHtml = '';
    
    
    let tableHtml = `${instructionsHtml}<h4 style="margin-bottom: 15px;">${table.title}</h4><table style="width: 100%; border-collapse: collapse;">`;
    tableHtml += `<thead><tr>${table.columns.map(col => `<th style="border: 1px solid #ddd; padding: 8px; background: #f8f9fa;">${col}</th>`).join("")}</tr></thead><tbody>`;
    
    table.rows.forEach(row => {
        tableHtml += "<tr>";
        table.columns.forEach(col => {
            let content = row[col.toLowerCase().replace(/\s+/g, '')] || "";
            content = content.replace(/___q(\d+)___/g, (match, num) => {
                const qId = `q${num}`;
                return `<input type="text" value="${answersSoFar[qId] || ""}" data-qid="${qId}" class="gap-fill" style="padding: 4px; border: 1px solid #ccc;" />`;
            });
            tableHtml += `<td style="border: 1px solid #ddd; padding: 8px;">${content}</td>`;
        });
        tableHtml += "</tr>";
    });
    
    tableHtml += "</tbody></table>";
    tableDiv.innerHTML = tableHtml;
    questionList.appendChild(tableDiv);
}

function renderLegacyGroup(group, key) {
    const questionList = document.getElementById('question-list');
    
    if (key === "matching" && group.matchingQuestions) {
        const groupDiv = document.createElement('div');
        groupDiv.innerHTML = `
            <div style="margin: 25px 0; padding: 20px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
                <h4>${group.heading || ""}</h4>
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="font-weight: 600;">${group.question || ""}</p>
                    ${Object.keys(group.options || {}).sort().map(key => `<p><strong>${key}</strong> ${group.options[key]}</p>`).join("")}
                </div>
                ${group.matchingQuestions.map(q => `
                    <div style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background: white; border-radius: 6px;">
                        <div style="background: #10b981; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 15px;">${q.qId.replace("q", "")}</div>
                        <div style="flex: 1; margin-right: 15px;">${q.text}</div>
                        <select data-qid="${q.qId}" style="padding: 8px; border: 2px solid #d1d5db; border-radius: 6px;">
                            <option value="">Select...</option>
                            ${Object.keys(group.options || {}).sort().map(key => `<option value="${key}" ${answersSoFar[q.qId] === key ? "selected" : ""}>${key}</option>`).join("")}
                        </select>
                    </div>
                `).join("")}
            </div>
        `;
        questionList.appendChild(groupDiv);
    }
}

function updateNavButtons(index) {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');
    
    if (backBtn) backBtn.style.display = index > 0 ? 'inline-block' : 'none';
    if (nextBtn) nextBtn.style.display = index < sections.length - 1 ? 'inline-block' : 'none';
    if (finishBtn) finishBtn.style.display = index === sections.length - 1 ? 'inline-block' : 'none';
}

// Event handlers
document.addEventListener("input", (e) => {
    const qId = e.target.dataset.qid;
    if (e.target.classList.contains("gap-fill") && qId) {
        answersSoFar[qId] = e.target.value.trim();
        updateQuestionNav();
        localStorage.setItem('listeningTestAnswers', JSON.stringify(answersSoFar));
    }
});

document.addEventListener("change", (e) => {
    const qId = e.target.name || e.target.dataset.qid;
    if (!qId) return;
    
    if (e.target.type === "radio") {
        answersSoFar[qId] = e.target.value;
    } else if (e.target.type === "checkbox") {
        const checked = Array.from(document.querySelectorAll(`input[type="checkbox"][data-qid="${qId}"]`))
            .filter(cb => cb.checked).map(cb => cb.value);
        answersSoFar[qId] = checked;
    } else if (e.target.tagName === "SELECT") {
        answersSoFar[qId] = e.target.value;
    }
    
    updateQuestionNav();
    localStorage.setItem('listeningTestAnswers', JSON.stringify(answersSoFar));
});

// Navigation handlers
document.addEventListener('DOMContentLoaded', () => {
    const nextBtn = document.getElementById('nextBtn');
    const backBtn = document.getElementById('backBtn');
    const finishBtn = document.getElementById('finishBtn');
    
    if (nextBtn) nextBtn.onclick = () => {
        if (currentSectionIndex < sections.length - 1) {
            currentSectionIndex++;
            currentQuestionNumber = currentSectionIndex * 10 + 1; // Update to first question of next section
            renderSection(currentSectionIndex);
            updateQuestionNav();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    
    if (backBtn) backBtn.onclick = () => {
        if (currentSectionIndex > 0) {
            currentSectionIndex--;
            currentQuestionNumber = currentSectionIndex * 10 + 1; // Update to first question of previous section
            renderSection(currentSectionIndex);
            updateQuestionNav();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    
    if (finishBtn) finishBtn.onclick = handleFinishTest;
    
    // Load saved answers
    try {
        const saved = localStorage.getItem('listeningTestAnswers');
        if (saved) answersSoFar = JSON.parse(saved);
    } catch (e) { answersSoFar = {}; }
});

// Test completion
async function handleFinishTest() {
    const user = auth.currentUser;
    if (!user) return alert("Please login first");
    
    if (!confirm("Submit test? You cannot change answers after submission.")) return;
    
    try {
        const results = calculateResults();
        const testId = new URLSearchParams(window.location.search).get('testId') || 'test-1';
        
        const docRef = await addDoc(collection(db, "resultsListening"), {
            userId: user.uid,
            name: user.email || "unknown",
            testId: testId,
            score: results.correct,
            total: results.total,
            percentage: Math.round((results.correct / results.total) * 100),
            answers: results.answers,
            correctAnswers: results.correctAnswers,
            createdAt: serverTimestamp(),
            completedAt: new Date().toISOString(),
        });
        
        localStorage.removeItem('listeningTestAnswers');
        clearInterval(window.listeningTimerInterval);
        window.location.href = `/pages/mock/listening/resultListening.html?id=${docRef.id}`;
    } catch (error) {
        console.error("Error saving result:", error);
        alert("Error submitting test. Please try again.");
    }
}

function calculateResults() {
    const answers = {}, correctAnswers = {};
    let correct = 0, total = 0;
    
    sections.forEach(section => {
        if (section.content) {
            section.content.forEach(item => {
                if (item.type === "question") {
                    const qId = item.questionId;
                    const userAns = answersSoFar[qId];
                    const expected = [item.correctAnswer];
                    
                    answers[qId] = userAns || null;
                    correctAnswers[qId] = expected;
                    if (checkAnswerCorrectness(userAns, expected)) correct++;
                    total++;
                } else if (item.type === "question-group") {
                    if (item.questions) {
                        item.questions.forEach(q => {
                            const qId = q.questionId;
                            const userAns = answersSoFar[qId];
                            const expected = [q.correctAnswer];
                            
                            answers[qId] = userAns || null;
                            correctAnswers[qId] = expected;
                            if (checkAnswerCorrectness(userAns, expected)) correct++;
                            total++;
                        });
                    }
                } else if (item.type === "table" && item.answer) {
                    // Handle table questions
                    Object.keys(item.answer).forEach(qId => {
                        const userAns = answersSoFar[qId];
                        const expected = [item.answer[qId]];
                        
                        answers[qId] = userAns || null;
                        correctAnswers[qId] = expected;
                        if (checkAnswerCorrectness(userAns, expected)) correct++;
                        total++;
                    });
                }
            });
        }
    });
    
    return { answers, correctAnswers, correct, total };
}

function checkAnswerCorrectness(userAns, expected) {
    if (!expected || expected.length === 0 || !userAns) return false;
    
    // Handle array answers (for multi-select)
    if (Array.isArray(userAns)) {
        if (!Array.isArray(expected[0])) return false;
        const userSet = new Set(userAns.map(a => String(a).toLowerCase().trim()));
        const expectedSet = new Set(expected[0].map(a => String(a).toLowerCase().trim()));
        return userSet.size === expectedSet.size && [...userSet].every(x => expectedSet.has(x));
    }
    
    // Handle single answers
    return expected.map(a => String(a).toLowerCase().trim()).includes(String(userAns).toLowerCase().trim());
}

function isAnswerValid(answer) {
    return answer !== undefined && answer !== null && answer !== '' && (!Array.isArray(answer) || answer.length > 0);
}

function analyzeTestProgress() {
    let total = 0, answered = 0;
    
    sections.forEach(section => {
        if (section.content) {
            section.content.forEach(item => {
                if (item.type === "question") {
                    total++;
                    if (isAnswerValid(answersSoFar[item.questionId])) answered++;
                } else if (item.type === "question-group" && item.questions) {
                    item.questions.forEach(q => {
                        total++;
                        if (isAnswerValid(answersSoFar[q.questionId])) answered++;
                    });
                } else if (item.type === "table" && item.answer) {
                    Object.keys(item.answer).forEach(qId => {
                        total++;
                        if (isAnswerValid(answersSoFar[qId])) answered++;
                    });
                }
            });
        }
    });
    
    return { total, answered };
}

// Timer
function startTimer(duration, display) {
    if (!display) return;
    clearInterval(window.listeningTimerInterval);
    timerStartTime = Date.now();
    
    window.listeningTimerInterval = setInterval(() => {
        if (isPaused) return;
        
        const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
        const remaining = duration - elapsed;
        
        if (remaining <= 0) {
            clearInterval(window.listeningTimerInterval);
            alert("Time's up! Submitting automatically.");
            handleFinishTest();
            return;
        }
        
        const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
        const seconds = String(remaining % 60).padStart(2, "0");
        display.textContent = `${minutes}:${seconds}`;
        
        if (remaining <= 300) display.style.color = '#dc2626';
        if (remaining === 300) alert("5 minutes remaining!");
        if (remaining === 60) alert("1 minute remaining!");
        
        pausedTime = remaining;
    }, 1000);
}

// Review function
window.openReview = () => {
    const progress = analyzeTestProgress();
    alert(`Progress: ${progress.answered}/${progress.total} questions answered (${Math.round(progress.answered/progress.total*100)}%)`);
};