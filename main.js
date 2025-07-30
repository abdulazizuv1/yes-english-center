import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

async function ensureCreatedAt(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!data.createdAt) {
      await updateDoc(doc(db, collectionName, docSnap.id), {
        createdAt: new Date(),
      });
    }
  }
}

function initGroups() {
  const wrapper = document.querySelector("#groups .swiper-wrapper");
  const loader = document.getElementById("loader");
  if (!wrapper || !loader) return;

  (async () => {
    try {
      await ensureCreatedAt("groups");

      const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const imgElements = [];

      snapshot.forEach((doc) => {
        const group = doc.data();

        const slide = document.createElement("div");
        slide.className = "swiper-slide swiper-slide1";

        slide.innerHTML = `
          <img src="${group.photoURL}" alt="${group.name}" />
          <h3>${group.name}</h3>
        `;

        const img = slide.querySelector("img");
        imgElements.push(img);

        wrapper.appendChild(slide);
      });

      let loaded = 0;
      const checkAndHideLoader = () => {
        loaded++;
        if (loaded === imgElements.length) {
          loader.remove();
        }
      };

      if (imgElements.length === 0) {
        loader.remove();
      } else {
        imgElements.forEach((img) => {
          if (img.complete && img.naturalHeight !== 0) {
            checkAndHideLoader();
          } else {
            img.addEventListener("load", checkAndHideLoader);
            img.addEventListener("error", checkAndHideLoader);
          }
        });
      }
    } catch (err) {
      console.error("❌ Ошибка при загрузке групп:", err);
      loader.textContent = "❌ Ошибка загрузки данных!";
    }
  })();
}

function initResults() {
  const resultsWrapper = document.querySelector("#results .swiper-wrapper");
  if (!resultsWrapper) return;

  (async () => {
    await ensureCreatedAt("results");

    const q = query(collection(db, "results"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => {
      const result = doc.data();

      const slide = document.createElement("div");
      slide.className = "swiper-slide swiper-slide3";

      slide.innerHTML = `
      <img src="${result.photoURL}" alt="${result.name}" />
      <h3>${result.name}</h3>
      <p>Band: <a>${result.band}</a></p>
      <p class="lng_results_group">Group: ${result.group}</p>
    `;

      resultsWrapper.appendChild(slide);
    });
  })();
}

function initFeedbacks() {
  const feedbacksWrapper = document.querySelector("#feedbacks .swiper-wrapper");
  if (!feedbacksWrapper) return;

  (async () => {
    const q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach((doc) => {
      const feedback = doc.data();

      const slide = document.createElement("div");
      slide.className = "swiper-slide swiper-slide2";

      slide.innerHTML = `
        <div class="feedback_info">
          <img src="./image/no_user.webp" alt=""> 
          <div class="feedback_info_detail">
            <h3>${feedback.name}</h3> 
            <p class="lng_feedbacks_group">Group: ${feedback.group}</p>
          </div>
        </div>
        <div class="text-container">
          <p class="text-content lng_feedbacks">${feedback.feedback}</p>
        </div>
      `;

      feedbacksWrapper.appendChild(slide);
    });
  })();
}

function createSwiper(selector, options) {
  if (!document.querySelector(selector)) return;
  return new Swiper(selector, options);
}

function initSwipers() {
  createSwiper(".mySwiper", {
    slidesPerView: 3,
    spaceBetween: 30,
    freeMode: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    breakpoints: {
      0: {
        slidesPerView: 1,
        spaceBetween: 20,
      },
      769: {
        slidesPerView: 2,
        spaceBetween: 25,
      },
      1024: {
        slidesPerView: 3,
        spaceBetween: 30,
      },
    },
  });

  createSwiper(".mySwiper3", {
    slidesPerView: 3,
    spaceBetween: 30,
    freeMode: true,
    autoplay: {
      delay: 6000,
      disableOnInteraction: false,
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    breakpoints: {
      0: {
        slidesPerView: 1,
        spaceBetween: 20,
      },
      769: {
        slidesPerView: 2,
        spaceBetween: 25,
      },
      1024: {
        slidesPerView: 3,
        spaceBetween: 30,
      },
    },
  });

  createSwiper(".mySwiper2", {
    slidesPerView: 2,
    spaceBetween: 30,
    freeMode: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    breakpoints: {
      0: {
        slidesPerView: 1,
        spaceBetween: 20,
      },
      769: {
        slidesPerView: 2,
        spaceBetween: 30,
      },
    },
  });
}

function initNavLinks() {
  const navLinks = document.querySelectorAll(".nav_info ul li a");
  if (!navLinks || navLinks.length === 0) return;

  function setActiveLinkOnClick() {
    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        // Close mobile menu when link is clicked
        const nav = document.querySelector("nav");
        if (nav.classList.contains("active")) {
          nav.classList.remove("active");
        }
        
        navLinks.forEach((el) => el.classList.remove("active"));
        link.classList.add("active");
      });
    });
  }

  function setDefaultActiveOnLoad() {
    const hash = window.location.hash;
    if (!hash || hash === "#home") {
      const homeLink = document.querySelector('.nav_info ul li a[href="#home"]');
      if (homeLink) {
        homeLink.classList.add("active");
      }
    }
  }

  setActiveLinkOnClick();
  setDefaultActiveOnLoad();
}

function initLang() {
  const select = document.querySelector("select");
  if (!select) return;
  const allLang = ["en", "ru", "uz"];

  function changeURLlang() {
    let lang = select.value;
    location.href = window.location.pathname + "#" + lang;
    location.reload();
    console.log(lang);
  }

  function changeLang() {
    let hash = window.location.hash;
    hash = hash.substr(1);
    if (!allLang.includes(hash)) {
      location.href = window.location.pathname + "#en";
      location.reload();
      return;
    }
    select.value = hash;
    
    // Check if langArr is defined before using it
    if (typeof langArr !== 'undefined') {
      for (let key in langArr) {
        let elements = document.querySelectorAll(`.${key}`);
        if (elements) {
          elements.forEach((elem) => {
            elem.innerHTML = langArr[key][hash];
          });
        }
      }
    }
  }

  select.addEventListener("change", changeURLlang);
  changeLang();
}

function initLoginPanel() {
  const closeBtn = document.querySelector(".close_btn");
  const loginPanel = document.querySelector(".login_panel");
  if (!closeBtn || !loginPanel) return;

  closeBtn.addEventListener("click", () => {
    loginPanel.style.display = "none";
  });

  // Close login panel when clicking outside
  loginPanel.addEventListener("click", (e) => {
    if (e.target === loginPanel) {
      loginPanel.style.display = "none";
    }
  });
}

function initMockRedirect() {
  const mockLink = document.querySelector("#mockLink");
  if (!mockLink) return;

  mockLink.addEventListener("click", (e) => {
    e.preventDefault();

    const user = auth.currentUser;

    if (user) {
      window.location.href = "pages/mock.html";
    } else {
      if (typeof toggleLogin === "function") {
        toggleLogin();
      } else {
        console.error("toggleLogin не определён!");
      }
    }
  });
}

// Improved mobile menu toggle function
function toggleMenu() {
    const nav = document.querySelector("nav");
    const navRight = document.querySelector(".nav_right");
    
    nav.classList.toggle("active");
    
    if (nav.classList.contains("active")) {
        // Показать элементы в мобильном меню
        navRight.style.display = "flex";
    } else {
        // Скрыть элементы когда меню закрыто
        setTimeout(() => {
            navRight.style.display = "none";
        }, 300);
    }
}

function toggleLogin() {
  const loginPanel = document.querySelector(".login_panel");
  if (loginPanel) {
    loginPanel.style.display = "flex";
    
    // Focus on email input
    setTimeout(() => {
      const emailInput = document.querySelector("#login_email");
      if (emailInput) emailInput.focus();
    }, 100);
  }
}

// Close mobile menu when clicking outside
document.addEventListener("click", (e) => {
  const nav = document.querySelector("nav");
  const toggle = document.querySelector(".toggle");
  const navInfo = document.querySelector(".nav_info");
  const navRight = document.querySelector(".nav_right");
  
  if (nav && nav.classList.contains("active")) {
    if (!nav.contains(e.target) && !toggle.contains(e.target)) {
      nav.classList.remove("active");
      if (navInfo) navInfo.style.display = "none";
      if (navRight) navRight.style.display = "none";
    }
  }
});

// Close mobile menu on window resize
window.addEventListener("resize", () => {
  if (window.innerWidth > 768) {
    const nav = document.querySelector("nav");
    const navInfo = document.querySelector(".nav_info");
    const navRight = document.querySelector(".nav_right");
    
    if (nav && nav.classList.contains("active")) {
      nav.classList.remove("active");
      if (navInfo) navInfo.style.display = "";
      if (navRight) navRight.style.display = "";
    }
  }
});

// Make functions globally available
window.toggleMenu = toggleMenu;
window.toggleLogin = toggleLogin;

document.addEventListener("DOMContentLoaded", () => {
  initGroups();
  initResults();
  initFeedbacks();
  initSwipers();
  initNavLinks();
  initLang();
  initLoginPanel();
  initMockRedirect();
});

// Firebase Authentication
onAuthStateChanged(auth, async (user) => {
  const loginBtn = document.querySelector("#loginBtn");
  const logoutBtn = document.querySelector("#logoutBtn");
  const settingsLink = document.querySelector(".settings-link");

  if (!loginBtn || !logoutBtn) return;

  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";
    logoutBtn.textContent = "Logout";

    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();
      console.log("Роль пользователя:", userData.role);

      if (userData.role === "admin") {
        if (settingsLink) {
          console.log("Показываем settings");
          settingsLink.style.display = "block";
        }
      } else {
        if (settingsLink) {
          console.log("Скрываем settings");
          settingsLink.style.display = "none";
        }
      }
    } else {
      console.log("Документа нет, создаём student");
      await setDoc(userDocRef, {
        name: "No name",
        email: user.email,
        role: "student",
      });

      if (settingsLink) settingsLink.style.display = "none";
    }
  } else {
    loginBtn.style.display = "block";
    logoutBtn.style.display = "none";
    loginBtn.textContent = "Login";
    if (settingsLink) settingsLink.style.display = "none";
  }
});

// Login function
window.loginUser = async function () {
  const email = document.querySelector("#login_email").value.trim();
  const password = document.querySelector("#login_password").value.trim();
  const loginBtn = document.querySelector(".login_submit");

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  // Show loading state
  const originalText = loginBtn.textContent;
  loginBtn.textContent = "Logging in...";
  loginBtn.disabled = true;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const loginPanel = document.querySelector(".login_panel");
    
    if (loginPanel) {
      loginPanel.style.display = "none";
      document.querySelector("#login_email").value = "";
      document.querySelector("#login_password").value = "";
    }

    // Save to Firestore if document doesn't exist
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      await setDoc(userDocRef, {
        name: "No name",
        email: userCredential.user.email,
        role: "student",
      });
    }
  } catch (err) {
    console.error("Login error:", err);
    alert("Login failed: " + err.message);
  } finally {
    // Reset button state
    loginBtn.textContent = originalText;
    loginBtn.disabled = false;
  }
};

// Logout function
window.logoutUser = async function () {
  try {
    await signOut(auth);
    
    // Clear form fields
    const emailInput = document.querySelector("#login_email");
    const passwordInput = document.querySelector("#login_password");
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
    
    console.log("User logged out successfully");
  } catch (err) {
    console.error("Logout error:", err);
    alert("Logout failed: " + err.message);
  }
};