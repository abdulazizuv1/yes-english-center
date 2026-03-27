import {
  getFirestore,
  doc,
  getDoc,
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
const feedbackId = params.get("id");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to view feedback.");
    window.location.href = "/login.html";
    return;
  }

  if (!feedbackId) {
    showError("No feedback ID provided.");
    return;
  }

  try {
    const docRef = doc(db, "aiFeedback", feedbackId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().uid !== user.uid) {
      showError("Feedback not found.");
      return;
    }

    renderFeedback(docSnap.data());
  } catch (err) {
    console.error("Error loading feedback:", err);
    showError("Failed to load feedback.");
  }

  document.getElementById("historyBtn").addEventListener("click", () => loadHistory(user.uid));
});

function renderFeedback(data) {
  const metaEl = document.getElementById("feedbackMeta");
  const bodyEl = document.getElementById("feedbackBody");

  let dateStr = "";
  if (data.createdAt) {
    const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    dateStr = date.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  metaEl.innerHTML = `<span class="feedback-date">📅 ${dateStr}</span>`;
  bodyEl.innerHTML = markdownToHtml(data.feedbackText || "No feedback text.");
}

function markdownToHtml(text) {
  // Process line by line
  const lines = text.split("\n");
  const html = [];
  let inList = false;

  for (const line of lines) {
    // ### heading
    if (line.startsWith("### ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    // ## heading
    } else if (line.startsWith("## ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    // bullet point
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${inlineMd(line.slice(2))}</li>`);
    // numbered list
    } else if (/^\d+\.\s/.test(line)) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<p>${inlineMd(line)}</p>`);
    // empty line
    } else if (line.trim() === "") {
      if (inList) { html.push("</ul>"); inList = false; }
    // normal paragraph
    } else {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<p>${inlineMd(line)}</p>`);
    }
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

function inlineMd(text) {
  // **bold**
  text = escapeHtml(text);
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return text;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  document.getElementById("feedbackBody").innerHTML = `<p class="error-state">${message}</p>`;
}

async function loadHistory(uid) {
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");

  historyPanel.style.display = "block";
  historyList.innerHTML = "<p>Loading history...</p>";

  try {
    const q = query(
      collection(db, "aiFeedback"),
      where("uid", "==", uid),
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
      let dateStr = "";
      if (data.createdAt) {
        const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        dateStr = date.toLocaleDateString("en-US", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      }
      const item = document.createElement("div");
      item.className = "history-item" + (docSnap.id === feedbackId ? " active" : "");
      item.innerHTML = `
        <span class="history-date">${dateStr}</span>
        <a href="/pages/ai-feedback/?id=${docSnap.id}" class="history-link">View Feedback →</a>
      `;
      historyList.appendChild(item);
    });
  } catch (err) {
    console.error("Error loading history:", err);
    historyList.innerHTML = "<p>Failed to load history.</p>";
  }
}
