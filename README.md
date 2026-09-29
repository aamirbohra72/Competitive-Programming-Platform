# Codeforces-Like Platform

A full-stack competitive programming platform built with TypeScript, TurboRepo, Next.js, Express, and Prisma.

## 🏗️ Architecture

```
codeforces-platform/
├── apps/
│   ├── web/              # Next.js frontend (App Router)
│   └── api/              # Express backend
├── packages/
│   ├── db/               # Prisma schema & client
│   ├── auth/             # JWT authentication utilities
│   ├── types/            # Shared TypeScript types
│   └── config/           # ESLint & TypeScript configs
└── turbo.json            # TurboRepo configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- TurboRepo (installed via npm)

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Create `.env` files in the following locations:

**Option 1: Root `.env` (recommended for database operations):**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/codeforces?schema=public"
PORT=3001
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Use one consistent `JWT_SECRET` everywhere the API loads env from (root `.env` vs `apps/api/.env`). Changing it invalidates existing tokens — users must log in again. The web app must call the same API that issued the token (`NEXT_PUBLIC_API_URL`).

**Interview chatbot (optional):** The `/interview` flow uses **Mistral** from the API for transcription (Voxtral) and chat scoring. Set on the **API** only (never `NEXT_PUBLIC_*`):

```env
MISTRAL_API_KEY="your-mistral-api-key"
# optional overrides:
# MISTRAL_CHAT_MODEL=mistral-small-latest
# MISTRAL_TRANSCRIBE_MODEL=voxtral-mini-latest
```

In **production**, enable the routes explicitly:

```env
INTERVIEW_ENABLED=true
```

If `INTERVIEW_ENABLED` is not `true` in production, `/api/interview/*` returns 503. Development does not require `INTERVIEW_ENABLED`.

The interview has **Practice** (optional PDF and camera) and **Proctored** modes. Proctored mode requires a text-based PDF resume (max 5 MB), working camera and microphone, an audible speaker test, confirmed entire-screen sharing, and fullscreen before the session starts. Browsers that cannot report the selected capture surface cannot enter Proctored mode. The resume text is sent to the configured Mistral service to plan a resume-specific first question; only the derived skills/project context is stored with the session. Follow-up questions probe resume claims and the final report includes skill gaps. At the ten-minute limit, the report uses only answers already submitted; without answers it explicitly says there is insufficient evidence. Neither camera nor screen video is uploaded.

Leaving the tab, losing window focus, or exiting fullscreen for 5 seconds disqualifies the session; disconnecting a required camera, microphone, or screen share also ends it. Copy/paste, right-click, and page text selection are blocked in Proctored mode; five attempts disqualify the session. The API records disqualification as `ABANDONED`. Browser checks cannot prevent switching, reliably detect inspector access, or provide tamper-proof supervision; this is a practice-grade proctoring experience, not a certified exam system. Mobile QR pairing and second-device monitoring are not implemented yet. Apply the checked-in interview resume migration with `npm run db:migrate -w @codeforces/db` before starting the API.

**Interview DB tables:** If `POST /api/interview/sessions` returns **500** (or **503** with “missing tables”), apply the schema to Postgres:

```bash
npm run db:push
```

Use the same `DATABASE_URL` as the API (`apps/api/.env` or root `.env`). If `npm run db:migrate` fails on a shadow database error, `db:push` is fine for local dev to add `InterviewSession` / `InterviewTurn`.

**Option 2: Separate files:**

**`apps/api/.env`:**
```env
PORT=3001
DATABASE_URL="postgresql://user:password@localhost:5432/codeforces?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Codeforces <noreply@yourdomain.com>"
```

**`apps/web/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### OTP Email Delivery (Production Ready)

- In `production`, SMTP is mandatory. API startup fails fast if SMTP is missing.
- In `development`, if SMTP is not configured, OTP is logged to API console as `[DEV OTP]`.
- For Gmail, use an **App Password** (not account password), and prefer `SMTP_PORT=587` + `SMTP_SECURE=false`.
- If your provider uses SSL on 465, set `SMTP_PORT=465` and `SMTP_SECURE=true`.
- Ensure `SMTP_FROM` uses a verified sender/domain for your provider.

**Note:** The seed script will look for `DATABASE_URL` in both the root `.env` and `apps/api/.env` files.

3. **Set up the database:**

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (applies InterviewSession / InterviewTurn when present)
npm run db:migrate

# Seed the database
npm run db:seed
```

4. **Start development servers:**

```bash
# Start both frontend and backend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 📦 Project Structure

### Backend (`apps/api`)

- **Controllers**: Handle HTTP requests and responses
- **Routes**: Define API endpoints
- **Middleware**: Authentication, authorization, error handling
- **Pattern**: Controller → Service → Repository (Prisma)

### Frontend (`apps/web`)

- **App Router**: Next.js 14 App Router structure
- **Pages**: Login, Register, Contests, Challenges, Submissions, Admin
- **Components**: Reusable UI components
- **Lib**: API client, authentication utilities

### Shared Packages

- **`@codeforces/db`**: Prisma client and schema
- **`@codeforces/auth`**: JWT token generation/verification, password hashing
- **`@codeforces/types`**: Shared TypeScript types
- **`@codeforces/config`**: ESLint and TypeScript configurations

## 🔐 Authentication & Authorization

### User Roles

- **ADMIN**: Can create/edit/delete contests and challenges, view all submissions
- **USER**: Can view contests, attempt challenges, submit solutions, view own submissions

### Default Users (from seed)

- **Admin**: `admin@codeforces.com` / `admin123`
- **User**: `user@codeforces.com` / `user123`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Contests
- `GET /api/contests` - Get all contests (with optional status filter)
- `GET /api/contests/:id` - Get contest by ID
- `GET /api/contests/:id/challenges` - Get challenges for a contest
- `POST /api/contests` - Create contest (Admin only)
- `PUT /api/contests/:id` - Update contest (Admin only)
- `DELETE /api/contests/:id` - Delete contest (Admin only)

### Challenges
- `GET /api/challenges/:id` - Get challenge by ID
- `POST /api/challenges` - Create challenge (Admin only)
- `PUT /api/challenges/:id` - Update challenge (Admin only)
- `DELETE /api/challenges/:id` - Delete challenge (Admin only)

### Submissions
- `GET /api/submissions` - Get user's submissions
- `GET /api/submissions/:id` - Get submission by ID
- `POST /api/submissions` - Submit solution
- `GET /api/submissions/admin/all` - Get all submissions (Admin only)

## 🗄️ Database Schema

### Models

- **User**: Authentication and user data
- **Contest**: Contest information with status (UPCOMING, LIVE, ENDED)
- **Challenge**: Problems within contests
- **Submission**: User code submissions with status tracking

### Relationships

- User → Submissions (one-to-many)
- Contest → Challenges (one-to-many)
- Challenge → Submissions (one-to-many)

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start all apps in dev mode

# Building
npm run build            # Build all apps

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio

# Code Quality
npm run lint             # Lint all packages
npm run format           # Format code with Prettier
```

### Tech Stack

- **Monorepo**: TurboRepo
- **Language**: TypeScript (strict mode)
- **Backend**: Express.js
- **Frontend**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (jsonwebtoken)
- **Validation**: Zod
- **Linting**: ESLint + Prettier

## 📝 Features

### Implemented

✅ User authentication (register/login)  
✅ Role-based access control (ADMIN/USER)  
✅ Contest management (CRUD)  
✅ Challenge management (CRUD)  
✅ Submission system  
✅ Protected routes and API endpoints  
✅ Responsive UI with dark mode support  
✅ Type-safe API calls  
✅ Database seeding with demo data  

### Optional Enhancements (Not Implemented)

- Contest countdown timer
- Submission polling for real-time updates
- Pagination on frontend
- Mock code execution engine
- Admin analytics dashboard
- Code editor with syntax highlighting
- Test case management

## 🔒 Security Notes

- Passwords are hashed using bcryptjs
- JWT tokens for authentication
- Role-based middleware for authorization
- Input validation with Zod
- SQL injection protection via Prisma

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and tests
5. Submit a pull request

## 📞 Support

For issues and questions, please open an issue on the repository.

