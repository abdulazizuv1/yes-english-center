// Grading and submission: scores listening/reading through the shared
// question engine, saves to resultFullmock and notifies Telegram.
import { state } from "./state.js";
import { auth, db, collection, addDoc, serverTimestamp } from "./firebase.js";
import {
  repairListeningIds,
  normalizeListeningSection,
  normalizeReadingQuestions,
  gradeItems,
} from "../../engine/index.js";

// Finish test
async function handleFinishTest() {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit.");
    return;
  }

  // Получаем значения напрямую из textarea элементов
  const task1Textarea = document.getElementById("task1Answer");
  const task2Textarea = document.getElementById("task2Answer");

  const writingAnswers = {
    task1: task1Textarea ? task1Textarea.value : "",
    task2: task2Textarea ? task2Textarea.value : "",
  };

  // Listening: normalize every section into canonical items and grade
  repairListeningIds(state.stageData.listening.sections);
  const listeningItems = (state.stageData.listening.sections || []).flatMap(
    (s) => normalizeListeningSection(s)
  );
  const listeningResult = gradeItems(listeningItems, state.answersSoFar);

  const listeningAnswers = {};
  const listeningCorrectAnswers = {};
  listeningResult.rows.forEach((r) => {
    listeningAnswers[r.id] = r.user ?? null;
    listeningCorrectAnswers[r.id] = r.expected;
  });

  // Reading: ids were assigned by assignReadingQuestionIds at render time
  const readingItems = (state.stageData.reading.passages || []).flatMap((p) =>
    normalizeReadingQuestions(p.questions)
  );
  const readingResult = gradeItems(readingItems, state.answersSoFar);

  const readingAnswers = {};
  const readingCorrectAnswers = {};
  readingResult.rows.forEach((r) => {
    readingAnswers[r.id] =
      typeof r.user === "string" ? r.user.trim().toLowerCase() : r.user ?? "";
    readingCorrectAnswers[r.id] = r.expected.map((a) => String(a).toLowerCase());
  });

  const listeningCorrect = listeningResult.correct;
  const listeningTotal = listeningResult.total;
  const readingCorrect = readingResult.correct;
  const readingTotal = readingResult.total;

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
