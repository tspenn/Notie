# Notie — full build prompt

Paste this into an agent with workspace root `E:\Notie` (or open that folder first).

---

Build **NOTIE** — FRIDAY Canvas reframed for long-form writing / journaling, **without AI**.

Reference product (read-only patterns, do not modify unless building a fork):  
`E:\FRIDAY\FridayCanvas-pc` — reuse architecture where it maps (Library ← Dashboard/Canvas, Notebook ← WorkZone, Categories, saved items, calendar, push). Strip all AI.

## Positioning

- For journaling, novel notes, Bible study, essays, long-form note-taking/writing.
- Organization/planning can happen; it is **not** the pitch.
- Tagline direction: “A quiet place for the writing that takes time.”
- Keep Canvas capabilities **except** anything AI-related.

## Strip all AI

- No FRIDAY chat/orb, AI assistant, credits, Watch List, tab awareness, proactive sweeps, AI summaries/briefs.
- No AI copy on marketing or in Settings.

## Keep (non-AI)

- **Library** (Dashboard/Canvas) + **Notebook** (WorkZone).
- **Categories** — unchanged (same concept as FRIDAY Canvas).
- **Entries** — rename Sessions → **Entries** everywhere (UI, copy, “Previous entry: …”).
- Calendar integration.
- Push notifications as **“Note to self”** (must have notifications enabled on device/s).
- Text, images, files, lists/to-dos, archive/restore; non-AI share patterns if present.
- Offline/local + cloud sync per pricing.
- **Global search** across the whole Library (titles, entry body, lists, file names).

## Library / shelf UI

- Project columns **look like books** on a shelf (spines/covers), not abstract cards/columns.
- **Reading lamp** icon instead of lighthouse.
- Short note field label: **Inspiration** (user-editable; not AI-generated slogans).
- Continuity line: **Previous entry: [title] — [date]** (Entries, not Sessions).

### Large screens (important)

- **Left:** book (spine/cover) + notebook title.
- **Right:** reading lamp + **Inspiration** write-in field.
- “Previous entry: …” above the row or full width.
- **Small screens:** stack — book/title, then Inspiration with lamp; keep lamp + Inspiration together.

## Notebook

- WorkZone-class surface: long-form writing, images, files, categories, lists, entry history.
- Language: **Entry / Entries**, not Session / Sessions.

## Visual

- Pastel “sea glass paper”: sand/mist paper, charcoal ink, teal or moss accent.
- **NO** pink, lavender, purple gradients, cream+terracotta cliché, dark-mode-first.
- Calm literary notebook — writing first; chrome second.
- Marketing: brand **Notie** is hero-level; one composition, not a widget dashboard.

## Pricing

- **One device:** $9.99 one-time (local; no multi-device sync).
- **Cloud Sync:** $3.99/month across devices (yearly option recommended).
- No AI credits. No SMS/Twilio.

## How to use + Calendar setup (required — user features, NOT AI)

Calendar connect/sync is a **user** function (ICS / Google / Outlook-style links). AI only *consumed* calendar data in Canvas; Notie keeps setup + sync and drops AI reading it.

Include in Settings and/or About → **How to use**:
- How Library, Notebook, Entries, Categories, Inspiration, and search work (short).
- **Connect your calendar:** paste ICS / iCal secret link; step-by-step for Google Calendar (Settings and sharing → Integrate calendar → Secret address in iCal format); note Apple/Outlook ICS where relevant.
- Sync now; read-only — Notie does not write back to their calendar.
- Optional: domain allowlist for school/work calendar hosts (as in Canvas Settings).
- **Note to self:** notifications require notifications enabled on device/s.

If Notie was already built without this: **do not restart from scratch** — add How to use + calendar setup to Settings/About and wire Calendar connect UI if missing. Re-read this whole prompt and patch gaps.

## Settings page (required — rename FRIDAY Canvas → Notie)

Build a full Settings experience modeled on FRIDAY Canvas Settings, with **every** user-facing string rebranded. Search/replace mindset: `FRIDAY Canvas` / `FRIDAY` / `Friday` (product) → **Notie**; `Session`/`Sessions` → **Entry**/**Entries**; WorkZone → **Notebook**; Dashboard/Canvas → **Library**.

### Remove from Settings entirely
- FRIDAY AI / assistant toggle, voice gender (Man/Gal FRIDAY), tab awareness, Watch List / SMS alerts, AI credits displays, anything that only exists for the AI product.
- Do not leave “FRIDAY Assistant” under About.

### Keep / rebrand
| Canvas (approx.) | Notie |
|------------------|--------|
| Settings | Settings |
| Subscription / plan | One Device ($9.99) vs Cloud Sync ($3.99/mo; yearly optional) |
| Ping my phone | **Note to self** (push notifications) |
| Continue where I left off | Keep; say “last notebook / entry” not project/WorkZone |
| Install PWA / home screen | Install **Notie** as an app |
| Backup / restore | Notie backup (rename file magic/extension from `.fridaybak` / FRIDAY strings → Notie-specific, e.g. `.notiebak`) |
| About | About **Notie** — writing notebook, no AI |
| Archive | Archived notebooks / entries |
| Chrome extension (if Canvas-only AI) | Omit unless it serves non-AI capture; default **omit** |
| Display name for FRIDAY | Account / display name only if needed — not “what FRIDAY calls you” |

### Note to self (notifications) — Settings copy
- Title: **Note to self**
- Body: Keeps you informed even when you are away from your desk (reminders you set, sync-related alerts if any).
- Requirement line (always visible): **Must have notifications enabled on your device/s.** Install Notie (or allow notifications in the browser) on each phone or computer you want notified.
- Max per day / priority controls OK if useful; language is notifications, never SMS/text/Twilio.
- Toasts: “Note to self enabled” / disabled — not “Ping my phone” or “FRIDAY Canvas”.

### Global find-replace checklist in Settings (+ About nested there)
- [ ] No remaining “FRIDAY Canvas”, “FRIDAY”, “WorkZone”, “Session(s)” in UI strings
- [ ] No AI credit, Watch, tab awareness, or assistant voice controls
- [ ] Plan copy matches One Device vs Cloud Sync
- [ ] Backup strings say Notie only
- [ ] Notification strings say Note to self + device notifications requirement

## Copy examples

- Inspiration  
- Note to self  
- Previous entry: …  
- Must have notifications enabled on your device/s.
- Notie (never FRIDAY Canvas in product UI)

## Out of scope

Anything AI. Do not reintroduce FRIDAY personality or Watch.

## Deliverable

Landing + Library (books) + Notebook + Entries + Categories + calendar + **Settings (fully rebranded Notie)** + Note-to-self notifications + global search + two pricing plans. Reuse Canvas architecture where it maps; rename Sessions→Entries; restyle columns as books; lamp + Inspiration on the **right** on large screens.
