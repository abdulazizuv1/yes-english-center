import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "/config.js";
import { reviewFromStored, scoreNotice } from "../engine/index.js";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let resultData = null;

// Convert listening score to IELTS band
function convertListeningToIELTS(score) {
  if (score >= 39) return 9.0;
  if (score >= 37) return 8.5;
  if (score >= 35) return 8.0;
  if (score >= 32) return 7.5;
  if (score >= 30) return 7.0;
  if (score >= 26) return 6.5;
  if (score >= 23) return 6.0;
  if (score >= 18) return 5.5;
  if (score >= 16) return 5.0;
  if (score >= 13) return 4.5;
  if (score >= 10) return 4.0;
  return 3.5;
}

// Convert reading score to IELTS band
function convertReadingToIELTS(score) {
  if (score >= 39) return 9.0;
  if (score >= 37) return 8.5;
  if (score >= 35) return 8.0;
  if (score >= 33) return 7.5;
  if (score >= 30) return 7.0;
  if (score >= 27) return 6.5;
  if (score >= 23) return 6.0;
  if (score >= 19) return 5.5;
  if (score >= 15) return 5.0;
  if (score >= 13) return 4.5;
  if (score >= 10) return 4.0;
  return 3.5;
}

// Initialize result page
async function initializeResult() {
  try {
    // Get result ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const resultId = urlParams.get("id");

    if (!resultId) {
      alert("No result ID found. Redirecting to your dashboard.");
      window.location.href = "/pages/dashboard/";
      return;
    }


    // Load result data
    const docRef = doc(db, "resultFullmock", resultId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Result ${resultId} not found`);
    }

    resultData = docSnap.data();

    // Update UI
    updateResultDisplay();
    showCelebration();
  } catch (error) {
    console.error("❌ Error loading result:", error);
    alert("Error loading result: " + error.message);
    window.location.href = "/pages/mock.html";
  }
}

// Update result display
function updateResultDisplay() {
  // Helper function to safely update element
  const safeUpdate = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    } else {
      console.warn(`Element with id '${id}' not found`);
    }
  };

  // Helper function to safely update style
  const safeStyleUpdate = (id, property, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.style[property] = value;
    } else {
      console.warn(`Element with id '${id}' not found`);
    }
  };

  // Student info
  safeUpdate("email", resultData.name || "Unknown");
  safeUpdate("completionDate", formatDate(resultData.createdAt));

  // Calculate scores - separate listening and reading
  const listeningScore = resultData.listeningScore || 0;
  const readingScore = resultData.readingScore || 0;
  const listeningTotal = 40;
  const readingTotal = 40;

  // Convert to IELTS bands
  const listeningBand = convertListeningToIELTS(listeningScore);
  const readingBand = convertReadingToIELTS(readingScore);
  
  // Overall band is the average of listening and reading bands (IELTS standard)
  const overallBand = ((listeningBand + readingBand) / 2).toFixed(1);

  // Update main score display - show overall band instead of total score
  safeUpdate("overallBand", overallBand);
  safeUpdate("overallBandLabel", "Overall Band Score");

  // Update individual scores with bands
  safeUpdate("listeningScore", `${listeningScore} / ${listeningTotal}`);
  safeUpdate("listeningBand", listeningBand);
  safeUpdate("readingScore", `${readingScore} / ${readingTotal}`);
  safeUpdate("readingBand", readingBand);

  // Calculate and update percentages
  const listeningPercentage = Math.round((listeningScore / listeningTotal) * 100);
  const readingPercentage = Math.round((readingScore / readingTotal) * 100);

  safeUpdate("listeningPercentage", `${listeningPercentage}%`);
  safeUpdate("readingPercentage", `${readingPercentage}%`);

  // Update detailed scores with bands
  safeUpdate("listeningDetailScore", `${listeningScore}/${listeningTotal} (Band ${listeningBand})`);
  safeUpdate("readingDetailScore", `${readingScore}/${readingTotal} (Band ${readingBand})`);

  // Update band displays in overview section
  safeUpdate("listeningBandDisplay", listeningBand);
  safeUpdate("readingBandDisplay", readingBand);
  safeUpdate("overallBandDisplay", overallBand);

  // Update writing info
  updateWritingSection();

  // Render detailed question grids with answers
  renderDetailedListeningQuestions();
  renderDetailedReadingQuestions();

  // Highlight band score based on overall band
  highlightBandScore(parseFloat(overallBand));
}

// Update writing section
function updateWritingSection() {
  const safeUpdate = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  };

  const writingAnswers = resultData.writingAnswers || {};
  const task1Content = writingAnswers.task1 || "No response provided";
  const task2Content = writingAnswers.task2 || "No response provided";

  // Count words
  const task1Words = countWords(task1Content);
  const task2Words = countWords(task2Content);

  // Update word counts
  safeUpdate("task1WordCount", `${task1Words} words`);
  safeUpdate("task2WordCount", `${task2Words} words`);

  // Update content
  safeUpdate("task1Response", task1Content);
  safeUpdate("task2Response", task2Content);
}

// Count words function
function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// Render detailed listening questions with full answer display
/* One breakdown renderer for both stages. Rows come from the engine, so
   the review agrees with the marks awarded — the old comparison stripped
   word endings, marking "engine" correct against the key "engines"
   although no point was given. Row count follows the test (a stage is not
   always exactly 40 questions). */
function renderBreakdown(containerId, answers, correctAnswers, label, storedScore) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`${containerId} container not found`);
    return;
  }

  const rows = reviewFromStored(answers || {}, correctAnswers || {});
  const notice = scoreNotice(storedScore, rows);
  container.innerHTML = notice ? `<p class="score-notice">${notice}</p>` : "";

  if (!rows.length) {
    container.innerHTML = `<p class="no-data">No ${label} answers recorded for this attempt.</p>`;
    return;
  }

  const ICONS = { correct: "\u2705", incorrect: "\u274C", unanswered: "\u2B55" };

  rows.forEach((row) => {
    const answerDiv = document.createElement("div");
    answerDiv.className = `detailed-answer ${row.status}`;
    answerDiv.innerHTML = `
      <div class="answer-header">
        <span class="status-icon">${ICONS[row.status]}</span>
        <strong>Question ${row.number}</strong>
      </div>
      <div class="answer-content">
        <div class="user-answer">
          <strong>Your Answer:</strong> ${row.userDisplay || "<i>Not answered</i>"}
        </div>
        <div class="correct-answer">
          <strong>Correct Answer:</strong> ${row.expectedDisplay || "<i>No data</i>"}
        </div>
      </div>
    `;
    container.appendChild(answerDiv);
  });
}

function renderDetailedListeningQuestions() {
  renderBreakdown(
    "listeningQuestions",
    resultData.listeningAnswers,
    resultData.listeningCorrectAnswers,
    "listening",
    resultData.listeningScore
  );
}

function renderDetailedReadingQuestions() {
  renderBreakdown(
    "readingQuestions",
    resultData.readingAnswers,
    resultData.readingCorrectAnswers,
    "reading",
    resultData.readingScore
  );
}



// An answer key may list several accepted variants separated by commas:
// "holiday, holidays" accepts both. A comma directly between digits
// (6,000) is a thousand separator, not a variant break.


// One comma-variant vs the student's answer ("/" alternatives kept)


// Check answer correctness (same logic as in main test)


// Helper function to normalize answers by removing postfixes


// Highlight appropriate band score based on overall band
function highlightBandScore(overallBand) {
  // Remove existing highlights
  const bandItems = document.querySelectorAll(".band-item");
  bandItems.forEach((item) => {
    item.classList.remove("active");
    item.style.transform = "scale(1)";
    item.style.boxShadow = "none";
  });

  // Determine band class based on overall band score
  let bandClass = "";
  if (overallBand >= 9.0) bandClass = "band-9";
  else if (overallBand >= 8.5) bandClass = "band-8-5";
  else if (overallBand >= 8.0) bandClass = "band-8";
  else if (overallBand >= 7.5) bandClass = "band-7-5";
  else if (overallBand >= 7.0) bandClass = "band-7";
  else if (overallBand >= 6.5) bandClass = "band-6-5";
  else if (overallBand >= 6.0) bandClass = "band-6";
  else if (overallBand >= 5.5) bandClass = "band-5-5";
  else if (overallBand >= 5.0) bandClass = "band-5";
  else if (overallBand >= 4.5) bandClass = "band-4-5";
  else bandClass = "band-4";

  // Highlight the appropriate band
  const bandElement = document.querySelector(`.${bandClass}`);
  if (bandElement) {
    bandElement.classList.add("active");
    bandElement.style.transform = "scale(1.05)";
    bandElement.style.boxShadow = "0 8px 25px rgba(59, 130, 246, 0.4)";

    // Scroll to highlighted band
    setTimeout(() => {
      bandElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 500);
  }
}

// Format date
function formatDate(timestamp) {
  if (!timestamp) return "Unknown";

  let date;
  if (timestamp.toDate) {
    // Firestore timestamp
    date = timestamp.toDate();
  } else {
    // Regular date
    date = new Date(timestamp);
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Show celebration animation
function showCelebration() {
  setTimeout(() => {
    const overlay = document.getElementById("celebrationOverlay");
    if (overlay) {
      overlay.classList.add("show");

      // Hide after 3 seconds
      setTimeout(() => {
        overlay.classList.remove("show");
      }, 3000);
    }
  }, 1000);
}

// Section navigation
window.showSection = function (sectionName) {
  // Remove active class from all tabs and sections
  document.querySelectorAll(".tab-button").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelectorAll(".result-section").forEach((section) => {
    section.classList.remove("active");
  });

  // Add active class to clicked tab and corresponding section
  if (event && event.target) {
    event.target.classList.add("active");
  }
  
  const section = document.getElementById(`${sectionName}Section`);
  if (section) {
    section.classList.add("active");
  }
};

// Retake test function
window.retakeTest = function () {
  if (confirm("Are you sure you want to retake the full mock test? This will start a new test session.")) {
    window.location.href = "/pages/mock/full/fullMock.html";
  }
};

// Initialize when page loads
window.addEventListener("load", async () => {

  // Check authentication
  const auth = getAuth();
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  if (!user) {
    alert("🔒 Please login first to view results");
    window.location.href = "/";
    return;
  }

  await initializeResult();
});

// Print functionality
window.addEventListener("beforeprint", () => {
  // Show all sections when printing
  document.querySelectorAll(".result-section").forEach((section) => {
    section.style.display = "block";
  });
});

window.addEventListener("afterprint", () => {
  // Restore original display
  document.querySelectorAll(".result-section").forEach((section) => {
    if (!section.classList.contains("active")) {
      section.style.display = "none";
    }
  });
});