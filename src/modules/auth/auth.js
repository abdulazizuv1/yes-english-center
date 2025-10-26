/**
 * Auth Module
 * Handles Firebase authentication
 * @module auth/auth
 */

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
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let auth = null;
let db = null;

/**
 * Initialize Firebase Auth
 * @param {Object} firebaseApp - Firebase app instance
 */
export function initAuth(firebaseApp) {
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  
  // Make auth available globally for compatibility
  window.auth = auth;
  
  console.log('✅ Auth initialized');
  return auth;
}

/**
 * Get current user
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
  return auth?.currentUser || null;
}

/**
 * Login user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User credential
 */
export async function login(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  console.log('🔐 Attempting login for:', email);
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Check/create user document
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      await setDoc(userDocRef, {
        name: "No name",
        email: userCredential.user.email,
        role: "student",
      });
      console.log('✅ New user document created');
    }

    console.log('✅ Login successful');
    return userCredential;
    
  } catch (error) {
    console.error('❌ Login error:', error);
    throw error;
  }
}

/**
 * Logout current user
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    console.log('🔐 Logging out user');
    await signOut(auth);
    console.log('✅ User logged out successfully');
  } catch (error) {
    console.error('❌ Logout error:', error);
    throw error;
  }
}

/**
 * Get user data from Firestore
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} User data or null
 */
export async function getUserData(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.warn('User document not found for UID:', uid);
      return null;
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

/**
 * Setup auth state change listener
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
  if (!auth) {
    console.error('Auth not initialized');
    return () => {};
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userData = await getUserData(user.uid);
        callback(user, userData);
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        callback(user, null);
      }
    } else {
      callback(null, null);
    }
  });
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!auth?.currentUser;
}

/**
 * Check if user has admin role
 * @param {Object} userData - User data from Firestore
 * @returns {boolean}
 */
export function isAdmin(userData) {
  return userData?.role === 'admin';
}

/**
 * Check if user has teacher role
 * @param {Object} userData - User data from Firestore
 * @returns {boolean}
 */
export function isTeacher(userData) {
  return userData?.role === 'teacher';
}

/**
 * Check if user has student role
 * @param {Object} userData - User data from Firestore
 * @returns {boolean}
 */
export function isStudent(userData) {
  return userData?.role === 'student';
}

export default {
  initAuth,
  getCurrentUser,
  login,
  logout,
  getUserData,
  onAuthChange,
  isAuthenticated,
  isAdmin,
  isTeacher,
  isStudent
};

