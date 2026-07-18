// Grading and submission for the listening test — scoring goes through
// the shared question engine (pages/mock/engine/).
import { listeningState } from "./state.js";
import {
  repairListeningIds,
  normalizeListeningSection,
  gradeItems,
  splitAnswerVariants as engineSplit,
  textAnswerCorrect,
} from "../../engine/index.js";

export function createHandleFinish(deps) {
  const { db, auth, collection, addDoc, serverTimestamp } = deps;

  async function handleFinishTest() {
    const user = auth.currentUser;
    if (!user) {
      alert("Please login first");
      return;
    }

    if (!confirm("Submit test? You cannot change answers after submission.")) {
      return;
    }

    const loadingModal = document.getElementById("loadingModal");
    if (loadingModal) {
      loadingModal.style.display = "flex";
    }

    try {
      const results = calculateResults();
      const testId =
        new URLSearchParams(window.location.search).get("testId") || "test-1";

      const docRef = await addDoc(collection(db, "resultsListening"), {
        userId: user.uid,
        name: user.email || "unknown",
        testId,
        score: results.correct,
        total: results.total,
        percentage: Math.round((results.correct / results.total) * 100),
        answers: results.answers,
        correctAnswers: results.correctAnswers,
        createdAt: serverTimestamp(),
        completedAt: new Date().toISOString(),
      });

      localStorage.removeItem("listeningTestAnswers");
      localStorage.removeItem("testHighlights");
      clearInterval(window[listeningState.timerIntervalKey]);

      if (loadingModal) {
        loadingModal.style.display = "none";
      }

      window.location.href = `/pages/mock/listening/result/?id=${docRef.id}`;
    } catch (error) {
      console.error("Error saving result:", error);

      if (loadingModal) {
        loadingModal.style.display = "none";
      }

      alert("Error submitting test. Please try again.");
    }
  }

  window.handleFinishTest = handleFinishTest;

  return handleFinishTest;
}

export function calculateResults() {
  repairListeningIds(listeningState.sections);
  const items = (listeningState.sections || []).flatMap((s) =>
    normalizeListeningSection(s)
  );
  const graded = gradeItems(items, listeningState.answersSoFar);

  const answers = {};
  const correctAnswers = {};
  graded.rows.forEach((r) => {
    answers[r.id] = r.user ?? null;
    correctAnswers[r.id] = r.expected;
  });

  return { answers, correctAnswers, correct: graded.correct, total: graded.total };
}

// Kept for compatibility (result viewer smoke tests import these):
export function splitAnswerVariants(key) {
  return engineSplit(key);
}

export function checkAnswerCorrectness(userAns, expected) {
  if (!expected || expected.length === 0 || userAns === null || userAns === undefined) {
    return false;
  }
  if (Array.isArray(userAns)) {
    if (!Array.isArray(expected[0])) return false;
    const userSet = new Set(userAns.map((a) => String(a).toLowerCase().trim()));
    const expectedSet = new Set(expected[0].map((a) => String(a).toLowerCase().trim()));
    return userSet.size === expectedSet.size && [...userSet].every((x) => expectedSet.has(x));
  }
  return textAnswerCorrect(userAns, expected);
}
