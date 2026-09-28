# Feature explain script

Use this when the client wants **every feature in short**, not only the 2–3 minute demo.

**Rule:** One feature = 15–20 seconds. Open the page, say the lines, move on.  
**Companion:** [CLIENT_DEMO_SPEAKER_SHEET.md](./CLIENT_DEMO_SPEAKER_SHEET.md) is the timed 3-minute client cut.  
**Developer 5-min walk:** [DEVELOPER_WALKTHROUGH_5MIN.md](./DEVELOPER_WALKTHROUGH_5MIN.md).

**Open line (say once):**

> “Same login, full journey: learn, practice, compete, interview, get help, get placed — and pay or grow the business from here.”

---

## 1. Start and account

### Home — `/`

> “This is the hub. Four doors: Courses, Practice, Contests, Projects. If they already started a course, we show Continue Learning so they pick up where they left off.”

### Sign in / Sign up — `/sign-in`, `/sign-up`

> “Accounts are Clerk. Sign in or sign up, then the app issues our API token. Roles are User, Teaching Assistant, and Admin. Learners stay in the product; staff get extra screens.”

### Public profile — `/{username}`

> “Every learner has a shareable profile: solved counts, difficulty split, and a contribution graph. Recruiters or friends can open the handle without logging in.”

### Support companion — chat icon in the navbar

> “This is in-app help. They ask about courses, billing, jobs, or getting stuck. It can answer, deep-link into the right page, or escalate to a TA ticket.”

---

## 2. Learn

### Courses catalog — `/learn`

> “This is the storefront. Salaam DSA, Node, React, System Design. Premium courses, ratings, and enroll. Progress and a daily streak sit on the account so the next visit is not a blank page.”

### Course player — `/learn/[id]`, tutorials, assignments

> “Inside a course: modules, tutorials, and assignments. Notes and quizzes stay in one track. We mark items complete so the outline always shows where they are.”

### AI course generator — `/learn/create`

> “If a catalog course is not enough, they can generate a custom notebook from a topic or notes. That uses an AI credit from billing, then they study it like any other course.”

### Generated notebook — `/learn/notebook/[courseId]`

> “Generated courses are units and topics with MCQs. Same progress model as the catalog — complete a topic, score a quiz, keep going.”

---

## 3. Practice and compete

### Practice / Playground — `/practice`

> “Interview-style problem set. Filter by company, language, difficulty, or search. This is daily grind, not a timed contest.”

### Problem + judge — `/practice/[id]` or `/challenges/[id]`

> “Statement, samples, editor. They submit; Docker actually runs the code. We support classic stdin problems, JavaScript functions, and React components. Wrong answer gets a hint — not the full solution. Accepted code is saved so they can reopen it later.”

### Submissions — `/submissions`

> “Full history: what they sent, language, verdict, score. Same trail for practice and contests.”

### Contests — `/contests`

> “Timed rounds. Upcoming, Live, Ended update automatically, with a countdown. Rated or unrated. They register, then solve only while the window is open.”

### Contest room — `/contests/[id]`

> “Problem list for that round. Same judge as practice, but under the clock. Admins publish drafts; learners only see live catalog contests.”

### Contest leaderboard — `/contests/[id]/leaderboard`

> “While the contest is live, ranks update in real time from Redis. When it ends, we freeze the board in the database so the result stays official.”

### Global leaderboard — `/leaderboard`

> “Platform-wide standing plus a year contribution heatmap. This is reputation, not one contest.”

---

## 4. Interview and career

### Mock interview — `/interview`

> “Timed JavaScript interview. Camera or mic, they speak, we transcribe and score each answer, then a report: Select, Borderline, or Reject. I will not start a live recording in a short walkthrough.”

### Meeting comms — `/communication`

> “Not a coding round. They practice standups and day-to-day engineer meetings. AI plays the scenario and coaches the reply.”

### TA Help — `/ta-help`

> “When AI is not enough, they raise a ticket — text or video, topic and language, optional time slot. They track waiting, claimed, replied, resolved.”

### TA Desk — `/ta-help/desk` (staff)

> “TAs and admins see the queue, claim a request, and reply. Human backup for the same product.”

### Placement — `/placement`

> “Last mile: job board, save and apply, alerts, and a resume builder. The account that practiced yesterday can apply today.”

### Project ideas — `/projects`

> “Portfolio and hackathon prompts by track — full-stack, GenAI, agents, and similar. Difficulty and stack so they pick something they can actually ship.”

---

## 5. Study tools

### DSA sheet — `/dsa-sheet`

> “Topic checklist of DSA problems. They tick progress as they go. Good for a 30-day or interview plan.”

### Visualizer — `/visualizer`

> “Visual Lab. Algorithms and low-level design patterns, step by step, frame by frame. Watch the idea, then go solve it in Practice.”

### Roadmaps — `/roadmaps`

> “Guided paths that stitch courses, DSA sheet, practice, and interview into one sequence. Progress on each step is live, so they see the whole career track, not isolated pages.”

---

## 6. Content

### Blog — `/blog`, `/blog/[id]`

> “Articles for the community — featured posts, tags, reading view. Keeps learners on the product between contests.”

### Write a blog — `/blog/write`

> “Authoring entry is here. The public reader is live; the in-app editor is the next wiring step. Today we can still publish via the content module.”

---

## 7. Money and growth

### Billing — `/billing`

> “Razorpay checkout. Single courses, AI generation credit, and bundles — full-stack, interview, frontend. Pay once, enrollment unlocks the course.”

### Gift a course — `/gift`

> “Buy a seat for someone else. Same catalog, gifted access. Useful for teams, parents, or campus.”

### Affiliate — `/affiliate`, `/affiliate/dashboard`

> “Partners share a link, we track registrations and course sales, show commission, KYC, and payouts. Growth without a separate marketing stack.”

### Referral — `/referral`

> “Learners invite friends. The friend gets a discount; the referrer earns cash when they enroll. Different from affiliate — this is peer invite, not a partner program.”

### Certificates — `/certificates`

> “Finish a course, generate a named PDF certificate. In progress stays locked; not enrolled sends them to the catalog.”

---

## 8. Staff

### Admin dashboard — `/admin/dashboard`

> “Operators see the control surface: contests, challenges, submissions. No deploy to run a weekend round.”

### Create contest — `/admin/contest/create`

> “Name, window, rated or unrated, then attach problems. Status flips Upcoming → Live → Ended on the clock.”

---

## Full walk order (~8 minutes)

Read top to bottom. Skip anything in parentheses if time is short.

1. Home  
2. Courses → one lesson  
3. Practice → submit one problem  
4. Contests → leaderboard  
5. Interview intro (do not Start)  
6. Placement  
7. TA Help  
8. Projects  
9. DSA Sheet + Visualizer + Roadmaps (30 seconds total)  
10. Blog  
11. Billing → Gift → Referral → Affiliate  
12. Certificates  
13. Admin (only if they ask “how do we run this?”)

**Close:**

> “That is the whole product: learn, grind, compete, interview, human help, jobs, and revenue. We can go deep on any one screen next.”

---

## 15-second cheat sheet

Say these if you are only pointing at the sidebar.

| Feature | Say |
|---|---|
| Home | Hub. Four doors. Continue learning. |
| Courses | Paid tracks: DSA, Node, React, System Design. Progress + streak. |
| AI course | Generate a notebook from notes. Uses a credit. |
| Practice | Company-tagged problems. Real Docker judge. |
| Judge | Stdin, JS function, or React. Hint on fail. Save on pass. |
| Submissions | Personal verdict history. |
| Contests | Timed. Register. Auto status. |
| Contest board | Live ranks, then frozen. |
| Leaderboard | Global rank + heatmap. |
| Interview | Voice mock. AI score. Select / Borderline / Reject. |
| Meeting comms | Standup practice with coaching. |
| TA Help | Human ticket. Text or video. |
| TA Desk | Staff queue and replies. |
| Placement | Jobs, apply, resume. |
| Projects | Build-this ideas by track. |
| DSA Sheet | Topic checklist. |
| Visualizer | Watch the algorithm, then code it. |
| Roadmaps | One path across courses, DSA, practice, interview. |
| Blog | Read articles in-product. |
| Billing | Razorpay. Courses, credit, bundles. |
| Gift | Buy for someone else. |
| Affiliate | Partner links and payouts. |
| Referral | Invite friends, earn + discount. |
| Certificates | PDF after completion. |
| Companion | Chat help, or escalate to TA. |
| Profile | Public handle and solved stats. |
| Admin | Create contests and problems. No engineer needed. |
