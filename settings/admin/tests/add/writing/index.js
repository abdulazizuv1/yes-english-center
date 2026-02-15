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
  addDoc,
  setDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "/config.js";


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let nextTestNumber = 1;

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
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          alert("❌ User data not found. Access denied.");
          window.location.href = "/";
          return;
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        if (userRole !== "admin") {
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

// Get the next test number
async function getNextTestNumber() {
  try {
    const testsRef = collection(db, "writingTests");
    const testsSnapshot = await getDocs(testsRef);

    let maxNumber = 0;
    testsSnapshot.forEach((docSnapshot) => {
      // Проверяем ID документа
      const docId = docSnapshot.id;
      if (docId && docId.startsWith("test-")) {
        const number = parseInt(docId.replace("test-", ""));
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
      // Также проверяем testId как запасной вариант
      const testId = docSnapshot.data().testId;
      if (testId && testId.startsWith("test-")) {
        const number = parseInt(testId.replace("test-", ""));
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    nextTestNumber = maxNumber + 1;
    document.getElementById(
      "testNumber"
    ).textContent = `This will be Test ${nextTestNumber}`;

    return nextTestNumber;
  } catch (error) {
    console.error("Error getting next test number:", error);
    return 1;
  }
}

// Handle image preview
function handleImagePreview(inputId) {
  const input = document.getElementById(inputId + "Image");
  const preview = document.getElementById(inputId + "Preview");
  const previewImg = document.getElementById(inputId + "PreviewImg");
  const uploadPlaceholder = document.querySelector(
    `#${inputId}FileArea .upload-placeholder`
  );

  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("❌ File size must be less than 10MB");
        input.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        preview.style.display = "block";
        uploadPlaceholder.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  });
}

// Remove image
window.removeImage = function (taskId) {
  const input = document.getElementById(taskId + "Image");
  const preview = document.getElementById(taskId + "Preview");
  const uploadPlaceholder = document.querySelector(
    `#${taskId}FileArea .upload-placeholder`
  );

  input.value = "";
  preview.style.display = "none";
  uploadPlaceholder.style.display = "block";
};

// Upload image to Firebase Storage
async function uploadImage(file, testNumber) {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storagePath = `writing-tasks/test-${testNumber}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");
  const loader = document.getElementById("loader");

  // Disable submit button and show loader
  submitBtn.disabled = true;
  submitText.textContent = "Adding test...";
  loader.style.display = "inline-block";

  try {
    // Get form values
    const testTitle = document.getElementById("testTitle").value.trim();
    const task1Question = document.getElementById("task1Question").value.trim();
    const task2Question = document.getElementById("task2Question").value.trim();
    const task1ImageFile = document.getElementById("task1Image").files[0];

    if (!task1ImageFile) {
      throw new Error("Please select an image for Task 1");
    }

    // Upload image
    const imageUrl = await uploadImage(task1ImageFile, nextTestNumber);

    // Prepare test data
    const testData = {
      testId: `test-${nextTestNumber}`,
      title: testTitle,
      task1: {
        question: task1Question,
        imageUrl: imageUrl,
      },
      task2: {
        question: task2Question,
      },
      createdAt: new Date().toISOString(),
      createdBy: currentUser.email,
    };


    // Save to Firestore
    // Save to Firestore with specific document ID
    const docId = `test-${nextTestNumber}`;
    await setDoc(doc(db, "writingTests", docId), testData);

    // Show success message
    const successModal = document.getElementById("successModal");
    const successMessage = document.getElementById("successMessage");
    successMessage.textContent = `Test ${nextTestNumber} has been added successfully!`;
    successModal.style.display = "flex";

    // Update next test number
    nextTestNumber++;
  } catch (error) {
    console.error("❌ Error adding test:", error);
    alert(`❌ Error adding test: ${error.message}`);
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitText.textContent = "Add Writing Test";
    loader.style.display = "none";
  }
}

// Reset form for adding another test
window.resetForm = function () {
  // Hide success modal
  document.getElementById("successModal").style.display = "none";

  // Reset form
  document.getElementById("writingTestForm").reset();

  // Reset image previews
  removeImage("task1");

  // Update test number display
  getNextTestNumber();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {

  // Check admin access
  await checkAdminAccess();

  // Get next test number
  await getNextTestNumber();

  // Setup image preview handlers
  handleImagePreview("task1");

  // Setup form submission
  const form = document.getElementById("writingTestForm");
  form.addEventListener("submit", handleFormSubmit);

});
