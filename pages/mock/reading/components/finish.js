// Grading and submission for the reading test — scoring goes through the
// shared question engine (pages/mock/engine/).
import { readingState } from "./state.js";
import { normalizeReadingQuestions, gradeItems } from "../../engine/index.js";

export function createHandleFinish(deps) {
  const { db, auth, collection, addDoc, serverTimestamp } = deps;

  return async function handleFinish() {
    const finishBtn = document.getElementById("finishBtn");
    finishBtn.disabled = true;
    finishBtn.textContent = "Submitting...";

    const loadingModal = document.getElementById("loadingModal");
    loadingModal.style.display = "flex";

    const items = (readingState.passages || []).flatMap((p) =>
      normalizeReadingQuestions(p.questions)
    );
    const graded = gradeItems(items, readingState.answersSoFar);

    const answers = {};
    const correctAnswers = {};
    graded.rows.forEach((r) => {
      answers[r.id] =
        typeof r.user === "string" ? r.user.trim().toLowerCase() : r.user ?? "";
      correctAnswers[r.id] = r.expected.map((a) => String(a).toLowerCase());
    });

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not authenticated");
      }
      const docRef = await addDoc(collection(db, "resultsReading"), {
        userId: user.uid,
        name: user.email || "unknown",
        testId: readingState.currentTestId,
        score: graded.correct,
        total: graded.total,
        answers,
        correctAnswers,
        createdAt: serverTimestamp(),
      });

      window.location.href = `/pages/mock/reading/result/?id=${docRef.id}`;
      localStorage.removeItem(readingState.testStorageKey);
      clearInterval(window.readingTimerInterval);
      window.finished = true;
    } catch (e) {
      console.error("❌ Error saving result:", e);

      loadingModal.style.display = "none";
      finishBtn.disabled = false;
      finishBtn.textContent = "Finish Test";

      alert("Error submitting your result. Please try again.");
    }
  };
}
