import { listeningState } from "./state.js";

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
  const answers = {};
  const correctAnswers = {};
  let correct = 0;
  let total = 0;

  listeningState.sections.forEach((section) => {
    if (section.content) {
      section.content.forEach((item) => {
        if (item.type === "question") {
          const qId = item.questionId;
          const userAns = listeningState.answersSoFar[qId];
          const expected = [item.correctAnswer];

          answers[qId] = userAns || null;
          correctAnswers[qId] = expected;

          const isCorrect = checkAnswerCorrectness(userAns, expected);
          if (isCorrect) correct++;
          total++;
        } else if (item.type === "question-group") {
          if (
            item.groupType === "multi-select" &&
            item.questions &&
            Array.isArray(item.questions)
          ) {
            item.questions.forEach((question) => {
              const qId = question.questionId;
              const userAns = listeningState.answersSoFar[qId];
              const expectedAnswer = question.correctAnswer;

              answers[qId] = userAns || null;
              correctAnswers[qId] = [expectedAnswer];

              const isCorrect = checkAnswerCorrectness(userAns, [expectedAnswer]);
              if (isCorrect) correct++;
              total++;
            });
          } else if (item.questions) {
            item.questions.forEach((q) => {
              const qId = q.questionId;
              const userAns = listeningState.answersSoFar[qId];
              const expected = [q.correctAnswer];

              answers[qId] = userAns || null;
              correctAnswers[qId] = expected;

              const isCorrect = checkAnswerCorrectness(userAns, expected);
              if (isCorrect) correct++;
              total++;
            });
          }
        } else if (item.type === "matching" && item.questions) {
          item.questions.forEach((q) => {
            const qId = q.questionId;
            const userAns = listeningState.answersSoFar[qId];
            const expected = [q.correctAnswer];

            answers[qId] = userAns || null;
            correctAnswers[qId] = expected;

            const isCorrect = checkAnswerCorrectness(userAns, expected);
            if (isCorrect) correct++;
            total++;
          });
        } else if (item.type === "table" && item.answer) {
          Object.keys(item.answer).forEach((qId) => {
            const userAns = listeningState.answersSoFar[qId];
            const expected = [item.answer[qId]];

            answers[qId] = userAns || null;
            correctAnswers[qId] = expected;

            const isCorrect = checkAnswerCorrectness(userAns, expected);
            if (isCorrect) correct++;
            total++;
          });
        }
      });
    }

    ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach((key) => {
      if (section[key] && section[key].matchingQuestions) {
        section[key].matchingQuestions.forEach((q) => {
          const qId = q.qId;
          const userAns = listeningState.answersSoFar[qId];
          const expected = [q.correctAnswer];

          answers[qId] = userAns || null;
          correctAnswers[qId] = expected;

          const isCorrect = checkAnswerCorrectness(userAns, expected);
          if (isCorrect) correct++;
          total++;
        });
      }
    });
  });

  return { answers, correctAnswers, correct, total };
}

export function checkAnswerCorrectness(userAns, expected) {
  if (
    !expected ||
    expected.length === 0 ||
    userAns === null ||
    userAns === undefined
  ) {
    return false;
  }

  if (Array.isArray(userAns)) {
    if (!Array.isArray(expected[0])) return false;
    const userSet = new Set(userAns.map((a) => String(a).toLowerCase().trim()));
    const expectedSet = new Set(
      expected[0].map((a) => String(a).toLowerCase().trim())
    );
    return (
      userSet.size === expectedSet.size &&
      [...userSet].every((x) => expectedSet.has(x))
    );
  }

  const userAnswer = String(userAns).toLowerCase().trim();
  const expectedAnswers = expected.map((a) => String(a).toLowerCase().trim());

  return expectedAnswers.some((exp) => {
    if (exp.includes("/")) {
      const alternatives = exp
        .split("/")
        .map((alt) => alt.trim().toLowerCase());
      return alternatives.some((alt) => {
        const cleanAlt = alt.replace(/[()]/g, "").trim();
        const cleanUser = userAnswer.replace(/[()]/g, "").trim();
        return cleanUser === cleanAlt;
      });
    }
    return userAnswer === exp;
  });
}


