# Developer pitch — 5 minutes

*Audience: engineers, tech leads, CTOs.*  
*Lead with what we offer and why it is one product — not a tour of every screen.*

**What we sell:** one login from first lesson → judged practice → live contest → scored interview → human TA → placement — with billing on the same account.

**What others usually ship:** a course site, *or* a problem set, *or* a mock interview. We run all three on one schema, and we isolate the two hard parts (untrusted code, live ranks) instead of faking them.

---

**Open (20s):**

> “Most coding products pick one lane — courses, a judge, or interview practice — and you stitch the rest with three other vendors. We built one platform: learn, get judged for real, compete live, interview with a score, escalate to a human, and pay on the same account. I’ll cover the pieces that are actually hard to copy, and skip the CRUD.”

---

### 1. What we are offering (35s)

> “For the learner it is a single career loop. Catalog courses — DSA, Node, React, System Design — plus AI-generated notebooks from their own notes. Daily practice against a real sandbox, not a checkbox. Timed contests with a live leaderboard that freezes when the round ends. A scored JS mock interview, and a TA queue when the model is not enough. Placement and a resume sit on the same profile.  
> For the business: Razorpay checkout, bundles, AI credits, gift, referral, and affiliate payouts. You can run a weekend contest from admin without a deploy.”

*Do not list Blog, Visualizer, Roadmaps, Gift unless they ask.*

---

### 2. Why this is not five tools glued together (30s)

> “One Postgres schema, one user id, one JWT after Clerk sign-in. Role is on the token — User, TA, Admin — and every mutation is checked on the API, not only in the UI. Progress, submissions, enrollments, tickets, and ranks all point at that user. That is why ‘continue learning’, certificates, contest history, and billing do not drift. Competitors that mash a course LMS onto LeetCode-style practice usually have two identity systems and no shared progress.”

---

### 3. Learn + metered AI generation (40s)

> “Catalog courses are normal relational content. Progress is per-user, per-item — ‘Continue Learning’ is the last incomplete item, not a second service. Streaks update on completion, not a nightly cron.  
> The differentiator is generation: they paste a topic or notes, we call Mistral with a structured prompt, validate the JSON against a schema, then persist units, topics, and MCQs. We do not write model output until it matches shape. Generated and catalog courses share the same player and progress pipeline — the app does not fork. Each generate debits an AI credit at the point of use, so LLM cost is a product line, not an unbounded bill.”

---

### 4. The judge — this is the moat (50s)

> “A course site cannot do this, and a lot of ‘practice’ apps fake it. The submission does not run in the Node process. It goes to Docker — one isolated container per run — so untrusted code never touches the host.  
> Three harnesses: classic stdin/stdout, JS function signatures, and React component render. Same `Submission` model for playground and contests; practice lives on a PRACTICE catalog, timed rounds are RATED or UNRATED. Verdict and structured diagnostics are stored. On fail we ask the model for a *conceptual* hint — schema-validated, no full solution, no hidden tests. On pass we keep their accepted code so they can resume.  
> That is why we can sell interview prep and contests from the same engine.”

---

### 5. Live contests without melting Postgres (30s)

> “Status is a clock: Upcoming → Live → Ended from start/end time, with a locked job so two API replicas do not double-flip. While live, ranks are a Redis sorted set — O(log n) updates, not a full table scan per submit. When the contest ends we snapshot into Postgres and that snapshot is the official board. Course platforms skip this. Judge-only sites often recompute rank in SQL under load. We split hot path and audit path on purpose.”

---

### 6. Interview score + human fallback (30s)

> “Mock interview is not a chatbot with a timer. We capture audio, transcribe, score against a rubric, and return Select / Borderline / Reject — the same language a hiring loop uses. Meeting-comms practice is lighter: scenario plus coaching, no hiring verdict, because that is rehearsal, not evaluation.  
> If they are still stuck, TA Help is a real queue on the same database: waiting → claimed → replied → resolved. The desk is a role-filtered view, not another product. AI first, human when it matters — most platforms give you one or the other.”

---

### 7. Money on the same account (25s)

> “Razorpay: one webhook, branch on product type — course, AI credit, or bundle — then enrollment. Gift, referral, and affiliate sit on that user. Affiliate tracks KYC and payouts because that is money out. Certificates are completion-gated off the same progress we already store. You are not bolting Stripe and a cert SaaS onto a judge later.”

---

**Close (20s):**

> “So what we offer is the full loop in one login. What is hard to copy is the combination: schema-validated AI courses that play like catalog content, a Docker judge with three harnesses, Redis ranks that freeze into Postgres, and a scored interview with a human queue — all billed on one webhook. Happy to go deep on the sandbox, the leaderboard snapshot, or the generation schema — whichever you would evaluate first.”

---

## If they ask “how are you better than X?”

| They compare to | You say |
|---|---|
| Udemy / course LMS | “They teach. They do not isolate untrusted code or run a live contest board.” |
| LeetCode / judge-only | “They judge. They do not enroll you in a paid track, generate a course from notes, or hand you a TA and a job board on the same user.” |
| Interview coaches / Pramp-style | “They talk. We also persist a real verdict from a sandbox, and we meter the LLM.” |
| “We’ll integrate three APIs” | “You will have three logins, two progress models, and no shared submission history. That is the integration tax we already paid.” |

---

## Stack (only if asked)

| Layer | Choice | Why |
|---|---|---|
| Web | Next.js App Router | Product UI, Clerk, checkout |
| API | Express (not Next route handlers) | Long judge timeouts, raw Razorpay webhook, background jobs |
| Data | Postgres + Prisma | Progress, submissions, enrollments, tickets — one graph |
| Identity | Clerk → platform JWT | We do not store passwords; API still role-checks every mutation |
| Judge | Docker, isolated per run | Untrusted code never shares the API process |
| Live ranks | Redis sorted sets | Fast during LIVE; Postgres snapshot is official |
| LLM | Mistral, JSON schema-validated | Persist only after shape check (courses, hints, interview) |
| Pay | Razorpay webhook | Course / credit / bundle on one handler |

---

## Do not say

- “Next.js API routes run the backend” — they do not. Express does.
- “Certificates are rendered on the server” — they are completion-gated; PDF is generated in the client from a template.
- Every sidebar item. Visualizer, blog writer, roadmaps are not the pitch.
