# Claude Code prompts: fix weak pole labels on the Matrix

Run these in order. Each one is a single prompt you can paste.

**Problem:** some forces have poles like `["Doesn't happen", "<force title>"]`. Matrix question 2 ("By [horizon], could you honestly picture either of these happening?") then compares "nothing" against the title. Users can't tell whether both outcomes are plausible, so placement on the uncertainty axis breaks.

**Rule:** a force is a variable. Its two poles are opposite end states of that variable. Each pole is a short outcome (2–5 words) that someone could picture by the horizon.

- Bad: `["Doesn't happen", "US dependent on Chinese power-electronics components"]`
- Good: `["US supply diversifies", "Dependence on China deepens"]`
- Good: `["Tariffs soften", "Tariffs bite harder"]`

---

## Prompt 1: Shared pole validator

```
Add a shared validator for force poles, used by both server and client.

Create lib/poles.ts that exports:
- GENERIC_POLE = /^(low|high|no|yes|none|not|more|less|same|status quo|increase|decrease|happens|it happens|doesn.?t happen|does not happen|won.?t happen|nothing changes)$/i
- isPoleOk(title: string, pole: string): boolean. False if the pole is empty, matches GENERIC_POLE (after trimming), or equals the force title (case-insensitive, trimmed).
- arePolesWeak(title: string, poles: [string, string]): boolean. True if either pole fails isPoleOk, or if the two poles are equal (case-insensitive).

Add unit tests that cover: "Doesn't happen", "Low"/"High", a pole that equals the title, identical poles, and the good examples ["Tariffs soften","Tariffs bite harder"].
```

## Prompt 2: Fix pole generation

```
Find every AI prompt or server function that creates or edits force poles: KB→signals extraction, manual signal create/AI-assist, event→force linking, and anything that writes signals.pole_a / pole_b.

1. Add this instruction and these examples to each prompt:
   "A force is a variable. Return its two poles as opposite END STATES of that variable, each 2–5 words, each an outcome a strategist could picture by the horizon. Never use 'Doesn't happen', 'Happens', 'Low'/'High', 'Yes'/'No', the force title, or a negation of the other pole.
   Bad: ['Doesn't happen', 'US dependent on Chinese power-electronics components']
   Good: ['US supply diversifies', 'Dependence on China deepens']
   Good: ['Tariffs soften', 'Tariffs bite harder']"
2. After the AI returns poles, run arePolesWeak(). If it returns true, regenerate once and say what failed (e.g. "pole_a is generic"). If it is still weak after that, save the poles anyway and set signals.poles_need_review = true (add this boolean column, default false, in a migration).
3. Event linking: the `toward` value on an event link must match pole_a or pole_b exactly (or a pole_aliases key). Validate this server-side.
```

## Prompt 3: Backfill existing forces

```
Write a one-off backfill (script or edge function, safe to rerun) that fixes forces with weak poles in existing projects.

For each signal where arePolesWeak(title, [pole_a, pole_b]) is true:
1. Regenerate the poles with the same prompt as Prompt 2. Give it the force title, body, and the titles of linked events with their current side, so each pole matches the events already pulling that way.
2. Merge the old values into pole_aliases: { [old pole_a]: "a", [old pole_b]: "b" }. Existing event links whose `toward` holds the old text then still resolve to the same side.
3. Update pole_a / pole_b. Do NOT change matrix_placements, axes, or axis_headlines.
4. Set poles_need_review = true if the result is still weak.

Log a dry-run report first (signal id, old poles → new poles), and only write changes when run with --apply.
```

## Prompt 4: Matrix UI, inline pole editor

```
On the Matrix page, port the pole editor from the reference: components/matrix-v2.jsx (MXPoleEditor, mxPolesWeak, mxPoleOk) and Matrix Standalone v2.html.

1. In the assess panel header, replace the "Can go two ways: A or B" line when arePolesWeak() is true OR poles_need_review is true. Show an amber box instead: "Name both ends of this force", with two inputs ("← One end", "Other end →"). Prefill only the poles that pass isPoleOk. Placeholders: "e.g. Dependence falls fast" / "e.g. Dependence deepens".
2. Disable "Save ends" until both inputs pass isPoleOk and the two are different.
3. On save, call a server action setPoles(signalId, [a, b]). It updates pole_a / pole_b, merges the old values into pole_aliases (same as the backfill), and sets poles_need_review = false. RLS: project editors only. Revalidate the matrix data.
4. After saving, the question 2 cards and answer buttons show the new names immediately.
5. Change the question 2 answer copy to: "Yes, both plausible" / "Only ← <pole A>" / "Only <pole B> →".
6. Show the same editor in the Signals Library force detail view whenever the force is weak, so it can be fixed outside the Matrix too.
```

## Prompt 5: Tests

```
Add tests for the pole fix:
- Seed a force with poles ["Doesn't happen", <its title>] and two linked events, one per side.
- Matrix: the assess panel shows "Name both ends of this force" instead of "Can go two ways".
- Save stays disabled for "Doesn't happen", for a value equal to the title, and for two identical values.
- After saving ["US supply diversifies", "Dependence on China deepens"]: the question 2 cards and buttons show the new names, each event stays on its original side (because pole_aliases holds the old text), and an existing placement for the force is unchanged.
- Backfill dry run lists the seeded force; --apply fixes it, and a second run reports nothing to fix.
- Generation: when the mocked AI returns weak poles, the system regenerates once, then sets poles_need_review.
```
