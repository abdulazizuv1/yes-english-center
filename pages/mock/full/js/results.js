// Grading and submission: collects answers for all three stages, scores
// listening/reading, saves to resultFullmock and notifies Telegram.
import { state } from "./state.js";
import { auth, db, collection, addDoc, serverTimestamp } from "./firebase.js";

// Finish test
async function handleFinishTest() {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit.");
    return;
  }

  // Collect all answers with correct answers for comparison
  const listeningAnswers = {};
  const listeningCorrectAnswers = {};
  const readingAnswers = {};
  const readingCorrectAnswers = {};
  // Получаем значения напрямую из textarea элементов
  const task1Textarea = document.getElementById("task1Answer");
  const task2Textarea = document.getElementById("task2Answer");

  const writingAnswers = {
    task1: task1Textarea ? task1Textarea.value : "",
    task2: task2Textarea ? task2Textarea.value : "",
  };

  // Process listening answers
  let listeningCorrect = 0;
  let listeningTotal = 0;


  for (const section of state.stageData.listening.sections) {
    if (section.content) {
      section.content.forEach((item) => {
        // ✅ 1. ОБЫЧНЫЕ ВОПРОСЫ
        if (item.type === "question") {
          const qId = item.questionId;
          const userAns = state.answersSoFar[qId];
          const saveKey = qId.replace("q", "");

          listeningAnswers[saveKey] = userAns !== undefined ? userAns : null;
          listeningCorrectAnswers[saveKey] = item.correctAnswer;

          const isCorrect = checkAnswerCorrectness(userAns, [
            item.correctAnswer,
          ]);
          if (isCorrect) listeningCorrect++;
          listeningTotal++;

          // ✅ 2. QUESTION GROUPS (multi-select, matching)
        } else if (item.type === "question-group") {
          // Multi-select группы
          if (item.groupType === "multi-select" && item.questions) {
            item.questions.forEach((q) => {
              const qId = q.questionId;
              const userAns = state.answersSoFar[qId];
              const saveKey = qId.replace("q", "");

              listeningAnswers[saveKey] = userAns || null;
              listeningCorrectAnswers[saveKey] = q.correctAnswer;

              const isCorrect = checkAnswerCorrectness(userAns, [
                q.correctAnswer,
              ]);
              if (isCorrect) listeningCorrect++;
              listeningTotal++;

            });
          }

          // ✅ Matching группы
          if (item.groupType === "matching" && item.questions) {
            item.questions.forEach((q) => {
              const qId = q.questionId;
              const userAns = state.answersSoFar[qId];
              const saveKey = qId.replace("q", "");

              listeningAnswers[saveKey] = userAns || null;
              listeningCorrectAnswers[saveKey] = q.correctAnswer;

              const isCorrect = checkAnswerCorrectness(userAns, [
                q.correctAnswer,
              ]);
              if (isCorrect) listeningCorrect++;
              listeningTotal++;

            });
          }

          // ✅ 3. ИСПРАВЛЕНО: TABLE ВОПРОСЫ - обрабатываем ОБА формата
        } else if (item.type === "table") {

          if (item.answer && typeof item.answer === "object") {
            Object.keys(item.answer).forEach((key) => {
              let qNum;
              let qId;

              // ✅ ИСПРАВЛЕНО: Обрабатываем ОБА формата ключей
              if (key.startsWith("qq")) {
                // Формат: qq37, qq38, qq39, qq40
                qNum = key.replace("qq", ""); // qq37 -> 37
                qId = `q${qNum}`; // -> q37
              } else if (key.startsWith("q")) {
                // Формат: q1, q2, q3, q4, q5, q6, q7, q8, q9, q10
                qNum = key.replace("q", ""); // q1 -> 1
                qId = key; // -> q1 (уже правильный)
              } else {
                // Формат: просто число 1, 2, 3...
                qNum = key; // 1 -> 1
                qId = `q${key}`; // -> q1
              }

              const userAns = state.answersSoFar[qId];
              const expected = item.answer[key];

              listeningAnswers[qNum] = userAns !== undefined ? userAns : null;
              listeningCorrectAnswers[qNum] = expected;

              const isCorrect = checkAnswerCorrectness(userAns, [expected]);
              if (isCorrect) listeningCorrect++;
              listeningTotal++;

            });
          }

          // ✅ Дополнительно: обрабатываем rows если нет answer
          else if (item.rows && Array.isArray(item.rows)) {
            item.rows.forEach((row, rowIndex) => {
              Object.keys(row).forEach((key) => {
                const cellContent = row[key];
                if (
                  typeof cellContent === "string" &&
                  cellContent.includes("___q")
                ) {
                  const matches = cellContent.match(/___q(\d+)___/g);
                  if (matches) {
                    matches.forEach((match) => {
                      const qNum = match.match(/\d+/)[0];
                      const qId = `q${qNum}`;
                      const userAns = state.answersSoFar[qId];

                      // Пытаемся найти правильный ответ в разных форматах
                      const expected =
                        item.answer?.[`qq${qNum}`] || // qq37 формат
                        item.answer?.[`q${qNum}`] || // q37 формат
                        item.answer?.[qNum] || // 37 формат
                        item.correctAnswers?.[qNum] ||
                        item.answers?.[qNum] ||
                        null;

                      listeningAnswers[qNum] =
                        userAns !== undefined ? userAns : null;
                      if (expected) {
                        listeningCorrectAnswers[qNum] = expected;
                      }

                      if (expected) {
                        const isCorrect = checkAnswerCorrectness(userAns, [
                          expected,
                        ]);
                        if (isCorrect) listeningCorrect++;
                        listeningTotal++;

                      } else {
                        listeningTotal++;

                      }
                    });
                  }
                }
              });
            });
          }

          // ✅ 4. MATCHING ВОПРОСЫ (отдельные, не в группах)
        } else if (item.groupType === "matching" && item.questions) {
          item.questions.forEach((q) => {
            const qId = q.questionId;
            const userAns = state.answersSoFar[qId];
            const saveKey = qId.replace("q", "");

            listeningAnswers[saveKey] = userAns || null;
            listeningCorrectAnswers[saveKey] = q.correctAnswer;

            const isCorrect = checkAnswerCorrectness(userAns, [
              q.correctAnswer,
            ]);
            if (isCorrect) listeningCorrect++;
            listeningTotal++;

          });
        }
      });
    }
  }

  // Process reading answers (оставляем как есть)
  let readingCorrect = 0;
  let readingTotal = 0;

  for (const qId of state.orderedQIds) {
    const q = findReadingQuestionByQId(qId);
    let userAns = state.answersSoFar[qId];
    if (Array.isArray(userAns)) {
      userAns = userAns[0] || "";
    }
    userAns = typeof userAns === "string" ? userAns.trim().toLowerCase() : "";

    readingAnswers[qId] = userAns;
    readingTotal++;

    // Get correct answer
    let correctAnsArray = [];
    if (typeof q.answer === "object" && !Array.isArray(q.answer)) {
      const extracted = q.answer[qId];
      correctAnsArray = Array.isArray(extracted) ? extracted : [extracted];
    } else {
      correctAnsArray = Array.isArray(q.answer) ? q.answer : [q.answer];
    }

    // "holiday, holidays" in one key means both variants are accepted
    correctAnsArray = correctAnsArray
      .filter((a) => typeof a === "string")
      .flatMap((a) => splitAnswerVariants(a))
      .map((a) => a.toLowerCase());

    readingCorrectAnswers[qId] = correctAnsArray;

    const isCorrect = correctAnsArray.includes(userAns);
    if (isCorrect) readingCorrect++;
  }


  try {
    const docRef = await addDoc(collection(db, "resultFullmock"), {
      userId: user.uid,
      name: user.email || "unknown",
      email: user.email || "unknown",
      testId: state.currentTestId,
      testTitle: state.testData?.title || "IELTS Full Mock Test",

      // Listening results
      listeningScore: listeningCorrect,
      listeningTotal: listeningTotal,
      listeningAnswers: listeningAnswers,
      listeningCorrectAnswers: listeningCorrectAnswers,

      // Reading results
      readingScore: readingCorrect,
      readingTotal: readingTotal,
      readingAnswers: readingAnswers,
      readingCorrectAnswers: readingCorrectAnswers,

      // Writing answers
      writingAnswers: writingAnswers,
      task1WordCount: countWords(writingAnswers.task1),
      task2WordCount: countWords(writingAnswers.task2),
      totalWritingWords:
        countWords(writingAnswers.task1) + countWords(writingAnswers.task2),

      // Overall
      totalScore: listeningCorrect + readingCorrect,
      totalPossible: listeningTotal + readingTotal,
      overallPercentage: Math.round(
        ((listeningCorrect + readingCorrect) /
          (listeningTotal + readingTotal)) *
          100
      ),

      // Individual percentages
      listeningPercentage: Math.round(
        (listeningCorrect / listeningTotal) * 100
      ),
      readingPercentage: Math.round((readingCorrect / readingTotal) * 100),

      createdAt: serverTimestamp(),
      submittedAt: new Date().toISOString(),
    });

    // Send writing to Telegram
    await sendWritingToTelegram({
      userId: user.uid,
      name: user.email || "unknown",
      email: user.email || "unknown",
      testId: state.currentTestId,
      testTitle: state.testData?.title || "IELTS Full Mock Test",
      task1: writingAnswers.task1,
      task2: writingAnswers.task2,
      task1WordCount: countWords(writingAnswers.task1),
      task2WordCount: countWords(writingAnswers.task2),
      listeningScore: listeningCorrect,
      listeningTotal: listeningTotal,
      readingScore: readingCorrect,
      readingTotal: readingTotal,
      overallScore: listeningCorrect + readingCorrect,
      overallTotal: listeningTotal + readingTotal,
    });

    clearInterval(window.fullMockTimerInterval);
    window.location.href = '/';
  } catch (e) {
    console.error("❌ Error saving result:", e);
    alert("Error submitting your result. Please try again.");
  }
  // Clear saved data
  localStorage.removeItem("fullmock_task1Answer");
  localStorage.removeItem("fullmock_task2Answer");
  localStorage.removeItem(state.testStorageKey);
}

// Helper functions
function findReadingQuestionByQId(qId) {
  for (const p of state.stageData.reading.passages) {
    for (const q of p.questions) {
      if (q.qId === qId) return q;
      if (Array.isArray(q.qIds) && q.qIds.includes(qId)) {
        return { ...q, qId };
      }
      if (q.type === "question-group" && q.questions) {
        const subQ = q.questions.find((sq) => sq.qId === qId);
        if (subQ) return { ...subQ, answer: [subQ.correctAnswer] };
      }
    }
  }
  return { answer: [] };
}

// An answer key may list several accepted variants separated by commas:
// "holiday, holidays" accepts both. A comma directly between digits
// (6,000) is a thousand separator, not a variant break.
function splitAnswerVariants(key) {
  const parts = [];
  for (const seg of String(key).split(",")) {
    const prev = parts[parts.length - 1];
    if (prev !== undefined && /\d$/.test(prev) && /^\d/.test(seg)) {
      parts[parts.length - 1] = `${prev},${seg}`;
    } else {
      parts.push(seg);
    }
  }
  return parts.map((v) => v.trim()).filter(Boolean);
}

function checkAnswerCorrectness(userAns, expected) {
  if (!expected || expected.length === 0) return false;

  if (Array.isArray(userAns) && Array.isArray(expected)) {
    if (userAns.length !== expected.length) return false;
    return (
      expected.every((v) => userAns.includes(v)) &&
      userAns.length === expected.length
    );
  } else {
    const userStr =
      typeof userAns === "string"
        ? userAns.toLowerCase().trim()
        : String(userAns || "")
            .toLowerCase()
            .trim();
    return expected.some((a) =>
      splitAnswerVariants(a).some((v) => v.toLowerCase() === userStr)
    );
  }
}

function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// Send writing to Telegram via Cloud Function (token stays server-side)
async function sendWritingToTelegram(data) {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const idToken = await user.getIdToken();
    const response = await fetch(
      "https://us-central1-yes-english-center.cloudfunctions.net/sendTestNotification",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          type: "fullmock",
          data: {
            testTitle: data.testTitle,
            testId: data.testId,
            task1: data.task1,
            task2: data.task2,
            task1WordCount: data.task1WordCount,
            task2WordCount: data.task2WordCount,
            listeningScore: data.listeningScore,
            listeningTotal: data.listeningTotal,
            readingScore: data.readingScore,
            readingTotal: data.readingTotal,
            overallScore: data.overallScore,
            overallTotal: data.overallTotal,
          },
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Notification error:", error);
    return false;
  }
}
export { handleFinishTest };
