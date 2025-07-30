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
      throw new Error("No result ID provided");
    }

    console.log("🔍 Loading result:", resultId);

    // Load result data
    const docRef = doc(db, "resultFullmock", resultId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Result ${resultId} not found`);
    }

    resultData = docSnap.data();
    console.log("📊 Result data loaded:", resultData);

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

  // Calculate scores
  const listeningScore = resultData.listeningScore || 0;
  const readingScore = resultData.readingScore || 0;
  const totalScore = listeningScore + readingScore;
  const totalPossible = 80;
  const listeningTotal = 40;
  const readingTotal = 40;

  // Convert to IELTS bands
  const listeningBand = convertListeningToIELTS(listeningScore);
  const readingBand = convertReadingToIELTS(readingScore);
  const overallBand = ((listeningBand + readingBand) / 2).toFixed(1);

  // Update main score display
  safeUpdate("overallScore", totalScore);
  safeUpdate("totalPossible", totalPossible);
  safeUpdate("overallBand", overallBand);

  // Update individual scores with bands
  safeUpdate("listeningScore", `${listeningScore} / ${listeningTotal} (Band ${listeningBand})`);
  safeUpdate("readingScore", `${readingScore} / ${readingTotal} (Band ${readingBand})`);

  // Calculate and update percentages
  const listeningPercentage = Math.round((listeningScore / listeningTotal) * 100);
  const readingPercentage = Math.round((readingScore / readingTotal) * 100);
  const overallPercentage = Math.round((totalScore / totalPossible) * 100);

  safeUpdate("listeningPercentage", `${listeningPercentage}%`);
  safeUpdate("readingPercentage", `${readingPercentage}%`);
  safeUpdate("progressPercent", `${overallPercentage}%`);

  // Update progress bar
  setTimeout(() => {
    safeStyleUpdate("progressFill", "width", `${overallPercentage}%`);
  }, 500);

  // Update analysis
  const totalIncorrect = totalPossible - totalScore;
  safeUpdate("totalCorrect", totalScore);
  safeUpdate("totalIncorrect", totalIncorrect);
  safeUpdate("overallAccuracy", `${overallPercentage}%`);

  // Update detailed scores with bands
  safeUpdate("listeningDetailScore", `${listeningScore}/${listeningTotal} (${listeningBand})`);
  safeUpdate("readingDetailScore", `${readingScore}/${readingTotal} (${readingBand})`);

  // Update band displays
  safeUpdate("listeningBandDisplay", listeningBand);
  safeUpdate("readingBandDisplay", readingBand);

  // Update writing info
  updateWritingSection();

  // Render question grids
  renderListeningQuestions();
  renderReadingQuestions();

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

// Render listening questions
function renderListeningQuestions() {
  const container = document.getElementById("listeningQuestions");
  if (!container) {
    console.warn("listeningQuestions container not found");
    return;
  }

  const listeningAnswers = resultData.listeningAnswers || {};
  const listeningCorrectAnswers = resultData.listeningCorrectAnswers || {};

  // Clear container
  container.innerHTML = "";

  // Create 40 questions for listening
  for (let i = 1; i <= 40; i++) {
    const qId = `q${i}`;
    const userAnswer = listeningAnswers[qId];
    const correctAnswers = listeningCorrectAnswers[qId] || [];

    const questionDiv = document.createElement("div");
    questionDiv.className = "question-result";
    questionDiv.textContent = i;

    // Determine status based on actual comparison
    if (userAnswer === undefined || userAnswer === null || userAnswer === "") {
      questionDiv.classList.add("unanswered");
      questionDiv.title = `Question ${i}: Not answered`;
    } else {
      const isCorrect = checkAnswerCorrectness(userAnswer, correctAnswers);
      if (isCorrect) {
        questionDiv.classList.add("correct");
        questionDiv.title = `Question ${i}: Correct\nYour answer: ${userAnswer}`;
      } else {
        questionDiv.classList.add("incorrect");
        questionDiv.title = `Question ${i}: Incorrect\nYour answer: ${userAnswer}\nCorrect answer: ${correctAnswers.join(", ")}`;
      }
    }

    container.appendChild(questionDiv);
  }
}

// Render reading questions
function renderReadingQuestions() {
  const container = document.getElementById("readingQuestions");
  if (!container) {
    console.warn("readingQuestions container not found");
    return;
  }

  const readingAnswers = resultData.readingAnswers || {};
  const readingCorrectAnswers = resultData.readingCorrectAnswers || {};

  // Clear container
  container.innerHTML = "";

  // Create 40 questions for reading
  for (let i = 1; i <= 40; i++) {
    const qId = `q${i}`;
    const userAnswer = readingAnswers[qId];
    const correctAnswers = readingCorrectAnswers[qId] || [];

    const questionDiv = document.createElement("div");
    questionDiv.className = "question-result";
    questionDiv.textContent = i;

    // Determine status based on actual comparison
    if (userAnswer === undefined || userAnswer === null || userAnswer === "") {
      questionDiv.classList.add("unanswered");
      questionDiv.title = `Question ${i}: Not answered`;
    } else {
      const isCorrect = checkAnswerCorrectness(userAnswer, correctAnswers);
      if (isCorrect) {
        questionDiv.classList.add("correct");
        questionDiv.title = `Question ${i}: Correct\nYour answer: ${userAnswer}`;
      } else {
        questionDiv.classList.add("incorrect");
        questionDiv.title = `Question ${i}: Incorrect\nYour answer: ${userAnswer}\nCorrect answer: ${correctAnswers.join(", ")}`;
      }
    }

    container.appendChild(questionDiv);
  }
}

// Check answer correctness (same logic as in main test)
function checkAnswerCorrectness(userAns, expected) {
  if (!expected || expected.length === 0) return false;

  if (Array.isArray(userAns) && Array.isArray(expected)) {
    if (userAns.length !== expected.length) return false;
    return expected.every((v) => userAns.includes(v)) && userAns.length === expected.length;
  } else {
    const userStr = typeof userAns === "string" ? userAns.toLowerCase().trim() : String(userAns || "").toLowerCase().trim();
    return expected.map((a) => String(a).toLowerCase().trim()).includes(userStr);
  }
}

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
  console.log("🌐 Full mock result page loaded");

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

  console.log("👤 User authenticated:", user.email);
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