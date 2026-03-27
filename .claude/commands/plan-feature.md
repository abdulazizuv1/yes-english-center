Launch the researcher agent to map the codebase for this feature: $ARGUMENTS

After researcher returns its summary, launch the architect agent with:
- The researcher's summary
- The original feature request: $ARGUMENTS
- Instruction to save the plan to plans/

After the architect saves and returns the plan, show it to the user and ask:
"Plan saved. Proceed with implementation? (yes/no)"

Do NOT write any code until the user confirms.
