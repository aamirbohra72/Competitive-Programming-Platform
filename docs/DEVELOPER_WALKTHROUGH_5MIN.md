# Developer walkthrough — 5 minutes

Speak this as an engineer. Show the UI. Name the **path**, not every file.

**Audience:** tech lead, another developer, or a technical client.  
**Product scripts:** [CLIENT_DEMO_SPEAKER_SHEET.md](./CLIENT_DEMO_SPEAKER_SHEET.md) · [FEATURE_EXPLAIN_SCRIPT.md](./FEATURE_EXPLAIN_SCRIPT.md)

**Prep:** `npm run dev` running. Signed in. `/practice` and `/contests` load. Optional: keep `apps/api/src/index.ts` in a second window — do not live-code.

**Open line:**

> “I’ll walk the platform the way it is built: one TypeScript monorepo, one login, and a few hard backends — judge, live ranks, payments, and AI — behind the rest of the product.”

---

## 0:00–0:35 — Shape of the repo

**Show:** folder tree, or just say it while Home (`/`) is open.

**Say:**

> “TurboRepo. `apps/web` is Next.js 14 App Router. `apps/api` is Express. Shared packages: Prisma in `@codeforces/db`, JWT helpers in `@codeforces/auth`, shared types in `@codeforces/types`.  
> Three roles: User, TA, Admin. Frontend talks to `/api/*`. Postgres is the source of truth. Redis is optional but it is how live contest ranks stay fast. Docker is optional but it is how we actually run user code.  
> Typical deploy: web on Vercel, API on Railway, DB on Neon.”

**Do not** open Prisma Studio.

---

## 0:35–1:05 — Auth (Clerk → our JWT)

**Show:** already signed in. Point at the user button. Optional: Network tab later, not now.

**Say:**

> “Clerk owns the identity UI — sign-in and sign-up. After Clerk is signed in, `ClerkApiBridge` calls `POST /api/auth/clerk-exchange`, we upsert the user by `clerkUserId`, and we return **our** JWT. The web app stores that token and sends `Authorization` on every API call.  
> Express middleware verifies the JWT and attaches `req.user`. Admin and TA routes go through role checks. Learners never hit TA Desk or contest create.”

**Punchline:** “Browser auth is Clerk. API auth is still our JWT. That is why older routes did not have to be rewritten.”

---

## 1:05–1:50 — Learn, progress, pay

**Click:** `/learn` → one course outline → mention `/learn/create` without generating.

**Say:**

> “Courses are a catalog plus generated notebooks. Catalog items map to Razorpay products — single courses, an AI-generate credit, and bundles.  
> Checkout creates a Razorpay order. The webhook is mounted **before** `express.json` so we verify the raw body. On paid, we write `PaymentOrder` and `Enrollment`. Course routes then gate on enrollment.  
> Progress is not local-only: `CourseLearningProgress`, per-item completion, and a `LearningStreak`. Certificates read that same progress.  
> `/learn/create` sends source text to Mistral and persists units, topics, and MCQs. That spend is the `ai-generate` credit.”

**Punchline:** “Pay → enroll → progress → certificate. One user id through the whole chain.”

---

## 1:50–3:00 — Practice + Docker judge (slow down here)

**Click:** `/practice` → open a problem → Submit if you can (or show the editor).

**Say:**

> “Practice is a `ContestKind.PRACTICE` catalog. List and filters are `GET /api/challenges`. The interesting part is submit.  
> `POST /api/submissions` validates with Zod, writes a row as `PENDING`, then the judge runs. `dockerJudgeService` sandboxes the run. Three modes: `STDIN` for classic I/O, `JS_FUNCTION` for interview-style functions, `REACT_COMPONENT` for UI tasks. Hidden tests stay hidden. We store structured `resultJson`, a hint that does **not** leak the solution, and on accept we upsert `AcceptedSolution` so they can reopen their code.  
> Concurrency is capped — queue max, slot drain on shutdown. A lifecycle job reaps stale `PENDING` rows so a dead worker cannot leave submissions hanging.  
> If Docker is down, health `/api/ready` reports it. The API still serves the rest of the product.”

**Punchline:** “This is a real judge, not a string compare in the browser.”

---

## 3:00–3:40 — Contests + live leaderboard

**Click:** `/contests` → a Live (or any) contest → `/contests/[id]/leaderboard`. Mention `/admin/contest/create` if they ask who operates it.

**Say:**

> “Public contests are `RATED` or `UNRATED` with a start and end. A 30-second lifecycle job, with a Postgres advisory lock so two API replicas do not double-flip, sets Upcoming → Live → Ended.  
> Submit during Live uses the same judge. On accept we increment a Redis sorted set. The contest leaderboard reads Redis while live, then `finalizeContestLeaderboard` writes `LeaderboardEntry` ranks and we can drop the Redis key.  
> `/leaderboard` is the global overview — ranks plus a contribution heatmap from submissions.”

**Punchline:** “Hot path is Redis. Official result is Postgres.”

---

## 3:40–4:25 — Interview, help, companion

**Click:** `/interview` (intro only) → `/ta-help` → mention the navbar companion.

**Say:**

> “Interview is a timed session: `InterviewSession` and `InterviewTurn`. Audio goes to Mistral Voxtral for transcription, then a chat model scores the answer and we persist feedback. End state is Select, Borderline, or Reject. Feature-gated in production with `INTERVIEW_ENABLED`.  
> Companion is `/api/companion/chat` — same LLM family, intents, and it can escalate.  
> TA Help is a real queue: WAITING → CLAIMED → REPLIED → RESOLVED. Learner API vs TA Desk. Roles enforce who can claim.”

**Punchline:** “AI first, human queue as fallback, same user record.”

---

## 4:25–4:50 — Career and growth (fast)

**Click:** `/placement` (2s) → `/projects` (2s) → `/billing` or `/affiliate` (2s).

**Say:**

> “Placement hub pulls careers plus a resume builder. Projects hub is tracks and ideas — can refresh from the LLM pack. Blog is the same pattern.  
> Growth is productized: gift, referral, affiliate metrics and KYC. All of that hangs off the same User and Enrollment models.  
> Staff: admin creates contests and challenges. No extra service.”

---

## 4:50–5:00 — Close

**Say:**

> “So as a developer: Next and Express, Prisma on Postgres, Clerk in front, our JWT behind, Docker judge, Redis for live ranks, Razorpay webhooks, Mistral for interview, courses, companion. Zod at the edge, role middleware, `/api/health` and `/api/ready`, smoke script in `scripts/functional-smoke.mjs`.  
> Happy to go deep on the judge harness, the contest lock, or the payment webhook next.”

---

## Click path (print this)

1. `/` — monorepo + roles  
2. Stay signed in — Clerk → `/api/auth/clerk-exchange`  
3. `/learn` — catalog, enroll, progress  
4. `/practice/[id]` — judge  
5. `/contests` → leaderboard — Redis then Postgres  
6. `/interview` — session + STT (do not Start)  
7. `/ta-help` — queue  
8. `/placement` → `/billing` — career + money  
9. Stop  

---

## If they ask “show me the code”

| Topic | Point here |
|---|---|
| Route table | `apps/api/src/index.ts` |
| Clerk exchange | `apps/web/src/components/ClerkApiBridge.tsx` → `POST /api/auth/clerk-exchange` |
| JWT + roles | `apps/api/src/middleware/auth.ts` |
| Schema | `packages/db/prisma/schema.prisma` |
| Judge | `apps/api/src/services/dockerJudgeService.ts` |
| Submit | `apps/api/src/controllers/submissionController.ts` |
| Contest clock | `apps/api/src/jobs/contestLifecycle.ts` |
| Live ranks | `apps/api/src/services/leaderboardService.ts` + `redisService.ts` |
| Payments | `apps/api/src/controllers/paymentController.ts` (webhook before JSON) |
| Interview | `apps/api/src/services/mistralInterviewService.ts` |
| Smoke | `scripts/functional-smoke.mjs` |

Do not open more than **one** of these unless they pick a topic.

---

## 90-second engineering cut

1. Monorepo + Clerk JWT bridge  
2. Submit → Docker judge → `resultJson`  
3. Live Redis ranks → finalize on ENDED  
4. Razorpay raw webhook → Enrollment  
5. Close  

---

## Do / don’t (developer)

**Do**

- Name the boundary: Next → Express → Prisma / Redis / Docker / Razorpay / Mistral.  
- Pause on submit and on the leaderboard. Those are the two hard systems.  
- Say what is optional: Redis and Docker. The API degrades; it does not lie.

**Don’t**

- Walk every sidebar item (that is the feature script).  
- Tail logs or open `.env`.  
- Start an interview recording.  
- Claim the blog writer is fully wired — reader is live; `/blog/write` is not.
