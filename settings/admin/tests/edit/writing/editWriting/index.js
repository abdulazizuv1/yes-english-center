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
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let currentTest = null;
let testId = null;

// ═══════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════
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
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          alert("❌ User data not found. Access denied.");
          window.location.href = "/";
          return;
        }
        if (userDoc.data().role !== "admin") {
          alert("🚫 Access denied. Admin privileges required.");
          window.location.href = "/";
          return;
        }
        currentUser = user;
        resolve({ user, userData: userDoc.data() });
      } catch (error) {
        console.error("❌ Error checking user role:", error);
        alert("❌ Error verifying admin access.");
        window.location.href = "/";
      }
    });
  });
}

// ═══════════════════════════════════════════
//  GET TEST ID FROM URL
// ═══════════════════════════════════════════
function getTestIdFromUrl() {
  return new URLSearchParams(window.location.search).get("testId");
}

// ═══════════════════════════════════════════
//  LOAD TEST
// ═══════════════════════════════════════════
async function loadTest() {
  try {
    const testDocRef = doc(db, "writingTests", testId);
    const testDoc = await getDoc(testDocRef);

    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }

    const rawData = testDoc.data();

    // Handle nested structure (some tests store data under test-N key)
    if (rawData[testId]) {
      currentTest = rawData[testId];
    } else {
      currentTest = rawData;
    }

    // Set test info
    const testNumber = testId.replace("test-", "");
    document.getElementById("testTitle").textContent = `Writing Test ${testNumber}`;
    document.getElementById("testId").value = testId;
    document.getElementById("testNumber").value = testNumber;
    document.getElementById("testTitleInput").value = currentTest.title || "";

    // Load Task 1
    document.getElementById("task1Question").value = currentTest.task1?.question || "";
    document.getElementById("task1ImageUrl").value = currentTest.task1?.imageUrl || "";

    // Preview image if url exists
    if (currentTest.task1?.imageUrl) {
      showImagePreview(currentTest.task1.imageUrl);
    }

    // Load Task 2
    document.getElementById("task2Question").value = currentTest.task2?.question || "";

    // Hide loading, show content
    document.getElementById("loadingContainer").style.display = "none";
    document.getElementById("mainContent").style.display = "block";

    console.log("✅ Writing test loaded:", testId);
  } catch (error) {
    console.error("❌ Error loading test:", error);
    document.getElementById("loadingContainer").innerHTML = `
      <div style="color: #f44336; text-align: center;">
        <h3>❌ Error loading test</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════
//  IMAGE PREVIEW
// ═══════════════════════════════════════════
function showImagePreview(url) {
  const container = document.getElementById("task1ImagePreview");
  if (!url) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 16px; padding: 16px; text-align: center;">
      <img src="${url}" alt="Task 1 Image" style="max-width: 100%; max-height: 300px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" 
        onerror="this.parentElement.innerHTML='<p style=\\'color:#ef4444;\\'>❌ Image failed to load</p>'">
      <p style="margin-top: 10px; font-size: 0.85rem; color: #0369a1;">Task 1 Image Preview</p>
    </div>`;
}

window.previewImage = function () {
  const url = document.getElementById("task1ImageUrl").value.trim();
  showImagePreview(url);
};

// ═══════════════════════════════════════════
//  IMAGE UPLOAD
// ═══════════════════════════════════════════
window.openImageUpload = function () {
  document.getElementById("imageUploadModal").style.display = "flex";
  document.getElementById("uploadProgress").style.display = "none";
  document.getElementById("confirmUploadBtn").disabled = true;
  document.getElementById("imageFileInput").value = "";
};

window.closeImageUploadModal = function () {
  document.getElementById("imageUploadModal").style.display = "none";
};

window.uploadImageFile = async function () {
  const fileInput = document.getElementById("imageFileInput");
  const file = fileInput.files[0];
  if (!file) return;

  const progressContainer = document.getElementById("uploadProgress");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const uploadBtn = document.getElementById("confirmUploadBtn");

  progressContainer.style.display = "block";
  uploadBtn.disabled = true;

  try {
    const storagePath = `writing-images/${testId}/task1/${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        progressFill.style.width = pct + "%";
        progressText.textContent = `Uploading... ${pct}%`;
      },
      (error) => {
        console.error("Upload error:", error);
        alert("❌ Upload failed: " + error.message);
        uploadBtn.disabled = false;
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        document.getElementById("task1ImageUrl").value = downloadURL;
        showImagePreview(downloadURL);
        closeImageUploadModal();
        showNotification("✅ Image uploaded successfully!");
      }
    );
  } catch (error) {
    console.error("Upload error:", error);
    alert("❌ Upload failed: " + error.message);
    uploadBtn.disabled = false;
  }
};

// ═══════════════════════════════════════════
//  SAVE TEST
// ═══════════════════════════════════════════
window.saveTest = function () {
  document.getElementById("saveModal").style.display = "flex";
};

window.closeSaveModal = function () {
  document.getElementById("saveModal").style.display = "none";
};

async function confirmSave() {
  const saveBtn = document.getElementById("confirmSaveBtn");
  const saveText = document.getElementById("saveText");
  const saveLoader = document.getElementById("saveLoader");

  saveBtn.disabled = true;
  saveText.textContent = "Saving...";
  saveLoader.style.display = "inline-block";

  try {
    // Read current values from form
    const title = document.getElementById("testTitleInput").value.trim();
    const task1Question = document.getElementById("task1Question").value.trim();
    const task1ImageUrl = document.getElementById("task1ImageUrl").value.trim();
    const task2Question = document.getElementById("task2Question").value.trim();

    // Build update data — preserve original structure
    const updateData = {
      title: title,
      task1: {
        question: task1Question,
        imageUrl: task1ImageUrl || null,
      },
      task2: {
        question: task2Question,
      },
      updatedAt: new Date().toISOString(),
    };

    // If original data was nested under testId key, save it accordingly
    const testDocRef = doc(db, "writingTests", testId);
    const rawDoc = await getDoc(testDocRef);
    const rawData = rawDoc.data();

    if (rawData[testId]) {
      // Nested structure: update under testId key
      const nestedUpdate = {};
      nestedUpdate[`${testId}.title`] = title;
      nestedUpdate[`${testId}.task1`] = updateData.task1;
      nestedUpdate[`${testId}.task2`] = updateData.task2;
      nestedUpdate[`${testId}.updatedAt`] = updateData.updatedAt;
      await updateDoc(testDocRef, nestedUpdate);
    } else {
      // Flat structure
      await updateDoc(testDocRef, updateData);
    }

    closeSaveModal();
    showNotification("✅ Writing test saved successfully!");
    console.log("✅ Writing test saved:", testId);
  } catch (error) {
    console.error("❌ Save error:", error);
    alert("❌ Error saving test: " + error.message);
  } finally {
    saveBtn.disabled = false;
    saveText.textContent = "Save Changes";
    saveLoader.style.display = "none";
  }
}

// ═══════════════════════════════════════════
//  GO BACK
// ═══════════════════════════════════════════
window.goBack = function () {
  if (confirm("Are you sure you want to cancel?\n\nAll unsaved changes will be lost.")) {
    window.location.href = "/pages/dashboard/#/admin/tests/writing";
  }
};

// ═══════════════════════════════════════════
//  NOTIFICATION
// ═══════════════════════════════════════════
function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 15px 25px;
    background: ${type === "success" ? "#4CAF50" : "#f44336"};
    color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000; font-weight: 500; animation: slideInRight 0.3s ease;
    font-family: 'Montserrat', sans-serif;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// CSS animations
const animStyle = document.createElement("style");
animStyle.textContent = `
  @keyframes slideInRight { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
`;
document.head.appendChild(animStyle);

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  await checkAdminAccess();

  testId = getTestIdFromUrl();
  if (!testId) {
    document.getElementById("loadingContainer").innerHTML = `
      <div style="color: #f44336; text-align: center;">
        <h3>❌ No test ID provided</h3>
        <p>Please go back and select a test to edit.</p>
        <button onclick="window.location.href='/pages/dashboard/#/admin/tests/writing'" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Back to Tests
        </button>
      </div>`;
    return;
  }

  await loadTest();

  // Image file input handlers
  const fileInput = document.getElementById("imageFileInput");
  const uploadArea = document.getElementById("uploadArea");
  const uploadBtn = document.getElementById("confirmUploadBtn");

  if (uploadArea && fileInput) {
    uploadArea.addEventListener("click", () => fileInput.click());
    uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.style.borderColor = "#667eea"; });
    uploadArea.addEventListener("dragleave", () => { uploadArea.style.borderColor = ""; });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "";
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event("change"));
    });
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        uploadBtn.disabled = false;
        uploadArea.querySelector("p").textContent = `📎 ${fileInput.files[0].name}`;
      }
    });
  }

  // Modal handlers
  document.getElementById("confirmSaveBtn").addEventListener("click", confirmSave);
  document.getElementById("saveModal").addEventListener("click", (e) => { if (e.target.id === "saveModal") closeSaveModal(); });
  document.getElementById("imageUploadModal").addEventListener("click", (e) => { if (e.target.id === "imageUploadModal") closeImageUploadModal(); });
});
