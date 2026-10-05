# Project review (original prototype → what changed)

| # | Finding in the original | Severity | Status |
|---|---|---|---|
| 1 | Critical results (suicide, self-harm, violence) only said "consider contacting a service". No phone numbers, no emphasis. | **Safety** | Fixed: crisis card with numbers (112 + MIELI line for Finland), guaranteed crisis message regardless of what the LLM says |
| 2 | Negation not handled: "I'm **not** anxious" scored as anxiety. | High | Fixed (non-critical rules only; critical is never suppressed, by design) |
| 3 | "cant sleep" (no apostrophe) did not match "can't sleep"; same for every contraction. | High | Fixed (apostrophes normalised both sides) |
| 4 | Screening looked only at the **last message**. "I feel hopeless" → "thanks" → result vanished. | High | Fixed: whole conversation is analysed |
| 5 | The chat was fake: it announced "rule-based screening detected anxiety with a score of 55/100". Alarming for users, not conversational. | High | Fixed: real LLM replies; scores never shown in chat |
| 6 | `DatePicker`/`TimePicker` used `renderInput`, which was removed in MUI X v6+ (project uses v8). Pickers would not render correctly. | High | Removed: booking now uses real server-side slots |
| 7 | `<Grid item xs={12}>` is invalid in MUI v7 (Grid v2 uses `size`). Layout warnings/breakage. | Medium | Removed Grid usage |
| 8 | Booking was `alert("Booked!")`. Nothing stored, no doctor notified. "Online/Offline" was hard-coded. | High | Fixed: real appointments, availability, emails |
| 9 | Clinicians hard-coded in the frontend; the list was identical for every severity/symptom. Two doctors shared one email address, and doctor emails were shown publicly to patients (privacy). | High | Fixed: DB-backed, ranked per screening, emails never exposed |
| 10 | Scoring rules were downloadable and tamperable in the browser. | Medium | Moved server-side |
| 11 | No persistence: refresh lost everything. "Your Data" showed only in-memory state. | Medium | Fixed: accounts, history, export, delete |
| 12 | Default CRA test ("learn react") would fail; `index.html` title "React App"; manifest/placeholder icons referenced missing files; package name `my-brain`. | Low | Fixed |
| 13 | README claimed React 18, Redux, TypeScript, PostgreSQL, MongoDB. None are used (React 19, hooks only). | Low | README rewritten to match reality |
| 14 | README says "data will be analysed to enhance the product". Health data is special-category data under GDPR; needs explicit consent. | Legal | Opt-in switch (off by default) added. No analytics pipeline built |
| 15 | Chat did not scroll, Enter didn't send, no loading state, no input limits. | Low | Fixed |
