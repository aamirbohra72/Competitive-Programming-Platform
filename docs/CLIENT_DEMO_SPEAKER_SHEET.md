# Client demo — speaker sheet + rehearsal

**Length:** 2–3 minutes (90-second cut at the end)  
**URL:** http://localhost:3000 (or production)  
**Pitch:** One platform from first lesson → daily practice → live contest → mock interview → job-ready.

Print this page. Keep it beside the browser. Do not read the sidebar out loud.

Need every feature in 15 seconds each? Use [FEATURE_EXPLAIN_SCRIPT.md](./FEATURE_EXPLAIN_SCRIPT.md).  
Walking this as a developer in 5 minutes? Use [DEVELOPER_WALKTHROUGH_5MIN.md](./DEVELOPER_WALKTHROUGH_5MIN.md).

---

## Before the call (2 minutes)

1. App is running (`npm run dev`). Web `:3000`, API `:3001`.
2. You are **already signed in** as a normal user. Do not log in live unless they ask.
3. Confirm these four pages load:
   - `/` Home
   - `/learn` Courses
   - `/practice` Practice (at least one problem)
   - `/contests` Contests (ideally one **Live**)
4. Second tab ready: `/admin/dashboard` (only if they ask how staff creates contests).
5. Do **not** start a full Interview recording. Stay on the intro screen.

If a page is empty or errors, use the **Backup line** in that step. Keep moving. Never debug on the call.

---

## One-page speaker sheet

| Time | Click | Say this | If it fails, say this |
|---|---|---|---|
| **0:00–0:20** | `/` Home. Point at the four cards. | “This is our coding career platform. A learner does not bounce between five tools. They learn, practice, compete, and prepare for interviews in one place. Four paths: Courses, Practice, Contests, Projects.” | “Home is the hub. Same four paths sit in the top nav — I’ll jump straight into learning.” Then go to `/learn`. |
| **0:20–0:50** | **Courses** → open **Salaam DSA** (or any course) → one tutorial / notebook. | “Courses are the paid learning path — DSA, Node, React, System Design. Lessons, quizzes, and assignments sit in one track. Progress and a daily streak are saved. We can also generate a custom course from notes using AI. Billing is Razorpay — courses, credits, and bundles.” | “Catalog is the storefront. Same idea: structured tracks, progress, checkout. I’ll show the part clients care about next — the real judge.” Skip to Practice. |
| **0:50–1:20** | **Practice** → Easy JS problem → editor → **Submit**. | “This is the playground. Filter by company, language, difficulty. They write code here. Our judge **runs** it — not a fake checkbox. Classic I/O, JavaScript functions, and React components. Fail → hint, not the full answer. Pass → solution is saved.” | “Judge is Docker-backed. If this run is slow, the product still stores submissions and verdicts. I’ll show contests next — same judge, under a clock.” Open `/contests`. |
| **1:20–1:50** | **Contests** → **Live** contest → problems → **Leaderboard**. | “Contests are timed. Upcoming, live, ended — automatic. Register, solve under a countdown, ranks update live. When it ends, the board freezes so results stay official. Admins create contests from a dashboard — no engineering ticket.” | “If this round isn’t live, the lifecycle is the same: register → solve → rank. Ended contests keep a frozen board. I’ll show interview next.” Open `/interview`. |
| **1:50–2:20** | **Interview (JS)** — intro only. Then **Placement Support**. Glance **TA Help** if time. | “Practice is not only typing code. Timed mock interview: mic or camera, spoken answers, AI transcription and scoring, then Select / Borderline / Reject. Stuck? Raise a TA ticket. Placement is the last mile: jobs, applications, resume builder — same login.” | “Interview is a timed voice round with an AI report. Placement is jobs plus resume. I’ll skip the live recording so we stay in time.” Open `/billing`. |
| **2:20–2:50** | **Billing** or **Affiliate** — 5 seconds. Stop. | “Commercially this is ready: Razorpay for courses and bundles, gift a course, referral, affiliate. Certificates after a track. Under the hood: Next.js, Express, Postgres, Redis for live ranks, Docker judge, Clerk auth.” | “Payments are Razorpay. Growth loops are gift, referral, affiliate. Happy to walk checkout in a longer session.” |

**Close (10 seconds):**

> “In short: we own the full student journey — learn, grind, compete, interview, get help, get placed — and we can charge for it. Happy to go deeper on the judge, interview scoring, or the admin flow.”

---

## If they ask “what’s unique?”

> “Most products are only a course site or only a judge. This one has a real code judge, live contest ranks, a voice mock interview, TA support, and placement — plus payments — in the same login.”

---

## 90-second cut (time is tight)

1. Home — one sentence pitch  
2. Practice — submit one problem  
3. Contests + leaderboard  
4. Interview intro  
5. Close  

Skip Courses, Placement, Billing.

---

## Click-by-click rehearsal (do this once before the meeting)

Time yourself. Aim for **2:20** so you have slack.

| # | URL / click | You should see | You say (short) | Backup |
|---|---|---|---|---|
| 1 | `/` | “Build. Compete. Ship faster.” + four cards | Hub. Four paths. | Use top nav: Practice, Courses, Contests. |
| 2 | `/learn` | Course cards (DSA, Node, React, System Design) | Paid tracks + progress. | If empty: “Catalog is configurable. Practice is live.” → `/practice`. |
| 3 | `/learn/1` (or any id) | Outline / modules | Lessons, quizzes, assignments. | Skip into any `/learn/[id]/tutorials/...` or `/learn/notebook/...`. |
| 4 | `/practice` | Problem list + filters | Company / difficulty / language. | Search box still proves the catalog. |
| 5 | `/practice/[id]` | Statement + editor | Real judge, not a checkbox. | If editor missing, stay on statement and describe Run/Submit. |
| 6 | Submit | Verdict: Accepted / Wrong Answer / etc. | Hint on fail. Saved solution on pass. | “Queued or slow is fine — status is tracked.” Do not refresh-spam. |
| 7 | `/contests` | Upcoming / Live / Ended + countdown | Timed rounds. | Filter or scroll to any contest. |
| 8 | `/contests/[id]` | Challenge list | Register + solve under clock. | If Upcoming: “Opens at start time.” Still open leaderboard. |
| 9 | `/contests/[id]/leaderboard` | Ranks | Live via Redis; frozen when ended. | `/leaderboard` is the global view. |
| 10 | `/interview` | Intro / start screen only | Voice mock + AI report. | Do not click Start. `/communication` is the meeting-practice cousin. |
| 11 | `/placement` | Career hub / jobs / resume | Last mile: apply + resume. | `/projects` if placement is empty. |
| 12 | `/ta-help` | Ticket list (optional 5s) | Humans when AI is not enough. | Staff: `/ta-help/desk`. |
| 13 | `/billing` | Products / checkout | Razorpay, bundles, credits. | `/affiliate` or `/referral` for growth. |
| 14 | Stop. Home or leave the last page. | — | Close line. | — |

**Optional if they ask “how do we operate this?”**

| # | URL | Show | Say |
|---|---|---|---|
| A | `/admin/dashboard` | Staff home | Admins create contests and problems. |
| B | `/admin/contest/create` | Create form | No deploy needed to launch a round. |
| C | `/submissions` | Own history | Learner sees every verdict. |
| D | `/certificates` | Certificate list | Proof after a track. |
| E | `/dsa-sheet` + `/visualizer` | Sheet + Visual Lab | Extra study tools — skip in the 3-min cut. |

---

## Do / don’t

**Do**

- Stay signed in before the call.
- Submit a problem you already know is judge-ready.
- Pause after the judge verdict. That is the wow moment.
- Offer a deeper dive. Do not start it unless they say yes.

**Don’t**

- Create an account live.
- Start the interview recording.
- Open Prisma / terminal / `.env`.
- Apologize more than once if something fails. Use the backup line and move.
- Read every sidebar item (Blog, Gift, Roadmaps, Visualizer — only if they ask).

---

## Feature map (if they go off-script)

| They say | You open | One sentence |
|---|---|---|
| “How do people pay?” | `/billing` | Razorpay: courses, AI credit, bundles. |
| “Can we gift this?” | `/gift` | Buy a course for someone else. |
| “How do we grow?” | `/affiliate` then `/referral` | Affiliates earn; users invite. |
| “Is there a blog?” | `/blog` | Read + write, LLM-assisted. |
| “Portfolio?” | `/projects` | Idea tracks: full-stack, GenAI, agents. |
| “Meeting skills?” | `/communication` | Standup / meeting practice with coaching. |
| “DSA checklist?” | `/dsa-sheet` | Topic sheet with progress. |
| “Can they see how an algorithm works?” | `/visualizer` | Frame-by-frame DSA and LLD. |
| “Certificates?” | `/certificates` | Download after completion. |
| “Public profile?” | `/{username}` | Shareable handle. |

---

## Tech one-liner (only if they ask architecture)

> “TypeScript TurboRepo. Next.js app, Express API, Postgres + Prisma, Redis for live ranks, Docker judge, Clerk auth, Mistral for interview and coaching, Razorpay for payments.”
