# Security Notes — YES English Center

Status of the July 2026 security cleanup, plus the actions that still need a human.

## ✅ Fixed in code (this repo)

| Issue | Fix |
|---|---|
| 3 Telegram bot tokens hardcoded in client JS (`fullMock.js`, `writing/test.js`, `Feedback.jsx`, `callback.js`) | All notifications now go through Cloud Functions (`sendTestNotification`, `submitContactForm`); tokens live in `functions/.env` only |
| Firestore rules only existed in the console | `firestore.rules` + `firestore.indexes.json` are now in the repo and deployed via `firebase deploy --only firestore` |
| Test content (incl. answers and `accessPin`) publicly readable without login | Rules now require auth for all test collections |
| Any signed-in student could read/overwrite/delete anyone's results | Results: create own only, read own (or staff), update/delete admin-only |
| Students could set `role: "admin"` on their own user doc | Self-updates may not touch `role`; create/delete admin-only |
| `feedbacks` (rendered on the landing page) writable by any signed-in user — stored-XSS vector | Writes now admin-only |
| `functions/index.js` was gitignored (no backend version history) | Tracked in git; secrets moved to `functions/.env` (still ignored) |
| cPanel deploy copied `mock-tests/` (answer JSONs) and `functions/` source to the public web root | `.cpanel.yml` now removes them after copy |

## ⚠️ Actions required (cannot be done from code)

1. **Revoke all three exposed Telegram bot tokens** via @BotFather (`/revoke`):
   - `8312079942:AAHs...` (test submissions)
   - `8058733911:AAG6...` (landing contact form)
   - `8614804182:AAEL...` (dashboard feedback)
   They are in git history and were shipped to every browser — assume compromised.
2. Put the new token in `functions/.env` (`TELEGRAM_BOT_TOKEN`). One bot is enough now;
   each recipient chat (`TELEGRAM_CHAT_ID`, `TELEGRAM_FEEDBACK_CHAT_ID`) must have
   pressed Start on that bot once.
3. **Deploy functions and rules** (order matters — functions first, then the site):
   ```bash
   firebase deploy --only functions --project yes-english-center
   firebase deploy --only firestore --project yes-english-center
   ```
4. Review **Storage rules** in the Firebase console (not versioned here yet).

## 🔜 Known remaining weaknesses (by design of the current architecture)

- **Client-side grading**: tests are scored in the browser and results written by the
  client, so a motivated student can still forge their own score (but no longer
  anyone else's). Real fix: a `submitTest` Cloud Function that grades server-side
  and strips answers from the test payload sent to students.
- **Signed-in students can read test answers** from the test documents (needed for
  client-side grading — same root cause as above).
- **`accessPin` is stored on the test document**, so any signed-in student can read
  it. Real fix: move PINs to an admin-only collection checked by a Cloud Function.
- **Realtime Database rules** (used for AI rate-limit counters) are not versioned
  here; the client never touches RTDB, but verify the rules are locked down.
