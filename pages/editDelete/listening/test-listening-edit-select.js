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
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let allTests = [];
let testToDelete = null;

// Check if user is admin
async function checkAdminAccess() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        console.log("❌ User not authenticated");
        alert("🔒 Please login first to access this page");
        window.location.href = "/";
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.log("❌ User document not found");
          alert("❌ User data not found. Access denied.");
          window.location.href = "/";
          return;
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        if (userRole !== "admin") {
          console.log("❌ User is not admin. Role:", userRole);
          alert("🚫 Access denied. Admin privileges required.");
          window.location.href = "/";
          return;
        }

        console.log("✅ Admin access granted for:", user.email);
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

// Load all tests from Firebase
async function loadTests() {
  try {
    console.log("🎧 Loading listening tests from Firebase...");
    
    const testsRef = collection(db, "listeningTests");
    const testsSnapshot = await getDocs(testsRef);
    
    allTests = [];
    testsSnapshot.forEach((docSnapshot) => {
      allTests.push({
        id: docSnapshot.id,
        ...docSnapshot.data()
      });
    });

    // Sort by test number
    allTests.sort((a, b) => {
      const numA = parseInt(a.id.replace("test-", ""));
      const numB = parseInt(b.id.replace("test-", ""));
      return numA - numB;
    });

    console.log(`✅ Loaded ${allTests.length} listening tests`);
    
    // Hide loading, show content
    document.getElementById("loadingContainer").style.display = "none";
    
    if (allTests.length === 0) {
      document.getElementById("emptyState").style.display = "block";
    } else {
      document.getElementById("testsContainer").style.display = "block";
      displayTests();
    }
    
    // Update stats
    document.getElementById("totalTests").textContent = allTests.length;
    
  } catch (error) {
    console.error("❌ Error loading listening tests:", error);
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

// Display tests in the list
function displayTests() {
  const container = document.getElementById("testsContainer");
  
  container.innerHTML = allTests.map(test => {
    const testNumber = test.id.replace("test-", "");
    const sectionCount = test.sections?.length || 0;
    const totalQuestions = test.sections?.reduce((sum, s) => sum + (s.questions?.length || 0), 0) || 0;
    const createdDate = test.createdAt ? new Date(test.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : 'Unknown date';
    
    return `
      <div class="test-card" data-test-id="${test.id}">
        <div class="test-card-header">
          <div class="test-info">
            <h3>🎧 Listening Test ${testNumber}</h3>
            <div class="test-stats">
              <div class="stat-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
                ${sectionCount} Section${sectionCount !== 1 ? 's' : ''}
              </div>
              <div class="stat-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${totalQuestions} Questions
              </div>
            </div>
            <p class="test-date">Created: ${createdDate}</p>
          </div>
          <div class="test-actions">
            <button class="btn-edit" onclick="editTest('${test.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit
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

// Edit test - redirect to edit page
window.editTest = function(testId) {
  console.log(`✏️ Editing listening test: ${testId}`);
  // Redirect to edit page with test ID as parameter
  window.location.href = `test-edit.html?testId=${testId}`;
};

// Confirm delete - show modal
window.confirmDelete = function(testId, testNumber) {
  testToDelete = testId;
  document.getElementById("deleteTestName").textContent = `Listening Test ${testNumber}`;
  document.getElementById("deleteModal").style.display = "flex";
};

// Close delete modal
window.closeDeleteModal = function() {
  document.getElementById("deleteModal").style.display = "none";
  testToDelete = null;
};

// Delete test
window.deleteTest = async function() {
  if (!testToDelete) return;

  const confirmBtn = document.getElementById("confirmDeleteBtn");
  const deleteText = document.getElementById("deleteText");
  const loader = document.getElementById("deleteLoader");

  // Disable button and show loader
  confirmBtn.disabled = true;
  deleteText.textContent = "Deleting...";
  loader.style.display = "inline-block";

  try {
    console.log(`🗑️ Deleting listening test: ${testToDelete}`);
    
    // Delete from Firebase
    await deleteDoc(doc(db, "listeningTests", testToDelete));
    
    console.log("✅ Listening test deleted successfully");
    
    // Remove from local array
    allTests = allTests.filter(test => test.id !== testToDelete);
    
    // Close modal
    closeDeleteModal();
    
    // Update display
    if (allTests.length === 0) {
      document.getElementById("testsContainer").style.display = "none";
      document.getElementById("emptyState").style.display = "block";
    } else {
      displayTests();
    }
    
    // Update stats
    document.getElementById("totalTests").textContent = allTests.length;
    
    // Show success message
    showNotification("✅ Listening test deleted successfully!", "success");
    
  } catch (error) {
    console.error("❌ Error deleting listening test:", error);
    alert(`❌ Error deleting test: ${error.message}`);
  } finally {
    // Reset button
    confirmBtn.disabled = false;
    deleteText.textContent = "Delete Test";
    loader.style.display = "none";
  }
};

// Show notification
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

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Connect delete button in modal
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎧 Listening Test Edit/Delete page loaded");

  // Check admin access
  await checkAdminAccess();

  // Load tests
  await loadTests();

  // Connect modal delete button
  document.getElementById("confirmDeleteBtn").addEventListener("click", deleteTest);

  // Close modal on outside click
  document.getElementById("deleteModal").addEventListener("click", (e) => {
    if (e.target.id === "deleteModal") {
      closeDeleteModal();
    }
  });

  console.log("✅ Listening page initialized successfully");
});

