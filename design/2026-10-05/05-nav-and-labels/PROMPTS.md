# 05 — Navigation and label fixes

These are small edits with no reference HTML. Run them as one prompt.

---

## Prompt 1 — Nav order, "+ Add Signal" removal, Storyline wording

1. **Sidebar order.** In the DECISIONS group of the app shell nav, list **Monitoring** before **Strategy**: Monitoring runs first and feeds Strategy. Keep the icons as they are (Activity for Monitoring, Target for Strategy). Rename the page title map entry `strategy: "Strategic Options"` to `"Strategy"`.
2. **Top-bar "+ Add Signal" button.** Hide it on `signals`, `projects`, `home`, `dashboard`, `matrix`, `canvas`, `monitoring`, `strategy` and `storyline`. It still shows on Knowledge Base, Narrative and Settings. Use one array check:
   `!["signals","projects","home","dashboard","matrix","canvas","monitoring","strategy","storyline"].includes(page)`
3. **Storyline wording.** A storyline is a chain of events, so make these changes:
   - The page button "+ Add Signal to Chain" becomes **"+ Add event to chain"**.
   - The per-column "+ Add signal" becomes **"+ Add event"**.
   - The picker modal title and `aria-label` "Add signal to storyline" become **"Add event to storyline"**. Rename the file and component from `signal-picker-modal` / `SignalPickerModal` to `event-picker-modal` / `EventPickerModal`.
   - In the modal, the library tab lists **events** (from the Signals library), not forces. The "Create new" tab creates an event, links it to a force and pole, and then adds it to the chain. The new event therefore appears in Signals and is tracked by Monitoring.

Acceptance:
- The sidebar shows Monitoring above Strategy.
- No "+ Add Signal" appears on the nine pages listed above.
- `grep -ri "add signal to chain"` returns nothing.
- An event created from Storyline appears in Monitoring after the next scan.
