import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "/config.js";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const auth = getAuth();
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to view results.");
    window.location.href = "/login.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  let resultId = params.get("id");

  if (!resultId) {
    const manualId = prompt(
      "No result ID in URL. Please enter the result ID manually:"
    );
    if (manualId) {
      window.location.href = `?id=${manualId.trim()}`;
      return;
    }
    alert("No ID provided. Returning to homepage.");
    window.location.href = "/index.html";
    return;
  }

  try {
    const docRef = doc(db, "resultsReading", resultId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
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
  const scoreEl = document.getElementById("score");
  const ieltsEl = document.getElementById("ielts");
  const accuracyEl = document.getElementById("accuracy");
  const totalQuestionsEl = document.getElementById("totalQuestions");
  const progressPercentEl = document.getElementById("progressPercent");
  const progressFillEl = document.getElementById("progressFill");
  const completionDateEl = document.getElementById("completionDate");
  const answersDiv = document.getElementById("answers");

  const answerKeys = Object.keys(data.correctAnswers || {});
  const total = answerKeys.length;
  const score = data.score || 0;
  const accuracy = Math.round((score / total) * 100);
  const ieltsScore = convertToIELTS(score, total);

  // Update basic info
  emailEl.textContent = data.name || "Unknown Student";
  scoreEl.textContent = `${score} / ${total}`;
  ieltsEl.textContent = ieltsScore;
  accuracyEl.textContent = `${accuracy}%`;
  totalQuestionsEl.textContent = total;
  progressPercentEl.textContent = `${accuracy}%`;
  
  // Update completion date
  if (data.createdAt) {
    const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
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

  // Animate progress bar
  setTimeout(() => {
    progressFillEl.style.width = `${accuracy}%`;
  }, 500);

  // Update result badge color based on score
  const resultBadge = document.getElementById('resultBadge');
  if (accuracy >= 90) {
    resultBadge.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  } else if (accuracy >= 80) {
    resultBadge.style.background = 'linear-gradient(135deg, #3b82f6, #1e40af)';
  } else if (accuracy >= 70) {
    resultBadge.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
  } else if (accuracy >= 60) {
    resultBadge.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
  } else {
    resultBadge.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
  }

  // Calculate answer statistics
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const sortedKeys = answerKeys.sort((a, b) => {
    const aNum = parseInt(a.replace("q", ""));
    const bNum = parseInt(b.replace("q", ""));
    return aNum - bNum;
  });

  // Clear answers div
  answersDiv.innerHTML = "";

  for (const qId of sortedKeys) {
    const userAns = (data.answers?.[qId] || "").toString().trim().toLowerCase();
    const correctAnsArray = (data.correctAnswers?.[qId] || []).map((a) =>
      a.toString().toLowerCase().trim()
    );

    const answerDiv = document.createElement("div");
    answerDiv.className = "answer";
    answerDiv.dataset.qid = qId;

    let statusIcon = "";
    let statusClass = "";

    if (!userAns || userAns === "null" || userAns === "undefined") {
      unansweredCount++;
      statusIcon = "⭕";
      statusClass = "unanswered";
      answerDiv.dataset.filter = "unanswered";
    } else if (correctAnsArray.includes(userAns)) {
      correctCount++;
      statusIcon = "✅";
      statusClass = "correct";
      answerDiv.dataset.filter = "correct";
    } else {
      incorrectCount++;
      statusIcon = "❌";
      statusClass = "incorrect";
      answerDiv.dataset.filter = "incorrect";
    }

    answerDiv.classList.add(statusClass);

    answerDiv.innerHTML = `
      <div class="question-number">
        <span class="status-icon">${statusIcon}</span>
        <strong>Question ${qId.toUpperCase().replace('Q', '')}</strong>
      </div>
      <div class="answer-content">
        <div class="user-answer">
          <strong>Your Answer:</strong> ${userAns || "<em>Not answered</em>"}
        </div>
        <div class="correct-answer">
          <strong>Correct Answer:</strong> ${correctAnsArray.join(" / ") || "<em>No data</em>"}
        </div>
      </div>
    `;

    answersDiv.appendChild(answerDiv);
  }

  // Update analysis numbers
  document.getElementById('correctCount').textContent = correctCount;
  document.getElementById('incorrectCount').textContent = incorrectCount;
  document.getElementById('unansweredCount').textContent = unansweredCount;

  // Animate numbers
  animateNumbers();
  
  // Setup filter functionality
  setupAnswerFilters();
  
  // Highlight current band in guide
  highlightCurrentBand(ieltsScore);
}

function animateNumbers() {
  const numbers = [
    { element: document.getElementById('correctCount'), target: parseInt(document.getElementById('correctCount').textContent) },
    { element: document.getElementById('incorrectCount'), target: parseInt(document.getElementById('incorrectCount').textContent) },
    { element: document.getElementById('unansweredCount'), target: parseInt(document.getElementById('unansweredCount').textContent) }
  ];

  numbers.forEach(({ element, target }) => {
    let current = 0;
    const increment = target / 20;
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

function setupAnswerFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const answers = document.querySelectorAll('.answer');

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      // Add active class to clicked button
      button.classList.add('active');

      const filter = button.dataset.filter;

      answers.forEach(answer => {
        if (filter === 'all' || answer.dataset.filter === filter) {
          answer.style.display = 'block';
          // Add animation
          answer.style.opacity = '0';
          answer.style.transform = 'translateY(20px)';
          setTimeout(() => {
            answer.style.opacity = '1';
            answer.style.transform = 'translateY(0)';
            answer.style.transition = 'all 0.3s ease';
          }, 100);
        } else {
          answer.style.display = 'none';
        }
      });
    });
  });
}

function highlightCurrentBand(ieltsScore) {
  const bandItems = document.querySelectorAll('.band-item');
  const score = parseFloat(ieltsScore);
  
  bandItems.forEach(item => {
    item.style.transform = 'scale(1)';
    item.style.boxShadow = 'none';
  });

  // Highlight the appropriate band
  if (score >= 9.0) {
    highlightBand('.band-9');
  } else if (score >= 8.0) {
    highlightBand('.band-8');
  } else if (score >= 7.0) {
    highlightBand('.band-7');
  } else if (score >= 6.0) {
    highlightBand('.band-6');
  } else if (score >= 5.0) {
    highlightBand('.band-5');
  }
}

function highlightBand(selector) {
  const bandItem = document.querySelector(selector);
  if (bandItem) {
    bandItem.style.transform = 'scale(1.05)';
    bandItem.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.2)';
    bandItem.style.transition = 'all 0.5s ease';
    
    // Scroll to highlighted band
    setTimeout(() => {
      bandItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  }
}

function convertToIELTS(score, total) {
  if (score >= 39) return "9.0";
  if (score >= 37) return "8.5";
  if (score >= 35) return "8.0";
  if (score >= 33) return "7.5";
  if (score >= 30) return "7.0";
  if (score >= 27) return "6.5";
  if (score >= 23) return "6.0";
  if (score >= 19) return "5.5";
  if (score >= 15) return "5.0";
  if (score >= 13) return "4.5";
  if (score >= 10) return "4.0";
  return "Below 4.0";
}

// Add some interactive effects
document.addEventListener('DOMContentLoaded', function() {
  // Add hover effects to cards
  const cards = document.querySelectorAll('.result-card, .analysis-card, .band-guide-card, .answers-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-5px)';
      this.style.transition = 'transform 0.3s ease';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });

  // Add ripple effect to buttons
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

// Add CSS for ripple effect
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