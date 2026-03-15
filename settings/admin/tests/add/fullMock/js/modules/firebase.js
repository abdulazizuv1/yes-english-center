// firebase.js - Encapsulates all interactions with Firebase
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
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Check if user is admin
export async function checkAdminAccess() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        alert("🔒 Please login first to access this page");
        window.location.href = "/";
        return reject("Not logged in");
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists() || userDoc.data().role !== "admin") {
          alert("🚫 Access denied. Admin privileges required.");
          window.location.href = "/";
          return reject("Not admin");
        }

        resolve(user);
      } catch (error) {
        console.error("❌ Error checking user role:", error);
        alert("❌ Error verifying admin access.");
        window.location.href = "/";
        reject(error);
      }
    });
  });
}

// Get the next Full Mock Test number
export async function getNextFullMockTestNumber() {
  try {
    const testsRef = collection(db, "fullMockTests");
    const testsSnapshot = await getDocs(testsRef);

    let maxNumber = 0;
    testsSnapshot.forEach((docSnapshot) => {
      const docId = docSnapshot.id;
      if (docId && docId.startsWith("full-mock-test-")) {
        const number = parseInt(docId.replace("full-mock-test-", ""));
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    return maxNumber + 1;
  } catch (error) {
    console.error("Error getting next mock test number:", error);
    return 1;
  }
}

// Upload file helper
export async function uploadFile(file, path) {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error(`❌ Error uploading to ${path}:`, error);
    throw error;
  }
}

// Save Full Mock Test
export async function saveFullMockTest(testData, testId) {
    try {
        const testRef = doc(db, "fullMockTests", testId);
        await setDoc(testRef, testData);
        return true;
    } catch(err) {
        console.error("Failed to save full mock test details", err);
        throw err;
    }
}
