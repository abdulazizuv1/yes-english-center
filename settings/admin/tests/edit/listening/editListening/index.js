// Edit Listening Test — loads the saved test into the shared authoring
// engine's prefilled forms (pages/mock/engine/author.js), the same forms
// the add tools use, and saves back in the exact same document shape.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "/config.js";
import {
  authorKinds,
  editorHTML,
  detectKind,
  collectAll,
  assignListeningNumbers,
  setupAuthorForms,
} from "/pages/mock/engine/author.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentTest = null;
const testId = new URLSearchParams(window.location.search).get("testId");
let uid = 0;
let audioUploadType = "single";
let singleAudioFile = null;
let singleAudioUrl = "";

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
        resolve(user);
      } catch (error) {
        console.error("❌ Error checking user role:", error);
        window.location.href = "/";
      }
    });
  });
}

async function uploadAudioFile(file, testNumber, sectionNumber) {
  const storagePath = `listening-audio/test-${testNumber}/part${sectionNumber}.mp3`;
  const snapshot = await uploadBytes(ref(storage, storagePath), file);
  return getDownloadURL(snapshot.ref);
}

/* ───────────────────────── load ───────────────────────── */

async function loadTest() {
  try {
    if (!testId) throw new Error("No test ID provided in the URL.");
    const testDoc = await getDoc(doc(db, "listeningTests", testId));
    if (!testDoc.exists()) throw new Error("Test not found");

    currentTest = testDoc.data();

    document.getElementById("loadingContainer").style.display = "none";
    document.getElementById("listeningTestForm").style.display = "block";

    loadPinSection();

    const parts = currentTest.parts || {};
    document.getElementById("testNumberBadge").textContent = parts.testId || testId;
    document.getElementById("testTitle").textContent = `Edit ${currentTest.title || "Listening Test"}`;
    const titleInput = document.getElementById("testTitleInput");
    if (titleInput) titleInput.value = currentTest.title || "";
    const timeLimitInput = document.getElementById("timeLimit");
    if (timeLimitInput && parts.metadata?.timeLimit) timeLimitInput.value = parts.metadata.timeLimit;

    determineInitialAudioType(parts.sections);

    const sections = t(parts.sections) ? parts.sections : [];
    if (sections.length) {
      sections.forEach((s) => addSectionComponent(s));
    } else {
      window.addSection();
    }
  } catch (error) {
    console.error("Error loading test:", error);
    document.getElementById("loadingContainer").innerHTML = `
      <div style="color: #f44336; text-align: center; padding: 50px;">
        <h3>❌ Error loading test</h3><p>${error.message}</p>
        <button onclick="location.href='/pages/dashboard/#/admin'" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">Return to Dashboard</button>
      </div>`;
  }
}

const t = (arr) => Array.isArray(arr) && arr.length > 0;

function determineInitialAudioType(sections) {
  if (currentTest.parts && currentTest.parts.audioUrl) {
    document.getElementById("singleAudio").checked = true;
    audioUploadType = "single";
    singleAudioUrl = currentTest.parts.audioUrl;
    document.getElementById("singleAudioUpload").style.display = "block";
    document.getElementById("singleAudioPreview").style.display = "flex";
    document.getElementById("singleAudioPreviewName").textContent = "Existing Test Audio (Firebase)";
    document.getElementById("singleAudioPreviewSize").textContent = "";
    document.getElementById("singleAudioPlayer").src = singleAudioUrl;
    const area = document.getElementById("singleAudioUploadArea");
    if (area) area.style.display = "none";
  } else if ((sections || []).some((s) => s.audioUrl)) {
    document.getElementById("separateAudio").checked = true;
    audioUploadType = "separate";
    document.getElementById("singleAudioUpload").style.display = "none";
  } else {
    document.getElementById("singleAudio").checked = true;
    audioUploadType = "single";
    document.getElementById("singleAudioUpload").style.display = "block";
  }
}

/* ───────────────────────── sections (prefilled) ───────────────────────── */

function addSectionComponent(sectionData = null) {
  const existing = [...document.querySelectorAll("#sectionsContainer .section-container")];
  if (existing.length >= 4) {
    alert("Maximum 4 sections allowed per listening test");
    return;
  }
  const n = existing.reduce((m, el) => Math.max(m, parseInt(el.dataset.section, 10) || 0), 0) + 1;
  const instr = sectionData?.instructions && typeof sectionData.instructions === "object" ? sectionData.instructions : {};

  const menuButtons = authorKinds("listening")
    .map(
      (k) =>
        `<button type="button" class="${k.isNew ? "au-new" : ""}" onclick="addAuthorQuestion(${n}, '${k.kind}')">${k.isNew ? "✨ " : "+ "}${k.label}</button>`
    )
    .join("");

  const hasAudio = !!sectionData?.audioUrl;
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  const sectionHTML = `
    <div class="section-container" data-section="${n}" ${hasAudio ? `data-existing-audio="${esc(sectionData.audioUrl)}"` : ""}>
      <div class="section-header">
        <div class="section-title"><span class="section-number">${n}</span> Section ${n}</div>
        ${n > 1 ? `<button type="button" class="remove-section-btn" onclick="removeSection(${n})">Remove Section</button>` : ""}
      </div>

      <div class="form-group">
        <label>Section Title</label>
        <input type="text" class="section-title-input" value="${esc(sectionData?.title || "")}" placeholder="e.g., Transport survey">
      </div>

      <div class="audio-upload" id="audioUpload${n}" style="display: ${audioUploadType === "separate" ? "block" : "none"};">
        ${hasAudio ? `<p style="margin:0 0 8px;color:#059669;font-size:13px">✔ Existing audio kept unless you upload a new file</p>` : ""}
        <input type="file" id="audioFile${n}" accept="audio/*" onchange="handleAudioUpload(${n})">
        <label for="audioFile${n}" class="audio-upload-label">
          <div class="audio-upload-text">${hasAudio ? "Replace Audio File (optional)" : "Upload Audio File"}</div>
        </label>
      </div>

      <div class="audio-preview" id="audioPreview${n}">
        <div class="audio-preview-info">
          <span class="audio-preview-name" id="audioPreviewName${n}"></span>
          <span class="audio-preview-size" id="audioPreviewSize${n}"></span>
        </div>
        <div class="audio-preview-controls">
          <button type="button" onclick="playAudio(${n})">▶ Play</button>
          <button type="button" onclick="pauseAudio(${n})">⏸ Pause</button>
        </div>
        <audio id="audioPlayer${n}" style="display: none;"></audio>
      </div>

      <div class="instructions-section">
        <h4>Section Instructions</h4>
        <div class="form-group"><input type="text" class="instructions-heading" value="${esc(instr.heading || "")}" placeholder="Heading (e.g., Questions 1-10)"></div>
        <div class="form-group"><input type="text" class="instructions-details" value="${esc(instr.details || "")}" placeholder="Details (e.g., Complete the notes below)"></div>
        <div class="form-group"><input type="text" class="instructions-note" value="${esc(instr.note || "")}" placeholder="Note (e.g., Write ONE WORD ONLY)"></div>
      </div>

      <div class="questions-section">
        <h4>Questions</h4>
        <div class="questions-container" id="questions-${n}"></div>
        <div class="au-menu">${menuButtons}</div>
      </div>
    </div>`;

  document.getElementById("sectionsContainer").insertAdjacentHTML("beforeend", sectionHTML);

  // Prefill the saved questions into author forms
  const container = document.getElementById(`questions-${n}`);
  (sectionData?.content || []).forEach((item) => {
    const kind = detectKind(item, "listening");
    if (!kind) {
      console.warn("Unknown listening item skipped in editor:", item);
      return;
    }
    container.insertAdjacentHTML("beforeend", editorHTML("listening", kind, `u${uid++}`, item));
  });

  updateSectionCount();
}

window.addSection = function () {
  addSectionComponent(null);
};

window.addAuthorQuestion = function (sectionNumber, kind) {
  const container = document.getElementById(`questions-${sectionNumber}`);
  container.insertAdjacentHTML("beforeend", editorHTML("listening", kind, `u${uid++}`));
  container.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.removeSection = function (sectionNumber) {
  if (!confirm("Remove this section and all its questions?")) return;
  document.querySelector(`.section-container[data-section="${sectionNumber}"]`)?.remove();
  updateSectionCount();
};

function updateSectionCount() {
  const el = document.getElementById("sectionCount");
  if (el) el.textContent = document.querySelectorAll(".section-container").length;
}

/* ───────────────────────── audio handlers ───────────────────────── */

window.handleAudioUpload = function (n) {
  const file = document.getElementById(`audioFile${n}`).files[0];
  if (!file) return;
  document.getElementById(`audioPreviewName${n}`).textContent = file.name;
  document.getElementById(`audioPreviewSize${n}`).textContent = "";
  document.getElementById(`audioPlayer${n}`).src = URL.createObjectURL(file);
  document.getElementById(`audioPreview${n}`).style.display = "block";
};
window.playAudio = (n) => document.getElementById(`audioPlayer${n}`).play();
window.pauseAudio = (n) => document.getElementById(`audioPlayer${n}`).pause();

window.handleSingleAudioUpload = function () {
  const file = document.getElementById("singleAudioFile").files[0];
  if (!file) return;
  singleAudioFile = file;
  document.getElementById("singleAudioPreview").style.display = "flex";
  document.getElementById("singleAudioPreviewName").textContent = file.name;
  document.getElementById("singleAudioPlayer").src = URL.createObjectURL(file);
};
window.playSingleAudio = () => document.getElementById("singleAudioPlayer").play();
window.pauseSingleAudio = () => document.getElementById("singleAudioPlayer").pause();
window.removeSingleAudio = function () {
  singleAudioFile = null;
  const inp = document.getElementById("singleAudioFile");
  if (inp) inp.value = "";
  document.getElementById("singleAudioPlayer").src = singleAudioUrl || "";
  document.getElementById("singleAudioPreviewName").textContent = singleAudioUrl ? "Existing Test Audio (Firebase)" : "";
};

window.handleCancel = function (event) {
  if (event) event.preventDefault();
  if (confirm("All unsaved changes will be lost. Are you sure?")) {
    window.location.href = "/pages/dashboard/#/admin";
  }
};

/* ───────────────────────── collect / preview / save ───────────────────────── */

function collectTestData() {
  const title = document.getElementById("testTitleInput").value.trim();
  if (!title) throw new Error("Test title is required.");
  const timeLimit = parseInt(document.getElementById("timeLimit")?.value, 10) || 30;

  const sections = [];
  let n = 1;

  document.querySelectorAll(".section-container").forEach((sectionEl, i) => {
    // Some older tests have untitled sections — the test pages fall back
    // to "Section N", so editing them must stay possible.
    const sectionTitle = sectionEl.querySelector(".section-title-input").value.trim();

    const items = collectAll(sectionEl.querySelector(".questions-container"), "listening", `Section ${i + 1}, `);
    if (!items.length) throw new Error(`Section ${i + 1}: add at least one question.`);
    n = assignListeningNumbers(items, n);

    sections.push({
      sectionNumber: i + 1,
      title: sectionTitle,
      instructions: {
        heading: sectionEl.querySelector(".instructions-heading").value.trim(),
        details: sectionEl.querySelector(".instructions-details").value.trim(),
        note: sectionEl.querySelector(".instructions-note").value.trim(),
      },
      content: items,
      __existingAudio: sectionEl.dataset.existingAudio || "",
      __domSection: parseInt(sectionEl.dataset.section, 10),
    });
  });

  if (!sections.length) throw new Error("Add at least one section.");

  return {
    title,
    parts: {
      testId: currentTest?.parts?.testId || `ielts-listening-${String(testId).replace(/\D/g, "")}`,
      title,
      sections,
      metadata: {
        totalQuestions: n - 1,
        timeLimit,
        version: currentTest?.parts?.metadata?.version || "1.0",
        createdAt: currentTest?.parts?.metadata?.createdAt || new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      },
    },
  };
}

window.previewTest = function () {
  const previewContent = document.getElementById("previewContent");
  try {
    const data = collectTestData();
    let html = `<h3>Test Preview — ${data.parts.metadata.totalQuestions} questions</h3>`;
    data.parts.sections.forEach((s) => {
      const kinds = s.content.map((c) => c.type + (c.format ? `/${c.format}` : "")).join(", ");
      html += `<div class="preview-section"><h4>Section ${s.sectionNumber}: ${s.title}</h4><p>${kinds}</p></div>`;
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

// The form submit opens the confirmation modal; executeSaveTest saves.
function handleFormSubmit(e) {
  e.preventDefault();
  try {
    collectTestData(); // validate before showing the confirm modal
    document.getElementById("confirmationModal").style.display = "flex";
  } catch (err) {
    alert(err.message);
  }
}

window.executeSaveTest = async function () {
  document.getElementById("confirmationModal").style.display = "none";

  const submitBtn = document.getElementById("saveBtn");
  const submitText = document.getElementById("saveText");
  const loader = document.getElementById("saveLoader");
  submitBtn.disabled = true;
  submitText.textContent = "Saving changes...";
  loader.style.display = "inline-block";

  try {
    const testData = collectTestData();
    const testNumber = String(testId).replace(/\D/g, "");

    if (audioUploadType === "single") {
      let finalUrl = singleAudioUrl;
      if (singleAudioFile) {
        finalUrl = await uploadAudioFile(singleAudioFile, testNumber, 0);
        singleAudioUrl = finalUrl;
      }
      testData.parts.audioUrl = finalUrl;
      testData.parts.sections.forEach((s) => (s.audioUrl = finalUrl));
    } else {
      for (const s of testData.parts.sections) {
        const fileInput = document.getElementById(`audioFile${s.__domSection}`);
        const file = fileInput?.files[0];
        if (file) {
          s.audioUrl = await uploadAudioFile(file, testNumber, s.sectionNumber);
        } else {
          s.audioUrl = s.__existingAudio || "";
        }
      }
    }
    testData.parts.sections.forEach((s) => {
      delete s.__existingAudio;
      delete s.__domSection;
    });

    await updateDoc(doc(db, "listeningTests", testId), {
      title: testData.title,
      parts: testData.parts,
    });

    document.getElementById("successMessage").textContent = "Listening Test has been updated successfully!";
    document.getElementById("successModal").style.display = "flex";
  } catch (error) {
    console.error("❌ Error updating test:", error);
    alert(`❌ Error updating test: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = "Save Changes";
    loader.style.display = "none";
  }
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
    const testDocRef = doc(db, "listeningTests", testId);
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
  document.getElementById("listeningTestForm").addEventListener("submit", handleFormSubmit);
  document.getElementById("addSectionBtn")?.addEventListener("click", () => window.addSection());
  document.getElementById("previewBtn")?.addEventListener("click", () => window.previewTest());
  document.getElementById("singleAudioFile")?.addEventListener("change", () => window.handleSingleAudioUpload());

  document.querySelectorAll('input[name="audioUploadType"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      audioUploadType = this.value;
      const single = this.value === "single";
      document.getElementById("singleAudioUpload").style.display = single ? "block" : "none";
      document.querySelectorAll("#sectionsContainer .audio-upload").forEach((u) => {
        u.style.display = single ? "none" : "block";
      });
    });
  });

  if (!window.__AUTHOR_HARNESS) {
    await checkAdminAccess();
    await loadTest();
  }
});

export { collectTestData, addSectionComponent };
