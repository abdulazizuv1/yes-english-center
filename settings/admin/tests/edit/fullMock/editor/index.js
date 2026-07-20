// Edit Full Mock Test — the first question editor for full mock tests.
// Loads the saved document into the shared authoring engine's prefilled
// forms (pages/mock/engine/author.js) — the same forms every add/edit
// tool uses — and saves back in the exact same stages[] shape.
// Audio files are kept as saved; only questions/texts are edited here.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "/config.js";
import {
  authorKinds,
  editorHTML,
  detectKind,
  collectAll,
  assignListeningNumbers,
  assignReadingNumbers,
  setupAuthorForms,
} from "/pages/mock/engine/author.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentTest = null;
const testId = new URLSearchParams(window.location.search).get("testId");
let uid = 0;

setupAuthorForms();

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

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

/* ───────────────────────── load ───────────────────────── */

async function loadTest() {
  if (!testId) throw new Error("No test ID provided in the URL.");
  const snap = await getDoc(doc(db, "fullmockTests", testId));
  if (!snap.exists()) throw new Error("Test not found");
  currentTest = snap.data();
  renderEditor(currentTest);
}

function renderEditor(data) {
  document.getElementById("loadingContainer").style.display = "none";
  document.getElementById("editorWrap").style.display = "block";
  document.getElementById("pageTitle").textContent = `Edit ${data.title || testId}`;
  document.getElementById("testTitleInput").value = data.title || "";

  const listening = (data.stages || []).find((s) => s.id === "listening");
  const reading = (data.stages || []).find((s) => s.id === "reading");
  const writing = (data.stages || []).find((s) => s.id === "writing");

  // Listening sections
  const lWrap = document.getElementById("listeningSections");
  lWrap.innerHTML = "";
  (listening?.sections || []).forEach((section, i) => addListeningSection(lWrap, section, i));

  // Reading passages
  const rWrap = document.getElementById("readingPassages");
  rWrap.innerHTML = "";
  (reading?.passages || []).forEach((p, i) => addReadingPassage(rWrap, p, i));

  // Writing tasks
  const entry = writing?.tasks?.[0] || {};
  document.getElementById("task1Question").value = entry.task1?.question || "";
  document.getElementById("task1Image").value =
    typeof entry.task1?.imageUrl === "string" ? entry.task1.imageUrl : "";
  document.getElementById("task2Question").value = entry.task2?.question || "";
}

function addListeningSection(wrap, section, i) {
  const instr = section.instructions && typeof section.instructions === "object" ? section.instructions : {};
  const menu = authorKinds("listening")
    .map((k) => `<button type="button" class="${k.isNew ? "au-new" : ""}" onclick="addFMQuestion('l-questions-${i}','listening','${k.kind}')">${k.isNew ? "✨ " : "+ "}${k.label}</button>`)
    .join("");
  wrap.insertAdjacentHTML(
    "beforeend",
    `<div class="block fm-listening-section" data-index="${i}">
      <h3>Section ${i + 1}</h3>
      <label>Title</label>
      <input type="text" class="fm-sec-title" value="${esc(section.title || "")}">
      <label>Instructions heading / details / note</label>
      <input type="text" class="fm-sec-heading" value="${esc(instr.heading || "")}" placeholder="Questions 1-10">
      <input type="text" class="fm-sec-details" value="${esc(instr.details || "")}" placeholder="Complete the notes below" style="margin-top:6px">
      <input type="text" class="fm-sec-note" value="${esc(instr.note || "")}" placeholder="Write ONE WORD ONLY" style="margin-top:6px">
      ${typeof section.groupInstruction === "string" && section.groupInstruction ? `<label>Section groupInstruction</label><textarea class="fm-sec-gi" rows="2">${esc(section.groupInstruction)}</textarea>` : `<textarea class="fm-sec-gi" rows="2" style="display:none"></textarea>`}
      <label>Questions</label>
      <div class="questions-container" id="l-questions-${i}"></div>
      <div class="au-menu">${menu}</div>
    </div>`
  );
  const container = document.getElementById(`l-questions-${i}`);
  (section.content || []).forEach((item) => {
    const kind = detectKind(item, "listening");
    if (!kind) {
      console.warn("Unknown listening item skipped in editor:", item);
      return;
    }
    container.insertAdjacentHTML("beforeend", editorHTML("listening", kind, `u${uid++}`, item));
  });
}

function addReadingPassage(wrap, passage, i) {
  const menu = authorKinds("reading")
    .map((k) => `<button type="button" class="${k.isNew ? "au-new" : ""}" onclick="addFMQuestion('r-questions-${i}','reading','${k.kind}')">${k.isNew ? "✨ " : "+ "}${k.label}</button>`)
    .join("");
  wrap.insertAdjacentHTML(
    "beforeend",
    `<div class="block fm-reading-passage" data-index="${i}">
      <h3>Passage ${i + 1}</h3>
      <label>Title</label>
      <input type="text" class="fm-pas-title" value="${esc(passage.title || "")}">
      <label>Instructions</label>
      <input type="text" class="fm-pas-instructions" value="${esc(passage.instructions || "")}">
      <label>Passage text</label>
      <textarea class="fm-pas-text" rows="10">${esc(passage.text || "")}</textarea>
      <label>Questions</label>
      <div class="questions-container" id="r-questions-${i}"></div>
      <div class="au-menu">${menu}</div>
    </div>`
  );
  const container = document.getElementById(`r-questions-${i}`);
  (passage.questions || []).forEach((q) => {
    const kind = detectKind(q, "reading");
    if (!kind) {
      console.warn("Unknown reading question skipped in editor:", q);
      return;
    }
    container.insertAdjacentHTML("beforeend", editorHTML("reading", kind, `u${uid++}`, q));
  });
}

window.addFMQuestion = function (containerId, target, kind) {
  const container = document.getElementById(containerId);
  container.insertAdjacentHTML("beforeend", editorHTML(target, kind, `u${uid++}`));
  container.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
};

/* ───────────────────────── collect / save ───────────────────────── */

function collectStages() {
  const title = document.getElementById("testTitleInput").value.trim();
  if (!title) throw new Error("Test title is required.");

  const oldListening = (currentTest.stages || []).find((s) => s.id === "listening") || {};
  const oldReading = (currentTest.stages || []).find((s) => s.id === "reading") || {};
  const oldWriting = (currentTest.stages || []).find((s) => s.id === "writing") || {};

  // Listening: collect every section, keep audio fields as saved
  let n = 1;
  const sections = [...document.querySelectorAll(".fm-listening-section")].map((el, i) => {
    const items = collectAll(el.querySelector(".questions-container"), "listening", `Listening Section ${i + 1}, `);
    if (!items.length) throw new Error(`Listening Section ${i + 1}: add at least one question.`);
    n = assignListeningNumbers(items, n);
    const old = oldListening.sections?.[i] || {};
    const gi = el.querySelector(".fm-sec-gi").value.trim();
    return {
      ...old,
      sectionNumber: i + 1,
      title: el.querySelector(".fm-sec-title").value.trim(),
      instructions: {
        heading: el.querySelector(".fm-sec-heading").value.trim(),
        details: el.querySelector(".fm-sec-details").value.trim(),
        note: el.querySelector(".fm-sec-note").value.trim(),
      },
      ...(gi ? { groupInstruction: gi } : {}),
      content: items,
    };
  });

  // Reading: collect passages; table answers renumbered to global
  const passages = [...document.querySelectorAll(".fm-reading-passage")].map((el, i) => {
    const questions = collectAll(el.querySelector(".questions-container"), "reading", `Reading Passage ${i + 1}, `);
    if (!questions.length) throw new Error(`Reading Passage ${i + 1}: add at least one question.`);
    return {
      title: el.querySelector(".fm-pas-title").value.trim(),
      instructions: el.querySelector(".fm-pas-instructions").value.trim(),
      text: el.querySelector(".fm-pas-text").value.trim(),
      questions,
    };
  });
  assignReadingNumbers(passages);

  // Writing
  const oldEntry = oldWriting.tasks?.[0] || {};
  const task1Image = document.getElementById("task1Image").value.trim();
  const writingEntry = {
    ...oldEntry,
    task1: {
      ...(oldEntry.task1 || {}),
      question: document.getElementById("task1Question").value.trim(),
      ...(task1Image ? { imageUrl: task1Image } : {}),
    },
    task2: {
      ...(oldEntry.task2 || {}),
      question: document.getElementById("task2Question").value.trim(),
    },
  };
  if (!task1Image) delete writingEntry.task1.imageUrl;

  return {
    title,
    stages: [
      { ...oldListening, title: oldListening.title || "Listening Test", sections, totalQuestions: n - 1 },
      { ...oldReading, title: oldReading.title || "Reading Test", passages },
      { ...oldWriting, title: oldWriting.title || "Writing Test", tasks: [writingEntry] },
    ],
  };
}

async function saveTest() {
  const btn = document.getElementById("saveBtn");
  const status = document.getElementById("statusBar");
  let payload;
  try {
    payload = collectStages();
  } catch (e) {
    alert(e.message);
    return;
  }
  btn.disabled = true;
  status.textContent = "Saving…";
  try {
    await updateDoc(doc(db, "fullmockTests", testId), {
      title: payload.title,
      stages: payload.stages,
    });
    currentTest = { ...currentTest, ...payload };
    showToast("✅ Full mock test updated successfully");
    status.textContent = "Saved";
  } catch (e) {
    console.error("❌ Error updating test:", e);
    alert(`❌ Error updating test: ${e.message}`);
    status.textContent = "";
  } finally {
    btn.disabled = false;
  }
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 3000);
}

/* ───────────────────────── init ───────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".stage-tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".stage-tabs button").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll(".stage-panel").forEach((p) =>
        p.classList.toggle("active", p.id === `panel-${b.dataset.tab}`)
      );
    })
  );
  document.getElementById("saveBtn").addEventListener("click", saveTest);

  if (!window.__AUTHOR_HARNESS) {
    await checkAdminAccess();
    try {
      await loadTest();
    } catch (e) {
      document.getElementById("loadingContainer").innerHTML =
        `<div style="color:#f44336"><h3>❌ Error loading test</h3><p>${e.message}</p></div>`;
    }
  }
});

// Harness/testing hook
export function setCurrentTest(data) {
  currentTest = data;
}

export { renderEditor, collectStages };
