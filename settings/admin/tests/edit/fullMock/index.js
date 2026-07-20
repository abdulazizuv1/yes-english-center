import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let allTests = [];
let testToDelete = null;

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

        const userData = userDoc.data();
        if (userData.role !== "admin") {
          alert("🚫 Access denied. Admin privileges required.");
          window.location.href = "/";
          return;
        }

        currentUser = user;
        resolve({ user, userData });
      } catch (error) {
        console.error("❌ Error checking user role:", error);
        alert("❌ Error verifying admin access. Please try again.");
        window.location.href = "/";
      }
    });
  });
}

async function loadTests() {
  try {
    const testsRef = collection(db, "fullmockTests");
    const testsSnapshot = await getDocs(testsRef);

    allTests = [];
    testsSnapshot.forEach((docSnapshot) => {
      allTests.push({ id: docSnapshot.id, ...docSnapshot.data() });
    });

    allTests.sort((a, b) => {
      const numA = parseInt(a.id.replace("test-", ""));
      const numB = parseInt(b.id.replace("test-", ""));
      return numA - numB;
    });

    document.getElementById("loadingContainer").style.display = "none";

    if (allTests.length === 0) {
      document.getElementById("emptyState").style.display = "block";
    } else {
      document.getElementById("testsContainer").style.display = "block";
      displayTests();
    }

    document.getElementById("totalTests").textContent = allTests.length;
  } catch (error) {
    console.error("❌ Error loading full mock tests:", error);
    document.getElementById("loadingContainer").innerHTML = `
      <div style="color: #f44336;">
        <h3>❌ Error loading tests</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
  }
}

function displayTests() {
  const container = document.getElementById("testsContainer");

  container.innerHTML = allTests.map(test => {
    const testNumber = test.id.replace("test-", "");
    const createdDate = test.createdAt ? new Date(test.createdAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    }) : 'Unknown date';
    const hasPIN = !!test.accessPin;

    return `
      <div class="test-card" data-test-id="${test.id}">
        <div class="test-card-header">
          <div class="test-info">
            <h3>📋 Full Mock Test ${testNumber}</h3>
            <div class="test-stats">
              <div class="stat-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                150 min
              </div>
              ${hasPIN ? `<div class="stat-badge pin-badge">🔒 PIN: ${test.accessPin}</div>` : '<div class="stat-badge" style="background:#f0fdf4;color:#16a34a;">🔓 No PIN</div>'}
            </div>
            <p class="test-date">Created: ${createdDate}</p>
          </div>
          <div class="test-actions">
            <button class="btn-edit-pin" style="background:#eff6ff;color:#1d4ed8;" onclick="location.href='editor/?testId=${test.id}'">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit Test
            </button>
            <button class="btn-edit-pin" onclick="openPinModal('${test.id}', '${testNumber}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              ${hasPIN ? 'Edit PIN' : 'Set PIN'}
            </button>
            <button class="btn-delete" onclick="confirmDelete('${test.id}', '${testNumber}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

let pinEditTestId = null;

window.openPinModal = function(testId, testNumber) {
  pinEditTestId = testId;
  const test = allTests.find(t => t.id === testId);
  document.getElementById('pinTestName').textContent = `Full Mock Test ${testNumber}`;
  document.getElementById('pinModalInput').value = test?.accessPin || '';
  const statusEl = document.getElementById('pinModalStatus');
  if (test?.accessPin) {
    statusEl.textContent = `Current PIN: ${test.accessPin}`;
    statusEl.style.color = '#d97706';
  } else {
    statusEl.textContent = 'No PIN set — test is publicly accessible';
    statusEl.style.color = '#9ca3af';
  }
  document.getElementById('pinModal').style.display = 'flex';
};

window.closePinModal = function() {
  document.getElementById('pinModal').style.display = 'none';
  pinEditTestId = null;
};

window.confirmSavePin = async function() {
  if (!pinEditTestId) return;
  const pin = document.getElementById('pinModalInput').value.trim();
  if (pin && !/^\d{6}$/.test(pin)) {
    alert('PIN must be exactly 6 digits (numbers only)');
    return;
  }
  const confirmBtn = document.getElementById('confirmPinBtn');
  const pinSaveText = document.getElementById('pinSaveText');
  const pinLoader = document.getElementById('pinLoader');
  confirmBtn.disabled = true;
  pinSaveText.textContent = 'Saving...';
  pinLoader.style.display = 'inline-block';
  try {
    if (pin) {
      await updateDoc(doc(db, "fullmockTests", pinEditTestId), { accessPin: pin });
      const idx = allTests.findIndex(t => t.id === pinEditTestId);
      if (idx !== -1) allTests[idx].accessPin = pin;
    } else {
      await updateDoc(doc(db, "fullmockTests", pinEditTestId), { accessPin: deleteField() });
      const idx = allTests.findIndex(t => t.id === pinEditTestId);
      if (idx !== -1) delete allTests[idx].accessPin;
    }
    closePinModal();
    displayTests();
    showNotification(pin ? '✅ PIN saved successfully!' : '✅ PIN removed successfully!', 'success');
  } catch (error) {
    alert('❌ Error saving PIN: ' + error.message);
  } finally {
    confirmBtn.disabled = false;
    pinSaveText.textContent = 'Save PIN';
    pinLoader.style.display = 'none';
  }
};

window.confirmDelete = function(testId, testNumber) {
  testToDelete = testId;
  document.getElementById("deleteTestName").textContent = `Full Mock Test ${testNumber}`;
  document.getElementById("deleteModal").style.display = "flex";
};

window.closeDeleteModal = function() {
  document.getElementById("deleteModal").style.display = "none";
  testToDelete = null;
};

window.deleteTest = async function() {
  if (!testToDelete) return;

  const confirmBtn = document.getElementById("confirmDeleteBtn");
  const deleteText = document.getElementById("deleteText");
  const loader = document.getElementById("deleteLoader");

  confirmBtn.disabled = true;
  deleteText.textContent = "Deleting...";
  loader.style.display = "inline-block";

  try {
    await deleteDoc(doc(db, "fullmockTests", testToDelete));
    allTests = allTests.filter(test => test.id !== testToDelete);
    closeDeleteModal();

    if (allTests.length === 0) {
      document.getElementById("testsContainer").style.display = "none";
      document.getElementById("emptyState").style.display = "block";
    } else {
      displayTests();
    }

    document.getElementById("totalTests").textContent = allTests.length;
    showNotification("✅ Full mock test deleted successfully!", "success");
  } catch (error) {
    console.error("❌ Error deleting test:", error);
    alert(`❌ Error deleting test: ${error.message}`);
  } finally {
    confirmBtn.disabled = false;
    deleteText.textContent = "Delete Test";
    loader.style.display = "none";
  }
};


function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === "success" ? "#4CAF50" : "#f44336"};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideInRight 0.3s ease;
    font-weight: 500;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", async () => {
  await checkAdminAccess();
  await loadTests();

  document.getElementById("confirmDeleteBtn").addEventListener("click", deleteTest);

  document.getElementById("deleteModal").addEventListener("click", (e) => {
    if (e.target.id === "deleteModal") closeDeleteModal();
  });

  document.getElementById("pinModal").addEventListener("click", (e) => {
    if (e.target.id === "pinModal") closePinModal();
  });
});
