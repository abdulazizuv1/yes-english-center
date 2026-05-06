import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

const params = new URLSearchParams(window.location.search);
const submissionId = params.get("id");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to view feedback.");
    window.location.href = "/login.html";
    return;
  }

  if (!submissionId) {
    showError("No submission ID provided.");
    return;
  }

  showLoading(true);

  try {
    const q = query(
      collection(db, "aiWritingFeedback"),
      where("userId", "==", user.uid),
      where("submissionId", "==", submissionId),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      showError("Feedback not found. It may still be generating — please go back and try again.");
      return;
    }

    renderStructuredFeedback(snapshot.docs[0].data());
  } catch (err) {
    console.error("Error loading feedback:", err);
    showError("Failed to load feedback.");
  } finally {
    showLoading(false);
  }

  document.getElementById("historyBtn").addEventListener("click", () => loadHistory(user.uid));
});

/* ── Utilities ──────────────────────────────────────────────────────── */

function showLoading(visible) {
  document.getElementById("feedbackLoading").style.display = visible ? "block" : "none";
}

function showError(message) {
  const el = document.getElementById("feedbackError");
  el.style.display = "block";
  el.querySelector(".error-state").textContent = message;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

/* ── Marker parser ──────────────────────────────────────────────────── */
// Converts [[ERR:wrong||correct]] and [[CMT:comment]] into styled HTML.
// Plain text segments are HTML-escaped; newlines become <br>.
function parseAnnotatedText(rawText) {
  if (!rawText) return "";

  const markerRegex = /\[\[ERR:((?:[^|]|\|(?!\|))*)\|\|([^\]]*)\]\]|\[\[CMT:([^\]]*)\]\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = markerRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: rawText.slice(lastIndex, match.index) });
    }
    if (match[3] !== undefined) {
      parts.push({ type: "cmt", content: match[3] });
    } else {
      parts.push({ type: "err", wrong: match[1], correct: match[2] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < rawText.length) {
    parts.push({ type: "text", content: rawText.slice(lastIndex) });
  }

  return parts.map((p) => {
    if (p.type === "text") {
      return escapeHtml(p.content).replace(/\n/g, "<br>");
    }
    if (p.type === "cmt") {
      return `<strong class="ann-comment">${escapeHtml(p.content)}</strong>`;
    }
    // ERR
    const wrong = p.wrong.trim();
    const correct = p.correct.trim();
    if (!wrong) {
      return `<span class="ann-insertion">(${escapeHtml(correct)})</span>`;
    }
    return `<span class="ann-error-wrong">${escapeHtml(wrong)}</span><span class="ann-error-correct"> (${escapeHtml(correct)})</span>`;
  }).join("");
}

/* ── Main render ────────────────────────────────────────────────────── */

function renderStructuredFeedback(data) {
  const f = data.feedback;
  if (!f) { showError("Feedback data is missing or corrupted."); return; }

  // Overall band
  document.getElementById("overallBand").textContent = f.overall ?? "—";
  if (data.createdAt) {
    const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    document.getElementById("feedbackDateRow").textContent = date.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }
  document.getElementById("overallSection").style.display = "block";

  if (f.task1) {
    renderTask("task1", f.task1, ["TA", "CC", "LR", "GRA"]);
    document.getElementById("task1Section").style.display = "block";
  }
  if (f.task2) {
    renderTask("task2", f.task2, ["TR", "CC", "LR", "GRA"]);
    document.getElementById("task2Section").style.display = "block";
  }
  if (f.summary) {
    document.getElementById("summaryText").textContent = f.summary;
    document.getElementById("summarySection").style.display = "block";
  }
}

function renderTask(taskId, taskData, criteriaKeys) {
  // Header score
  document.getElementById(`${taskId}Score`).textContent = `Band ${taskData.score ?? "—"}`;

  // Criteria grid
  document.getElementById(`${taskId}Criteria`).innerHTML = criteriaKeys.map((key) => {
    const val = taskData[key] ?? "—";
    const cls = getCriteriaClass(val);
    return `<div class="criteria-item ${cls}">
      <div class="criteria-score">${val}</div>
      <div class="criteria-label">${key}</div>
    </div>`;
  }).join("");

  // Annotated text (parsed HTML)
  document.getElementById(`${taskId}AnnotatedText`).innerHTML =
    parseAnnotatedText(taskData.annotated_text);

  // Good sides
  const goodEl = document.getElementById(`${taskId}GoodSides`);
  if (Array.isArray(taskData.good_sides) && taskData.good_sides.length > 0) {
    goodEl.innerHTML = taskData.good_sides
      .map((s) => `<li class="good-side-item">${escapeHtml(s)}</li>`)
      .join("");
  } else {
    goodEl.innerHTML = `<li class="good-side-item">No specific strengths noted.</li>`;
  }

  // Key issues
  const issuesEl = document.getElementById(`${taskId}KeyIssues`);
  if (Array.isArray(taskData.key_issues) && taskData.key_issues.length > 0) {
    issuesEl.innerHTML = taskData.key_issues
      .map((issue) => `<li class="key-issue-item">${escapeHtml(issue)}</li>`)
      .join("");
  } else {
    issuesEl.innerHTML = `<li class="key-issue-item">No key issues noted.</li>`;
  }

  // Grammar issues table
  const grammarBody = document.getElementById(`${taskId}GrammarBody`);
  const grammarSection = document.getElementById(`${taskId}GrammarSection`);
  if (Array.isArray(taskData.grammar_issues) && taskData.grammar_issues.length > 0) {
    grammarBody.innerHTML = taskData.grammar_issues.map((g, i) => `
      <tr class="${i % 2 === 0 ? "grammar-row-even" : "grammar-row-odd"}">
        <td class="grammar-wrong">${escapeHtml(g.wrong ?? "")}</td>
        <td class="grammar-correct">${escapeHtml(g.correct ?? "")}</td>
        <td class="grammar-rule">${escapeHtml(g.rule ?? "")}</td>
      </tr>`).join("");
    grammarSection.style.display = "";
  } else {
    grammarSection.style.display = "none";
  }

  // Advice
  document.getElementById(`${taskId}Advice`).textContent = taskData.advice || "";
}

function getCriteriaClass(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "";
  if (n >= 8) return "criteria-high";
  if (n >= 6.5) return "criteria-mid";
  return "criteria-low";
}

/* ── History ────────────────────────────────────────────────────────── */

async function loadHistory(uid) {
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");

  historyPanel.style.display = "block";
  historyList.innerHTML = "<p>Loading history...</p>";

  try {
    const q = query(
      collection(db, "aiWritingFeedback"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      historyList.innerHTML = "<p>No feedback history yet.</p>";
      return;
    }

    historyList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let dateStr = "—";
      if (data.createdAt) {
        const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        dateStr = date.toLocaleDateString("en-US", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      }
      const overall = data.feedback?.overall ?? "?";
      const item = document.createElement("div");
      item.className = "history-item" + (data.submissionId === submissionId ? " active" : "");
      item.innerHTML = `
        <div>
          <span class="history-date">${escapeHtml(dateStr)}</span>
          <span class="history-band">Band ${escapeHtml(String(overall))}</span>
        </div>
        <a href="/pages/ai-feedback/?id=${escapeHtml(data.submissionId)}" class="history-link">View →</a>
      `;
      historyList.appendChild(item);
    });
  } catch (err) {
    console.error("Error loading history:", err);
    historyList.innerHTML = "<p>Failed to load history.</p>";
  }
}
