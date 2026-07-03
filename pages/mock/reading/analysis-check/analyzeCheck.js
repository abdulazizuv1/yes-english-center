import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, getDocs, collection
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, getIdToken
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const CF_URL = "https://us-central1-yes-english-center.cloudfunctions.net/analyzeReadingAnalysis";

let currentUser = null;
let currentUserRole = null;
let selectedTestId = null;
let selectedTestTitle = null;
let parsedData = null;
let selectedFile = null;
let testsLoaded = false;

// Show spinner until auth resolves — prevents flash/kick-out
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }
  currentUser = user;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) currentUserRole = snap.data().role || "student";
  } catch { currentUserRole = "student"; }
  await init();
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  const testIdParam = params.get("testId");
  const modeParam = params.get("mode");
  const viewParam = params.get("view");

  if (viewParam) {
    await loadAndShowSubmission(viewParam);
    return;
  }

  if (testIdParam || modeParam === "with_passage") {
    document.querySelector('input[name="mode"][value="with_passage"]').checked = true;
    await showTestGroup();
    if (testIdParam) await preselectTest(testIdParam);
  }

  showSection("section-form");
}

// ── Mode & Test ─────────────────────────────────────────────
async function showTestGroup() {
  document.getElementById("testGroup").style.display = "";
  if (!testsLoaded) {
    await loadTests();
    testsLoaded = true;
  }
}

function hideTestGroup() {
  document.getElementById("testGroup").style.display = "none";
  selectedTestId = null;
  selectedTestTitle = null;
}

window.onModeChange = async function() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value;
  if (mode === "with_passage") {
    await showTestGroup();
  } else {
    hideTestGroup();
  }
  updateSubmitState();
};

async function loadTests() {
  const dropdown = document.getElementById("testDropdown");
  dropdown.innerHTML = '<option value="">Loading...</option>';
  try {
    const snap = await getDocs(collection(db, "readingTests"));
    const tests = [];
    snap.forEach(d => tests.push({ id: d.id, ...d.data() }));
    tests.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""));
    dropdown.innerHTML = '<option value="">-- Select a test --</option>';
    tests.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.title || t.name || t.id;
      dropdown.appendChild(opt);
    });
  } catch {
    dropdown.innerHTML = '<option value="">Failed to load tests</option>';
  }
}

async function preselectTest(testId) {
  const dropdown = document.getElementById("testDropdown");
  dropdown.value = testId;
  if (dropdown.value === testId) {
    selectedTestId = testId;
    selectedTestTitle = dropdown.options[dropdown.selectedIndex]?.text || testId;
  } else {
    try {
      const snap = await getDoc(doc(db, "readingTests", testId));
      const data = snap.exists() ? snap.data() : {};
      const opt = document.createElement("option");
      opt.value = testId;
      opt.textContent = data.title || data.name || testId;
      opt.selected = true;
      dropdown.appendChild(opt);
      selectedTestId = testId;
      selectedTestTitle = opt.textContent;
    } catch {
      selectedTestId = testId;
      selectedTestTitle = testId;
    }
  }
  updateSubmitState();
}

window.onTestChange = function() {
  const dropdown = document.getElementById("testDropdown");
  selectedTestId = dropdown.value || null;
  selectedTestTitle = dropdown.value ? dropdown.options[dropdown.selectedIndex]?.text : null;
  updateSubmitState();
};

function getMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || "without_passage";
}

function updateSubmitState() {
  const mode = getMode();
  const fileReady = !!parsedData;
  const testReady = mode === "without_passage" || !!selectedTestId;
  document.getElementById("btnSubmit").disabled = !(fileReady && testReady);
}

// ── Drag & Drop ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const zone = document.getElementById("uploadZone");
  if (!zone) return;
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  });
});

window.handleFileSelect = function(input) {
  if (input.files[0]) processFile(input.files[0]);
};

function processFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["xlsx", "xls"].includes(ext)) {
    showParseError("Please upload an Excel file (.xlsx or .xls)");
    return;
  }
  selectedFile = file;
  showFileInfo(file.name, "Parsing...");
  hideParseError();

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      parsedData = parseExcelFile(e.target.result);
      const rowCount = parsedData?.rows?.length || 0;
      if (rowCount === 0) {
        showParseError("File is empty. Please upload a file with data rows.");
        showFileInfo(file.name, "Error");
        parsedData = null;
      } else {
        showFileInfo(file.name, `${rowCount} rows found`);
        hideParseError();
      }
    } catch (err) {
      showParseError(err.message || "Could not read the file. Please upload a valid Excel file.");
      showFileInfo(file.name, "Error");
      parsedData = null;
    }
    updateSubmitState();
  };
  reader.readAsArrayBuffer(file);
}

// ── Excel Parsing — accepts any format ─────────────────────
function parseExcelFile(buffer) {
  if (typeof XLSX === "undefined") {
    throw new Error("Excel parser not ready. Please wait a moment and try again.");
  }

  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Find first non-empty row (treated as header)
  let headerIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i].some(cell => String(cell).trim())) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error("File is empty.");

  // Collect non-empty data rows after header
  const dataRows = [];
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    if (allRows[i].some(cell => String(cell).trim())) dataRows.push(allRows[i]);
  }
  if (dataRows.length === 0) throw new Error("File is empty.");

  // Build header keys (pad if data has more cols than header)
  const rawHeaders = allRows[headerIdx].map(h => String(h || "").trim());
  const maxCols = Math.max(rawHeaders.length, ...dataRows.map(r => r.length));
  while (rawHeaders.length < maxCols) rawHeaders.push(`Col${rawHeaders.length + 1}`);

  // Deduplicate keys
  const headers = rawHeaders.map((h, i) => {
    const key = h || `Col${i + 1}`;
    const prior = rawHeaders.slice(0, i).filter(p => (p || `Col${i}`) === key).length;
    return prior > 0 ? `${key}_${prior + 1}` : key;
  });

  // Rows as objects — Firestore doesn't allow nested arrays
  const rows = dataRows.map(row => {
    const obj = {};
    for (let i = 0; i < maxCols; i++) obj[headers[i]] = String(row[i] || "").trim();
    return obj;
  });

  return { headers, rows };
}

window.removeFile = function() {
  selectedFile = null;
  parsedData = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("fileInfo").classList.add("hidden");
  hideParseError();
  updateSubmitState();
};

function showFileInfo(name, status) {
  document.getElementById("fileName").textContent = name;
  document.getElementById("fileStatus").textContent = status;
  document.getElementById("fileInfo").classList.remove("hidden");
}

function showParseError(msg) {
  const el = document.getElementById("parseError");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideParseError() {
  document.getElementById("parseError")?.classList.add("hidden");
}

// ── Submit ──────────────────────────────────────────────────
window.submitAnalysis = async function() {
  if (!parsedData || !currentUser) return;
  const mode = getMode();
  if (mode === "with_passage" && !selectedTestId) return;

  const btn = document.getElementById("btnSubmit");
  btn.disabled = true;
  btn.textContent = "Analyzing...";
  showSection("section-loading");

  try {
    const idToken = await getIdToken(currentUser);

    // Send data directly to CF — no Firestore write before Claude responds
    const response = await fetch(CF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        mode,
        testId: selectedTestId || null,
        testTitle: selectedTestTitle || null,
        fileName: selectedFile?.name || "unknown.xlsx",
        questionsData: parsedData,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        showError("Weekly Limit Reached", "You've reached your weekly limit (5 analyses). Your limit resets on Monday.");
      } else {
        showError("Analysis Failed", result.error || "An unexpected error occurred. Please try again.");
      }
      return;
    }

    if (result.aiResult) {
      renderResults(result.aiResult, { testTitle: selectedTestTitle, mode, submittedAt: new Date() });
    } else {
      showError("No Results", "The analysis completed but returned no results. Please try again.");
    }
  } catch (err) {
    console.error("Submit error:", err);
    showError("Connection Error", "Could not connect. Please check your internet and try again.");
  } finally {
    btn.textContent = "Submit for AI Check";
  }
};

// ── Results Rendering ───────────────────────────────────────
function renderResults(aiResult, meta) {
  const { overallScore, totalQuestions, percentage, estimatedBand, summary, questions } = aiResult;
  const testLabel = meta?.testTitle || "No Test Selected";
  const modeLabel = meta?.mode === "with_passage" ? "With Passage" : "Without Passage";
  const dateLabel = meta?.submittedAt
    ? new Date(meta.submittedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  let html = `
    <div class="results-header-card">
      <h2>AI Reading Analysis Results</h2>
      <div class="results-meta">
        <span>📖 ${escapeHtml(testLabel)}</span>
        <span>Mode: ${modeLabel}</span>
        <span>📅 ${dateLabel}</span>
      </div>
      <div class="results-score-row">
        <div class="results-score-box">
          <div class="results-score-num">${overallScore}/${totalQuestions}</div>
          <div class="results-score-label">Overall Score</div>
        </div>
        <div class="results-score-box">
          <div class="results-score-num">${percentage}%</div>
          <div class="results-score-label">Percentage</div>
        </div>
        <div class="results-score-box band-highlight">
          <div class="results-score-num">${escapeHtml(String(estimatedBand ?? "—"))}</div>
          <div class="results-score-label">Estimated Band</div>
        </div>
      </div>
      <div class="results-summary">${escapeHtml(summary)}</div>
    </div>
    <div class="questions-breakdown-title">Question-by-Question Breakdown</div>
  `;

  (questions || []).forEach(q => {
    const score = q.overallQuestionScore ?? "—";
    const scoreClass = score >= 3 ? "score-full" : score >= 2 ? "score-good" : score >= 1 ? "score-partial" : "score-zero";
    const kqQuality = q.keywordsFromQuestion?.quality || "weak";
    const ktQuality = q.keywordsFromText?.quality || "weak";
    const isCorrect = q.answer?.isCorrect;

    html += `
      <div class="question-result-card">
        <div class="qrc-header">
          <span class="qrc-number">Q${q.questionNumber}</span>
          <span class="qrc-score ${scoreClass}">${score}/3</span>
        </div>

        <div class="qrc-section">
          <div class="qrc-section-title">Keywords from Question</div>
          ${q.keywordsFromQuestion?.studentInput ? `<div class="qrc-student-text">"${escapeHtml(q.keywordsFromQuestion.studentInput)}"</div>` : ""}
          <div class="qrc-row">
            <span class="quality-badge quality-${kqQuality}">${capitalize(kqQuality)}</span>
            <span class="qrc-feedback">${escapeHtml(q.keywordsFromQuestion?.feedback || "")}</span>
          </div>
          ${q.keywordsFromQuestion?.suggestions?.length ? `<div class="qrc-suggestions">💡 Try: ${q.keywordsFromQuestion.suggestions.map(s => `<em>${escapeHtml(s)}</em>`).join(", ")}</div>` : ""}
        </div>

        <div class="qrc-section">
          <div class="qrc-section-title">Keywords from Text</div>
          ${q.keywordsFromText?.studentInput ? `<div class="qrc-student-text">"${escapeHtml(q.keywordsFromText.studentInput)}"</div>` : ""}
          <div class="qrc-row">
            <span class="quality-badge quality-${ktQuality}">${capitalize(ktQuality)}</span>
            <span class="qrc-feedback">${escapeHtml(q.keywordsFromText?.feedback || "")}</span>
          </div>
          ${q.keywordsFromText?.suggestions?.length ? `<div class="qrc-suggestions">💡 Try: ${q.keywordsFromText.suggestions.map(s => `<em>${escapeHtml(s)}</em>`).join(", ")}</div>` : ""}
        </div>

        <div class="qrc-section">
          <div class="qrc-section-title">Answer</div>
          ${q.answer?.studentInput ? `<div class="qrc-student-text">"${escapeHtml(q.answer.studentInput)}"</div>` : ""}
          <div class="qrc-row">
            ${isCorrect === true
              ? `<span class="answer-badge answer-correct">✅ Correct</span>`
              : isCorrect === false
                ? `<span class="answer-badge answer-incorrect">❌ Incorrect</span>`
                : `<span class="answer-badge answer-unknown">⚪ Not Verified</span>`}
            ${q.answer?.correctAnswer ? `<span class="qrc-correct-ans">Correct: <strong>${escapeHtml(q.answer.correctAnswer)}</strong></span>` : ""}
          </div>
          <div class="qrc-feedback-text">${escapeHtml(q.answer?.feedback || "")}</div>
        </div>

        ${q.questionFeedback ? `<div class="qrc-overall-feedback">${escapeHtml(q.questionFeedback)}</div>` : ""}
      </div>
    `;
  });

  document.getElementById("resultsContent").innerHTML = html;
  showSection("section-results");
}

// ── View Past Submission ────────────────────────────────────
async function loadAndShowSubmission(submissionId) {
  showSection("section-loading");
  try {
    const docSnap = await getDoc(doc(db, "aiReadingAnalysis", submissionId));
    if (!docSnap.exists()) { showError("Not Found", "This submission could not be found."); return; }
    const data = docSnap.data();
    if (data.userId !== currentUser.uid && currentUserRole !== "admin") {
      showError("Access Denied", "You do not have permission to view this submission.");
      return;
    }
    if (data.status === "completed" && data.aiResult) {
      renderResults(data.aiResult, {
        testTitle: data.testTitle,
        mode: data.mode,
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(),
      });
    } else if (data.status === "error") {
      showError("Analysis Error", data.error || "This analysis encountered an error.");
    } else {
      showError("Not Ready", "This analysis is still pending.");
    }
  } catch {
    showError("Load Error", "Could not load this submission.");
  }
}

// ── Misc ────────────────────────────────────────────────────
window.retrySubmit = function() {
  document.getElementById("btnSubmit").disabled = false;
  showSection("section-form");
};

window.startNewAnalysis = function() {
  parsedData = null;
  selectedFile = null;
  selectedTestId = null;
  selectedTestTitle = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("fileInfo").classList.add("hidden");
  document.getElementById("btnSubmit").disabled = true;
  document.getElementById("btnSubmit").textContent = "Submit for AI Check";
  hideParseError();
  document.querySelector('input[name="mode"][value="without_passage"]').checked = true;
  document.getElementById("testGroup").style.display = "none";
  const params = new URLSearchParams(window.location.search);
  if (params.get("testId")) {
    window.location.href = "/pages/mock/reading/analysis-check/";
  } else {
    showSection("section-form");
  }
};

function showSection(id) {
  document.querySelectorAll(".section-block").forEach(s => s.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");
}

function showError(title, message) {
  document.getElementById("errorTitle").textContent = title;
  document.getElementById("errorMessage").textContent = message;
  showSection("section-error");
}

function escapeHtml(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}
