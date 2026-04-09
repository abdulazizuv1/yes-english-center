import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let currentTask = 1;
let testData = null;
let currentTestId = "test-1";
let task1Answer = "";
let task2Answer = "";
let task1WordCount = 0;
let task2WordCount = 0;

// Timer variables
let totalTimeLeft = 60 * 60; // 60 minutes in seconds
let timerInterval = null;

// Pause functionality variables
let isPaused = false;
let pausedTime = 0;
let hasUnlimitedTime = false; // Track if user has unlimited time

// DOM elements
const elements = {
  testBadge: document.getElementById("testBadge"),
  taskBadge: document.getElementById("taskBadge"),
  timer: document.getElementById("timer"),
  taskTitle: document.getElementById("taskTitle"),
  taskInstructions: document.getElementById("taskInstructions"),
  questionText: document.getElementById("questionText"),
  questionImage: document.getElementById("questionImage"),
  taskImage: document.getElementById("taskImage"),
  answerText: document.getElementById("answerText"),
  wordCount: document.getElementById("wordCount"),
  wordMinimum: document.getElementById("wordMinimum"),
  wordStatus: document.getElementById("wordStatus"),
  nextBtn: document.getElementById("nextBtn"),
  finishBtn: document.getElementById("finishBtn"),
  step1: document.getElementById("step1"),
  step2: document.getElementById("step2"),
  loadingScreen: document.getElementById("loadingScreen"),
  successModal: document.getElementById("successModal"),
  writingLabel: document.getElementById("writingLabel"),
  pauseModal: document.getElementById("pauseModal"),
};

// Pause functionality
window.togglePause = function() {
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseModal = document.getElementById('pauseModal');
    
    if (!isPaused) {
        // Pause the test
        isPaused = true;
        clearInterval(timerInterval);
        pausedTime = totalTimeLeft;
        pauseBtn.textContent = 'Resume';
        pauseBtn.classList.add('paused');
        pauseModal.style.display = 'flex';
        
        // Disable interaction with test
        document.querySelector('.container').style.pointerEvents = 'none';
        document.querySelector('.navigation').style.pointerEvents = 'none';
        
    } else {
        // Resume the test
        isPaused = false;
        pauseBtn.textContent = 'Pause';
        pauseBtn.classList.remove('paused');
        pauseModal.style.display = 'none';
        
        // Enable interaction with test
        document.querySelector('.container').style.pointerEvents = 'auto';
        document.querySelector('.navigation').style.pointerEvents = 'auto';
        
        // Resume timer with remaining time (only if user doesn't have unlimited time)
        if (!hasUnlimitedTime) {
            totalTimeLeft = pausedTime;
            startTimer();
        }
    }
};

// Initialize test
function waitForPin(correctPin) {
  return new Promise((resolve) => {
    const modal = document.getElementById("pinModal");
    const input = document.getElementById("pinInput");
    const error = document.getElementById("pinError");
    const confirmBtn = document.getElementById("pinConfirmBtn");

    modal.style.display = "flex";
    input.focus();

    function attempt() {
      const entered = input.value.trim();
      if (entered === correctPin) {
        modal.style.display = "none";
        resolve();
      } else {
        error.style.display = "block";
        input.value = "";
        input.focus();
      }
    }

    confirmBtn.addEventListener("click", attempt);
    input.addEventListener("keydown", function onKey(e) {
      if (e.key === "Enter") attempt();
    });
  });
}

async function initializeTest() {
  try {
    // Get test ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentTestId = urlParams.get("testId") || "test-1";

    console.log("🎯 Loading writing test:", currentTestId);

    // Load test data
    const docRef = doc(db, "writingTests", currentTestId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const rawData = docSnap.data();
      console.log("✅ Raw test data loaded:", rawData);

      if (rawData.accessPin) {
        await waitForPin(rawData.accessPin);
      }

      // Fix structure - get nested object test-1
      if (rawData[currentTestId]) {
        testData = rawData[currentTestId];
        console.log("✅ Extracted nested test data:", testData);
      } else {
        testData = rawData;
        console.log("✅ Using direct test data:", testData);
      }

      // Check data structure
      if (!testData.task1 || !testData.task2) {
        console.error("❌ Invalid test structure:", testData);
        console.error("❌ Available keys:", Object.keys(testData));
        throw new Error("Test data is missing task1 or task2");
      }

      if (!testData.task1.question) {
        console.error("❌ Task1 missing question:", testData.task1);
        throw new Error("Task1 is missing question field");
      }

      if (!testData.task2.question) {
        console.error("❌ Task2 missing question:", testData.task2);
        throw new Error("Task2 is missing question field");
      }

      console.log("✅ Test structure validated");
      console.log(
        "📝 Task1 question:",
        testData.task1.question.substring(0, 100)
      );
      console.log(
        "📝 Task2 question:",
        testData.task2.question.substring(0, 100)
      );

      // Update UI
      elements.testBadge.textContent =
        testData.title || `Test ${currentTestId.replace("test-", "")}`;

      // Load Task 1
      loadTask(1);

      // Check if user has unlimited time before starting timer
      const auth = getAuth();
      onAuthStateChanged(auth, (user) => {
        if (user && user.email === "alisher@yescenter.uz") {
          // Unlimited time for this account
          hasUnlimitedTime = true;
          elements.timer.textContent = "∞";
          elements.timer.style.fontSize = "24px";
          console.log("✨ Unlimited time mode activated for", user.email);
        } else {
          // Normal timer for other users
          hasUnlimitedTime = false;
          startTimer();
        }
      });

      // Hide loading screen
      setTimeout(() => {
        elements.loadingScreen.classList.add("hidden");
      }, 1000);
    } else {
      throw new Error(`Test ${currentTestId} not found in Firestore`);
    }
  } catch (error) {
    console.error("❌ Error loading test:", error);
    console.error("❌ Error details:", error.message);

    // Show error in loading screen
    elements.loadingScreen.innerHTML = `
            <div class="loading-content">
                <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                <h2>Error Loading Test</h2>
                <p>${error.message}</p>
                <p style="margin-top: 20px; font-size: 14px; opacity: 0.8;">Test ID: ${currentTestId}</p>
                <button onclick="location.href='/pages/mock.html'" style="margin-top: 20px; padding: 12px 24px; background: white; color: #054196ff; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    🏠 Back to Tests
                </button>
            </div>
        `;
  }
}

// Load specific task
function loadTask(taskNum) {
    try {
        currentTask = taskNum;
        
        console.log(`🔄 Loading task ${taskNum}`);
        console.log(`📋 Available test data:`, testData);
        
        if (taskNum === 1) {
            // Task 1
            elements.taskBadge.textContent = "Task 1";
            elements.taskTitle.textContent = "Writing Task 1";
            elements.taskInstructions.innerHTML = `
                You should spend about 20 minutes on this task.<br>
                Write at least 150 words.
            `;
            
            // Safely get question
            const task1Question = testData?.task1?.question || "Question not available";
            elements.questionText.textContent = task1Question;
            elements.wordMinimum.textContent = "/ 150 minimum";
            elements.writingLabel.textContent = "Your Answer (Task 1):";
            
            console.log("📝 Task1 question loaded:", task1Question.substring(0, 50));
            
            // Show image if exists
            if (testData?.task1?.imageUrl) {
                console.log("🖼️ Loading image:", testData.task1.imageUrl);
                elements.taskImage.src = testData.task1.imageUrl;
                elements.taskImage.onload = () => console.log("✅ Image loaded successfully");
                elements.taskImage.onerror = () => console.error("❌ Image failed to load");
                elements.questionImage.style.display = "block";
            } else {
                console.log("⚠️ No image URL for Task 1");
                elements.questionImage.style.display = "none";
            }
            
            // Load saved answer
            const savedTask1 = localStorage.getItem('writing_test_task1') || '';
            task1Answer = savedTask1;
            elements.answerText.value = task1Answer;
            updateWordCount();
            
            console.log("📥 Task 1 answer restored:", task1Answer.length, "characters");
            
            // Update navigation - Task 1 keeps "Back to Tests"
            document.getElementById('backBtn').innerHTML = '🏠 Back to Tests';
            document.getElementById('backBtn').onclick = () => location.href = '/pages/mock.html';
            elements.step1.classList.add('active');
            elements.step2.classList.remove('active');
            elements.nextBtn.style.display = 'block';
            elements.finishBtn.style.display = 'none';
            
        } else {
            // Task 2
            elements.taskBadge.textContent = "Task 2";
            elements.taskTitle.textContent = "Writing Task 2";
            elements.taskInstructions.innerHTML = `
                You should spend about 40 minutes on this task.<br>
                Write at least 250 words.<br>
                Give reasons for your answer and include any relevant examples from your own knowledge or experience.
            `;
            
            // Safely get question
            const task2Question = testData?.task2?.question || "Question not available";
            elements.questionText.textContent = task2Question;
            elements.wordMinimum.textContent = "/ 250 minimum";
            elements.writingLabel.textContent = "Your Answer (Task 2):";
            
            console.log("📝 Task2 question loaded:", task2Question.substring(0, 50));
            
            // Hide image
            elements.questionImage.style.display = "none";
            
            // Load saved answer
            const savedTask2 = localStorage.getItem('writing_test_task2') || '';
            task2Answer = savedTask2;
            elements.answerText.value = task2Answer;
            updateWordCount();
            
            console.log("📥 Task 2 answer restored:", task2Answer.length, "characters");
            
            // Update navigation - Task 2 has "Back to Task 1"
            document.getElementById('backBtn').innerHTML = '⬅️ Back to Task 1';
            document.getElementById('backBtn').onclick = () => loadTask(1);
            elements.step1.classList.remove('active');
            elements.step2.classList.add('active');
            elements.nextBtn.style.display = 'none';
            elements.finishBtn.style.display = 'block';
        }
        
        console.log(`✅ Task ${taskNum} loaded successfully`);
        
    } catch (error) {
        console.error(`❌ Error loading task ${taskNum}:`, error);
        console.error("❌ Test data:", testData);
        
        // Show error message
        elements.questionText.textContent = `Error loading task ${taskNum}: ${error.message}`;
    }
}

// Word count function
function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// Update word count display
function updateWordCount() {
    const text = elements.answerText.value;
    const wordCount = countWords(text);
    const minimum = currentTask === 1 ? 150 : 250;
    
    elements.wordCount.textContent = wordCount;
    
    // Update status
    const statusIcon = elements.wordStatus.querySelector('.status-icon');
    const statusText = elements.wordStatus.querySelector('.status-text');
    
    if (wordCount >= minimum) {
        elements.wordStatus.className = 'word-status sufficient';
        statusIcon.textContent = '✅';
        statusText.textContent = 'Word count requirement met';
    } else {
        elements.wordStatus.className = 'word-status insufficient';
        statusIcon.textContent = '⚠️';
        statusText.textContent = `${minimum - wordCount} more words needed`;
    }
    
    // Save current answer
    if (currentTask === 1) {
        task1Answer = text;
        task1WordCount = wordCount;
        localStorage.setItem('writing_test_task1', text);
    } else {
        task2Answer = text;
        task2WordCount = wordCount;
        localStorage.setItem('writing_test_task2', text);
    }
}

// Timer functions with pause support
function startTimer() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (isPaused) return; // Don't update timer if paused
    
    totalTimeLeft--;

    if (totalTimeLeft <= 0) {
      clearInterval(timerInterval);
      alert("Time's up! Your test will be submitted automatically.");
      submitTest();
      return;
    }

    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(totalTimeLeft / 60);
  const seconds = totalTimeLeft % 60;
  elements.timer.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Change color when time is running low
  if (totalTimeLeft <= 300) {
    // 5 minutes
    elements.timer.style.color = "#dc2626";
    elements.timer.style.animation = "pulse 1s infinite";
  } else if (totalTimeLeft <= 600) {
    // 10 minutes
    elements.timer.style.color = "#f59e0b";
  }
}

// Auto-save functionality
function setupAutoSave() {
  setInterval(() => {
    const currentAnswer = elements.answerText.value;

    // Save to localStorage
    if (currentTask === 1) {
      localStorage.setItem("writing_test_task1", currentAnswer);
    } else {
      localStorage.setItem("writing_test_task2", currentAnswer);
    }

    console.log("📝 Auto-saved");
  }, 30000); // Every 30 seconds
}

// Load saved data
function loadSavedData() {
    const savedTask1 = localStorage.getItem('writing_test_task1');
    const savedTask2 = localStorage.getItem('writing_test_task2');
    
    if (savedTask1) {
        task1Answer = savedTask1;
    }
    
    if (savedTask2) {
        task2Answer = savedTask2;
    }
    
    console.log("📥 Loaded saved data:", {
        task1Length: savedTask1?.length || 0,
        task2Length: savedTask2?.length || 0
    });
}

// Clear all data
function clearAllData() {
    // Clear localStorage
    localStorage.removeItem('writing_test_task1');
    localStorage.removeItem('writing_test_task2');
    
    // Clear form fields
    elements.answerText.value = '';
    
    // Clear global variables
    task1Answer = "";
    task2Answer = "";
    task1WordCount = 0;
    task2WordCount = 0;
    
    // Reset word count display
    elements.wordCount.textContent = '0';
    elements.wordStatus.className = 'word-status insufficient';
    elements.wordStatus.querySelector('.status-icon').textContent = '⚠️';
    elements.wordStatus.querySelector('.status-text').textContent = 'Below minimum word count';
    
    console.log("🧹 All data cleared successfully");
}

// Submit test
async function submitTest() {
  try {
    // Get current user FIRST
    const auth = getAuth();
    const user = await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        unsub();
        resolve(u);
      });
    });

    if (!user) {
      alert("You must be logged in to submit.");
      return;
    }

    if (!task1Answer.trim()) {
      alert("Please complete Task 1 before submitting.");
      return;
    }

    if (!task2Answer.trim()) {
      alert("Please complete Task 2 before submitting.");
      return;
    }

    // Show loading
    elements.finishBtn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                Submitting...
            </div>
        `;
    elements.finishBtn.disabled = true;

    // Recalculate word counts from actual answers to ensure accuracy
    const finalTask1WordCount = countWords(task1Answer);
    const finalTask2WordCount = countWords(task2Answer);
    const finalTotalWordCount = finalTask1WordCount + finalTask2WordCount;

    console.log("📊 Final word counts:", {
      task1: finalTask1WordCount,
      task2: finalTask2WordCount,
      total: finalTotalWordCount
    });

    // Save to Firestore
    const resultData = {
      userId: user.uid,
      name: user.email || "Unknown",
      email: user.email || "Unknown",
      testId: currentTestId,
      testTitle: testData?.title || "IELTS Writing Test",

      // Task 1 data
      task1Question: testData?.task1?.question || "Question not available",
      task1ImageUrl: testData?.task1?.imageUrl || null,
      task1Content: task1Answer,
      task1WordCount: finalTask1WordCount,

      // Task 2 data
      task2Question: testData?.task2?.question || "Question not available",
      task2Content: task2Answer,
      task2WordCount: finalTask2WordCount,

      // Metadata
      totalWordCount: finalTotalWordCount,
      submittedAt: serverTimestamp(),
    };

    console.log("💾 Saving to Firestore:", resultData);

    const docRef = await addDoc(collection(db, "resultsWriting"), resultData);
    console.log("✅ Data saved to Firestore successfully, ID:", docRef.id);

    // Send email
    await sendEmailNotification(resultData);

    // Clear all data
    clearAllData();

    // Stop timer
    clearInterval(timerInterval);

    // Show success modal with correct word counts
    showSuccessModal(finalTask1WordCount, finalTask2WordCount, docRef.id);
  } catch (error) {
    console.error("❌ Error submitting test:", error);
    alert("Error submitting test: " + error.message);

    // Reset button
    elements.finishBtn.innerHTML = "📧 Finish & Submit";
    elements.finishBtn.disabled = false;
  }
}

// Send Telegram notification
async function sendEmailNotification(data) {
  try {
    console.log("📱 Sending Telegram notification...");

    const BOT_TOKEN = "8312079942:AAHsxrigaSHGEsdf3EQTB9IVYadU1mVVbwI";
    const CHAT_ID = "53064348";

    const task1Preview = data.task1Content

    const task2Preview = data.task2Content

    const message = `🎓 *IELTS Writing Test Submission*

👤 *Student:* ${data.name}
📧 *Email:* ${data.email}
📝 *Test:* ${data.testTitle}
🆔 *Test ID:* ${data.testId}
⏰ *Submitted:* ${new Date().toLocaleString()}

📋 *TASK 1 (${data.task1WordCount} words)*
❓ *Question:* ${data.task1Question}
${data.task1ImageUrl ? `🖼️ [View Image](${data.task1ImageUrl})` : ""}

📝 *Answer:* ${task1Preview}

📋 *TASK 2 (${data.task2WordCount} words)*  
❓ *Question:* ${data.task2Question}

📝 *Answer:* ${task2Preview}

📊 *Total Words:* ${data.totalWordCount}
🏫 *Platform:* YES English Center`;

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: false,
        }),
      }
    );

    if (response.ok) {
      console.log("✅ Telegram notification sent successfully");
      return true;
    } else {
      const error = await response.json();
      console.error("❌ Telegram API error:", error);

      // Fallback: send without Markdown if parsing error
      if (error.error_code === 400) {
        const plainMessage = message
          .replace(/\*/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
        const fallbackResponse = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: CHAT_ID,
              text: plainMessage,
            }),
          }
        );

        if (fallbackResponse.ok) {
          console.log("✅ Telegram notification sent (plain text)");
          return true;
        }
      }

      return false;
    }
  } catch (error) {
    console.error("❌ Telegram notification error:", error)
      
    return false;
 }
}

// Show success modal
function showSuccessModal(task1Words, task2Words, resultId) {
 elements.successModal.classList.add("show");

 // Update modal content
 const auth = getAuth();
 const user = auth.currentUser;
 document.getElementById("submittedName").textContent = user?.email || "Student";
 document.getElementById("submittedTest").textContent =
   testData?.title || "IELTS Writing Test";
 document.getElementById("submittedTask1Words").textContent = task1Words;
 document.getElementById("submittedTask2Words").textContent = task2Words;

 // Set View Results button to link to the result page
 const viewResultsBtn = document.getElementById("viewResultsBtn");
 if (viewResultsBtn) {
   viewResultsBtn.onclick = () => {
     window.location.href = `/pages/mock/writing/result/?id=${resultId}`;
   };
 }
}

// Event listeners
function setupEventListeners() {
 // Answer textarea
 elements.answerText.addEventListener("input", updateWordCount);

 // Next button
 elements.nextBtn.addEventListener("click", () => {
   loadTask(2);
 });

 // Finish button
 elements.finishBtn.addEventListener("click", submitTest);

 // Keyboard shortcuts
 document.addEventListener("keydown", (e) => {
   // Ctrl+S for save
   if (e.ctrlKey && e.key === "s") {
     e.preventDefault();
     console.log("💾 Manual save triggered");
   }

   // Ctrl+Enter for next/submit
   if (e.ctrlKey && e.key === "Enter") {
     e.preventDefault();
     if (currentTask === 1) {
       elements.nextBtn.click();
     } else {
       elements.finishBtn.click();
     }
   }
 });
}

// Initialize everything
window.addEventListener("load", async () => {
 console.log("🌐 Writing test page loaded");

 // Check authentication
 const auth = getAuth();
 const user = await new Promise((resolve) => {
   const unsub = onAuthStateChanged(auth, (u) => {
     unsub();
     resolve(u);
   });
 });

 if (!user) {
   alert("🔒 Please login first to access the writing test");
   window.location.href = "/";
   return;
 }

 console.log("👤 User authenticated:", user.email);

 // Load saved data
 loadSavedData();

 // Setup event listeners
 setupEventListeners();

 // Setup auto-save
 setupAutoSave();

 // Initialize test
 await initializeTest();
});

// Cleanup on page unload
window.addEventListener("beforeunload", (e) => {
 // Save current state
 const currentAnswer = elements.answerText.value;

 if (currentTask === 1 && currentAnswer) {
   localStorage.setItem("writing_test_task1", currentAnswer);
 } else if (currentTask === 2 && currentAnswer) {
   localStorage.setItem("writing_test_task2", currentAnswer);
 }

 // Show warning if test is not submitted
 if ((task1Answer || task2Answer) && currentAnswer) {
   e.preventDefault();
   e.returnValue = "";
   return "You have unsaved changes. Are you sure you want to leave?";
 }
});

// Add CSS animation for pulse effect
const style = document.createElement("style");
style.textContent = `
@keyframes pulse {
   0%, 100% { opacity: 1; }
   50% { opacity: 0.5; }
}

@keyframes spin {
   0% { transform: rotate(0deg); }
   100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);