/**
 * Student Settings Panel
 * Main JavaScript for student settings functionality
 */

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "../../config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Global state
let currentUser = null;
let userData = null;
let currentTab = 'results';
let currentResultsCategory = 'all';
let currentStatsSkill = 'listening';
let chartInstance = null;
let selectedProfilePicture = null;

/**
 * Initialize the settings panel
 */
async function initializeSettings() {
  
  // Check authentication
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert('Please login to access settings');
      window.location.href = '/';
      return;
    }

    currentUser = user;

    // Load user data from Firestore
    await loadUserData();

    // Initialize UI
    initializeTabSwitching();
    initializePersonalDetailsHandlers();
    
    // Load initial content based on active tab
    await loadResultsData();
    
  });
}

/**
 * Load user data from Firestore
 */
async function loadUserData() {
  try {
    const userDocRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      userData = userDoc.data();
      
      // Update profile header
      updateProfileHeader();
    } else {
      console.warn('⚠️ User document not found');
      userData = {
        name: 'Unknown',
        email: currentUser.email,
        role: 'student'
      };
      updateProfileHeader();
    }
  } catch (error) {
    console.error('❌ Error loading user data:', error);
    alert('Failed to load user data');
  }
}

/**
 * Update profile header with user information
 */
function updateProfileHeader() {
  const userNameEl = document.getElementById('userName');
  const userEmailEl = document.getElementById('userEmail');
  const userRoleEl = document.getElementById('userRole');
  const profilePictureEl = document.getElementById('profilePicture');
  const pfpPreviewEl = document.getElementById('pfpPreview');

  if (userNameEl) userNameEl.textContent = userData.name || 'Unknown';
  if (userEmailEl) userEmailEl.textContent = userData.email || currentUser.email;
  if (userRoleEl) userRoleEl.textContent = (userData.role || 'student').charAt(0).toUpperCase() + (userData.role || 'student').slice(1);
  
  // Set profile picture
  const photoURL = userData.photoURL || '../../image/no_user.webp';
  if (profilePictureEl) profilePictureEl.src = photoURL;
  if (pfpPreviewEl) pfpPreviewEl.src = photoURL;
  
  // Update personal details form
  const nameInput = document.getElementById('nameInput');
  const usernameInput = document.getElementById('usernameInput');
  if (nameInput) nameInput.value = userData.name || '';
  if (usernameInput) usernameInput.value = userData.username || '';
}

/**
 * Initialize tab switching functionality
 */
function initializeTabSwitching() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const tabName = btn.dataset.tab;
      
      // Update active states
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Hide all content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Show selected content
      const contentId = `${tabName}-content`;
      const contentEl = document.getElementById(contentId);
      if (contentEl) contentEl.classList.add('active');
      
      currentTab = tabName;
      
      // Load content for the selected tab
      if (tabName === 'results' && !document.querySelector('#resultsContainer .result-card')) {
        await loadResultsData();
      } else if (tabName === 'statistics') {
        await loadStatistics();
      }
    });
  });
  
}

/**
 * Load results data from Firestore
 */
async function loadResultsData(category = 'all') {
  const resultsContainer = document.getElementById('resultsContainer');
  if (!resultsContainer) return;

  currentResultsCategory = category;

  // Show loading
  resultsContainer.innerHTML = `
    <div class="loading-message glass-morphism">
      <div class="spinner"></div>
      <p>Loading your results...</p>
    </div>
  `;

  try {
    const results = [];

    // Fetch from all collections or specific one based on category
    if (category === 'all' || category === 'listening') {
      const listeningResults = await fetchResults('resultsListening', 'listening');
      results.push(...listeningResults);
    }
    
    if (category === 'all' || category === 'reading') {
      const readingResults = await fetchResults('resultsReading', 'reading');
      results.push(...readingResults);
    }
    
    if (category === 'all' || category === 'writing') {
      const writingResults = await fetchResults('resultsWriting', 'writing');
      results.push(...writingResults);
    }
    
    if (category === 'all' || category === 'fullmock') {
      const fullMockResults = await fetchResults('resultFullmock', 'fullmock');
      results.push(...fullMockResults);
    }

    // Sort by date (newest first)
    results.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return dateB - dateA;
    });

    // Render results
    renderResults(results);

  } catch (error) {
    console.error('❌ Error loading results:', error);
    resultsContainer.innerHTML = `
      <div class="empty-state glass-morphism">
        <div class="empty-state-icon">⚠️</div>
        <p>Failed to load results. Please try again.</p>
      </div>
    `;
  }
}

/**
 * Fetch results from a specific collection
 */
async function fetchResults(collectionName, type) {
  try {
    const resultsRef = collection(db, collectionName);
    const q = query(
      resultsRef,
      where("userId", "==", currentUser.uid)
    );
    
    const querySnapshot = await getDocs(q);
    const results = [];
    
    querySnapshot.forEach((doc) => {
      results.push({
        id: doc.id,
        type: type,
        ...doc.data()
      });
    });
    
    // Sort in JavaScript instead of Firestore to avoid index requirement
    results.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return dateB - dateA; // Newest first
    });
    
    return results;
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
}

/**
 * Render results in the UI
 */
function renderResults(results) {
  const resultsContainer = document.getElementById('resultsContainer');
  
  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state glass-morphism">
        <div class="empty-state-icon">📝</div>
        <p>No results found. Complete a test to see your results here.</p>
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = results.map(result => {
    const date = result.createdAt?.toDate ? result.createdAt.toDate().toLocaleDateString() : 'Unknown date';
    const score = getResultScore(result);
    const badge = getResultBadge(result);
    
    return `
      <div class="result-card glass-morphism" onclick="openResult('${result.type}', '${result.id}')">
        <div class="result-card-header">
          <span class="result-type">${getTypeIcon(result.type)} ${formatType(result.type)}</span>
          <span class="result-badge">${badge}</span>
        </div>
        <div class="result-details">
          <div class="result-score">${score}</div>
          <div class="result-test-id">Test ID: ${result.testId || 'N/A'}</div>
        </div>
        <div class="result-date">📅 ${date}</div>
      </div>
    `;
  }).join('');

  // Add filter buttons handler
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.dataset.category;
      loadResultsData(category);
    });
  });
}

/**
 * Get result score display
 */
function getResultScore(result) {
  if (result.type === 'fullmock') {
    return `Overall Band: ${result.overallBand || 'N/A'}`;
  } else if (result.type === 'writing') {
    return `${result.totalWordCount || 0} words`;
  } else {
    const ielts = convertToIELTS(result.score || 0, result.total || 40, result.type);
    return `${result.score || 0}/${result.total || 40} (Band ${ielts})`;
  }
}

/**
 * Get result badge text
 */
function getResultBadge(result) {
  if (result.type === 'fullmock') {
    const band = result.overallBand || 0;
    if (band >= 7.0) return '🌟 Excellent';
    if (band >= 6.0) return '✨ Good';
    if (band >= 5.0) return '👍 Pass';
    return '📚 Keep Practicing';
  } else if (result.type === 'writing') {
    return '✍️ Submitted';
  } else {
    const ielts = convertToIELTS(result.score || 0, result.total || 40, result.type);
    if (ielts >= 7.0) return '🌟 Excellent';
    if (ielts >= 6.0) return '✨ Good';
    if (ielts >= 5.0) return '👍 Pass';
    return '📚 Keep Practicing';
  }
}

/**
 * Convert score to IELTS band
 */
function convertToIELTS(score, total, type) {
  if (type === 'listening' || type === 'reading') {
    if (score >= 39) return 9.0;
    if (score >= 37) return 8.5;
    if (score >= 35) return 8.0;
    if (score >= 32) return 7.5;
    if (score >= 30) return 7.0;
    if (score >= 26) return 6.5;
    if (score >= 23) return 6.0;
    if (score >= 18) return 5.5;
    if (score >= 16) return 5.0;
    if (score >= 13) return 4.5;
    if (score >= 10) return 4.0;
    return 3.5;
  }
  return 0;
}

/**
 * Get type icon
 */
function getTypeIcon(type) {
  const icons = {
    listening: '🎧',
    reading: '📖',
    writing: '✍️',
    fullmock: '🎓'
  };
  return icons[type] || '📝';
}

/**
 * Format type name
 */
function formatType(type) {
  const names = {
    listening: 'Listening',
    reading: 'Reading',
    writing: 'Writing',
    fullmock: 'Full Mock'
  };
  return names[type] || type;
}

/**
 * Open result page
 */
window.openResult = function(type, resultId) {
  const urls = {
    listening: `/pages/mock/listening/resultListening.html?id=${resultId}`,
    reading: `/pages/mock/result.html?id=${resultId}`,
    writing: `/pages/mock/writing/resultWriting.html?id=${resultId}`,
    fullmock: `/pages/mock/full/resultFullMock.html?id=${resultId}`
  };
  
  const url = urls[type];
  if (url) {
    window.location.href = url;
  }
};

/**
 * Load statistics and render chart
 */
async function loadStatistics() {
  const skill = currentStatsSkill;
  
  try {
    // Fetch results for selected skill
    const collectionName = skill === 'fullmock' ? 'resultFullmock' : `results${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
    const results = await fetchResults(collectionName, skill);
    
    // Sort by date (oldest first for chart)
    results.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return dateA - dateB;
    });
    
    // Prepare data for chart
    const labels = results.map(r => {
      const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const data = results.map(r => {
      if (skill === 'fullmock') {
        return r.overallBand || 0;
      } else if (skill === 'writing') {
        return r.totalWordCount || 0;
      } else {
        return convertToIELTS(r.score || 0, r.total || 40, skill);
      }
    });
    
    // Render chart
    renderChart(labels, data, skill);
    
    // Calculate and display trend feedback
    displayTrendFeedback(data, results, skill);
    
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

/**
 * Render Chart.js line chart
 */
function renderChart(labels, data, skill) {
  const ctx = document.getElementById('progressChart');
  if (!ctx) return;
  
  // Destroy existing chart if any
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  const yAxisLabel = skill === 'writing' ? 'Word Count' : 'IELTS Band Score';
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${formatType(skill)} Progress`,
        data: data,
        borderColor: '#1763e1',
        backgroundColor: 'rgba(23, 99, 225, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#1763e1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              size: 14,
              weight: 'bold'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#2c3e50',
          bodyColor: '#5a6c7d',
          borderColor: '#1763e1',
          borderWidth: 1,
          padding: 12,
          displayColors: false
        }
      },
      scales: {
        y: {
          beginAtZero: skill === 'writing',
          title: {
            display: true,
            text: yAxisLabel,
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: 12
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Test Date',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: 12
            }
          }
        }
      }
    }
  });
}

/**
 * Display trend feedback
 */
function displayTrendFeedback(data, results, skill) {
  const feedbackEl = document.getElementById('trendFeedback');
  if (!feedbackEl || data.length < 2) {
    if (feedbackEl) {
      feedbackEl.innerHTML = `
        <h3>Performance Feedback</h3>
        <p>Complete at least 2 tests to see your progress trend.</p>
      `;
    }
    return;
  }
  
  // Calculate trend
  const firstScore = data[0];
  const lastScore = data[data.length - 1];
  const difference = lastScore - firstScore;
  const percentChange = ((difference / firstScore) * 100).toFixed(1);
  
  let trendStatus = 'stagnant';
  let trendIcon = '➡️';
  let trendText = 'Staying Consistent';
  let message = 'Your performance has been relatively stable.';
  
  if (difference > 0.5 || (skill === 'writing' && difference > 50)) {
    trendStatus = 'improving';
    trendIcon = '📈';
    trendText = 'Improving';
    message = `Great job! You've improved ${skill === 'writing' ? `by ${Math.abs(difference).toFixed(0)} words` : `by ${Math.abs(difference).toFixed(1)} band score`} since your first test.`;
  } else if (difference < -0.5 || (skill === 'writing' && difference < -50)) {
    trendStatus = 'declining';
    trendIcon = '📉';
    trendText = 'Needs Attention';
    message = `Your performance has ${skill === 'writing' ? `decreased by ${Math.abs(difference).toFixed(0)} words` : `decreased by ${Math.abs(difference).toFixed(1)} band score`}. Consider reviewing your study approach.`;
  }
  
  feedbackEl.innerHTML = `
    <h3>Performance Feedback</h3>
    <div class="trend-status ${trendStatus}">
      <span>${trendIcon}</span>
      <span>${trendText}</span>
    </div>
    <div class="trend-details">
      <p><strong>${message}</strong></p>
      <p>Total tests completed: ${results.length}</p>
      <p>First score: ${firstScore.toFixed(skill === 'writing' ? 0 : 1)}</p>
      <p>Latest score: ${lastScore.toFixed(skill === 'writing' ? 0 : 1)}</p>
      ${percentChange !== 'Infinity' ? `<p>Overall change: ${percentChange}%</p>` : ''}
    </div>
  `;
}

/**
 * Initialize statistics skill selector
 */
document.addEventListener('DOMContentLoaded', () => {
  const skillSelect = document.getElementById('skillSelect');
  if (skillSelect) {
    skillSelect.addEventListener('change', async (e) => {
      currentStatsSkill = e.target.value;
      await loadStatistics();
    });
  }
});

/**
 * Initialize personal details handlers
 */
function initializePersonalDetailsHandlers() {
  // Name update
  const saveNameBtn = document.getElementById('saveNameBtn');
  if (saveNameBtn) {
    saveNameBtn.addEventListener('click', updateName);
  }
  
  // Username update
  const saveUsernameBtn = document.getElementById('saveUsernameBtn');
  if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener('click', updateUsername);
  }
  
  // Password update
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', changePassword);
  }
  
  // Profile picture
  const pfpInput = document.getElementById('pfpInput');
  const uploadPfpBtn = document.getElementById('uploadPfpBtn');
  
  if (pfpInput) {
    pfpInput.addEventListener('change', handleProfilePictureSelection);
  }
  
  if (uploadPfpBtn) {
    uploadPfpBtn.addEventListener('click', uploadProfilePicture);
  }
}

/**
 * Update user name
 */
async function updateName() {
  const nameInput = document.getElementById('nameInput');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const nameMessage = document.getElementById('nameMessage');
  const newName = nameInput.value.trim();
  
  if (!newName) {
    showMessage(nameMessage, 'Please enter a valid name', 'error');
    return;
  }
  
  try {
    saveNameBtn.disabled = true;
    saveNameBtn.textContent = 'Saving...';
    
    await updateDoc(doc(db, "users", currentUser.uid), {
      name: newName
    });
    
    userData.name = newName;
    updateProfileHeader();
    showMessage(nameMessage, 'Name updated successfully!', 'success');
    
  } catch (error) {
    console.error('Error updating name:', error);
    showMessage(nameMessage, 'Failed to update name: ' + error.message, 'error');
  } finally {
    saveNameBtn.disabled = false;
    saveNameBtn.textContent = 'Save';
  }
}

/**
 * Update username
 */
async function updateUsername() {
  const usernameInput = document.getElementById('usernameInput');
  const saveUsernameBtn = document.getElementById('saveUsernameBtn');
  const usernameMessage = document.getElementById('usernameMessage');
  const newUsername = usernameInput.value.trim();
  
  if (!newUsername) {
    showMessage(usernameMessage, 'Please enter a valid username', 'error');
    return;
  }
  
  try {
    saveUsernameBtn.disabled = true;
    saveUsernameBtn.textContent = 'Checking...';
    
    // Check if username is already taken
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", newUsername));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const existingUser = querySnapshot.docs[0];
      if (existingUser.id !== currentUser.uid) {
        showMessage(usernameMessage, 'Username already taken. Please choose another.', 'error');
        saveUsernameBtn.disabled = false;
        saveUsernameBtn.textContent = 'Save';
        return;
      }
    }
    
    saveUsernameBtn.textContent = 'Saving...';
    
    await updateDoc(doc(db, "users", currentUser.uid), {
      username: newUsername
    });
    
    userData.username = newUsername;
    showMessage(usernameMessage, 'Username updated successfully!', 'success');
    
  } catch (error) {
    console.error('Error updating username:', error);
    showMessage(usernameMessage, 'Failed to update username: ' + error.message, 'error');
  } finally {
    saveUsernameBtn.disabled = false;
    saveUsernameBtn.textContent = 'Save';
  }
}

/**
 * Change password
 */
async function changePassword() {
  const currentPasswordInput = document.getElementById('currentPasswordInput');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const passwordMessage = document.getElementById('passwordMessage');
  
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    showMessage(passwordMessage, 'Please fill in all password fields', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showMessage(passwordMessage, 'New password must be at least 6 characters', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showMessage(passwordMessage, 'New passwords do not match', 'error');
    return;
  }
  
  try {
    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = 'Changing...';
    
    // Reauthenticate user
    const credential = EmailAuthProvider.credential(
      currentUser.email,
      currentPassword
    );
    
    await reauthenticateWithCredential(currentUser, credential);
    
    // Update password
    await updatePassword(currentUser, newPassword);
    
    // Clear inputs
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
    
    showMessage(passwordMessage, 'Password changed successfully!', 'success');
    
  } catch (error) {
    console.error('Error changing password:', error);
    let errorMsg = 'Failed to change password';
    
    if (error.code === 'auth/wrong-password') {
      errorMsg = 'Current password is incorrect';
    } else if (error.code === 'auth/weak-password') {
      errorMsg = 'Password is too weak';
    } else if (error.code === 'auth/requires-recent-login') {
      errorMsg = 'Please logout and login again before changing password';
    }
    
    showMessage(passwordMessage, errorMsg, 'error');
  } finally {
    changePasswordBtn.disabled = false;
    changePasswordBtn.textContent = 'Change Password';
  }
}

/**
 * Handle profile picture selection
 */
function handleProfilePictureSelection(event) {
  const file = event.target.files[0];
  const uploadBtn = document.getElementById('uploadPfpBtn');
  const pfpPreview = document.getElementById('pfpPreview');
  
  if (!file) return;
  
  // Validate file
  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file');
    return;
  }
  
  if (file.size > 2 * 1024 * 1024) {
    alert('File size must be less than 2MB');
    return;
  }
  
  selectedProfilePicture = file;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    pfpPreview.src = e.target.result;
  };
  reader.readAsDataURL(file);
  
  // Show upload button
  if (uploadBtn) {
    uploadBtn.style.display = 'block';
  }
}

/**
 * Upload profile picture to Firebase Storage
 */
async function uploadProfilePicture() {
  if (!selectedProfilePicture) {
    alert('Please select a picture first');
    return;
  }
  
  const uploadBtn = document.getElementById('uploadPfpBtn');
  const loadingOverlay = document.getElementById('loadingOverlay');
  
  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    // Upload to Firebase Storage
    const fileExtension = selectedProfilePicture.name.split('.').pop();
    const fileName = `${currentUser.uid}_${Date.now()}.${fileExtension}`;
    const fileRef = storageRef(storage, `profilePictures/${currentUser.uid}/${fileName}`);
    
    await uploadBytes(fileRef, selectedProfilePicture);
    
    // Get download URL
    const downloadURL = await getDownloadURL(fileRef);
    
    // Update Firestore
    await updateDoc(doc(db, "users", currentUser.uid), {
      photoURL: downloadURL
    });
    
    userData.photoURL = downloadURL;
    updateProfileHeader();
    
    // Reset
    selectedProfilePicture = null;
    uploadBtn.style.display = 'none';
    uploadBtn.textContent = 'Upload';
    
    alert('Profile picture updated successfully!');
    
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    alert('Failed to upload profile picture: ' + error.message);
  } finally {
    uploadBtn.disabled = false;
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }
}

/**
 * Show message
 */
function showMessage(element, message, type) {
  if (!element) return;
  
  element.textContent = message;
  element.className = `message ${type}`;
  
  setTimeout(() => {
    element.className = 'message';
  }, 5000);
}

// Initialize settings panel when DOM is ready
document.addEventListener('DOMContentLoaded', initializeSettings);


