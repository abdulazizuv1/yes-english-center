// Edit Reading Test — loads the saved test into the shared authoring
// engine's prefilled forms (pages/mock/engine/author.js), the same forms
// the add tools use, and saves back in the exact same document shape.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "/config.js";
import {
  authorKinds,
  editorHTML,
  detectKind,
  collectAll,
  assignReadingNumbers,
  setupAuthorForms,
} from "/pages/mock/engine/author.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentTest = null;
const testId = new URLSearchParams(window.location.search).get("testId");
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
        window.location.href = "/";
      }
    });
  });
}

/* ───────────────────────── load ───────────────────────── */

async function loadTest() {
  try {
    if (!testId) throw new Error("No test ID provided in the URL.");
    const testDoc = await getDoc(doc(db, "readingTests", testId));
    if (!testDoc.exists()) throw new Error("Test not found");

    currentTest = testDoc.data();

    document.getElementById("loadingContainer").style.display = "none";
    const main = document.getElementById("mainContent");
    if (main) main.style.display = "block";
    const form = document.getElementById("readingTestForm");
    if (form) form.style.display = "block";

    const badge = document.getElementById("testNumber");
    if (badge) badge.textContent = testId;
    const title = document.getElementById("testTitle");
    if (title) title.textContent = `Edit Reading ${testId}`;

    loadPinSection();

    (currentTest.passages || []).forEach((p) => addPassageComponent(p));
    if (!document.querySelector('#passagesContainer .passage-container')) addPassageComponent(null);
  } catch (error) {
    console.error("Error loading test:", error);
    document.getElementById("loadingContainer").innerHTML = `
      <div style="color: #f44336; text-align: center; padding: 50px;">
        <h3>❌ Error loading test</h3><p>${error.message}</p>
        <button onclick="location.href='/pages/dashboard/#/admin'" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">Return to Dashboard</button>
      </div>`;
  }
}

/* ───────────────────────── passages (prefilled) ───────────────────────── */

function addPassageComponent(passageData = null) {
  const existing = [...document.querySelectorAll("#passagesContainer .passage-container")];
  if (existing.length >= 3) {
    alert("Maximum 3 passages allowed per test");
    return;
  }
  const n = existing.reduce((m, el) => Math.max(m, parseInt(el.dataset.passage, 10) || 0), 0) + 1;
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  const menuButtons = authorKinds("reading")
    .map(
      (k) =>
        `<button type="button" class="${k.isNew ? "au-new" : ""}" onclick="addAuthorQuestion(${n}, '${k.kind}')">${k.isNew ? "✨ " : "+ "}${k.label}</button>`
    )
    .join("");

  const passageHTML = `
    <div class="passage-container" data-passage="${n}">
      <div class="passage-header">
        <div class="passage-title"><span class="passage-number">${n}</span> Passage ${n}</div>
        ${n > 1 ? `<button type="button" class="remove-passage-btn" onclick="removePassage(${n})">Remove Passage</button>` : ""}
      </div>

      <div class="form-group">
        <label>Passage Title *</label>
        <input type="text" class="passage-title-input" value="${esc(passageData?.title || "")}" placeholder="Passage title">
      </div>

      <div class="form-group">
        <label>Instructions</label>
        <input type="text" class="passage-instructions" value="${esc(passageData?.instructions || "")}">
      </div>

      <div class="form-group">
        <label>Passage Text *</label>
        <textarea class="passage-text" rows="10" placeholder="Full reading passage text...">${esc(passageData?.text || "")}</textarea>
      </div>

      <div class="questions-section">
        <h4>Questions</h4>
        <div class="questions-container" id="questions-${n}"></div>
        <div class="au-menu">${menuButtons}</div>
      </div>
    </div>`;

  document.getElementById("passagesContainer").insertAdjacentHTML("beforeend", passageHTML);

  const container = document.getElementById(`questions-${n}`);
  (passageData?.questions || []).forEach((q) => {
    const kind = detectKind(q, "reading");
    if (!kind) {
      console.warn("Unknown reading question skipped in editor:", q);
      return;
    }
    container.insertAdjacentHTML("beforeend", editorHTML("reading", kind, `u${uid++}`, q));
  });

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
  updatePassageCount();
};

function updatePassageCount() {
  const el = document.getElementById("passageCount");
  if (el) el.textContent = document.querySelectorAll(".passage-container").length;
}

/* ───────────────────────── collect / save ───────────────────────── */

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

  return {
    passages,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.email || "unknown",
  };
}

window.saveTest = function () {
  try {
    collectTestData(); // validate first
    document.getElementById("saveModal").style.display = "flex";
  } catch (e) {
    alert(e.message);
  }
};

window.closeSaveModal = function () {
  document.getElementById("saveModal").style.display = "none";
};

async function confirmSave() {
  const saveBtn = document.getElementById("confirmSaveBtn");
  const saveText = document.getElementById("saveText");
  const saveLoader = document.getElementById("saveLoader");
  saveBtn.disabled = true;
  if (saveText) saveText.textContent = "Saving...";
  if (saveLoader) saveLoader.style.display = "inline-block";

  try {
    const testData = collectTestData();
    const updateData = {
      ...testData,
      createdAt: currentTest.createdAt || new Date().toISOString(),
      createdBy: currentTest.createdBy || "unknown",
      testId: testId,
    };

    await updateDoc(doc(db, "readingTests", testId), updateData);
    currentTest = { ...currentTest, ...updateData };

    window.closeSaveModal();
    document.getElementById("successMessage") &&
      (document.getElementById("successMessage").textContent = "Reading Test has been updated successfully!");
    const modal = document.getElementById("successModal");
    if (modal) modal.style.display = "flex";
    else alert("✅ Reading Test updated successfully!");
  } catch (error) {
    console.error("❌ Error updating test:", error);
    alert(`❌ Error updating test: ${error.message}`);
  } finally {
    saveBtn.disabled = false;
    if (saveText) saveText.textContent = "Save Changes";
    if (saveLoader) saveLoader.style.display = "none";
  }
}

window.closeDeleteModal = function () {
  const m = document.getElementById("deleteModal");
  if (m) m.style.display = "none";
};

window.goBack = function () {
  window.location.href = "../index.html";
};

/* ───────────────────────── PIN ───────────────────────── */

function loadPinSection() {
  const pin = currentTest?.accessPin || "";
  const input = document.getElementById("accessPinInput");
  if (input) input.value = pin;
  updatePinUI(pin);
}

function updatePinUI(pin) {
  const statusEl = document.getElementById("pinStatus");
  const badgeEl = document.getElementById("pinBadge");
  const removeBtn = document.getElementById("removePinBtn");
  if (!statusEl) return;
  if (pin) {
    statusEl.textContent = `Current PIN: ${pin}`;
    statusEl.className = "pin-status pin-active";
    if (badgeEl) { badgeEl.textContent = `PIN: ${pin}`; badgeEl.style.display = "inline-block"; }
    if (removeBtn) removeBtn.style.display = "inline-flex";
  } else {
    statusEl.textContent = "No PIN set — test is publicly accessible";
    statusEl.className = "pin-status pin-none";
    if (badgeEl) badgeEl.style.display = "none";
    if (removeBtn) removeBtn.style.display = "none";
  }
}

window.savePin = async function () {
  const pin = document.getElementById("accessPinInput").value.trim();
  if (pin && !/^\d{6}$/.test(pin)) {
    alert("PIN must be exactly 6 digits (numbers only)");
    return;
  }
  const btn = document.getElementById("savePinBtn");
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Saving...";
  try {
    const testDocRef = doc(db, "readingTests", testId);
    if (pin) {
      await updateDoc(testDocRef, { accessPin: pin });
      if (currentTest) currentTest.accessPin = pin;
    } else {
      await updateDoc(testDocRef, { accessPin: deleteField() });
      if (currentTest) delete currentTest.accessPin;
    }
    updatePinUI(pin);
  } catch (error) {
    alert("❌ Error saving PIN: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
};

window.removePin = function () {
  document.getElementById("accessPinInput").value = "";
  window.savePin();
};

/* ───────────────────────── init ───────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("confirmSaveBtn")?.addEventListener("click", confirmSave);
  document.getElementById("addPassageBtn")?.addEventListener("click", () => addPassageComponent(null));
  document.getElementById("readingTestForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    window.saveTest();
  });

  if (!window.__AUTHOR_HARNESS) {
    await checkAdminAccess();
    await loadTest();
  }
});

export { collectTestData, addPassageComponent };
