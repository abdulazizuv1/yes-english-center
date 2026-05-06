# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YES English Center** — an IELTS exam preparation platform. Three distinct apps coexist in the same repo:
1. **Landing page + Mock tests** — vanilla JS, no build step, served from root
2. **Admin panel** — vanilla JS at `settings/admin/`, served as-is
3. **React Dashboard** — React 19 + Vite at `pages/dashboard/`, requires a separate build

All three share Firebase Auth, Firestore, and Storage via `config.js` (gitignored).

## Commands

### Root (main site / landing page)
```bash
npm run dev      # Vite dev server for main site
npm run build    # Vite build
npm run lint     # ESLint
```

### React Dashboard
```bash
cd pages/dashboard
npm install
npm run dev      # Vite dev server (base path: /pages/dashboard/)
npm run build    # Outputs to pages/dashboard/dist/
```

### Cloud Functions
```bash
cd functions
npm install
npm run serve    # Firebase local emulator
npm run deploy   # Deploy to Firebase
npm run lint
```

## Architecture

### Vanilla JS Modules (`src/modules/`)
The main app uses a module orchestrator pattern. Each module has a single responsibility and is initialized in order by `src/main.js`. All modules are exposed on `window.App.*` for cross-module access and debugging.

| Module | Responsibility |
|--------|---------------|
| `auth/` | Firebase Auth — email/password login, username lookup, role resolution |
| `data/` | Firestore reads with multi-level caching (memory → IndexedDB → Firebase) |
| `cache/` | IndexedDB wrapper with 30-minute TTL |
| `ui/` | Skeleton loaders, DOM rendering, scroll animations |
| `language/` | i18n for English / Russian / Uzbek |
| `swiper/` | Swiper carousel configuration |
| `callback/` | Contact form submission |
| `utils/` | Shared helpers, performance tracking |

### Cloud Functions (`functions/index.js`)
Three HTTP-callable functions, all requiring Firebase ID token verification:
- `createUser` — admin-only; creates Auth user + Firestore doc
- `deleteUser` — admin-only; deletes Auth user + Firestore doc
- `generateAIFeedback` — calls Anthropic Claude API (IELTS writing grading); 4 requests/week per user, results cached in Firestore

### Firestore Collections
`users`, `groups`, `results`, `feedbacks`, `readingTests`, `listeningTests`, `writingTests`, `fullMockTests`, `resultsWriting`, `aiWritingFeedback`

### Role-Based Access
Three roles stored in Firestore `users` collection: `admin`, `teacher`, `student`. Cloud Functions verify admin role via Firestore before privileged operations. Frontend routes check role after auth.

### Mock Tests (`pages/mock/`)
Four test types: `reading/`, `listening/`, `writing/`, `full/`. Each is a self-contained HTML/JS/CSS bundle — no build step. Test data loaded from Firestore; results written back.

### React Dashboard (`pages/dashboard/`)
Separate Vite app with React Router, Chart.js analytics, and Lucide icons. Shares Firebase config via a relative import to root `config.js`. Build outputs to `pages/dashboard/dist/`.

## Key Files

- `config.js` — Firebase credentials (gitignored; must exist locally)
- `src/main.js` — App initialization sequence; start here to trace data flow
- `functions/index.js` — All backend logic including Claude AI integration
- `sw.js` — Service Worker for offline caching of static assets
- `firebase.json` / `.firebaserc` — Firebase hosting + emulator config
