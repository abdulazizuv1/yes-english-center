# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YES English Center** — an IELTS exam preparation platform. Three distinct apps coexist in the same repo:
1. **Landing page + Mock tests** — vanilla JS, no build step, served from root
2. **Admin panel** — vanilla JS at `settings/admin/`, served as-is
3. **React Dashboard** — React 19 + Vite at `pages/dashboard/`, requires a separate build

All three share Firebase Auth, Firestore, and Storage via `config.js` (gitignored).

Deployment: cPanel copies the git checkout into `public_html` (see `.cpanel.yml`), so
the dashboard's **built output is committed** (`pages/dashboard/index.html` + `assets/`).
Cloud Functions and Firestore rules deploy separately via the Firebase CLI.

## Commands

### Root (main site / landing page)
```bash
npm run dev      # Vite dev server for main site
npm run build    # Vite build (dev convenience only — production serves source files)
npm run lint     # ESLint
```

### React Dashboard
```bash
cd pages/dashboard
npm install
npm run dev      # Vite dev server (base path: /pages/dashboard/)
npm run build    # Cleans assets/, restores index.dev.html entry, builds IN PLACE
                 # (outputs committed index.html + assets/ — commit them)
```

### Cloud Functions & Firestore rules
```bash
cd functions
npm install
npm run serve    # Firebase local emulator
npm run lint

# From repo root:
firebase deploy --only functions --project yes-english-center
firebase deploy --only firestore --project yes-english-center   # rules + indexes
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
| `callback/` | Contact form → `submitContactForm` Cloud Function |
| `utils/` | Shared helpers, performance tracking |

### Cloud Functions (`functions/index.js`)
HTTP functions; all except `submitContactForm` require a Firebase ID token:
- `createUser` / `deleteUser` — admin-only user management
- `generateAIFeedback` — Claude API grading of IELTS writing; 2 requests/week per user (RTDB counter), results cached in `aiWritingFeedback`
- `analyzeReadingAnalysis` — Claude API check of reading-analysis worksheets; 5/week per user
- `sendTestNotification` — Telegram notifications for test/feedback submissions (types: `writing`, `fullmock`, `feedback`)
- `submitContactForm` — public endpoint for the landing-page contact form
- `generateStudyPlan` — builds the student's daily study plan (`studyPlans/{uid}`); Claude (Haiku) supplies only skill weights/weekly focuses/advice, all scheduling is deterministic in `functions/planner.js`; 3 generations/week per user, full non-AI fallback
- `dailyPlanBotWebhook` — Telegram webhook for @dailyplan_yes_bot: students link by sending their login email; mapping stored in `telegramLinks/{chatId}` (server-only collection)
- `sendDailyPlanReminders` — scheduled daily 08:00 Asia/Tashkent; sends each linked student their pending tasks

Secrets (`CLAUDE_API_KEY`, `TELEGRAM_*`) live in `functions/.env` (gitignored; see `functions/.env.example`).

### Firestore
Collections: `users`, `groups`, `results`, `feedbacks`, `readingTests`, `listeningTests`, `writingTests`, `fullmockTests`, `resultsReading`, `resultsListening`, `resultsWriting`, `resultFullmock`, `aiWritingFeedback`, `aiReadingAnalysis`, `userTargets`, `studyPlans`, `telegramLinks` (server-only).

Security rules are versioned in `firestore.rules` (deployed via `firebase deploy --only firestore`). Key invariants: tests require auth to read; students may only create their own results and can never change their own `role`; landing-page collections (`groups`, `results`, `feedbacks`) are public-read/admin-write. See `docs/SECURITY.md` for the threat model and remaining known gaps.

### Role-Based Access
Three roles stored in Firestore `users` collection: `admin`, `teacher`, `student`. Cloud Functions verify admin role via Firestore before privileged operations. Frontend routes check role after auth; Firestore rules enforce it server-side.

### Mock Tests (`pages/mock/`)
Four test types: `reading/`, `listening/`, `writing/`, `full/`. Each is a self-contained HTML/JS/CSS bundle — no build step. Test data loaded from Firestore; results written back. Grading currently happens client-side (known limitation — see `docs/SECURITY.md`).

### React Dashboard (`pages/dashboard/`)
Separate Vite app with React Router (route-level code splitting via `React.lazy`), Chart.js analytics, and Lucide icons. Firebase config is inlined in `src/firebase.js`. `vite.config.js` builds in place with vendor chunks split; the build script wipes `assets/` first so stale hashed bundles never accumulate.

### Admin scripts (`mock-tests/`)
Firestore import/export tooling using the admin SDK + `serviceAccountKey.json` (gitignored). `mock-tests/scripts/download-doc.js <collection> <docId>` downloads any document as JSON.

## Key Files

- `config.js` — Firebase web config (gitignored; must exist locally)
- `src/main.js` — App initialization sequence; start here to trace data flow
- `functions/index.js` — All backend logic including Claude AI integration (tracked in git; secrets in `functions/.env`)
- `firestore.rules` — Firestore security rules (source of truth, deploy after editing)
- `sw.js` — Service Worker for offline caching of static assets (bump cache version when changing cached assets)
- `firebase.json` / `.firebaserc` — Firebase project + deploy config
- `docs/SECURITY.md` — security fixes done, pending manual actions, known gaps
