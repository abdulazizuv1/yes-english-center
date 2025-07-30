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

const firebaseConfig = {
  apiKey: "AIzaSyBw36xP5tVYO2D0T-XFQQAGFA4wrJ8If8k",
  authDomain: "yes-english-center.firebaseapp.com",
  projectId: "yes-english-center",
  storageBucket: "yes-english-center.firebasestorage.app",
  messagingSenderId: "203211203853",
  appId: "1:203211203853:web:7d499925c3aa830eaefc44",
  measurementId: "G-4LHEBLG2KK",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Cache for test structures - now supports multiple tests
let testStructureCache = {};

// Load test structure from Firestore based on testId
async function loadTestStructure(testId) {
  // Return cached version if available
  if (testStructureCache[testId]) {
    console.log(`📋 Using cached test structure for ${testId}`);
    return testStructureCache[testId];
  }
  
  try {
    console.log(`🔄 Loading test structure for testId: ${testId}`);
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
      console.log(`✅ Test structure loaded and cached for ${testId}:`, testStructure);
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

// Get all questions from test structure
function getAllQuestions(testStructure) {
  if (!testStructure || !testStructure.sections) {
    console.warn("⚠️ No test structure or sections found");
    return [];
  }
  
  const allQuestions = [];
  
  testStructure.sections.forEach((section, sectionIndex) => {
    if (!section.content) {
      // Check for legacy format
      if (section.questions || section.multiSelect || section.matching) {
        console.log(`📝 Processing legacy section ${sectionIndex + 1}`);
      }
      return;
    }
    
    section.content.forEach(item => {
      if (item.type === "question") {
        allQuestions.push({
          qId: item.questionId,
          type: item.format || item.type,
          correctAnswer: item.correctAnswer,
          options: item.options,
          sectionIndex: sectionIndex
        });
      } else if (item.type === "question-group") {
        if (item.groupType === "multi-select" && item.questions) {
          item.questions.forEach(q => {
            allQuestions.push({
              qId: q.questionId,
              type: "multi-select",
              correctAnswer: q.correctAnswer,
              options: item.options,
              sectionIndex: sectionIndex
            });
          });
        } else if (item.groupType === "matching" && item.questions) {
          item.questions.forEach(q => {
            allQuestions.push({
              qId: q.questionId,
              type: "matching",
              correctAnswer: q.correctAnswer,
              options: item.options,
              sectionIndex: sectionIndex
            });
          });
        }
      } else if (item.type === "table" && item.answer) {
        // Handle table questions
        Object.keys(item.answer).forEach(qId => {
          allQuestions.push({
            qId: qId,
            type: "gap-fill",
            correctAnswer: item.answer[qId],
            options: null,
            sectionIndex: sectionIndex
          });
        });
      } else if (item.qId) {
        // Legacy question format
        allQuestions.push({
          qId: item.qId,
          type: item.type,
          correctAnswer: item.answer,
          options: item.options,
          sectionIndex: sectionIndex
        });
      }
    });
    
    // Process legacy groups
    ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach((key) => {
      if (section[key]) {
        const group = section[key];
        
        if (key === "matching" && group.matchingQuestions) {
          group.matchingQuestions.forEach(mq => {
            allQuestions.push({
              qId: mq.qId,
              type: "matching",
              correctAnswer: mq.correct,
              options: group.options,
              sectionIndex: sectionIndex
            });
          });
        } else if (["multiSelect", "multiSelect1", "multiSelect2"].includes(key)) {
          const entries = group.answer || {};
          for (const questionKey in entries) {
            if (questionKey.includes('_')) {
              const questionNumbers = questionKey.split('_');
              const expectedAnswers = Array.isArray(entries[questionKey]) ? entries[questionKey] : [entries[questionKey]];
              
              questionNumbers.forEach((qNum, index) => {
                allQuestions.push({
                  qId: `q${qNum}`,
                  type: "multi-select",
                  correctAnswer: expectedAnswers.length > index ? expectedAnswers[index] : null,
                  options: group.options,
                  sectionIndex: sectionIndex
                });
              });
            } else {
              allQuestions.push({
                qId: `q${questionKey}`,
                type: "multi-select", 
                correctAnswer: entries[questionKey],
                options: group.options,
                sectionIndex: sectionIndex
              });
            }
          }
        }
      }
    });
  });
  
  console.log(`📝 Extracted ${allQuestions.length} questions from test structure`);
  return allQuestions;
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
    console.log(`🔍 Fetching result with ID: ${resultId}`);
    const docRef = doc(db, "resultsListening", resultId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("📊 Result data loaded:", data);
      
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
  console.log(`🎯 Rendering result for testId: ${data.testId}`);
  
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
    // Load test structure based on the actual testId from result data
    const testStructure = await loadTestStructure(data.testId);
    
    if (!testStructure) {
      throw new Error(`Failed to load test structure for testId: ${data.testId}`);
    }
    
    const allQuestions = getAllQuestions(testStructure);
    
    if (allQuestions.length === 0) {
      throw new Error("No questions found in test structure");
    }
    
    // Process results
    const { userAnswers, correctAnswers, score, total } = processAnswers(data, allQuestions);
    const accuracy = Math.round((score / total) * 100);
    const ieltsScore = convertToIELTS(score, total);

    console.log(`📈 Test Results: ${score}/${total} (${accuracy}%) - IELTS: ${ieltsScore}`);

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

    // Calculate answer statistics and section performance
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    const sectionStats = [0, 0, 0, 0]; // Correct answers per section

    const sortedKeys = Object.keys(correctAnswers).sort((a, b) => {
      const aNum = extractQuestionNumber(a);
      const bNum = extractQuestionNumber(b);
      return aNum - bNum;
    });

    // Clear answers div
    if (answersDiv) answersDiv.innerHTML = "";

    for (const qId of sortedKeys) {
      try {
        const userAnswer = userAnswers[qId];
        const correctAnswer = correctAnswers[qId];
        const questionData = allQuestions.find(q => q.qId === qId);

        const { userDisplay, isCorrect } = processAnswer(userAnswer, correctAnswer, questionData);
        const correctDisplay = formatCorrectAnswer(correctAnswer, questionData);

        // Update statistics
        if (!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0) || userAnswer === "") {
          unansweredCount++;
        } else if (isCorrect) {
          correctCount++;
          // Update section stats (assuming 10 questions per section)
          const sectionIndex = Math.floor((extractQuestionNumber(qId) - 1) / 10);
          if (sectionIndex >= 0 && sectionIndex < 4) {
            sectionStats[sectionIndex]++;
          }
        } else {
          incorrectCount++;
        }

        if (answersDiv) {
          const answerDiv = document.createElement("div");
          answerDiv.className = "answer";
          answerDiv.dataset.qid = qId;

          let statusIcon = "";
          let statusClass = "";

          if (!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0) || userAnswer === "") {
            statusIcon = "⭕";
            statusClass = "unanswered";
            answerDiv.dataset.filter = "unanswered";
          } else if (isCorrect) {
            statusIcon = "✅";
            statusClass = "correct";
            answerDiv.dataset.filter = "correct";
          } else {
            statusIcon = "❌";
            statusClass = "incorrect";
            answerDiv.dataset.filter = "incorrect";
          }

          answerDiv.classList.add(statusClass);

          answerDiv.innerHTML = `
            <div class="question-number">
              <span class="status-icon">${statusIcon}</span>
              <strong>Question ${formatQuestionId(qId).replace('Question ', '')}</strong>
            </div>
            <div class="answer-content">
              <div class="user-answer">
                <strong>Your Answer:</strong> ${userDisplay}
              </div>
              <div class="correct-answer">
                <strong>Correct Answer:</strong> ${correctDisplay}
              </div>
            </div>
          `;

          answersDiv.appendChild(answerDiv);
        }
      } catch (error) {
        console.error(`❌ Error processing question ${qId}:`, error);
      }
    }

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

// Process answers and calculate score
function processAnswers(data, allQuestions) {
  const userAnswers = {};
  const correctAnswers = {};
  let score = 0;
  
  Object.entries(data.answers || {}).forEach(([qId, answer]) => {
    userAnswers[qId] = answer;
  });
  
  allQuestions.forEach(question => {
    const qId = question.qId;
    const correctAnswer = question.correctAnswer;
    const userAnswer = userAnswers[qId];
    
    correctAnswers[qId] = correctAnswer;
    
    const isCorrect = checkAnswerCorrectness(userAnswer, correctAnswer, question.type);
    if (isCorrect) score++;
  });
  
  return {
    userAnswers,
    correctAnswers,
    score,
    total: allQuestions.length
  };
}

// Check answer correctness
function checkAnswerCorrectness(userAnswer, correctAnswer, questionType) {
  if (!correctAnswer) return false;
  
  if (questionType === "matching") {
    return String(userAnswer || "").toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
  }
  
  if (Array.isArray(correctAnswer)) {
    if (!Array.isArray(userAnswer)) return false;
    return checkArrayAnswer(userAnswer, correctAnswer);
  }
  
  return checkStringAnswer(userAnswer, correctAnswer);
}

function extractQuestionNumber(qId) {
  if (!qId || typeof qId !== 'string') return 0;
  const matches = qId.match(/\d+/g);
  if (matches && matches.length > 0) {
    return parseInt(matches[0]);
  }
  return 0;
}

function formatQuestionId(qId) {
  if (!qId) return "Question";
  return qId.toUpperCase().replace(/^Q/, "Question ");
}

function processAnswer(userAnswer, correctAnswer, questionData) {
  const questionType = questionData?.type;
  const options = questionData?.options || {};
  
  if (!userAnswer || 
      (Array.isArray(userAnswer) && userAnswer.length === 0) || 
      userAnswer === "" || 
      userAnswer === null || 
      userAnswer === undefined) {
    return { userDisplay: "<i>Not answered</i>", isCorrect: false };
  }

  if (questionType === "matching") {
    const optionText = options[userAnswer] || '';
    const userDisplay = userAnswer ? `${userAnswer}. ${optionText}` : "<i>Not answered</i>";
    const isCorrect = String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
    return { userDisplay, isCorrect };
  }

  if (Array.isArray(userAnswer)) {
    const userDisplay = userAnswer.length > 0 ? userAnswer.join(", ") : "<i>Not answered</i>";
    const isCorrect = checkArrayAnswer(userAnswer, correctAnswer);
    return { userDisplay, isCorrect };
  }

  const userDisplay = String(userAnswer).trim() || "<i>Not answered</i>";
  const isCorrect = checkStringAnswer(userAnswer, correctAnswer);
  return { userDisplay, isCorrect };
}

function checkArrayAnswer(userAnswer, correctAnswer) {
  if (!Array.isArray(correctAnswer) || correctAnswer.length === 0) {
    return false;
  }

  if (!Array.isArray(userAnswer) || userAnswer.length !== correctAnswer.length) {
    return false;
  }

  const userSorted = userAnswer.map(a => String(a).toLowerCase().trim()).sort();
  const correctSorted = correctAnswer.map(a => String(a).toLowerCase().trim()).sort();
  
  return userSorted.every((item, index) => item === correctSorted[index]);
}

function checkStringAnswer(userAnswer, correctAnswer) {
  if (!userAnswer || typeof userAnswer !== 'string') {
    return false;
  }

  const userClean = userAnswer.toLowerCase().trim();
  
  if (Array.isArray(correctAnswer)) {
    return correctAnswer.some(correct => 
      String(correct).toLowerCase().trim() === userClean
    );
  } else {
    return String(correctAnswer).toLowerCase().trim() === userClean;
  }
}

function formatCorrectAnswer(correctAnswer, questionData) {
  if (!correctAnswer) {
    return "<i>No data</i>";
  }

  const questionType = questionData?.type;
  const options = questionData?.options || {};
  
  if (questionType === "matching") {
    const optionText = options[correctAnswer] || '';
    return correctAnswer ? `${correctAnswer}. ${optionText}` : "<i>No data</i>";
  }

  if (Array.isArray(correctAnswer)) {
    return correctAnswer.length > 0 ? correctAnswer.join(" / ") : "<i>No data</i>";
  }

  return String(correctAnswer);
}

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