import { readingState } from "./state.js";
import { initializeHighlightSystem, setupWindowHighlightActions, saveCurrentHighlights } from "./highlights.js";
import { loadSavedState, assignQuestionIds, saveState } from "./storage.js";
import { generateQuestionNav, updateQuestionNav, startTimer, setRenderPassageFn } from "./navigation.js";
import { renderPassage } from "./render.js";
import { createHandleFinish } from "./finish.js";
import { createPauseModal, setupTogglePause } from "./pause.js";

export function initReadingTest(deps) {
  const { db, auth, doc, getDoc, collection, addDoc, serverTimestamp, onAuthStateChanged } = deps;

  const handleFinish = createHandleFinish({ db, auth, collection, addDoc, serverTimestamp });

  function setupNavButtons() {
    const backBtn = document.getElementById("backBtn");
    const nextBtn = document.getElementById("nextBtn");
    const finishBtn = document.getElementById("finishBtn");

    backBtn.addEventListener("click", () => {
      if (readingState.currentPassageIndex > 0) {
        saveCurrentHighlights(saveState);
        readingState.currentPassageIndex--;
        renderPassage(readingState.currentPassageIndex);
        updateQuestionNav();
      }
    });

    nextBtn.addEventListener("click", () => {
      if (readingState.currentPassageIndex < readingState.passages.length - 1) {
        saveCurrentHighlights(saveState);
        readingState.currentPassageIndex++;
        renderPassage(readingState.currentPassageIndex);
        updateQuestionNav();
      }
    });

    finishBtn.addEventListener("click", handleFinish);
  }

  async function loadTest() {
    const user = await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        unsub();
        resolve(u);
      });
    });

    if (!user) {
      alert("You must be logged in to access the reading test.");
      window.location.href = "/";
      return;
    }

    try {
      const cssLink = document.querySelector('link[href*="test.css"]');
      if (cssLink) {
        const timestamp = new Date().getTime();
        cssLink.href = `./test.css?v=${timestamp}`;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const testId = urlParams.get("testId") || "test-1";
      readingState.currentTestId = testId;
      readingState.testStorageKey = `readingTest_${readingState.currentTestId}`;
      loadSavedState();

      console.log("🎯 Loading reading test with ID:", testId);

      const docRef = doc(db, "readingTests", testId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        readingState.passages = data.passages;
        // Соединяем навигацию с функцией рендера
        setRenderPassageFn(renderPassage);
        assignQuestionIds();
        generateQuestionNav();
        renderPassage(readingState.currentPassageIndex);
        updateQuestionNav();
        console.log("✅ Reading test loaded successfully");
      } else {
        document.getElementById("passageText").innerHTML = "Test not found.";
        console.error("❌ Reading test not found:", testId);
      }
    } catch (error) {
      console.error("❌ Error loading reading test:", error);
      document.getElementById("passageText").innerHTML =
        "Error loading test: " + error.message;
    }
  }

  window.openReview = function () {
    alert("Review functionality - showing all answers and flagged questions");
  };

  function setupTimerAfterLoad() {
    const display = document.getElementById("time");

    onAuthStateChanged(auth, (user) => {
      if (user && user.email === "alisher@yescenter.uz") {
        readingState.hasUnlimitedTime = true;
        display.textContent = "∞";
        display.style.fontSize = "24px";
        console.log("✨ Unlimited time mode activated for", user.email);
      } else {
        readingState.hasUnlimitedTime = false;
        startTimer(60 * 60, display, handleFinish);
      }
    });
  }

  window.onload = () => {
    createPauseModal();
    const startTimerWithFinish = (duration, display) =>
      startTimer(duration, display, handleFinish);
    setupTogglePause(startTimerWithFinish);
    initializeHighlightSystem();
    setupWindowHighlightActions(saveState);
    setupNavButtons();

    loadTest().then(() => {
      setupTimerAfterLoad();
    });
  };
}


