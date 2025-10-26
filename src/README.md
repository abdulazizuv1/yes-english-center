# 🏗️ Modular Architecture Documentation

## 📁 Project Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.js           # Firebase authentication logic
│   │   └── auth-ui.js        # UI updates for authentication
│   │
│   ├── cache/
│   │   └── indexeddb.js      # IndexedDB persistent caching
│   │
│   ├── data/
│   │   ├── data-cache.js     # In-memory cache management
│   │   └── data-loader.js    # Firebase data loading with caching
│   │
│   ├── ui/
│   │   ├── skeleton.js       # Skeleton screen loaders
│   │   ├── renderer.js       # Data rendering functions
│   │   └── animations.js     # UI animations (future)
│   │
│   ├── swiper/
│   │   └── swiper-config.js  # Swiper initialization & config
│   │
│   ├── language/
│   │   └── language.js       # Multi-language support
│   │
│   └── utils/
│       └── helpers.js        # Utility functions
│
└── main.js                    # Application orchestrator (entry point)
```

---

## 🎯 Module Descriptions

### 1. **Auth Module** (`modules/auth/`)

#### `auth.js`
Core authentication logic using Firebase Auth.

**Exports:**
- `initAuth(app)` - Initialize Firebase Auth
- `login(email, password)` - User login
- `logout()` - User logout
- `getCurrentUser()` - Get current authenticated user
- `getUserData(uid)` - Fetch user data from Firestore
- `onAuthChange(callback)` - Listen to auth state changes
- `isAuthenticated()` - Check if user is logged in
- `isAdmin(userData)` - Check if user is admin
- `isTeacher(userData)` - Check if user is teacher
- `isStudent(userData)` - Check if user is student

**Usage:**
```javascript
import * as Auth from './modules/auth/auth.js';

// Initialize
Auth.initAuth(firebaseApp);

// Login
await Auth.login('user@example.com', 'password123');

// Check auth state
if (Auth.isAuthenticated()) {
  console.log('User is logged in');
}
```

#### `auth-ui.js`
UI management for authentication.

**Exports:**
- `updateAuthUI(user, userData)` - Update UI based on auth state
- `showLoginPanel()` - Show login modal
- `hideLoginPanel()` - Hide login modal
- `toggleLoginPanel()` - Toggle login modal
- `clearLoginForm()` - Clear login form inputs
- `initLoginForm(onLogin)` - Initialize login form handlers
- `initMockRedirect(isAuth)` - Setup mock test access control

---

### 2. **Cache Module** (`modules/cache/`)

#### `indexeddb.js`
Persistent storage using IndexedDB API.

**Exports:**
- `initDB()` - Initialize IndexedDB
- `getFromCache(key)` - Retrieve cached data
- `saveToCache(key, data)` - Save data to cache
- `clearCache(key)` - Clear specific cache entry
- `clearAllCache()` - Clear all cached data
- `isCacheValid(key)` - Check if cache is valid

**Features:**
- 30-minute cache duration
- Automatic cache expiration
- Persistent between sessions

**Usage:**
```javascript
import * as Cache from './modules/cache/indexeddb.js';

// Save to cache
await Cache.saveToCache('groups', groupsData);

// Get from cache
const cached = await Cache.getFromCache('groups');

// Clear cache
await Cache.clearCache('groups');
```

---

### 3. **Data Module** (`modules/data/`)

#### `data-cache.js`
In-memory cache for fast data access.

**Exports:**
- `get(key)` - Get from memory cache
- `set(key, data)` - Save to memory cache
- `has(key)` - Check if key exists
- `clear(key)` - Clear specific key
- `clearAll()` - Clear all cache
- `size()` - Get cache size

#### `data-loader.js`
Firebase data loading with multi-level caching.

**Exports:**
- `initFirestore(app)` - Initialize Firestore
- `loadGroups()` - Load groups data
- `loadResults()` - Load results data
- `loadFeedbacks()` - Load feedbacks data
- `loadAllData()` - Load all data with priority
- `reloadData(type)` - Force reload data

**Caching Strategy:**
```
1. Check Memory Cache (instant)
   ↓ if not found
2. Check IndexedDB (very fast ~10-50ms)
   ↓ if not found
3. Load from Firebase (slower ~500-2000ms)
```

**Usage:**
```javascript
import * as DataLoader from './modules/data/data-loader.js';

// Initialize
DataLoader.initFirestore(firebaseApp);

// Load all data
const data = await DataLoader.loadAllData();
// Returns: { groups, results, feedbacks, errors }

// Reload specific data
await DataLoader.reloadData('groups');
```

---

### 4. **UI Module** (`modules/ui/`)

#### `skeleton.js`
Loading placeholder screens.

**Exports:**
- `showSkeletons(selector, count)` - Show skeleton loaders
- `showAllSkeletons()` - Show all section skeletons
- `hideSkeletons(selector)` - Hide skeleton from section
- `hideAllSkeletons()` - Hide all skeletons
- `replaceWithContent(selector, renderer)` - Replace skeleton with content

**Usage:**
```javascript
import * as Skeleton from './modules/ui/skeleton.js';

// Show skeletons
Skeleton.showAllSkeletons();

// Hide when data is ready
Skeleton.hideSkeletons('#groups .swiper-wrapper');
```

#### `renderer.js`
Data rendering with animations.

**Exports:**
- `renderGroups(data, wrapper)` - Render groups cards
- `renderResults(data, wrapper)` - Render results cards
- `renderFeedbacks(data, wrapper)` - Render feedback cards
- `renderAll(data)` - Render all sections
- `loadImageWithCorsHandling(img, url)` - Image loading with fallback

**Features:**
- Lazy loading images (Intersection Observer)
- Staggered animations
- CORS error handling with fallback

**Usage:**
```javascript
import * as Renderer from './modules/ui/renderer.js';

const wrapper = document.querySelector('#groups .swiper-wrapper');
Renderer.renderGroups(groupsData, wrapper);
```

---

### 5. **Swiper Module** (`modules/swiper/`)

#### `swiper-config.js`
Swiper slider management.

**Exports:**
- `initAllSwipers()` - Initialize all Swipers
- `initGroupsSwiper()` - Initialize groups Swiper
- `initResultsSwiper()` - Initialize results Swiper
- `initFeedbacksSwiper()` - Initialize feedbacks Swiper
- `updateSwiper(selector)` - Update specific Swiper
- `updateAllSwipers()` - Update all Swipers
- `destroySwiper(selector)` - Destroy Swiper instance
- `getSwiperInstance(selector)` - Get Swiper instance
- `pauseAutoplay(selector)` - Pause autoplay
- `resumeAutoplay(selector)` - Resume autoplay

**Usage:**
```javascript
import * as SwiperConfig from './modules/swiper/swiper-config.js';

// Initialize all
const swipers = SwiperConfig.initAllSwipers();

// Update after content change
SwiperConfig.updateAllSwipers();
```

---

### 6. **Language Module** (`modules/language/`)

#### `language.js`
Multi-language support.

**Exports:**
- `getCurrentLanguage()` - Get current language
- `setLanguage(lang)` - Change language
- `initLanguageOnLoad()` - Initialize language on page load
- `initLanguageSwitchers()` - Setup language selectors
- `getAvailableLanguages()` - Get supported languages
- `isLanguageSupported(lang)` - Check if language is supported
- `getLanguageName(code)` - Get language display name

**Supported Languages:**
- 🇬🇧 English (en)
- 🇷🇺 Русский (ru)
- 🇺🇿 O'zbekcha (uz)

**Usage:**
```javascript
import * as Language from './modules/language/language.js';

// Initialize
Language.initLanguageOnLoad();
Language.initLanguageSwitchers();

// Get current
const current = Language.getCurrentLanguage(); // 'en'

// Change language
Language.setLanguage('ru');
```

---

### 7. **Utils Module** (`modules/utils/`)

#### `helpers.js`
Common utility functions.

**Exports:**
- `hideLoader()` / `showLoader()` - Loader management
- `debounce(func, wait)` - Debounce function
- `throttle(func, limit)` - Throttle function
- `wait(ms)` - Async delay
- `formatDate(timestamp)` / `formatTime(timestamp)` - Date formatting
- `isInViewport(element)` - Viewport check
- `smoothScrollTo(selector, offset)` - Smooth scrolling
- `generateId(prefix)` - Generate unique ID
- `copyToClipboard(text)` - Copy to clipboard
- `getQueryParam(param)` - Get URL parameter
- `isMobile()` / `isIOS()` / `isAndroid()` - Device detection
- `getBrowserName()` - Browser detection
- `measureTime(func, label)` - Performance measurement
- `retry(func, maxRetries, delay)` - Retry with backoff

**Usage:**
```javascript
import * as Helpers from './modules/utils/helpers.js';

// Debounce search input
const debouncedSearch = Helpers.debounce(searchFunction, 300);

// Smooth scroll
Helpers.smoothScrollTo('#contact', 80);

// Device detection
if (Helpers.isMobile()) {
  console.log('Mobile device detected');
}
```

---

## 🚀 Main Application (`main.js`)

The orchestrator that initializes and coordinates all modules.

### Initialization Flow:

```
1. Initialize Firebase
   ↓
2. Initialize Authentication
   ↓
3. Initialize Language
   ↓
4. Initialize UI
   ├── Show skeleton loaders
   ├── Initialize Swipers
   ├── Hide main loader
   └── Load and render data
```

### Global Access:

For debugging and testing, all modules are available globally:

```javascript
// In browser console
window.App.Auth.isAuthenticated()
window.App.DataLoader.reloadData('groups')
window.App.Helpers.isMobile()
```

---

## 🎨 Benefits of Modular Architecture

### 1. **Separation of Concerns**
- Each module has a single responsibility
- Easy to understand and maintain
- Changes in one module don't affect others

### 2. **Reusability**
- Modules can be reused in different parts of the app
- Easy to use in other projects

### 3. **Testability**
- Each module can be tested independently
- Easy to mock dependencies

### 4. **Scalability**
- Easy to add new features
- Easy to remove unused features
- Clear structure for team collaboration

### 5. **Performance**
- Lazy loading support
- Tree-shaking compatible
- Smaller bundle sizes

### 6. **Maintainability**
- Easy to find and fix bugs
- Clear dependencies
- Self-documenting code

---

## 🔧 How to Add New Module

1. **Create module file:**
```bash
touch src/modules/yourmodule/yourmodule.js
```

2. **Export functions:**
```javascript
export function yourFunction() {
  // Your code
}

export default {
  yourFunction
};
```

3. **Import in main.js:**
```javascript
import * as YourModule from './modules/yourmodule/yourmodule.js';
```

4. **Use in application:**
```javascript
YourModule.yourFunction();
```

---

## 📊 Performance Metrics

### Before Modularization:
- ❌ Single 777-line file
- ❌ Hard to maintain
- ❌ No clear structure
- ❌ Difficult to test

### After Modularization:
- ✅ 8 focused modules
- ✅ ~150 lines per module
- ✅ Clear responsibilities
- ✅ Easy to test
- ✅ Better performance
- ✅ Scalable architecture

---

## 🐛 Debugging

### Check Module Loading:
```javascript
// In browser console
console.log(window.App);
```

### Test Individual Modules:
```javascript
// Test auth
await window.App.Auth.login('test@test.com', 'password');

// Test data loading
const data = await window.App.DataLoader.loadGroups();
console.log(data);

// Test cache
await window.App.Cache.saveToCache('test', { data: 123 });
const cached = await window.App.Cache.getFromCache('test');
```

---

## 📝 Best Practices

1. **Keep modules focused** - One module, one responsibility
2. **Use meaningful names** - Clear function and variable names
3. **Document exports** - Add JSDoc comments
4. **Handle errors** - Try/catch and proper error messages
5. **Log operations** - Console logs for debugging
6. **Test modules** - Unit tests for each module
7. **Keep dependencies minimal** - Avoid circular dependencies

---

## 🔮 Future Improvements

- [ ] Add unit tests for each module
- [ ] Add TypeScript definitions
- [ ] Create CI/CD pipeline
- [ ] Add error boundary module
- [ ] Add analytics module
- [ ] Add notification module
- [ ] Add service worker module
- [ ] Add offline support

---

**Created:** 2025  
**Architecture:** ES6 Modules  
**Pattern:** Modular + Orchestrator  
**Performance:** Optimized with multi-level caching

