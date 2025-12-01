import { listeningState } from "./state.js";

export function isAnswerValid(answer) {
  return (
    answer !== undefined &&
    answer !== null &&
    answer !== "" &&
    (!Array.isArray(answer) || answer.length > 0)
  );
}

export function analyzeTestProgress() {
  let total = 0;
  let answered = 0;

  listeningState.sections.forEach((section) => {
    if (section.content) {
      section.content.forEach((item) => {
        if (item.type === "question") {
          total++;
          if (isAnswerValid(listeningState.answersSoFar[item.questionId])) answered++;
        } else if (item.type === "question-group" && item.questions) {
          item.questions.forEach((q) => {
            total++;
            if (isAnswerValid(listeningState.answersSoFar[q.questionId])) answered++;
          });
        } else if (item.type === "matching" && item.questions) {
          item.questions.forEach((q) => {
            total++;
            if (isAnswerValid(listeningState.answersSoFar[q.questionId])) answered++;
          });
        } else if (item.type === "table" && item.answer) {
          Object.keys(item.answer).forEach((qId) => {
            total++;
            if (isAnswerValid(listeningState.answersSoFar[qId])) answered++;
          });
        }
      });
    }

    ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach((key) => {
      if (section[key] && section[key].matchingQuestions) {
        section[key].matchingQuestions.forEach((q) => {
          total++;
          if (isAnswerValid(listeningState.answersSoFar[q.qId])) answered++;
        });
      }
    });
  });

  return { total, answered };
}


