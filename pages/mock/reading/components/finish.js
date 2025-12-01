import { readingState } from "./state.js";

function findQuestionByQId(qId) {
  for (const p of readingState.passages) {
    for (const q of p.questions) {
      if (q.qId === qId) return q;

      if (q.type === "question-group" && q.questions) {
        const subQuestion = q.questions.find((subQ) => subQ.qId === qId);
        if (subQuestion) {
          return {
            ...subQuestion,
            answer: subQuestion.answer,
            parentGroup: q,
          };
        }
      }

      if (Array.isArray(q.qIds) && q.qIds.includes(qId)) {
        return { ...q, qId };
      }
    }
  }
  return { answer: null };
}

export function createHandleFinish(deps) {
  const { db, auth, collection, addDoc, serverTimestamp } = deps;

  return async function handleFinish() {
    const finishBtn = document.getElementById("finishBtn");
    finishBtn.disabled = true;
    finishBtn.textContent = "Submitting...";

    const loadingModal = document.getElementById("loadingModal");
    loadingModal.style.display = "flex";

    const answers = {};
    const correctAnswers = {};
    let correct = 0;
    let total = 0;

    for (const qId of readingState.orderedQIds) {
      const q = findQuestionByQId(qId);

      let userAns = readingState.answersSoFar[qId];
      if (Array.isArray(userAns)) {
        userAns = userAns[0] || "";
      }
      userAns = typeof userAns === "string" ? userAns.trim().toLowerCase() : "";

      answers[qId] = userAns;
      total++;

      let correctAnsArray = [];

      if (q.correctAnswer) {
        correctAnsArray = [q.correctAnswer];
      } else if (typeof q.answer === "object" && !Array.isArray(q.answer)) {
        const extracted = q.answer[qId];
        correctAnsArray = Array.isArray(extracted) ? extracted : [extracted];
      } else {
        correctAnsArray = Array.isArray(q.answer) ? q.answer : [q.answer];
      }

      correctAnsArray = correctAnsArray
        .filter((a) => typeof a === "string")
        .map((a) => a.trim().toLowerCase());

      correctAnswers[qId] = correctAnsArray;

      const isCorrect = correctAnsArray.includes(userAns);
      if (isCorrect) correct++;
    }

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not authenticated");
      }
      const docRef = await addDoc(collection(db, "resultsReading"), {
        userId: user.uid,
        name: user.email || "unknown",
        testId: readingState.currentTestId,
        score: correct,
        total: total,
        answers,
        correctAnswers,
        createdAt: serverTimestamp(),
      });

      window.location.href = `/pages/mock/result.html?id=${docRef.id}`;
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


