// Add Listening Test — section/audio/save flow. Question editor forms and
// collection live in the shared authoring engine (pages/mock/engine/
// author.js), the same one the reading and full mock tools use.
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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "/config.js";
import {
  authorKinds,
  editorHTML,
  collectAll,
  assignListeningNumbers,
  setupAuthorForms,
} from "/pages/mock/engine/author.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let nextTestNumber = 1;
let sectionCount = 0;
let uid = 0;
let singleAudioFile = null;
let audioUploadType = "single";

setupAuthorForms();

// Check if user is admin
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
    const snapshot = await getDocs(collection(db, "listeningTests"));
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

async function uploadAudioFile(file, testNumber, sectionNumber) {
  const storagePath = `listening-audio/test-${testNumber}/part${sectionNumber}.mp3`;
  const snapshot = await uploadBytes(ref(storage, storagePath), file);
  return getDownloadURL(snapshot.ref);
}

/* ───────────────────────── sections ───────────────────────── */

function addSection() {
  if (sectionCount >= 4) {
    alert("Maximum 4 sections allowed per listening test");
    return;
  }
  sectionCount++;
  const n = sectionCount;

  const menuButtons = authorKinds("listening")
    .map(
      (k) =>
        `<button type="button" class="${k.isNew ? "au-new" : ""}" onclick="addAuthorQuestion(${n}, '${k.kind}')">${k.isNew ? "✨ " : "+ "}${k.label}</button>`
    )
    .join("");

  const sectionHTML = `
    <div class="section-container" data-section="${n}">
      <div class="section-header">
        <div class="section-title"><span class="section-number">${n}</span> Section ${n}</div>
        ${n > 1 ? `<button type="button" class="remove-section-btn" onclick="removeSection(${n})">Remove Section</button>` : ""}
      </div>

      <div class="form-group">
        <label>Section Title</label>
        <input type="text" class="section-title-input" placeholder="e.g., Transport survey">
      </div>

      <div class="audio-upload" id="audioUpload${n}" style="display: ${audioUploadType === "separate" ? "block" : "none"};">
        <input type="file" id="audioFile${n}" accept="audio/*" onchange="handleAudioUpload(${n})">
        <label for="audioFile${n}" class="audio-upload-label">
          <svg class="audio-upload-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          <div class="audio-upload-text">Upload Audio File</div>
          <div class="audio-upload-hint">Click to select or drag and drop audio file (MP3, WAV, etc.)</div>
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
          <button type="button" onclick="removeAudio(${n})" class="remove-audio">🗑 Remove</button>
        </div>
        <audio id="audioPlayer${n}" style="display: none;"></audio>
      </div>

      <div class="instructions-section">
        <h4>Section Instructions *</h4>
        <div class="form-group"><input type="text" class="instructions-heading" placeholder="Heading (e.g., Questions 1-10)"></div>
        <div class="form-group"><input type="text" class="instructions-details" placeholder="Details (e.g., Complete the notes below)"></div>
        <div class="form-group"><input type="text" class="instructions-note" placeholder="Note (e.g., Write ONE WORD AND/OR A NUMBER for each answer.)"></div>
      </div>

      <div class="questions-section">
        <h4>Questions</h4>
        <div class="questions-container" id="questions-${n}"></div>
        <div class="au-menu">${menuButtons}</div>
      </div>
    </div>`;

  document.getElementById("sectionsContainer").insertAdjacentHTML("beforeend", sectionHTML);
  setupDragAndDrop(n);
  updateSectionCount();
}

window.addAuthorQuestion = function (sectionNumber, kind) {
  const container = document.getElementById(`questions-${sectionNumber}`);
  container.insertAdjacentHTML("beforeend", editorHTML("listening", kind, `u${uid++}`));
  container.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.removeSection = function (sectionNumber) {
  if (!confirm("Remove this section and all its questions?")) return;
  document.querySelector(`.section-container[data-section="${sectionNumber}"]`)?.remove();
  sectionCount--;
  updateSectionCount();
};

function updateSectionCount() {
  const el = document.getElementById("sectionCount");
  if (el) el.textContent = document.querySelectorAll(".section-container").length;
}

/* ───────────────────────── audio ───────────────────────── */

function setupDragAndDrop(sectionNumber) {
  const uploadArea = document.getElementById(`audioUpload${sectionNumber}`);
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });
  uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("audio/")) {
      document.getElementById(`audioFile${sectionNumber}`).files = files;
      window.handleAudioUpload(sectionNumber);
    } else {
      alert("Please drop an audio file");
    }
  });
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

window.handleAudioUpload = function (sectionNumber) {
  const file = document.getElementById(`audioFile${sectionNumber}`).files[0];
  if (!file) return;
  document.getElementById(`audioPreviewName${sectionNumber}`).textContent = file.name;
  document.getElementById(`audioPreviewSize${sectionNumber}`).textContent = formatFileSize(file.size);
  document.getElementById(`audioPlayer${sectionNumber}`).src = URL.createObjectURL(file);
  document.getElementById(`audioPreview${sectionNumber}`).style.display = "block";
};
window.playAudio = (n) => document.getElementById(`audioPlayer${n}`).play();
window.pauseAudio = (n) => document.getElementById(`audioPlayer${n}`).pause();
window.removeAudio = function (n) {
  document.getElementById(`audioFile${n}`).value = "";
  document.getElementById(`audioPreview${n}`).style.display = "none";
  const p = document.getElementById(`audioPlayer${n}`);
  p.pause();
  p.src = "";
};

window.handleSingleAudioUpload = function () {
  const file = document.getElementById("singleAudioFile").files[0];
  if (!file) return;
  singleAudioFile = file;
  document.getElementById("singleAudioPreviewName").textContent = file.name;
  document.getElementById("singleAudioPreviewSize").textContent = formatFileSize(file.size);
  document.getElementById("singleAudioPlayer").src = URL.createObjectURL(file);
  document.getElementById("singleAudioPreview").style.display = "block";
};
window.playSingleAudio = () => document.getElementById("singleAudioPlayer").play();
window.pauseSingleAudio = () => document.getElementById("singleAudioPlayer").pause();
window.removeSingleAudio = function () {
  singleAudioFile = null;
  document.getElementById("singleAudioFile").value = "";
  document.getElementById("singleAudioPreview").style.display = "none";
  document.getElementById("singleAudioPlayer").src = "";
};

window.handleCancel = function (event) {
  if (event) event.preventDefault();
  if (confirm("All unsaved progress will be lost. Are you sure you want to cancel?")) {
    window.location.href = "../index.html";
  }
};

/* ───────────────────────── collect / preview / submit ───────────────────────── */

function collectTestData() {
  const testTitle = document.getElementById("testTitle").value.trim();
  const timeLimit = parseInt(document.getElementById("timeLimit").value, 10);
  if (!testTitle) throw new Error("Test title is required.");

  const sections = [];
  let n = 1;

  document.querySelectorAll(".section-container").forEach((sectionEl, i) => {
    const title = sectionEl.querySelector(".section-title-input").value.trim();
    if (!title) throw new Error(`Section ${i + 1}: title is required.`);

    const items = collectAll(sectionEl.querySelector(".questions-container"), "listening", `Section ${i + 1}, `);
    if (!items.length) throw new Error(`Section ${i + 1}: add at least one question.`);
    n = assignListeningNumbers(items, n);

    sections.push({
      sectionNumber: parseInt(sectionEl.dataset.section, 10),
      title,
      instructions: {
        heading: sectionEl.querySelector(".instructions-heading").value.trim(),
        details: sectionEl.querySelector(".instructions-details").value.trim(),
        note: sectionEl.querySelector(".instructions-note").value.trim(),
      },
      content: items,
    });
  });

  if (!sections.length) throw new Error("Add at least one section.");

  const accessPin = document.getElementById("accessPin").value.trim();
  if (accessPin && !/^\d{6}$/.test(accessPin)) {
    throw new Error("Access PIN must be exactly 6 digits.");
  }

  return {
    title: testTitle,
    ...(accessPin ? { accessPin } : {}),
    parts: {
      testId: `ielts-listening-${nextTestNumber}`,
      title: testTitle,
      sections,
      metadata: {
        totalQuestions: n - 1,
        timeLimit,
        version: "1.0",
        createdAt: new Date().toISOString().split("T")[0],
      },
    },
    createdAt: new Date(),
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

async function handleFormSubmit(e) {
  e.preventDefault();

  let testData;
  try {
    testData = collectTestData();
  } catch (err) {
    alert(err.message);
    return;
  }

  if (audioUploadType === "single") {
    if (!singleAudioFile) {
      alert("Upload the audio file first.");
      return;
    }
  } else {
    for (const section of document.querySelectorAll(".section-container")) {
      const sn = parseInt(section.dataset.section, 10);
      if (!document.getElementById(`audioFile${sn}`)?.files[0]) {
        alert(`Section ${sn}: audio file is missing.`);
        return;
      }
    }
  }

  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");
  const loader = document.getElementById("loader");
  submitBtn.disabled = true;
  submitText.textContent = "Adding test...";
  loader.style.display = "inline-block";

  try {
    const audioUrls = {};
    const sections = document.querySelectorAll(".section-container");
    if (audioUploadType === "single") {
      const url = await uploadAudioFile(singleAudioFile, nextTestNumber, 0);
      sections.forEach((s) => (audioUrls[parseInt(s.dataset.section, 10)] = url));
    } else {
      for (const s of sections) {
        const sn = parseInt(s.dataset.section, 10);
        audioUrls[sn] = await uploadAudioFile(document.getElementById(`audioFile${sn}`).files[0], nextTestNumber, sn);
      }
    }

    testData.parts.sections.forEach((section) => {
      section.audioUrl = audioUrls[section.sectionNumber];
    });

    await setDoc(doc(db, "listeningTests", `test-${nextTestNumber}`), testData);

    document.getElementById("successMessage").textContent = `Listening Test ${nextTestNumber} has been added successfully!`;
    document.getElementById("successModal").style.display = "flex";
    nextTestNumber++;
  } catch (error) {
    console.error("❌ Error adding test:", error);
    alert(`❌ Error adding test: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = "Add Listening Test";
    loader.style.display = "none";
  }
}

window.resetForm = function () {
  document.getElementById("successModal").style.display = "none";
  document.getElementById("sectionsContainer").innerHTML = "";
  document.getElementById("testTitle").value = "";
  document.getElementById("timeLimit").value = "30";
  sectionCount = 0;
  updateSectionCount();
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

  document.getElementById("addSectionBtn").addEventListener("click", addSection);
  document.getElementById("previewBtn").addEventListener("click", window.previewTest);
  document.getElementById("listeningTestForm").addEventListener("submit", handleFormSubmit);

  addSection();

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
  document.getElementById("singleAudioUpload").style.display = "block";
});

export { collectTestData };
