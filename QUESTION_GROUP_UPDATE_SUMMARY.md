# Question Group Update Summary

## Changes Made

### 1. Improved Design of Group Type Selector
- **CSS**: Enhanced the dropdown with gradient background, better borders, and hover effects
- Location: `listening.css` lines 899-924
- Features:
  - Gradient purple background
  - 2px solid border with hover effects
  - Smooth transitions and shadow on hover

### 2. Multi-Select Structure (Fixed)
**New Structure:**
1. Group instruction (optional)
2. **Question text** - Main question (e.g., "Which THREE features does the speaker mention?")
3. **Options** - A, B, C, D, etc. with text
4. **Correct Answers** - Comma-separated answer letters (e.g., "A,B,C")

**JSON Output Format:**
```json
{
  "type": "question-group",
  "groupType": "multi-select",
  "questionId": "q18_19_20",
  "groupInstruction": "Questions 18-20\nChoose THREE letters, A-G.",
  "text": "Which THREE of the following features of the area in Spain does the speaker talk about?",
  "options": {
    "A": "altitude",
    "B": "coastline",
    "C": "economy",
    ...
  },
  "questions": [
    {
      "questionId": "q18",
      "correctAnswer": "A"
    },
    {
      "questionId": "q19",
      "correctAnswer": "F"
    },
    {
      "questionId": "q20",
      "correctAnswer": "G"
    }
  ]
}
```

### 3. Matching Structure (Fixed)
**New Structure:**
1. Group instruction (optional)
2. **Options** - A, B, C with text
3. **Individual Questions** - Each with question text and correct answer

**JSON Output Format:**
```json
{
  "type": "matching",
  "groupInstruction": "Questions 25-30\nWrite the correct letter, A, B or C...",
  "options": {
    "A": "They gave higher marks.",
    "B": "They gave lower marks.",
    "C": "Their marks were not significantly different."
  },
  "questions": [
    {
      "questionId": "q25",
      "text": "male students marking female presenters",
      "correctAnswer": "B"
    },
    {
      "questionId": "q26",
      "text": "female students marking male presenters",
      "correctAnswer": "C"
    },
    ...
  ]
}
```

### 4. Dynamic UI Toggling
- Added `handleGroupTypeChange()` function
- When "Multi Select" is selected:
  - Shows: Question text input (green background)
  - Shows: Group answers input (yellow background)
  - Hides: Individual questions section
  
- When "Matching" is selected:
  - Shows: Individual questions section
  - Hides: Question text input
  - Hides: Group answers input

### 5. Updated Validation Logic
**Multi-Select Validation:**
- Question text must be filled
- At least one option must be added
- All option texts must be filled
- Group answers field must be filled (comma-separated)

**Matching Validation:**
- At least one option must be added
- All option texts must be filled
- At least one individual question must be added
- All individual question texts must be filled
- All individual question answers must be filled

### 6. Updated Data Collection Logic
- `listening.js` lines 1920-1974
- Properly handles both types differently
- Multi-select: Creates questions array from comma-separated answers
- Matching: Creates questions array from individual question items with text

## Files Modified
1. `/Users/abdulaziz/Documents/YES/pages/addTests/listening/listening.css`
   - Lines 789-950: Added/updated styles for option labels, buttons, and group sections

2. `/Users/abdulaziz/Documents/YES/pages/addTests/listening/listening.js`
   - Lines 589-647: Restructured question-group HTML generation
   - Lines 1185-1256: Updated helper functions (addOption, addGroupQuestion, handleGroupTypeChange)
   - Lines 1920-1974: Updated data collection logic
   - Lines 2302-2355: Updated validation logic

## Testing Checklist
- [x] No linter errors
- [ ] Test multi-select: Add question, fill fields, verify JSON output
- [ ] Test matching: Add question, fill fields, verify JSON output
- [ ] Test switching between types
- [ ] Test validation for both types
- [ ] Test add/remove options
- [ ] Test add/remove individual questions (matching only)
- [ ] Verify proper JSON structure matches expected format

## How to Test
1. Open `/Users/abdulaziz/Documents/YES/pages/addTests/listening/listening.html` in browser
2. Add a new section
3. Click "Add Question" > "Question Group"
4. Test Multi-Select:
   - Leave default "Multi Select" selected
   - Fill in group instruction
   - Fill in question text (green field)
   - Add options (A, B, C...)
   - Fill in correct answers (e.g., "A,B,C") in yellow field
   - Save and check console for JSON output
5. Test Matching:
   - Select "Matching" from dropdown
   - Verify question text field disappears
   - Verify individual questions section appears
   - Fill in options
   - Add individual questions with text
   - Fill in correct answer for each
   - Save and check console for JSON output

