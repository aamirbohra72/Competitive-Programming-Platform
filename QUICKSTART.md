# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- npm or yarn package manager

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE codeforces;
```

### 3. Configure Environment Variables

**Backend (`apps/api/.env`):**
```env
PORT=3001
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/codeforces?schema=public"
JWT_SECRET="change-this-to-a-random-secret-in-production"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
```

**Frontend (`apps/web/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations to create tables
npm run db:migrate

# Seed database with admin user and demo contests
npm run db:seed
```

This creates:
- Admin user: `admin@codeforces.com` / `admin123`
- Regular user: `user@codeforces.com` / `user123`
- Demo contests (Upcoming, Live, Ended)

### 5. Start Development Servers

```bash
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### 6. Access the Application

1. Open http://localhost:3000 in your browser
2. Login with admin credentials to access admin features
3. Or register a new user account

## Common Commands

### Mobile Interview Monitoring

Resume-based **Proctored+** interviews require a QR-paired phone camera. **Practice**
and ordinary **Proctored** interviews do not use mobile monitoring. Ordinary
Proctored retains the laptop camera, microphone, screen-share, and fullscreen
checks. Apply migrations and regenerate Prisma:

```bash
npm run db:migrate
npm run db:generate
```

Configure `GROQ_API_KEY` on the API. `GROQ_VISION_MODEL` defaults to
`meta-llama/llama-4-scout-17b-16e-instruct`; choose a Groq vision-capable model if
your account does not support that model. For phones, both the web origin and
`NEXT_PUBLIC_API_URL` must be reachable HTTPS URLs. Optionally set
`NEXT_PUBLIC_MOBILE_ORIGIN` to the HTTPS web origin used in QR links, allow that
origin in API `CORS_ORIGIN`, and restart Next.js after environment changes.
Laptop `localhost` URLs are not reachable from a phone. A LAN HTTP address is
not a secure camera context; use HTTPS hosting or a trusted HTTPS tunnel.

Complete the laptop device checks, generate a QR code, scan it on the phone,
accept the photo consent, and connect the camera. Position the phone to show one
person and the laptop. Start the interview on the laptop once connected. The
ten-minute timer starts then. Keep the phone camera page visible and prevent
the phone from locking.

The API requests three randomly timed photos. Only high-confidence observations
of missing people/laptops or additional people produce photo warnings.
Uncertain assessments and provider errors are recorded without warnings. Missing
photos and camera disconnections also produce warnings. Mobile warnings and
desktop away warnings share a four-warning disqualification threshold. All three
checks must be accounted for before submitting the final answer or report.
Existing laptop-device and prohibited-action rules remain in effect.

Photos are processed in memory and sent to Groq; this application does not store
them. Observation outcomes are stored with the interview. Provider retention is
governed by Groq's terms. Pairing links are single-use, expire after five minutes,
and use URL fragments; server-side token hashes are stored instead of raw tokens.
After starting, an expired pairing link cannot be used to replace the camera.

This is visibility monitoring, not proof of cheating, identity verification, or
tamper-proof camera attestation. A modified client can spoof camera/heartbeat
requests, and three snapshots cannot cover the entire interview. Assessments can
be wrong. For consequential decisions, review warnings and provide an appeal
process instead of treating AI observations as definitive evidence.

Focused regression check (from `apps/api`):

```bash
npx tsx scripts/test-interview-resume.ts
```

Set `TEST_MOBILE_DB=true` and load the API environment to include the optional
PostgreSQL concurrency/persistence checks. They create disposable test records,
mock vision responses, and delete their records afterward.

```bash
# Development
npm run dev              # Start all apps

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio (database GUI)

# Building
npm run build            # Build all apps for production

# Code Quality
npm run lint             # Lint all packages
npm run format           # Format code with Prettier
```

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running
- Check `DATABASE_URL` in `apps/api/.env`
- Ensure database exists: `CREATE DATABASE codeforces;`

### Port Already in Use

- Change `PORT` in `apps/api/.env` if 3001 is taken
- Change Next.js port: `npm run dev -- -p 3001` (if 3000 is taken)

### Module Not Found Errors

- Run `npm install` in root directory
- Delete `node_modules` and reinstall if issues persist

### Prisma Client Not Generated

- Run `npm run db:generate` in root directory
- Ensure `packages/db/prisma/schema.prisma` exists

## Next Steps

1. **Explore the Admin Dashboard**: Login as admin and create contests
2. **Add Challenges**: Create challenges within contests
3. **Submit Solutions**: Try submitting code solutions
4. **View Submissions**: Check submission status and history

## Production Deployment

1. Set `NODE_ENV=production` in environment variables
2. Use a strong `JWT_SECRET` (generate with `openssl rand -base64 32`)
3. Update `DATABASE_URL` to production database
4. Build apps: `npm run build`
5. Run migrations: `npm run db:migrate`
6. Start production servers


