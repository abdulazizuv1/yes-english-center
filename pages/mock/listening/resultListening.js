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
import {
  repairListeningIds,
  normalizeListeningSection,
  reviewRows,
  reviewFromStored,
  reviewSummary,
  scoreNotice,
} from "../engine/index.js";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Cache for test structures - now supports multiple tests
let testStructureCache = {};

// Load test structure from Firestore based on testId
async function loadTestStructure(testId) {
  // Return cached version if available
  if (testStructureCache[testId]) {
    return testStructureCache[testId];
  }
  
  try {
    const docRef = doc(db, "listeningTests", testId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      let testStructure = null;
      
      // Extract sections from different structures
      if (data.sections && Array.isArray(data.sections)) {
        testStructure = { sections: data.sections };
      } else if (data.parts && data.parts.sections && Array.isArray(data.parts.sections)) {
        testStructure = { sections: data.parts.sections };
      } else if (data.parts && Array.isArray(data.parts)) {
        testStructure = { sections: data.parts };
      }
      
      // Cache the loaded structure
      testStructureCache[testId] = testStructure;
      return testStructure;
    } else {
      console.error(`❌ Test document not found for testId: ${testId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error loading test structure for ${testId}:`, error);
    return null;
  }
}

/* Canonical items for a test, straight from the engine — the same
   normalizer the test page uses, so every question kind the students can
   answer (including drag & drop and map labelling) appears in the review. */
function itemsForTest(testStructure) {
  const sections = testStructure?.sections || testStructure?.parts?.sections || [];
  repairListeningIds(sections);
  return sections.flatMap((section) => normalizeListeningSection(section));
}

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
    alert("No result ID found. Redirecting to your dashboard.");
    window.location.href = "/pages/dashboard/";
    return;
  }

  try {
    const docRef = doc(db, "resultsListening", resultId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Validate that testId exists in result data
      if (!data.testId) {
        console.warn("⚠️ No testId found in result data, defaulting to test-1");
        data.testId = "test-1";
      }
      
      showCelebration();
      setTimeout(() => renderResult(data), 1000);
    } else {
      alert("Result document not found.");
      console.error(`❌ Result document not found for ID: ${resultId}`);
    }
  } catch (err) {
    console.error("❌ Error fetching result:", err);
    alert("Failed to load result.");
  }
});

function showCelebration() {
  const overlay = document.getElementById('celebrationOverlay');
  if (overlay) {
    overlay.classList.add('show');
    
    setTimeout(() => {
      overlay.classList.remove('show');
    }, 3000);
  }
}

async function renderResult(data) {
  
  const emailEl = document.getElementById("email");
  const scoreEl = document.getElementById("score");
  const ieltsEl = document.getElementById("ielts");
  const accuracyEl = document.getElementById("accuracy");
  const totalQuestionsEl = document.getElementById("totalQuestions");
  const progressPercentEl = document.getElementById("progressPercent");
  const progressFillEl = document.getElementById("progressFill");
  const completionDateEl = document.getElementById("completionDate");
  const answersDiv = document.getElementById("answers");

  try {
    // The breakdown comes from the engine's review layer, so it always
    // agrees with the marks the student was given.
    // Results outlive tests — a deleted test must not break the review,
    // so fall back to the answer keys stored with the result itself.
    let rows;
    const testStructure = await loadTestStructure(data.testId).catch(() => null);
    const items = testStructure ? itemsForTest(testStructure) : [];
    if (items.length) {
      rows = reviewRows(items, data.answers || {});
    } else {
      console.warn(`Test ${data.testId} unavailable — reviewing from the saved answer keys.`);
      rows = reviewFromStored(data.answers || {}, data.correctAnswers || {});
    }

    if (!rows.length) {
      throw new Error("This result has no answer data to review.");
    }

    const summary = reviewSummary(rows);
    // Lead with the score the attempt was marked with — that is what the
    // dashboard shows — and flag it if a recheck now differs.
    const score = typeof data.score === "number" ? data.score : summary.correct;
    const total = typeof data.total === "number" ? data.total : summary.total;
    const notice = scoreNotice(data.score, rows);
    const accuracy = summary.accuracy;
    const ieltsScore = convertToIELTS(score, total);


    // Update basic info
    if (emailEl) emailEl.textContent = data.name || "Unknown Student";
    if (scoreEl) scoreEl.textContent = `${score} / ${total}`;
    if (ieltsEl) ieltsEl.textContent = ieltsScore;
    if (accuracyEl) accuracyEl.textContent = `${accuracy}%`;
    if (totalQuestionsEl) totalQuestionsEl.textContent = total;
    if (progressPercentEl) progressPercentEl.textContent = `${accuracy}%`;
    
    // Update completion date
    if (data.createdAt && completionDateEl) {
      const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      completionDateEl.textContent = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (completionDateEl) {
      completionDateEl.textContent = new Date().toLocaleDateString();
    }

    // Animate progress bar
    if (progressFillEl) {
      setTimeout(() => {
        progressFillEl.style.width = `${accuracy}%`;
      }, 500);
    }

    // Update result badge color based on score
    const resultBadge = document.getElementById('resultBadge');
    if (resultBadge) {
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
    }

    // Answer breakdown — one row per question, straight from the engine
    const sectionStats = [0, 0, 0, 0]; // correct answers per section of 10
    const correctCount = summary.correct;
    const incorrectCount = summary.incorrect;
    const unansweredCount = summary.unanswered;

    if (answersDiv) {
      answersDiv.innerHTML = notice
        ? `<p class="score-notice">${notice}</p>`
        : "";
    }

    const ICONS = { correct: "\u2705", incorrect: "\u274C", unanswered: "\u2B55" };

    rows.forEach((row) => {
      if (row.status === "correct") {
        const sectionIndex = Math.floor((parseInt(row.number, 10) - 1) / 10);
        if (sectionIndex >= 0 && sectionIndex < 4) sectionStats[sectionIndex]++;
      }

      if (!answersDiv) return;

      const answerDiv = document.createElement("div");
      answerDiv.className = `answer ${row.status}`;
      answerDiv.dataset.qid = row.id;
      answerDiv.dataset.filter = row.status;

      answerDiv.innerHTML = `
        <div class="question-number">
          <span class="status-icon">${ICONS[row.status]}</span>
          <strong>Question ${row.number}</strong>
        </div>
        <div class="answer-content">
          ${row.questionText ? `<div class="question-text-review">${row.questionText}</div>` : ""}
          <div class="user-answer">
            <strong>Your Answer:</strong> ${row.userDisplay || "<em>Not answered</em>"}
          </div>
          <div class="correct-answer">
            <strong>Correct Answer:</strong> ${row.expectedDisplay || "<em>No data</em>"}
          </div>
        </div>
      `;

      answersDiv.appendChild(answerDiv);
    });

    // Update analysis numbers
    const correctCountEl = document.getElementById('correctCount');
    const incorrectCountEl = document.getElementById('incorrectCount');
    const unansweredCountEl = document.getElementById('unansweredCount');
    
    if (correctCountEl) correctCountEl.textContent = correctCount;
    if (incorrectCountEl) incorrectCountEl.textContent = incorrectCount;
    if (unansweredCountEl) unansweredCountEl.textContent = unansweredCount;

    // Update section performance
    updateSectionPerformance(sectionStats);

    // Animate numbers
    animateNumbers();
    
    // Setup filter functionality
    setupAnswerFilters();
    
    // Highlight current band in guide
    highlightCurrentBand(ieltsScore);
    
  } catch (error) {
    console.error("❌ Error rendering result:", error);
    alert(`Error loading test results: ${error.message}`);
    
    // Show error message in the results area
    if (answersDiv) {
      answersDiv.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
          <h3>❌ Error Loading Results</h3>
          <p>Unable to load test structure for testId: <strong>${data.testId}</strong></p>
          <p>Error: ${error.message}</p>
          <p>Please contact support if this issue persists.</p>
        </div>
      `;
    }
  }
}

function updateSectionPerformance(sectionStats) {
  for (let i = 0; i < 4; i++) {
    const score = sectionStats[i];
    const percentage = (score / 10) * 100;
    
    const scoreEl = document.getElementById(`section${i + 1}Score`);
    const progressEl = document.getElementById(`section${i + 1}Progress`);
    
    if (scoreEl) scoreEl.textContent = `${score}/10`;
    
    if (progressEl) {
      setTimeout(() => {
        progressEl.style.width = `${percentage}%`;
      }, 500 + (i * 200));
    }
  }
}

function animateNumbers() {
  const correctCountEl = document.getElementById('correctCount');
  const incorrectCountEl = document.getElementById('incorrectCount');
  const unansweredCountEl = document.getElementById('unansweredCount');
  
  const numbers = [
    { element: correctCountEl, target: correctCountEl ? parseInt(correctCountEl.textContent) : 0 },
    { element: incorrectCountEl, target: incorrectCountEl ? parseInt(incorrectCountEl.textContent) : 0 },
    { element: unansweredCountEl, target: unansweredCountEl ? parseInt(unansweredCountEl.textContent) : 0 }
  ].filter(item => item.element); // Filter out null elements

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
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const filter = button.dataset.filter;

      answers.forEach(answer => {
        if (filter === 'all' || answer.dataset.filter === filter) {
          answer.style.display = 'block';
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
    
    setTimeout(() => {
      bandItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  }
}














// An answer key may list several accepted variants separated by commas:
// "holiday, holidays" accepts both. A comma directly between digits
// (6,000) is a thousand separator, not a variant break.


// One comma/slash variant vs the student's cleaned answer






function convertToIELTS(score, total) {
  if (score >= 39) return "9.0";
  if (score >= 37) return "8.5";
  if (score >= 35) return "8.0";
  if (score >= 32) return "7.5";
  if (score >= 30) return "7.0";
  if (score >= 26) return "6.5";
  if (score >= 23) return "6.0";
  if (score >= 18) return "5.5";
  if (score >= 16) return "5.0";
  if (score >= 13) return "4.5";
  if (score >= 10) return "4.0";
  return "Below 4.0";
}

// Add interactive effects
document.addEventListener('DOMContentLoaded', function() {
  const cards = document.querySelectorAll('.result-card, .analysis-card, .section-performance-card, .band-guide-card, .answers-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-5px)';
      this.style.transition = 'transform 0.3s ease';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });

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