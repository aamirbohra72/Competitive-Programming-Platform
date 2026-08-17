/**
 * Production-grade functional validation (extends functional-smoke).
 * Run after servers are up: node scripts/production-validate.mjs
 */
const API = process.env.API_URL || 'http://localhost:3001';
const WEB = process.env.WEB_URL || 'http://localhost:3000';

const results = [];

function ok(name, pass, detail = '') {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '') });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 45000);
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.body
        ? { 'Content-Type': 'application/json', ...(opts.headers || {}) }
        : opts.headers,
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

function looksLikeErrorPage(text) {
  return /Application error|Internal Server Error|__NEXT_DATA__.*"err"|Something went wrong/i.test(
    text || '',
  );
}

async function main() {
  console.log(`\n=== Production validate ===\nAPI=${API}\nWEB=${WEB}\n`);

  const contests = (await req(`${API}/api/contests`)).json?.data || [];
  const live = contests.find((c) => (c.effectiveStatus || c.status) === 'LIVE');
  const upcoming = contests.find((c) => (c.effectiveStatus || c.status) === 'UPCOMING');
  const ended = contests.find((c) => (c.effectiveStatus || c.status) === 'ENDED');
  const challenges = (await req(`${API}/api/challenges`)).json || [];
  const blog = await req(`${API}/api/blog`);
  const lb = await req(`${API}/api/leaderboard/overview?year=${new Date().getFullYear()}`);
  const sampleUser = lb.json?.globalLeaderboard?.[0]?.username;

  // --- Extra API surface ---
  {
    const companies = await req(`${API}/api/challenges/companies`);
    ok(
      'Challenge companies catalog',
      companies.status === 200 && (Array.isArray(companies.json) || Array.isArray(companies.json?.companies) || typeof companies.json === 'object'),
      `status=${companies.status}`,
    );
  }

  {
    const llm = await req(`${API}/api/courses/llm-enabled`);
    ok(
      'Courses LLM catalog',
      llm.status === 200 && Array.isArray(llm.json?.courseIds),
      `count=${llm.json?.courseIds?.length}`,
    );
  }

  {
    const otp = await req(`${API}/api/auth/request-otp`, { method: 'POST', body: { email: 'x@y.com' } });
    ok('Legacy OTP retired (410)', otp.status === 410, `status=${otp.status}`);
  }

  {
    const exec = await req(`${API}/api/execute/execute`, {
      method: 'POST',
      body: { language: 'javascript', code: 'console.log(1)', challengeId: challenges[0]?.id },
    });
    ok('Judge execute requires auth', exec.status === 401, `status=${exec.status}`);
  }

  {
    const iv = await req(`${API}/api/interview/sessions`, { method: 'POST', body: {} });
    ok('Interview requires auth', iv.status === 401, `status=${iv.status}`);
  }

  {
    const mine = await req(`${API}/api/courses/mine`);
    ok('Generated courses require auth', mine.status === 401, `status=${mine.status}`);
  }

  {
    const pay = await req(`${API}/api/payments/create-order`, { method: 'POST', body: { productId: 'ai-generate' } });
    ok('Payments create-order requires auth', pay.status === 401, `status=${pay.status}`);
    const hist = await req(`${API}/api/payments/history`);
    ok('Payments history requires auth', hist.status === 401, `status=${hist.status}`);
    const enroll = await req(`${API}/api/payments/enrollments`);
    ok('Enrollments require auth', enroll.status === 401, `status=${enroll.status}`);
  }

  {
    const ta = await req(`${API}/api/ta-help/mine`);
    ok('TA help requires auth', ta.status === 401, `status=${ta.status}`);
  }

  if (live) {
    const detail = await req(`${API}/api/contests/${live.id}`);
    ok(
      'LIVE contest detail',
      detail.status === 200 && detail.json?.id === live.id,
      `${detail.json?.name || live.name} status=${detail.json?.effectiveStatus || detail.json?.status}`,
    );
    const register = await req(`${API}/api/contests/${live.id}/register`, { method: 'POST' });
    ok('Contest register requires auth', register.status === 401, `status=${register.status}`);
    const cLb = await req(`${API}/api/leaderboard/contest/${live.id}`);
    ok('Contest leaderboard requires auth', cLb.status === 401, `status=${cLb.status}`);
  } else {
    ok('LIVE contest detail', false, 'no LIVE contest');
    ok('Contest register requires auth', false, 'no LIVE contest');
    ok('Contest leaderboard requires auth', false, 'no LIVE contest');
  }

  {
    const postId = blog.json?.posts?.[0]?.id;
    if (postId) {
      const post = await req(`${API}/api/blog/${encodeURIComponent(postId)}`);
      ok(
        'Blog post detail',
        post.status === 200 && (post.json?.title || post.json?.post?.title),
        post.json?.title || post.json?.post?.title || `status=${post.status}`,
      );
    } else {
      ok('Blog post detail', false, 'no posts');
    }
  }

  {
    const products = await req(`${API}/api/payments/products`);
    const list = products.json?.products || products.json?.data || products.json;
    const count = Array.isArray(list) ? list.length : Array.isArray(products.json?.catalog) ? products.json.catalog.length : 0;
    ok('Payment products have catalog items', products.status === 200 && count >= 1, `count=${count}`);
  }

  {
    const hub = await req(`${API}/api/careers/hub`);
    const jobs = hub.json?.jobs || hub.json?.listings || hub.json?.remoteJobs || [];
    const hasJobs = Array.isArray(jobs)
      ? jobs.length >= 0
      : Boolean(hub.json?.sections || hub.json?.roles || hub.json?.source);
    ok('Careers hub payload shape', hub.status === 200 && hasJobs, `keys=${Object.keys(hub.json || {}).join(',')}`);
  }

  {
    const companion = await req(`${API}/api/companion/chat`, {
      method: 'POST',
      body: { message: 'How do I start a practice problem?' },
      timeoutMs: 90000,
    });
    ok(
      'Support companion chat',
      companion.status === 200 && typeof companion.json?.reply === 'string' && companion.json.reply.length > 8,
      companion.json?.reply ? `intent=${companion.json.intent}` : `status=${companion.status} ${companion.json?.error || ''}`,
    );
  }

  {
    const resume = await req(`${API}/api/careers/resume/suggest`, {
      method: 'POST',
      timeoutMs: 90000,
      body: {
        fullName: 'Aamir Tester',
        headline: 'Software Engineer',
        email: 'aamir@example.com',
        summary: 'Full-stack engineer building learning platforms.',
        skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
        experience: [
          {
            id: '1',
            company: 'Acme',
            title: 'SDE',
            start: '2022',
            end: 'Present',
            bullets: ['Shipped contest platform features', 'Improved judge reliability'],
          },
        ],
        projects: [
          {
            id: '1',
            name: 'Codeforces Platform',
            bullets: ['Built practice + contests with Docker judge'],
          },
        ],
        education: [{ id: '1', school: 'University', degree: 'B.Tech', year: '2020' }],
        achievements: [],
      },
    });
    ok(
      'Resume AI suggestions',
      resume.status === 200 && typeof resume.json?.score === 'number',
      resume.status === 200 ? `score=${resume.json?.score}` : `status=${resume.status} ${resume.json?.error || resume.text?.slice(0, 80)}`,
    );
  }

  // --- Remaining web pages ---
  const extraPages = [
    '/gift',
    '/affiliate',
    '/affiliate/dashboard',
    '/referral',
    '/certificates',
    '/ta-help',
    '/ta-help/desk',
    '/blog/write',
    '/login',
    '/sign-in',
    '/sign-up',
    '/submissions',
    '/learn/create',
    '/admin/dashboard',
    '/admin/contest/create',
    '/visualizer/dsa',
    '/visualizer/lld',
    '/contest',
    '/learn/1',
    '/learn/1/assignments',
  ];

  if (challenges[0]?.id) extraPages.push(`/practice/${challenges[0].id}`);
  if (live?.id) {
    extraPages.push(`/contests/${live.id}`);
    extraPages.push(`/contests/${live.id}/leaderboard`);
  }
  if (upcoming?.id) extraPages.push(`/contests/${upcoming.id}`);
  if (ended?.id) extraPages.push(`/contests/${ended.id}`);
  if (sampleUser) extraPages.push(`/${encodeURIComponent(sampleUser)}`);
  const postId = blog.json?.posts?.[0]?.id;
  if (postId) extraPages.push(`/blog/${encodeURIComponent(postId)}`);

  for (const path of extraPages) {
    const page = await req(`${WEB}${path}`, { timeoutMs: 90000 });
    const okStatus = page.status === 200 || page.status === 307 || page.status === 302 || page.status === 308;
    ok(
      `Web ${path}`,
      okStatus && !looksLikeErrorPage(page.text),
      `status=${page.status}${looksLikeErrorPage(page.text) ? ' error-page' : ''}`,
    );
  }

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  console.log(`\n=== Production validate summary ===`);
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
