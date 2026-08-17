/**
 * Functional smoke suite for local Codeforces platform.
 * Run: node scripts/functional-smoke.mjs
 */
const API = process.env.API_URL || 'http://localhost:3001';
const WEB = process.env.WEB_URL || 'http://localhost:3000';

const results = [];

function ok(name, pass, detail = '') {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '') });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 45000);
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json', ...(opts.headers || {}) } : opts.headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      redirect: 'manual',
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-json */
    }
    return { status: res.status, text, json, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`\n=== Functional smoke ===\nAPI=${API}\nWEB=${WEB}\n`);

  // --- Platform health ---
  {
    const h = await req(`${API}/api/health`);
    ok('API /health', h.status === 200, `status=${h.status}`);
    const r = await req(`${API}/api/ready`);
    const checks = r.json?.checks || {};
    ok(
      'API /ready',
      r.status === 200 && (r.json?.ready === true || r.json?.status === 'ready'),
      `ready=${r.json?.ready} postgres=${checks.postgres} redis=${checks.redis} docker=${checks.docker}`,
    );
    ok('API /ready reports docker probe', typeof checks.docker === 'boolean', `docker=${checks.docker}`);
  }

  // --- Practice catalog ---
  let practiceChallenges = [];
  {
    const c = await req(`${API}/api/challenges`);
    practiceChallenges = Array.isArray(c.json) ? c.json : [];
    ok('Practice catalog loads', c.status === 200 && practiceChallenges.length > 0, `count=${practiceChallenges.length}`);
    const allPractice = practiceChallenges.every((ch) => ch?.contest?.kind === 'PRACTICE');
    ok('Practice catalog is PRACTICE-only', allPractice, allPractice ? 'no contest leak' : 'mixed kinds found');
    if (practiceChallenges[0]?.id) {
      const d = await req(`${API}/api/challenges/${practiceChallenges[0].id}`);
      ok('Practice challenge detail', d.status === 200 && d.json?.title, d.json?.title || `status=${d.status}`);
      ok('Practice challenge judgeReady', Boolean(d.json?.judgeReady), `judgeReady=${d.json?.judgeReady}`);
    }
  }

  // --- Contests ---
  let contests = [];
  {
    const list = await req(`${API}/api/contests`);
    contests = list.json?.data || [];
    ok('Contests list', list.status === 200 && contests.length >= 1, `total=${list.json?.total ?? contests.length}`);
    const statuses = new Set(contests.map((c) => c.effectiveStatus || c.status));
    ok('Contest statuses present', statuses.has('LIVE') || statuses.has('UPCOMING') || statuses.has('ENDED'), [...statuses].join(','));

    const live = contests.find((c) => (c.effectiveStatus || c.status) === 'LIVE');
    const upcoming = contests.find((c) => (c.effectiveStatus || c.status) === 'UPCOMING');
    const ended = contests.find((c) => (c.effectiveStatus || c.status) === 'ENDED');

    if (live) {
      const ch = await req(`${API}/api/contests/${live.id}/challenges`);
      ok('LIVE contest challenges visible', ch.status === 200 && Array.isArray(ch.json) && ch.json.length > 0, `count=${ch.json?.length}`);
    } else {
      ok('LIVE contest challenges visible', false, 'no LIVE contest seeded');
    }

    if (upcoming) {
      const ch = await req(`${API}/api/contests/${upcoming.id}/challenges`);
      ok('UPCOMING statements locked', ch.status === 403, `status=${ch.status}`);
    } else {
      ok('UPCOMING statements locked', false, 'no UPCOMING contest');
    }

    if (ended) {
      const ch = await req(`${API}/api/contests/${ended.id}/challenges`);
      ok('ENDED contest practice open', ch.status === 200 && Array.isArray(ch.json), `count=${ch.json?.length}`);
    } else {
      ok('ENDED contest practice open', false, 'no ENDED contest');
    }
  }

  // --- Auth gates ---
  {
    const p = await req(`${API}/api/progress/me`);
    ok('Progress requires auth', p.status === 401, `status=${p.status}`);
    const s = await req(`${API}/api/submissions`);
    ok('Submissions require auth', s.status === 401, `status=${s.status}`);
  }

  // --- Leaderboard ---
  {
    const lb = await req(`${API}/api/leaderboard/overview?year=2026`);
    ok('Leaderboard overview dynamic', lb.status === 200 && Array.isArray(lb.json?.globalLeaderboard), `rows=${lb.json?.globalLeaderboard?.length}`);
    const sampleUser = lb.json?.globalLeaderboard?.[0]?.username;
    if (sampleUser) {
      const profile = await req(`${API}/api/leaderboard/profile/${encodeURIComponent(sampleUser)}?year=2026`);
      ok(
        'Public profile by username',
        profile.status === 200 &&
          profile.json?.user?.username &&
          profile.json?.user?.streak &&
          Array.isArray(profile.json?.user?.contributions?.days),
        `user=${profile.json?.user?.username} streak=${profile.json?.user?.streak?.current}`,
      );
    } else {
      const missing = await req(`${API}/api/leaderboard/profile/__no_such_user__`);
      ok('Public profile 404 for unknown user', missing.status === 404, `status=${missing.status}`);
    }
  }

  // --- Blog ---
  {
    const b = await req(`${API}/api/blog`);
    ok('Blog hub loads', b.status === 200 && Array.isArray(b.json?.posts) && b.json.posts.length >= 1, `posts=${b.json?.posts?.length} source=${b.json?.source}`);
  }

  // --- Projects / payments / careers ---
  {
    const pr = await req(`${API}/api/projects`);
    ok('Projects hub', pr.status === 200, `status=${pr.status}`);
    const prod = await req(`${API}/api/payments/products`);
    ok('Payment products catalog', prod.status === 200, `status=${prod.status}`);
    const careers = await req(`${API}/api/careers/hub`);
    ok('Careers hub', careers.status === 200, `status=${careers.status}`);
  }

  // --- Communication (Mistral) ---
  {
    const types = await req(`${API}/api/communication/types`);
    ok('Communication meeting types', types.status === 200 && types.json?.types?.length >= 6, `count=${types.json?.types?.length}`);
    const scenario = await req(`${API}/api/communication/scenario`, {
      method: 'POST',
      body: { meetingType: 'daily-standup' },
      timeoutMs: 90000,
    });
    ok('Communication scenario generation', scenario.status === 200 && scenario.json?.prompt, `source=${scenario.json?.source} title=${scenario.json?.title}`);
    if (scenario.json) {
      const coach = await req(`${API}/api/communication/coach`, {
        method: 'POST',
        body: {
          meetingType: 'daily-standup',
          scenario: scenario.json,
          userResponse:
            'Yesterday I finished the auth fix and added tests. Today I will open the PR and verify staging. Blocker: waiting on Redis credentials from infra.',
        },
        timeoutMs: 90000,
      });
      ok(
        'Communication Mistral coaching',
        coach.status === 200 && typeof coach.json?.score === 'number' && Array.isArray(coach.json?.strengths) && coach.json.strengths.length >= 1,
        `score=${coach.json?.score} source=${coach.json?.source}`,
      );
    } else {
      ok('Communication Mistral coaching', false, 'no scenario');
    }
  }

  // --- Web pages ---
  const pages = [
    '/',
    '/practice',
    '/roadmaps',
    '/communication',
    '/blog',
    '/leaderboard',
    '/contests',
    '/dsa-sheet',
    '/placement',
    '/learn',
    '/projects',
    '/interview',
    '/billing',
    '/visualizer',
  ];
  for (const path of pages) {
    const page = await req(`${WEB}${path}`, { timeoutMs: 90000 });
    ok(`Web ${path}`, page.status === 200, `status=${page.status}`);
  }

  // --- Requirement: /roadmaps is not a fake profile ---
  {
    const roadmaps = await req(`${WEB}/roadmaps`, { timeoutMs: 90000 });
    const body = roadmaps.text || '';
    const looksLikeRoadmaps = /Learning paths|Roadmaps|Engineer Communication|Full-Stack/i.test(body);
    const looksLikeFakeProfile = /Interview Practice Platform Questions|Course Watch Time/i.test(body) && !/Learning paths/i.test(body);
    ok('Roadmaps page is real (not mock profile)', roadmaps.status === 200 && looksLikeRoadmaps && !looksLikeFakeProfile, looksLikeRoadmaps ? 'roadmaps UI' : 'unexpected content');
  }

  // --- Summary ---
  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('Suite crashed:', err);
  process.exit(2);
});
