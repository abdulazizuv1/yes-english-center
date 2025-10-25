import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { firebaseConfig } from "./config.js";
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Make auth available globally for glass-effects.js
window.auth = auth;

// Fallback UI updater to ensure navbar reflects auth state immediately
function applyAuthUIFallback(user) {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

  const isLoggedIn = !!user;

  if (loginBtn) {
    loginBtn.style.display = isLoggedIn ? 'none' : 'block';
    if (!isLoggedIn) loginBtn.textContent = 'Login';
  }
  if (logoutBtn) {
    logoutBtn.style.display = isLoggedIn ? 'block' : 'none';
    if (isLoggedIn) logoutBtn.textContent = 'Logout';
  }
  if (mobileLoginBtn) {
    mobileLoginBtn.style.display = isLoggedIn ? 'none' : 'block';
    if (!isLoggedIn) mobileLoginBtn.textContent = 'Login';
  }
  if (mobileLogoutBtn) {
    mobileLogoutBtn.style.display = isLoggedIn ? 'block' : 'none';
    if (isLoggedIn) mobileLogoutBtn.textContent = 'Logout';
  }
}

// Cache for Firebase data to avoid repeated calls
const dataCache = {
  groups: null,
  results: null,
  feedbacks: null
};

// Optimized loader management
function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 500);
  }
}

// Show initial content immediately, load data progressively
function showInitialContent() {
  // Hide loader after a short delay to show immediate response
  setTimeout(hideLoader, 800);
  
  // Initialize swipers with empty content first
  initSwipers();
  
  // Load data progressively in background
  loadAllData();
}

// Load all Firebase data in parallel
async function loadAllData() {
  try {
    // Run all Firebase calls in parallel instead of sequentially
    const [groupsData, resultsData, feedbacksData] = await Promise.allSettled([
      loadGroupsData(),
      loadResultsData(), 
      loadFeedbacksData()
    ]);

    // Process successful data loads
    if (groupsData.status === 'fulfilled') {
      populateGroups(groupsData.value);
    }
    if (resultsData.status === 'fulfilled') {
      populateResults(resultsData.value);
    }
    if (feedbacksData.status === 'fulfilled') {
      populateFeedbacks(feedbacksData.value);
    }

    // Update swipers after content is loaded
    updateSwipers();

  } catch (error) {
    console.error("Error loading data:", error);
  }
}

// Separate data loading functions
async function loadGroupsData() {
  if (dataCache.groups) return dataCache.groups;
  
  const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  
  const groups = [];
  snapshot.forEach((doc) => {
    groups.push({ id: doc.id, ...doc.data() });
  });
  
  dataCache.groups = groups;
  return groups;
}

async function loadResultsData() {
  if (dataCache.results) return dataCache.results;
  
  const q = query(collection(db, "results"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  
  const results = [];
  snapshot.forEach((doc) => {
    results.push({ id: doc.id, ...doc.data() });
  });
  
  dataCache.results = results;
  return results;
}

async function loadFeedbacksData() {
  if (dataCache.feedbacks) return dataCache.feedbacks;
  
  const q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  
  const feedbacks = [];
  snapshot.forEach((doc) => {
    feedbacks.push({ id: doc.id, ...doc.data() });
  });
  
  dataCache.feedbacks = feedbacks;
  return feedbacks;
}

// Populate functions with lazy image loading
function populateGroups(groups) {
  const wrapper = document.querySelector("#groups .swiper-wrapper");
  if (!wrapper) return;

  groups.forEach((group, index) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide swiper-slide1";
    
    // Add loading state and lazy loading
    slide.innerHTML = `
      <div class="image-placeholder">
        <img 
          data-src="${group.photoURL}" 
          alt="${group.name}"
          loading="lazy"
          style="opacity: 0; transition: opacity 0.3s ease;"
        />
      </div>
      <h3>${group.name}</h3>
    `;

    const img = slide.querySelector("img");
    
    // Lazy load images with intersection observer
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.onload = () => {
            img.style.opacity = "1";
          };
          imageObserver.unobserve(img);
        }
      });
    });
    
    imageObserver.observe(img);
    wrapper.appendChild(slide);
  });
}

function populateResults(results) {
  const wrapper = document.querySelector("#results .swiper-wrapper");
  if (!wrapper) return;

  results.forEach((result) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide swiper-slide3";

    slide.innerHTML = `
      <img 
        alt="${result.name}"
        loading="lazy"
        style="opacity: 0; transition: opacity 0.3s ease;"
      />
      <h3>${result.name}</h3>
      <p>Band: <a>${result.band}</a></p>
      <p class="lng_results_group">Group: ${result.group}</p>
    `;

    const img = slide.querySelector("img");
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          loadImageWithCorsHandling(img, result.photoURL);
          imageObserver.unobserve(img);
        }
      });
    });
    
    imageObserver.observe(img);
    wrapper.appendChild(slide);
  });
}

function populateFeedbacks(feedbacks) {
  const wrapper = document.querySelector("#feedbacks .swiper-wrapper");
  if (!wrapper) return;

  feedbacks.forEach((feedback) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide swiper-slide2";

    slide.innerHTML = `
      <div class="feedback_info">
        <img src="./image/no_user.webp" alt="" loading="lazy"> 
        <div class="feedback_info_detail">
          <h3>${feedback.name}</h3> 
          <p class="lng_feedbacks_group">Group: ${feedback.group}</p>
        </div>
      </div>
      <div class="text-container">
        <p class="text-content lng_feedbacks">${feedback.feedback}</p>
      </div>
    `;

    wrapper.appendChild(slide);
  });
}

// Swiper instances storage
let swiperInstances = {};

function createSwiper(selector, options) {
  if (!document.querySelector(selector)) return null;
  
  const swiper = new Swiper(selector, options);
  swiperInstances[selector] = swiper;
  return swiper;
}

function initSwipers() {
  // Initialize swipers with empty content first
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
      0: { slidesPerView: 1, spaceBetween: 20 },
      769: { slidesPerView: 2, spaceBetween: 25 },
      1024: { slidesPerView: 3, spaceBetween: 30 },
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
      0: { slidesPerView: 1, spaceBetween: 20 },
      769: { slidesPerView: 2, spaceBetween: 25 },
      1024: { slidesPerView: 3, spaceBetween: 30 },
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
      0: { slidesPerView: 1, spaceBetween: 20 },
      769: { slidesPerView: 2, spaceBetween: 30 },
    },
  });
}

function updateSwipers() {
  // Update all swiper instances after content is loaded
  Object.values(swiperInstances).forEach(swiper => {
    if (swiper && swiper.update) {
      swiper.update();
    }
  });
}

// Language initialization (работает с glass-effects.js)
let langChangeTimeout;
function initLang() {
  const selects = document.querySelectorAll(".lang_change");
  if (!selects.length) return;
  
  const allLang = ["en", "ru", "uz"];

  function changeURLlang(select) {
    clearTimeout(langChangeTimeout);
    langChangeTimeout = setTimeout(() => {
      let lang = select.value;
      location.href = window.location.pathname + "#" + lang;
      location.reload();
    }, 100);
  }

  function changeLang() {
    let hash = window.location.hash;
    hash = hash.substr(1);
    if (!allLang.includes(hash)) {
      location.href = window.location.pathname + "#en";
      location.reload();
      return;
    }
    
    // Update all language selectors
    selects.forEach(select => {
      select.value = hash;
    });
    
    if (typeof langArr !== 'undefined') {
      requestAnimationFrame(() => {
        for (let key in langArr) {
          let elements = document.querySelectorAll(`.${key}`);
          if (elements) {
            elements.forEach((elem) => {
              elem.innerHTML = langArr[key][hash];
            });
          }
        }
      });
    }
  }

  // Add event listeners to all language selectors
  selects.forEach(select => {
    select.addEventListener("change", () => changeURLlang(select));
  });
  
  changeLang();
}

// OPTIMIZED INITIALIZATION - Show content first, load data after
document.addEventListener("DOMContentLoaded", () => {
  // Initialize language functionality
  initLang();
  
  // Show initial content and start loading data
  showInitialContent();
  
  // If Firebase already has a current user, reflect it immediately
  applyAuthUIFallback(auth.currentUser);
});

// Firebase Authentication with glass-effects.js integration
onAuthStateChanged(auth, async (user) => {

  if (user) {
    // Ensure immediate UI toggle even if glass-effects isn't ready
    applyAuthUIFallback(user);
    try {
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);

      let userData = null;
      if (docSnap.exists()) {
        userData = docSnap.data();
        console.log("👤 User role:", userData.role);
      } else {
        // Create new user document
        userData = {
          name: "No name",
          email: user.email,
          role: "student",
        };
        await setDoc(userDocRef, userData);
        console.log("✅ New user document created");
      }

      // Update UI through glass-effects.js
      if (typeof window.updateAuthUI === 'function') {
        window.updateAuthUI(user, userData);
      }

    } catch (error) {
      console.error("❌ Error handling user data:", error);
      
      // Still update UI even if there's an error
      if (typeof window.updateAuthUI === 'function') {
        window.updateAuthUI(user, null);
      }
    }
  } else {
    // User not logged in
    if (typeof window.updateAuthUI === 'function') {
      window.updateAuthUI(null, null);
    }
    // Fallback update
    applyAuthUIFallback(null);
  }
});

// Enhanced Login function (replaces the one in glass-effects.js)
window.loginUser = async function () {
  const email = document.querySelector("#login_email").value.trim();
  const password = document.querySelector("#login_password").value.trim();
  const loginBtn = document.querySelector(".login_submit");

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  const originalText = loginBtn.textContent;
  loginBtn.textContent = "Logging in...";
  loginBtn.disabled = true;

  try {
    console.log('🔐 Attempting login for:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Close login panel using glass-effects function
    if (typeof window.closeLogin === 'function') {
      window.closeLogin();
    }
    
    // Clear form fields
    document.querySelector("#login_email").value = "";
    document.querySelector("#login_password").value = "";

    // Check/create user document
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      await setDoc(userDocRef, {
        name: "No name",
        email: userCredential.user.email,
        role: "student",
      });
    }

    console.log('✅ Login successful');

  } catch (err) {
    console.error("❌ Login error:", err);
    alert("Login failed: " + err.message);
  } finally {
    loginBtn.textContent = originalText;
    loginBtn.disabled = false;
  }
};

// Enhanced Logout function
window.logoutUser = async function () {
  try {
    console.log('🔐 Logging out user');
    await signOut(auth);
    
    // Clear form fields
    const emailInput = document.querySelector("#login_email");
    const passwordInput = document.querySelector("#login_password");
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
    
    console.log("✅ User logged out successfully");
  } catch (err) {
    console.error("❌ Logout error:", err);
    alert("Logout failed: " + err.message);
  }
};

// Mock redirect functionality (enhanced version)
function initMockRedirect() {
  const mockLinks = document.querySelectorAll("#mockLink, #mobileTokenLink");
  
  mockLinks.forEach(mockLink => {
    if (mockLink) {
      mockLink.addEventListener("click", (e) => {
        e.preventDefault();
        
        const user = auth.currentUser;
        console.log('🎯 Mock test link clicked, user:', user ? 'authenticated' : 'not authenticated');
        
        if (user) {
          window.location.href = "pages/mock.html";
        } else {
          if (typeof window.toggleLogin === 'function') {
            window.toggleLogin();
          }
        }
      });
    }
  });
}

// Initialize mock redirect when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initMockRedirect();
});

// Функция загрузки изображений с обходом CORS
function loadImageWithCorsHandling(imgElement, originalUrl) {
  // Сначала пробуем оригинальный URL
  imgElement.src = originalUrl;
  
  imgElement.onload = () => {
    imgElement.style.opacity = "1";
  };
  
      imgElement.onerror = () => {
        console.warn('Failed to load image:', originalUrl);
        
        // Пробуем добавить alt=media
        if (!originalUrl.includes('alt=media')) {
          const newUrl = originalUrl + (originalUrl.includes('?') ? '&' : '?') + 'alt=media';
          imgElement.src = newUrl;
          
          imgElement.onload = () => imgElement.style.opacity = "1";
          imgElement.onerror = () => {
            // Fallback изображение
            imgElement.src = './image/placeholder.svg';
            imgElement.style.opacity = "1";
            console.error('All loading attempts failed for:', originalUrl);
          };
        } else {
          // Fallback изображение
          imgElement.src = './image/placeholder.svg';
          imgElement.style.opacity = "1";
        }
      };
}


