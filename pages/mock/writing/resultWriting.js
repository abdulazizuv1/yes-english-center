import {
  getFirestore,
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);

const EVALUATE_URL = "https://us-central1-yes-english-center.cloudfunctions.net/evaluateWriting";

let currentUser = null;
let currentData = null;
let currentResultId = null;

const auth = getAuth();
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to view results.");
    window.location.href = "/login.html";
    return;
  }

  currentUser = user;

  const params = new URLSearchParams(window.location.search);
  let resultId = params.get("id");
  currentResultId = resultId;

  if (!resultId) {
    alert("No result ID found. Redirecting to your dashboard.");
    window.location.href = "/pages/dashboard/";
    return;
  }

  try {
    const docRef = doc(db, "resultsWriting", resultId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      currentData = data;
      console.log("Writing result data:", data);
      showCelebration();
      setTimeout(() => renderResult(data), 1000);
    } else {
      alert("Result document not found.");
    }
  } catch (err) {
    console.error("Error fetching result:", err);
    alert("Failed to load result.");
  }
});

function showCelebration() {
  const overlay = document.getElementById('celebrationOverlay');
  overlay.classList.add('show');
  
  setTimeout(() => {
    overlay.classList.remove('show');
  }, 3000);
}

function renderResult(data) {
  const emailEl = document.getElementById("email");
  const completionDateEl = document.getElementById("completionDate");
  const tasksCompletedEl = document.getElementById("tasksCompleted");
  const timeTakenEl = document.getElementById("timeTaken");
  const totalWordsEl = document.getElementById("totalWords");
  
  console.log("Rendering result with data:", data); // Отладка
  
  // Обновляем основную информацию - используем правильные поля из вашей БД
  emailEl.textContent = data.email || data.name || "Unknown Student";
  
  // Дата завершения - используем submittedAt
  if (data.submittedAt) {
    const date = data.submittedAt.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt);
    completionDateEl.textContent = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else {
    completionDateEl.textContent = new Date().toLocaleDateString();
  }

  // Обрабатываем ответы на задания - используем правильные поля
  const task1Response = data.task1Content || "";
  const task2Response = data.task2Content || "";
  
  console.log("Task responses:", { task1Response, task2Response }); // Отладка
  
  // Подсчитываем слова
  const task1WordCount = countWords(task1Response);
  const task2WordCount = countWords(task2Response);
  const totalWordCount = task1WordCount + task2WordCount;
  
  console.log("Word counts:", { task1WordCount, task2WordCount, totalWordCount }); // Отладка
  
  // Определяем количество завершенных заданий
  let completedTasks = 0;
  if (task1Response.trim()) completedTasks++;
  if (task2Response.trim()) completedTasks++;
  
  // Обновляем статистику
  tasksCompletedEl.textContent = `${completedTasks}/2`;
  timeTakenEl.textContent = data.timeTaken || "60 min";
  totalWordsEl.textContent = totalWordCount;
  
  // Обновляем анализ задач
  updateTaskAnalysis(task1WordCount, task2WordCount);
  
  // Отображаем ответы
  displayTaskResponses(task1Response, task2Response, task1WordCount, task2WordCount);
  
  // Настраиваем переключатели вида
  setupViewToggles();

  // Анимируем числа
  animateNumbers();

  // Инициализируем AI Check
  initAiCheck();
}

function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function updateTaskAnalysis(task1Words, task2Words) {
  const task1WordsEl = document.getElementById("task1Words");
  const task2WordsEl = document.getElementById("task2Words");
  const task1StatusEl = document.getElementById("task1Status");
  const task2StatusEl = document.getElementById("task2Status");
  
  // Обновляем количество слов
  task1WordsEl.textContent = task1Words;
  task2WordsEl.textContent = task2Words;
  
  // Обновляем статус требований
  if (task1Words >= 150) {
    task1StatusEl.textContent = "✅ Requirement met";
    task1StatusEl.className = "word-requirement met";
  } else {
    task1StatusEl.textContent = `${150 - task1Words} words needed`;
    task1StatusEl.className = "word-requirement not-met";
  }
  
  if (task2Words >= 250) {
    task2StatusEl.textContent = "✅ Requirement met";
    task2StatusEl.className = "word-requirement met";
  } else {
    task2StatusEl.textContent = `${250 - task2Words} words needed`;
    task2StatusEl.className = "word-requirement not-met";
  }
}

function displayTaskResponses(task1Response, task2Response, task1Words, task2Words) {
  // Task 1
  const task1WordCountEl = document.getElementById("task1WordCount");
  const task1StatusEl = document.getElementById("task1ResponseStatus");
  const task1ContentEl = document.getElementById("task1Content");
  const task1TextAreaEl = document.getElementById("task1TextArea");
  
  task1WordCountEl.textContent = `${task1Words} words`;
  
  if (task1Response.trim()) {
    task1StatusEl.textContent = "Complete";
    task1StatusEl.className = "task-status complete";
    task1ContentEl.innerHTML = formatTextForDisplay(task1Response);
    task1TextAreaEl.value = task1Response;
  } else {
    task1StatusEl.textContent = "Incomplete";
    task1StatusEl.className = "task-status incomplete";
    task1ContentEl.innerHTML = '<p class="no-response">No response submitted</p>';
    task1TextAreaEl.value = "No response submitted";
  }
  
  // Task 2
  const task2WordCountEl = document.getElementById("task2WordCount");
  const task2StatusEl = document.getElementById("task2ResponseStatus");
  const task2ContentEl = document.getElementById("task2Content");
  const task2TextAreaEl = document.getElementById("task2TextArea");
  
  task2WordCountEl.textContent = `${task2Words} words`;
  
  if (task2Response.trim()) {
    task2StatusEl.textContent = "Complete";
    task2StatusEl.className = "task-status complete";
    task2ContentEl.innerHTML = formatTextForDisplay(task2Response);
    task2TextAreaEl.value = task2Response;
  } else {
    task2StatusEl.textContent = "Incomplete";
    task2StatusEl.className = "task-status incomplete";
    task2ContentEl.innerHTML = '<p class="no-response">No response submitted</p>';
    task2TextAreaEl.value = "No response submitted";
  }
}

function formatTextForDisplay(text) {
  if (!text || !text.trim()) {
    return '<p class="no-response">No response submitted</p>';
  }
  
  // Разбиваем текст на параграфы по двойным переносам строк
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  if (paragraphs.length === 0) {
    // Если нет параграфов, разбиваем по одинарным переносам
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => `<p>${escapeHtml(line.trim())}</p>`).join('');
  }
  
  return paragraphs.map(paragraph => {
    const cleanParagraph = paragraph.trim().replace(/\n/g, ' ');
    return `<p>${escapeHtml(cleanParagraph)}</p>`;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupViewToggles() {
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  const formattedViews = document.querySelectorAll('.content-formatted');
  const plainViews = document.querySelectorAll('.content-plain');
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Убираем активный класс со всех кнопок
      toggleButtons.forEach(btn => btn.classList.remove('active'));
      // Добавляем активный класс к нажатой кнопке
      button.classList.add('active');
      
      const view = button.dataset.view;
      
      if (view === 'formatted') {
        formattedViews.forEach(view => view.style.display = 'block');
        plainViews.forEach(view => view.style.display = 'none');
      } else {
        formattedViews.forEach(view => view.style.display = 'none');
        plainViews.forEach(view => view.style.display = 'block');
      }
    });
  });
}

function animateNumbers() {
  const numbers = [
    { element: document.getElementById('task1Words'), target: parseInt(document.getElementById('task1Words').textContent) },
    { element: document.getElementById('task2Words'), target: parseInt(document.getElementById('task2Words').textContent) },
    { element: document.getElementById('totalWords'), target: parseInt(document.getElementById('totalWords').textContent) }
  ];

  numbers.forEach(({ element, target }) => {
    let current = 0;
    const increment = Math.max(1, target / 30);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        element.textContent = target;
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(current);
      }
    }, 50);
  });
}

function showFeedbackButton(docId) {
  const feedbackBtn = document.getElementById("aiFeedbackBtn");
  if (feedbackBtn) {
    feedbackBtn.href = `/pages/ai-feedback/?id=${docId}`;
    feedbackBtn.style.display = "";
  }
}

async function checkExistingFeedback() {
  if (!currentUser || !currentResultId) return;
  try {
    const q = query(
      collection(db, "aiFeedback"),
      where("uid", "==", currentUser.uid),
      where("sessionId", "==", currentResultId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      showFeedbackButton(snapshot.docs[0].id);
    }
  } catch (err) {
    console.error("Error checking existing feedback:", err);
  }
}

async function initAiCheck() {
  const btn = document.getElementById("aiCheckBtn");
  const statusEl = document.getElementById("aiUsageStatus");
  if (!btn || !statusEl || !currentUser) return;

  const today = new Date().toISOString().split("T")[0];
  const usageRef = ref(rtdb, `aiUsage/${currentUser.uid}/${today}/count`);

  try {
    const snapshot = await get(usageRef);
    const count = snapshot.exists() ? snapshot.val() : 0;
    const remaining = Math.max(0, 3 - count);
    if (remaining === 0) {
      statusEl.textContent = "Daily limit reached (3/3). Try again tomorrow.";
      statusEl.className = "ai-usage-status limit-reached";
      btn.disabled = true;
    } else {
      statusEl.textContent = `AI checks remaining today: ${remaining}/3`;
    }
  } catch (err) {
    console.error("Error reading AI usage:", err);
    statusEl.textContent = "AI checks remaining today: 3/3";
  }

  btn.addEventListener("click", handleAiCheck);
  checkExistingFeedback();
}

async function handleAiCheck() {
  const btn = document.getElementById("aiCheckBtn");
  const statusEl = document.getElementById("aiUsageStatus");

  btn.disabled = true;
  btn.textContent = "⏳ Analyzing…";
  statusEl.textContent = "Sending to AI examiner...";

  try {
    const idToken = await currentUser.getIdToken();

    const response = await fetch(EVALUATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        task1Text: currentData?.task1Content || null,
        task2Text: currentData?.task2Content || null,
        task1ImageUrl: currentData?.task1ImageUrl || null,
      }),
    });

    const result = await response.json();

    if (result.error === "limit_reached") {
      statusEl.textContent = "Daily limit reached (3/day). Try again tomorrow.";
      statusEl.className = "ai-usage-status limit-reached";
      return;
    }

    if (!response.ok) {
      throw new Error(`[${result.error}] ${result.message || response.status}`);
    }

    // Save feedback to Firestore
    const docRef = await addDoc(collection(db, "aiFeedback"), {
      uid: currentUser.uid,
      feedbackText: result.feedbackText,
      task1Text: currentData?.task1Content || null,
      task2Text: currentData?.task2Content || null,
      sessionId: currentResultId,
      createdAt: serverTimestamp(),
    });

    showFeedbackButton(docRef.id);
    window.location.href = `/pages/ai-feedback/?id=${docRef.id}`;
  } catch (err) {
    console.error("AI check error:", err);
    statusEl.textContent = "Error occurred. Please try again.";
    btn.disabled = false;
    btn.textContent = "✨ AI Check (IELTS Feedback)";
  }
}

// Добавляем интерактивные эффекты
document.addEventListener('DOMContentLoaded', function() {
  // Добавляем hover эффекты к карточкам
  const cards = document.querySelectorAll('.result-card, .analysis-card, .responses-card, .tips-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-5px)';
      this.style.transition = 'transform 0.3s ease';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });

  // Добавляем эффект "волны" для кнопок
  const buttons = document.querySelectorAll('button');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
});

// Добавляем CSS для эффекта волны
const style = document.createElement('style');
style.textContent = `
  button {
    position: relative;
    overflow: hidden;
  }
  
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    transform: scale(0);
    animation: ripple-animation 0.6s linear;
    pointer-events: none;
  }
  
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);