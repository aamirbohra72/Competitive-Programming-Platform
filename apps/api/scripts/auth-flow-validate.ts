/**
 * Authenticated API flows against a running local API.
 * Uses the seeded user@codeforces.com account + JWT_SECRET (not Clerk).
 */
import path from 'node:path';
import dotenv from 'dotenv';
import { generateToken } from '@codeforces/auth';
import { prisma } from '@codeforces/db';

const apiDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(apiDir, '../../.env') });
dotenv.config({ path: path.join(apiDir, '.env'), override: true });

const API = process.env.API_URL || 'http://localhost:3001';
const results: { name: string; pass: boolean; detail: string }[] = [];

function ok(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(url: string, opts: { method?: string; body?: unknown; token?: string; timeoutMs?: number } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 120000);
  try {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* ignore */
    }
    return { status: res.status, json: json as Record<string, unknown> | null, text };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`\n=== Authenticated flows ===\nAPI=${API}\n`);

  const user = await prisma.user.findUnique({ where: { email: 'user@codeforces.com' } });
  if (!user) {
    ok('Seed user exists', false, 'user@codeforces.com missing — run db:seed');
    process.exit(1);
  }
  ok('Seed user exists', true, user.username);

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });

  const me = await req(`${API}/api/progress/me`, { token });
  ok('GET /progress/me', me.status === 200, `status=${me.status}`);

  const subs = await req(`${API}/api/submissions`, { token });
  const subRows = (subs.json as { data?: unknown[] } | null)?.data;
  ok('GET /submissions', subs.status === 200 && Array.isArray(subRows), `status=${subs.status} rows=${subRows?.length}`);

  const enroll = await req(`${API}/api/payments/enrollments`, { token });
  ok('GET /payments/enrollments', enroll.status === 200, `status=${enroll.status}`);

  const challenges = await req(`${API}/api/challenges`);
  const list = Array.isArray(challenges.json) ? challenges.json : [];
  const hello = list.find((c: { slug?: string; title?: string }) => c.slug === 'hello-world' || /hello/i.test(c.title || ''));
  const practice = hello || list[0];
  ok('Practice challenge for judge', Boolean(practice?.id), practice?.title || 'none');

  if (practice?.id) {
    const detail = await req(`${API}/api/challenges/${practice.id}`);
    const starter =
      (detail.json as { starterCode?: string } | null)?.starterCode ||
      "console.log('Hello, World!');";
    const run = await req(`${API}/api/execute/execute`, {
      method: 'POST',
      token,
      timeoutMs: 180000,
      body: {
        challengeId: practice.id,
        language: 'javascript',
        code: starter,
      },
    });
    ok(
      'POST /execute (Docker judge)',
      run.status === 200 && typeof run.json?.status === 'string',
      `http=${run.status} judge=${run.json?.status || run.json?.error || run.text.slice(0, 80)}`,
    );

    const submit = await req(`${API}/api/submissions`, {
      method: 'POST',
      token,
      timeoutMs: 180000,
      body: {
        challengeId: practice.id,
        language: 'javascript',
        sourceCode: starter,
      },
    });
    ok(
      'POST /submissions (practice)',
      submit.status === 201 || submit.status === 200,
      `http=${submit.status} status=${(submit.json as { status?: string })?.status || submit.json?.error || submit.text.slice(0, 80)}`,
    );
  }

  const contests = await req(`${API}/api/contests`);
  const data = (contests.json as { data?: { id: string; name: string; effectiveStatus?: string; status?: string }[] })?.data || [];
  const live = data.find((c) => (c.effectiveStatus || c.status) === 'LIVE');
  if (live) {
    const register = await req(`${API}/api/contests/${live.id}/register`, { method: 'POST', token });
    ok(
      'POST contest register (LIVE)',
      register.status === 200 || register.status === 201 || register.status === 409,
      `http=${register.status} ${register.json?.error || register.json?.status || 'ok'}`,
    );
    const my = await req(`${API}/api/contests/${live.id}/me`, { token });
    ok('GET contest /me', my.status === 200, `registered=${(my.json as { isRegistered?: boolean })?.isRegistered} status=${my.status}`);
    const lb = await req(`${API}/api/leaderboard/contest/${live.id}`, { token });
    ok('GET contest leaderboard', lb.status === 200 && Array.isArray(lb.json?.leaderboard), `rows=${(lb.json?.leaderboard as unknown[])?.length}`);
  } else {
    ok('POST contest register (LIVE)', false, 'no LIVE contest');
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== Authenticated summary ===`);
  console.log(`Passed: ${results.filter((r) => r.pass).length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Suite crashed:', err);
  await prisma.$disconnect();
  process.exit(2);
});
