# Drag & Drop QA Checklist

## Code Review Status (QA Agent — 2026-05-06)

### RED FLAGS — Fixed before merge

| # | Issue | File | Status |
|---|-------|------|--------|
| 1 | Score inflation: `total += q.slots.length` made score /43 not /40 | `finish.js` | **FIXED** — drag_drop is now bonus, not counted in total |
| 2 | Dead validator module: `dragDropValidator.js` was never imported | `render.js`, `finish.js` | **FIXED** — render.js imports `QUESTION_TYPE_DRAG_DROP`, finish.js imports `scoreDragDrop` |
| 3 | `getQuestionTypeFromText()` missing drag_drop entry (breaks renumber) | `add/reading/index.js` | **FIXED** — added `"Drag & Drop Matching": "drag_drop"` |

### YELLOW FLAGS — Product decisions needed

| # | Issue | Recommendation |
|---|-------|----------------|
| 1 | No touch/mobile drag support | HTML5 drag API doesn't work on iOS/Android. Add touch fallback (touchstart/touchmove/touchend) in a follow-up task |
| 2 | Drag_drop invisible to nav bar (no numbered bubble) | drag_drop qIds are `dd1`, `dd2` — not in the q1–q40 nav. Acceptable for bonus questions; document as known limitation |

### VERIFIED OK
- All 9 existing switch cases in `render.js` unchanged
- `saveState` and `updateQuestionNav` correctly imported and used
- `refreshDragDropUI` correctly passes parent div to `attachDragDropListeners`
- Original scoring loop in `finish.js` completely unchanged
- `navigation.js` answered-check handles both string and object answers
- `test-1.json` valid JSON, all slot correctIds reference valid item IDs
- `qId: "dd1"` does not conflict with q1–q40
- No `console.log` in production code
- Admin add form: menu, switch case, helpers, collectTestData all correct
- Admin edit form: menu, createQuestionItem, syncDOMToData all correct

---

## Manual Test Checklist

### Existing question types (regression)
- [ ] Open a test with gap-fill question — answers, saves, scores correctly
- [ ] Open a test with true-false-notgiven — answers, saves, scores correctly
- [ ] Open a test with multiple-choice — answers, saves, scores correctly
- [ ] Navigate between passages — answers from passage 1 not reset when going to passage 2
- [ ] Timer continues counting when drag_drop question is visible
- [ ] Finish button shows correct total score (existing questions unaffected)

### New drag_drop question type
- [ ] Items (A, B, C) are visible in the items bank
- [ ] Items can be dragged to slots
- [ ] Only one item per slot (dropping a 2nd item displaces the first)
- [ ] Item displaced from a slot returns to the bank
- [ ] Navigating to a different passage and returning restores the drag_drop answer
- [ ] Correct answer is scored correctly (each slot independently)
- [ ] Partial answer (some slots empty) does not crash the app

### Admin — Add form
- [ ] "Drag & Drop Matching" option appears in the "Add Question" menu
- [ ] Clicking it shows items list and slots list in the form
- [ ] Items can be added and removed dynamically
- [ ] Slots can be added and removed dynamically
- [ ] After removing/renumbering a passage, menu still creates drag_drop (not gap-fill)
- [ ] Saving a test with a drag_drop question persists items + slots to Firestore
- [ ] The saved test opens correctly in the test runtime
- [ ] Validation: saving without correctId matching any item ID shows error (if implemented)

### Admin — Edit form
- [ ] An existing drag_drop question loads with its items and slots pre-filled
- [ ] Editing items/slots and saving updates Firestore correctly
- [ ] Editing drag_drop does not change other questions in the test

### Mobile / touch
- [ ] Drag and drop works via touch events — EXPECTED TO FAIL (no touch fallback, tracked as yellow flag)
