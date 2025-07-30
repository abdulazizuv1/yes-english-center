import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import {
  ref as storageRef,
  getStorage,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBw36xP5tVYO2D0T-XFQQAGFA4wrJ8If8k",
  authDomain: "yes-english-center.firebaseapp.com",
  projectId: "yes-english-center",
  storageBucket: "yes-english-center.firebasestorage.app",
  messagingSenderId: "203211203853",
  appId: "1:203211203853:web:7d499925c3aa830eaefc44",
  measurementId: "G-4LHEBLG2KK",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

// Check authentication and admin role
async function checkAdminAccess() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      
      if (!user) {
        console.log("❌ User not authenticated, redirecting to home page");
        alert("🔒 Please login first to access admin panel");
        window.location.href = "/";
        return;
      }

      try {
        // Check user role in Firestore
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
        resolve({ user, userData });

      } catch (error) {
        console.error("❌ Error checking user role:", error);
        alert("❌ Error verifying admin access. Please try again.");
        window.location.href = "/";
      }
    });
  });
}

async function callCreateUser({ email, password, role }) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Пользователь не авторизован");

  const token = await currentUser.getIdToken();

  const response = await fetch(
    "https://us-central1-yes-english-center.cloudfunctions.net/createUser",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, password, role }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText);
  }

  return await response.json();
}

async function loadUsers() {
  try {
    const container = document.querySelector("#users-container");
    if (!container) return;
    
    container.innerHTML = ""; // Clear old list

    const usersList = document.createElement("ul");
    usersList.id = "users-list";
    container.appendChild(usersList);

    const usersSnapshot = await getDocs(collection(db, "users"));
    usersSnapshot.forEach((userDoc) => {
      const li = document.createElement("li");
      li.textContent = `${userDoc.data().email} (${userDoc.data().role})`;

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.style.marginLeft = "10px";
      delBtn.onclick = async () => {
        if (confirm("Are you sure you want to delete this user?")) {
          try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Вы не авторизованы");

            const token = await currentUser.getIdToken();

            const response = await fetch(
              "https://us-central1-yes-english-center.cloudfunctions.net/deleteUser",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ uid: userDoc.id }),
              }
            );

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(errText);
            }

            alert("User deleted!");
            await loadUsers();
          } catch (err) {
            console.error("Ошибка при удалении пользователя:", err);
            alert("❌ Ошибка: " + err.message);
          }
        }
      };

      li.appendChild(delBtn);
      usersList.appendChild(li);
    });
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

// Загрузка групп и отображение
async function loadGroups() {
  try {
    const container = document.querySelector("#group-preview");
    if (!container) return;

    container.innerHTML = "";

    const snapshot = await getDocs(collection(db, "groups"));
    snapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.gap = "10px";
      div.style.marginBottom = "10px";

      const img = document.createElement("img");
      img.src = data.photoURL;
      img.alt = data.name;
      img.style.width = "50px";
      img.style.height = "50px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "50%";

      const name = document.createElement("div");
      name.innerHTML = `<strong>${data.name}</strong><br>${
        data.position || ""
      }`;

      div.appendChild(img);
      div.appendChild(name);
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading teachers:", err);
  }
}

// Initialize admin panel after authentication check
async function initializeAdminPanel() {
  try {
    // Check admin access first
    const { user, userData } = await checkAdminAccess();
    if (!user) return; // Will redirect if not admin

    console.log("🔧 Initializing admin panel for:", user.email);

    // Setup form event listeners only after admin verification
    setupFormEventListeners();
    
    // Load initial data
    await loadUsers();
    await loadGroups();

    console.log("✅ Admin panel initialized successfully");

  } catch (error) {
    console.error("❌ Error initializing admin panel:", error);
    alert("Error loading admin panel. Please try again.");
    window.location.href = "/";
  }
}

// Setup all form event listeners
function setupFormEventListeners() {
  // Create user form
  const createUserForm = document.querySelector("#create-user-form");
  if (createUserForm) {
    createUserForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = createUserForm["new-email"].value.trim();
      const password = createUserForm["new-password"].value.trim();
      const role = createUserForm["new-role"].value;

      try {
        const result = await callCreateUser({ email, password, role });
        if (result?.uid) {
          alert("✅ Пользователь создан. UID: " + result.uid);
        } else {
          console.warn("Ответ от сервера не содержит UID:", result);
          alert("⚠️ Пользователь создан, но UID не получен.");
        }
        createUserForm.reset();
        await loadUsers(); // обновить список
      } catch (err) {
        console.error("Ошибка при создании пользователя:", err);
        alert("❌ Ошибка: " + err.message);
      }
    });
  }

  // Add group form
  const addGroupForm = document.querySelector("#add-group-form");
  if (addGroupForm) {
    addGroupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.querySelector("#group-name").value.trim();
      const fileInput = document.querySelector("#group-photo");
      const file = fileInput.files[0];

      if (!file || !name) {
        alert("Please provide a name and photo.");
        return;
      }

      const groupResult = document.querySelector("#group-result");
      groupResult.textContent = "Uploading...";

      try {
        const fileRef = storageRef(storage, `groups/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const photoURL = await getDownloadURL(fileRef);

        // Сохраняем в Firestore
        await addDoc(collection(db, "groups"), {
          name,
          photoURL,
          createdAt: Date.now(),
        });

        groupResult.textContent = "✅ Group added!";
        e.target.reset();
        await loadGroups();
      } catch (error) {
        console.error("Error adding group:", error);
        groupResult.textContent = "❌ Error: " + error.message;
      }
    });
  }

  // Add result form
  const addResultForm = document.querySelector("#add-result-form");
  if (addResultForm) {
    addResultForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.querySelector("#result-name").value.trim();
      const band = parseFloat(document.querySelector("#result-band").value);
      const group = document.querySelector("#result-group").value.trim();
      const file = document.querySelector("#result-photo").files[0];
      const message = document.querySelector("#result-message");

      if (!name || !group || !band || !file) {
        message.textContent = "❌ Заполните все поля!";
        return;
      }

      message.textContent = "Загрузка...";

      try {
        const fileRef = storageRef(storage, `results/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const photoURL = await getDownloadURL(fileRef);

        await addDoc(collection(db, "results"), {
          name,
          band,
          group,
          photoURL,
          createdAt: Date.now(),
        });

        message.textContent = "✅ Успешно добавлено!";
        e.target.reset();
      } catch (err) {
        console.error("Ошибка при добавлении:", err);
        message.textContent = "❌ Ошибка: " + err.message;
      }
    });
  }

  // Add feedback form
  const addFeedbackForm = document.querySelector("#add-feedback-form");
  if (addFeedbackForm) {
    addFeedbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.querySelector("#feedback-name").value.trim();
      const group = document.querySelector("#feedback-group").value.trim();
      const feedback = document.querySelector("#feedback-text").value.trim();
      const message = document.querySelector("#feedback-message");

      if (!name || !group || !feedback) {
        message.textContent = "❌ Заполните все поля!";
        return;
      }

      message.textContent = "Загрузка...";

      try {
        await addDoc(collection(db, "feedbacks"), {
          name,
          group,
          feedback,
          createdAt: Date.now(),
        });

        message.textContent = "✅ Успешно добавлено!";
        e.target.reset();
      } catch (err) {
        console.error("Ошибка при добавлении отзыва:", err);
        message.textContent = "❌ Ошибка: " + err.message;
      }
    });
  }
}

// Create users container if it doesn't exist
function createUsersContainer() {
  const existingContainer = document.querySelector("#users-container");
  if (!existingContainer) {
    const usersContainer = document.createElement("div");
    usersContainer.id = "users-container";
    document.body.appendChild(usersContainer);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 Admin panel page loaded");
  createUsersContainer();
  initializeAdminPanel();
});

// Optional: Add logout functionality
function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await auth.signOut();
        console.log("👋 Admin logged out");
        window.location.href = "/";
      } catch (error) {
        console.error("❌ Logout error:", error);
      }
    });
  }
}

// Setup logout button when page loads
window.addEventListener("load", () => {
  setupLogoutButton();
});