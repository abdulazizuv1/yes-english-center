import { listeningState } from "./state.js";
import { saveCurrentHighlights, loadSavedHighlights } from "./highlights.js";
import { loadSavedAnswers, setupAnswerPersistence } from "./storage.js";
import {
  generateQuestionNav,
  updateQuestionNav,
  attachNavButtons,
  setupOpenReview,
} from "./navigation.js";
import { renderSection } from "./render.js";
import { createHandleFinish } from "./results.js";
import { setupTogglePause, startTimer } from "./pause.js";

export function initListeningTest(deps) {
  const {
    app,
    db,
    auth,
    doc,
    getDoc,
    collection,
    addDoc,
    serverTimestamp,
    onAuthStateChanged,
  } = deps;

  listeningState.app = app;
  listeningState.db = db;
  listeningState.auth = auth;

  const handleFinish = createHandleFinish({
    db,
    auth,
    collection,
    addDoc,
    serverTimestamp,
  });

  function loadTest() {
    return (async () => {
      try {
        const testId =
          new URLSearchParams(window.location.search).get("testId") || "test-1";
        const docSnap = await getDoc(doc(db, "listeningTests", testId));

        if (!docSnap.exists()) throw new Error(`Test ${testId} not found`);

        const data = docSnap.data();
        listeningState.sections =
          data.sections || data.parts?.sections || data.parts || [];

        if (listeningState.sections.length === 0) {
          throw new Error("No sections found");
        }

        document.title = data.title || "Listening Test";

        generateQuestionNav();
        listeningState.currentQuestionNumber = 1;
        listeningState.audioInitialized = false;
        listeningState.currentAudioSection = 0;

        loadSavedHighlights();
        loadSavedAnswers();

        renderSection(0);
        updateQuestionNav();

        const display = document.getElementById("time");
        onAuthStateChanged(auth, (user) => {
          if (user && user.email === "alisher@yescenter.uz") {
            listeningState.hasUnlimitedTime = true;
            if (display) {
              display.textContent = "∞";
              display.style.fontSize = "24px";
            }
            console.log("✨ Unlimited time mode activated for", user.email);
          } else {
            listeningState.hasUnlimitedTime = false;
            startTimer(40 * 60, display, handleFinish);
          }
        });
      } catch (error) {
        console.error("Error loading test:", error);
        const questionList = document.getElementById("question-list");
        if (questionList) {
          questionList.innerHTML = `<p class='error'>${error.message}</p>`;
        }
      }
    })();
  }

  window.addEventListener("DOMContentLoaded", () => {
    attachNavButtons(handleFinish);
    setupAnswerPersistence();
    setupOpenReview();
    setupTogglePause(handleFinish);

    onAuthStateChanged(auth, (user) => {
      if (!user) {
        alert("Please log in to take the test.");
        window.location.href = "/";
      } else {
        loadTest();
      }
    });
  });
}


