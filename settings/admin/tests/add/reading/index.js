// Add Reading Test — passage/save flow. Question editor forms and
// collection live in the shared authoring engine (pages/mock/engine/
// author.js), the same one the listening and full mock tools use.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "/config.js";
import {
  authorKinds,
  editorHTML,
  collectAll,
  assignReadingNumbers,
  setupAuthorForms,
} from "/pages/mock/engine/author.js";
import { normalizeReadingQuestions } from "/pages/mock/engine/normalize.js";
import { gradeItems } from "/pages/mock/engine/grade.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let nextTestNumber = 1;
let passageCount = 0;
let uid = 0;

setupAuthorForms();

async function checkAdminAccess() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) {
        alert("🔒 Please login first to access this page");
        window.location.href = "/";
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== "admin") {
          alert("🚫 Access denied. Admin privileges required.");
          window.location.href = "/";
          return;
        }
        currentUser = user;
        resolve(user);
      } catch (error) {
        console.error("❌ Error checking user role:", error);
        alert("❌ Error verifying admin access. Please try again.");
        window.location.href = "/";
      }
    });
  });
}

async function getNextTestNumber() {
  try {
    const snapshot = await getDocs(collection(db, "readingTests"));
    let maxNumber = 0;
    snapshot.forEach((docSnap) => {
      const match = docSnap.id.match(/test-(\d+)/);
      if (match) maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
    });
    nextTestNumber = maxNumber + 1;
    const badge = document.getElementById("testNumber");
    if (badge) badge.textContent = `Test ${nextTestNumber}`;
  } catch (e) {
    console.error("Error getting next test number:", e);
  }
}

/* ───────────────────────── passages ───────────────────────── */

function addPassage() {
  if (passageCount >= 3) {
    alert("Maximum 3 passages allowed per test");
    return;
  }
  passageCount++;
  const n = passageCount;

  const menuButtons = authorKinds("reading")
    .map(
      (k) =>
        `<button type="button" class="${k.isNew ? "au-new" : ""}" onclick="addAuthorQuestion(${n}, '${k.kind}')">${k.isNew ? "✨ " : "+ "}${k.label}</button>`
    )
    .join("");

  const ranges = { 1: "1-13", 2: "14-26", 3: "27-40" };
  const passageHTML = `
    <div class="passage-container" data-passage="${n}">
      <div class="passage-header">
        <div class="passage-title"><span class="passage-number">${n}</span> Passage ${n}</div>
        ${n > 1 ? `<button type="button" class="remove-passage-btn" onclick="removePassage(${n})">Remove Passage</button>` : ""}
      </div>

      <div class="form-group">
        <label>Passage Title *</label>
        <input type="text" class="passage-title-input" placeholder="e.g., The discovery of a baby mammoth" required>
      </div>

      <div class="form-group">
        <label>Instructions</label>
        <input type="text" class="passage-instructions" value="You should spend about 20 minutes on Questions ${ranges[n] || ""}">
      </div>

      <div class="form-group">
        <label>Passage Text *</label>
        <textarea class="passage-text" rows="10" placeholder="Paste or type the full reading passage text here..." required></textarea>
      </div>

      <div class="questions-section">
        <h4>Questions</h4>
        <div class="questions-container" id="questions-${n}"></div>
        <div class="au-menu">${menuButtons}</div>
      </div>
    </div>`;

  document.getElementById("passagesContainer").insertAdjacentHTML("beforeend", passageHTML);
  updatePassageCount();
}

window.addAuthorQuestion = function (passageNumber, kind) {
  const container = document.getElementById(`questions-${passageNumber}`);
  container.insertAdjacentHTML("beforeend", editorHTML("reading", kind, `u${uid++}`));
  container.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.removePassage = function (passageNumber) {
  if (!confirm("Remove this passage and all its questions?")) return;
  document.querySelector(`.passage-container[data-passage="${passageNumber}"]`)?.remove();
  passageCount--;
  updatePassageCount();
};

function updatePassageCount() {
  const el = document.getElementById("passageCount");
  if (el) el.textContent = document.querySelectorAll(".passage-container").length;
}

window.handleCancel = function (event) {
  if (event) event.preventDefault();
  if (confirm("All unsaved progress will be lost. Are you sure you want to cancel?")) {
    window.location.href = "../index.html";
  }
};

/* ───────────────────────── collect / preview / submit ───────────────────────── */

function collectTestData() {
  const passages = [];

  document.querySelectorAll(".passage-container").forEach((passageEl, i) => {
    const title = passageEl.querySelector(".passage-title-input").value.trim();
    const text = passageEl.querySelector(".passage-text").value.trim();
    if (!title || !text) throw new Error(`Passage ${i + 1}: title and text are required.`);

    const questions = collectAll(passageEl.querySelector(".questions-container"), "reading", `Passage ${i + 1}, `);
    if (!questions.length) throw new Error(`Passage ${i + 1}: add at least one question.`);

    passages.push({
      title,
      instructions: passageEl.querySelector(".passage-instructions").value.trim(),
      text,
      questions,
    });
  });

  if (!passages.length) throw new Error("Add at least one passage.");

  // table markers/answers must be saved against the final global numbers
  assignReadingNumbers(passages);

  const accessPin = document.getElementById("accessPin").value.trim();
  if (accessPin && !/^\d{6}$/.test(accessPin)) {
    throw new Error("Access PIN must be exactly 6 digits.");
  }

  return {
    testId: `test-${nextTestNumber}`,
    passages,
    ...(accessPin ? { accessPin } : {}),
    createdAt: new Date().toISOString(),
    createdBy: currentUser?.email || "unknown",
  };
}

// Count gradeable questions exactly the way the test engine will
function countQuestions(passages) {
  const clone = structuredClone(passages);
  let c = 1;
  clone.forEach((p) => p.questions.forEach((q) => {
    if (q.question && q.type !== "drag_drop") q.qId = `q${c++}`;
    if (q.type === "question-group" && q.questions) q.questions.forEach((s) => { s.qId = `q${c++}`; });
    if (q.type === "drag_drop" && q.slots) q.slots.forEach((s) => { s.qId = `q${c++}`; });
    if (q.type === "map-labelling" && q.questions) q.questions.forEach((s) => { s.qId = `q${c++}`; });
    if (q.type === "table" && q.rows) {
      const keys = (q.columns || []).slice(1).map((x) => x.toLowerCase());
      q.rows.forEach((row) => keys.forEach((k) => {
        if (typeof row[k] === "string") row[k] = row[k].replace(/___q\d+___/g, () => `___q${c++}___`);
      }));
    }
  }));
  return gradeItems(clone.flatMap((p) => normalizeReadingQuestions(p.questions)), {}).total;
}

window.previewTest = function () {
  const previewContent = document.getElementById("previewContent");
  try {
    const data = collectTestData();
    let html = `<h3>Test Preview — ${countQuestions(data.passages)} questions</h3>`;
    data.passages.forEach((p, i) => {
      const kinds = p.questions.map((q) => q.type + (q.groupType ? `/${q.groupType}` : "")).join(", ");
      html += `<div class="preview-section"><h4>Passage ${i + 1}: ${p.title}</h4><p>${kinds}</p></div>`;
    });
    previewContent.innerHTML = html;
  } catch (e) {
    previewContent.innerHTML = `<h3>Not ready yet</h3><p style="color:#b91c1c">${e.message}</p>`;
  }
  document.getElementById("previewModal").style.display = "flex";
};

window.closePreview = function () {
  document.getElementById("previewModal").style.display = "none";
};

async function handleFormSubmit(e) {
  e.preventDefault();

  let testData;
  try {
    testData = collectTestData();
  } catch (err) {
    alert(err.message);
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");
  const loader = document.getElementById("loader");
  submitBtn.disabled = true;
  submitText.textContent = "Adding test...";
  loader.style.display = "inline-block";

  try {
    await setDoc(doc(db, "readingTests", `test-${nextTestNumber}`), testData);

    document.getElementById("successMessage").textContent = `Reading Test ${nextTestNumber} has been added successfully!`;
    document.getElementById("successModal").style.display = "flex";
    nextTestNumber++;
  } catch (error) {
    console.error("❌ Error adding test:", error);
    alert(`❌ Error adding test: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = "Add Reading Test";
    loader.style.display = "none";
  }
}

window.resetForm = function () {
  document.getElementById("successModal").style.display = "none";
  document.getElementById("passagesContainer").innerHTML = "";
  const t = document.getElementById("testTitle");
  if (t) t.value = "";
  passageCount = 0;
  updatePassageCount();
  getNextTestNumber();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/* ───────────────────────── init ───────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  // Harness pages set this flag to exercise the form flow without Firebase
  if (!window.__AUTHOR_HARNESS) {
    await checkAdminAccess();
    await getNextTestNumber();
  }

  document.getElementById("addPassageBtn").addEventListener("click", addPassage);
  document.getElementById("previewBtn").addEventListener("click", window.previewTest);
  document.getElementById("readingTestForm").addEventListener("submit", handleFormSubmit);

  addPassage();
});

export { collectTestData };
