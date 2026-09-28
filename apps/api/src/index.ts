import path from 'node:path';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from '@codeforces/db';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth';
import { contestRoutes } from './routes/contests';
import { challengeRoutes } from './routes/challenges';
import { submissionRoutes } from './routes/submissions';
import { leaderboardRoutes } from './routes/leaderboard';
import { executionRoutes } from './routes/execution';
import { interviewRoutes } from './routes/interview';
import { courseRoutes } from './routes/courses';
import { careersRoutes } from './routes/careers';
import { communicationRoutes } from './routes/communication';
import { progressRoutes } from './routes/progress';
import { paymentRoutes } from './routes/payments';
import { projectsRoutes } from './routes/projects';
import { blogRoutes } from './routes/blog';
import { companionRoutes } from './routes/companion';
import { taHelpRoutes } from './routes/taHelp';
import { videoRoutes } from './routes/videos';
import { connectRedis, disconnectRedis } from './services/redisService';
import {
  assertEmailConfigForRuntime,
  getEmailDeliveryMode,
  verifySmtpIfConfigured,
} from './services/emailService';
import {
  startContestLifecycleJob,
  stopContestLifecycleJob,
} from './jobs/contestLifecycle';
import { paymentController } from './controllers/paymentController';
import { drainJudgeSlots } from './services/dockerJudgeService';
import { getReadyStatus } from './services/healthService';
import { assertRuntimeEnv } from './lib/assertRuntimeEnv';

// Load env from known locations (Turbo/cwd may not be apps/api).
const apiDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(apiDir, '../../.env') });
dotenv.config({ path: path.join(apiDir, '.env'), override: true });

assertRuntimeEnv();
assertEmailConfigForRuntime();

const app = express();
const PORT = process.env.PORT || 3001;

function corsOriginOption(): cors.CorsOptions['origin'] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) {
    // Dev: allow local web. Production: assertRuntimeEnv requires CORS_ORIGIN.
    return true;
  }
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return (origin, callback) => {
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  };
}

app.use(
  cors({
    origin: corsOriginOption(),
    credentials: true,
  }),
);

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Razorpay signs the raw JSON body — must run before express.json().
app.post('/api/payments/webhook', express.raw({ type: '*/*' }), (req, res, next) => {
  void paymentController.webhook(req, res).catch(next);
});

app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/execute', executionRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/companion', companionRoutes);
app.use('/api/ta-help', taHelpRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/videos', videoRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ready', async (_req, res) => {
  const { ready, checks } = await getReadyStatus();
  res.status(ready ? 200 : 503).json({
    ready,
    status: ready ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

connectRedis().catch(console.error);
startContestLifecycleJob();

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received, shutting down`);
  stopContestLifecycleJob();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    setTimeout(resolve, 10_000);
  });

  await drainJudgeSlots(8_000);
  await disconnectRedis();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

const server: http.Server = app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  const mode = getEmailDeliveryMode();
  console.log(`📬 Email delivery mode: ${mode}`);
  if (mode === 'console' && process.env.NODE_ENV !== 'production') {
    console.log(
      '⚠️  Email not configured — OTP is NOT emailed. Set BREVO_API_KEY + BREVO_SENDER_EMAIL (or SMTP_*) in apps/api/.env, or use devOtp from /auth/request-otp in dev.',
    );
  }
  if (process.env.NODE_ENV === 'production') {
    verifySmtpIfConfigured().catch((err: Error) => {
      console.error('[MAIL] Email verify failed — outgoing mail may not work:', err.message);
    });
  }
});

server.setTimeout(10 * 60 * 1000);
