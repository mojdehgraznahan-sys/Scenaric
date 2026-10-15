# Claude Code prompts: show onboarding answers in Settings → Project

Reference UI: `Settings Onboarding Answers Standalone.html` (same folder). Open it in a browser. It's self-contained and has sample answers.
Prototype source: `components/onboarding.jsx` (`INTERVIEW`) and `components/page-monitoring-settings.jsx` (`OnboardingAnswers`).

**What it does:** Settings → Project gets an "Onboarding answers" section below Industry. It shows the framing interview the user completed during onboarding, as four collapsible blocks:
- A: The focal decision (awake, decision, owner, stakes)
- B: The unknowns (o1, plus o2 and o3, which are optional)
- C: Good & bad outcomes (good, bad, turns)
- D: Predetermined vs uncertain (given, open, actors)

Each block header shows its tag, its title, and a count of answers (or "Not answered"). When a block is open, it lists every question with the saved answer, or "No answer" in muted italics. "Edit answers" turns the answers into textareas, with Save and Cancel. Saving does **not** regenerate the focal question.

Run these prompts in order.

---

## Prompt 1: Repo check and question config

```
Read the reference file settings_onboarding_handoff/Settings Onboarding Answers Standalone.html.

1. Find the onboarding flow and the Settings → Project page in our app. Report their file paths before changing anything.
2. Move the interview definition (blocks A–D with ids, tags, eyebrows, and questions, using the ids awake, decision, owner, stakes, o1, o2, o3, good, bad, turns, given, open, actors) into one shared module, e.g. lib/onboarding/interview.ts. Export it as INTERVIEW, with types:
   type InterviewQuestion = { id: string; q: string; ph?: string; big?: boolean; opt?: boolean }
   type InterviewBlock = { id: string; tag: "A"|"B"|"C"|"D"; eyebrow: string; intro: string; research?: boolean; qs: InterviewQuestion[] }
3. Update onboarding to import INTERVIEW from that module. Do not change any copy.
```

## Prompt 2: Schema and persistence

```
Persist each project's onboarding answers.

1. Migration: add a table project_onboarding_answers:
   project_id uuid PK references projects(id) on delete cascade
   answers jsonb not null default '{}'   -- { [questionId]: string }
   completed_at timestamptz null
   updated_at timestamptz not null default now()
   updated_by uuid references auth.users(id)
   (If onboarding already stores the interview in another place, e.g. projects.onboarding jsonb, use that instead. Don't duplicate it. Tell me which you chose.)
2. RLS: project members can select; project editors and owners can insert and update.
3. Onboarding: when onboarding finishes (the launch step), upsert the answers along with completed_at. Write answers exactly as the user typed them, without the AI-refined focal question.
4. Backfill: if existing projects already have interview answers stored somewhere else, copy them across. If not, there's nothing to backfill, and the UI will show "Not answered".
```

## Prompt 3: Server functions

```
Add these server functions (server actions or API routes, whichever the repo uses):

- getOnboardingAnswers(projectId) → { answers: Record<string,string>, completedAt: string|null }
  Return { answers: {} } if there's no row.
- updateOnboardingAnswers(projectId, patch: Record<string,string>)
  - Only accept keys that are question ids in INTERVIEW; reject unknown keys.
  - Trim values; an empty string clears that answer.
  - Cap each answer at 4,000 characters.
  - Merge the patch into the existing answers (don't replace the whole object), and set updated_at and updated_by.
  - Return the merged answers.
  - Must NOT change projects.focal_question or anything generated from it.
Add input validation with the repo's existing validation library (e.g. zod).
```

## Prompt 4: Port the UI

```
Add an OnboardingAnswers component to Settings → Project. Place it below the Industry field and above the project assistant. Match the reference file exactly:

- Header: "Onboarding answers" (14px/600) with the helper text "What you told us when framing the project. The focal question, key forces and scenarios were drawn from these." On the right, a mono uppercase count: "N OF 13 ANSWERED". Count the total from INTERVIEW; don't hard-code 13.
- One collapsible card per block. The header row has a 22px orange-50 tag chip (A–D), the mono eyebrow, a count ("2/4", or "Not answered" in amber #B45309 when the block has no answers), and a chevron that rotates when the block opens. Block A starts open, and only one block is open at a time.
- Body: for each question, show its label (12px, muted). Optional questions get " (optional)". Under the label, show the answer (13.5px, pre-wrap) or "No answer" in muted italics.
- Edit mode is per block. "Edit answers" turns that block's answers into textareas: 3 rows when big, otherwise 2, using the onboarding placeholders. "Save answers" calls updateOnboardingAnswers with only that block's keys, applies the change optimistically, and rolls back with an error toast if it fails. "Cancel" throws away the changes. While editing, show this note: "Editing these won't rewrite your focal question. Use the assistant below to re-sharpen it."
- Viewers (read-only role): hide "Edit answers".
- Load the answers on the server with the page, so there's no loading flash. If the request fails, show the section with an inline "Couldn't load answers. Retry." message.
- Use the repo's existing Button, Textarea, and Card components and design tokens. Do not copy the inline styles verbatim.
```

## Prompt 5: Tests

```
Add tests:
- A project with every answer filled shows "13 OF 13 ANSWERED", and each block shows its count.
- A project with no answers row shows "Not answered" on every block and "No answer" for every question. Edit still works and creates the row.
- Edit block C, change "turns", save, and reload: the new value is there, the other blocks are unchanged, and projects.focal_question is unchanged.
- Cancel throws away the changes.
- A viewer sees no "Edit answers" button, and updateOnboardingAnswers rejects their call (RLS).
- updateOnboardingAnswers rejects unknown keys and values over 4,000 characters.
- Completing onboarding writes the answers, and Settings shows them right after.
```
