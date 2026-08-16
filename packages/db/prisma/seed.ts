import {
  PrismaClient,
  UserRole,
  ContestStatus,
  ContestKind,
  JudgeMode,
} from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { getValidatedCatalog } from './catalog';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), 'apps/api/.env') });
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config({ path: resolve(__dirname, '../../../apps/api/.env') });

const prisma = new PrismaClient();

const PRACTICE_SLUG = 'interview-practice-js-react';

function determineStatus(startTime: Date, endTime: Date): ContestStatus {
  const now = new Date();
  if (now < startTime) return ContestStatus.UPCOMING;
  if (now > endTime) return ContestStatus.ENDED;
  return ContestStatus.LIVE;
}

async function upsertPracticeContest() {
  const now = new Date();
  const data = {
    slug: PRACTICE_SLUG,
    name: 'Interview Practice — JavaScript & React',
    description: 'Curated frontend interview prompts with company tags for /practice',
    startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000),
    status: ContestStatus.LIVE,
    kind: ContestKind.PRACTICE,
    isPublished: true,
  };

  const bySlug = await prisma.contest.findUnique({ where: { slug: PRACTICE_SLUG } });
  if (bySlug) {
    return prisma.contest.update({ where: { id: bySlug.id }, data });
  }

  const byName = await prisma.contest.findFirst({
    where: { name: data.name },
  });
  if (byName) {
    return prisma.contest.update({ where: { id: byName.id }, data });
  }

  return prisma.contest.create({ data });
}

async function seedCatalog(contestId: string) {
  const catalog = getValidatedCatalog();

  for (const challenge of catalog) {
    const data = {
      contestId,
      slug: challenge.slug,
      title: challenge.title,
      description: challenge.description,
      difficulty: challenge.difficulty,
      practiceLanguage: challenge.practiceLanguage,
      companies: challenge.companies,
      estimatedTime: challenge.estimatedTime,
      inputFormat: challenge.inputFormat,
      outputFormat: challenge.outputFormat,
      constraints: challenge.constraints,
      sampleInput: challenge.sampleInput,
      sampleOutput: challenge.sampleOutput,
      judgeMode: challenge.judgeMode as JudgeMode,
      allowedLanguages: challenge.allowedLanguages,
      starterCode: challenge.starterCode,
      judgeReady: challenge.judgeReady,
    };

    const saved = await prisma.challenge.upsert({
      where: { slug: challenge.slug },
      create: data,
      update: data,
    });

    await prisma.challengeTestCase.deleteMany({ where: { challengeId: saved.id } });
    await prisma.challengeTestCase.createMany({
      data: challenge.testCases.map((tc) => ({
        challengeId: saved.id,
        name: tc.name,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        specJson: tc.specJson ?? null,
        isSample: tc.isSample,
        isHidden: tc.isHidden,
        order: tc.order,
      })),
    });
  }

  console.log(`Upserted ${catalog.length} catalog challenges with test cases`);
}

type DemoChallenge = {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  sampleInput: string;
  sampleOutput: string;
  starterCode: string;
};

async function upsertDemoContest(opts: {
  slug: string;
  name: string;
  description: string;
  kind: ContestKind;
  startTime: Date;
  endTime: Date;
  challenges: DemoChallenge[];
}) {
  const status = determineStatus(opts.startTime, opts.endTime);
  const contest = await prisma.contest.upsert({
    where: { slug: opts.slug },
    create: {
      slug: opts.slug,
      name: opts.name,
      description: opts.description,
      startTime: opts.startTime,
      endTime: opts.endTime,
      status,
      kind: opts.kind,
      isPublished: true,
    },
    update: {
      name: opts.name,
      description: opts.description,
      startTime: opts.startTime,
      endTime: opts.endTime,
      status,
      kind: opts.kind,
      isPublished: true,
    },
  });

  for (const ch of opts.challenges) {
    const data = {
      contestId: contest.id,
      slug: ch.slug,
      title: ch.title,
      description: ch.description,
      difficulty: ch.difficulty,
      inputFormat: 'Standard input',
      outputFormat: 'Standard output',
      constraints: '1 ≤ |input| ≤ 10^5',
      sampleInput: ch.sampleInput,
      sampleOutput: ch.sampleOutput,
      judgeMode: JudgeMode.STDIN,
      allowedLanguages: ['javascript', 'python'],
      starterCode: ch.starterCode,
      judgeReady: true,
    };

    const saved = await prisma.challenge.upsert({
      where: { slug: ch.slug },
      create: data,
      update: data,
    });

    await prisma.challengeTestCase.deleteMany({ where: { challengeId: saved.id } });
    await prisma.challengeTestCase.createMany({
      data: [
        {
          challengeId: saved.id,
          name: 'sample',
          input: ch.sampleInput,
          expectedOutput: ch.sampleOutput,
          isSample: true,
          isHidden: false,
          order: 0,
        },
        {
          challengeId: saved.id,
          name: 'hidden-1',
          input: ch.sampleInput,
          expectedOutput: ch.sampleOutput,
          isSample: false,
          isHidden: true,
          order: 1,
        },
      ],
    });
  }

  return contest;
}

async function seedDemoContests() {
  const now = new Date();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const live = await upsertDemoContest({
    slug: 'weekly-sprint-live',
    name: 'Weekly Sprint #12',
    description:
      'Live 3-hour coding sprint. Solve as many problems as you can — standings update as you submit.',
    kind: ContestKind.RATED,
    startTime: new Date(now.getTime() - 1 * hour),
    endTime: new Date(now.getTime() + 2 * hour),
    challenges: [
      {
        slug: 'demo-live-sum-a-b',
        title: 'A + B',
        description:
          'Read two integers A and B from a single line and print their sum.\n\nThis is a warm-up problem used in contest demos.',
        difficulty: 'Easy',
        sampleInput: '2 3',
        sampleOutput: '5',
        starterCode:
          "const [a, b] = readLine().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
      },
      {
        slug: 'demo-live-fizzbuzz',
        title: 'FizzBuzz Range',
        description:
          'Read an integer N. For each i from 1 to N print "Fizz" if divisible by 3, "Buzz" if by 5, "FizzBuzz" if by both, otherwise i — one per line.',
        difficulty: 'Easy',
        sampleInput: '5',
        sampleOutput: '1\n2\nFizz\n4\nBuzz',
        starterCode:
          "const n = Number(readLine());\nfor (let i = 1; i <= n; i++) {\n  if (i % 15 === 0) console.log('FizzBuzz');\n  else if (i % 3 === 0) console.log('Fizz');\n  else if (i % 5 === 0) console.log('Buzz');\n  else console.log(i);\n}\n",
      },
      {
        slug: 'demo-live-reverse-words',
        title: 'Reverse Words',
        description:
          'Read a line of space-separated words and print them in reverse order, still space-separated.',
        difficulty: 'Easy',
        sampleInput: 'hello world codeforces',
        sampleOutput: 'codeforces world hello',
        starterCode:
          "const words = readLine().trim().split(/\\s+/).filter(Boolean);\nconsole.log(words.reverse().join(' '));\n",
      },
    ],
  });

  const upcoming = await upsertDemoContest({
    slug: 'frontend-cup-upcoming',
    name: 'Frontend Cup Qualifier',
    description:
      'Upcoming qualifier round. Register early — problems unlock at start. Focus: algorithms + JS fundamentals.',
    kind: ContestKind.UNRATED,
    startTime: new Date(now.getTime() + 2 * day),
    endTime: new Date(now.getTime() + 2 * day + 2.5 * hour),
    challenges: [
      {
        slug: 'demo-upcoming-sum-a-b',
        title: 'A + B (Qualifier)',
        description:
          'Read two integers A and B from a single line and print their sum.',
        difficulty: 'Easy',
        sampleInput: '2 3',
        sampleOutput: '5',
        starterCode:
          "const [a, b] = readLine().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
      },
      {
        slug: 'demo-upcoming-max-of-three',
        title: 'Max of Three',
        description: 'Read three integers and print the maximum.',
        difficulty: 'Easy',
        sampleInput: '7 2 9',
        sampleOutput: '9',
        starterCode:
          "const nums = readLine().split(/\\s+/).map(Number);\nconsole.log(Math.max(...nums));\n",
      },
    ],
  });

  const ended = await upsertDemoContest({
    slug: 'march-open-ended',
    name: 'March Open Round',
    description:
      'Past open contest — browse problems and review the finalized standings.',
    kind: ContestKind.UNRATED,
    startTime: new Date(now.getTime() - 10 * day),
    endTime: new Date(now.getTime() - 9 * day),
    challenges: [
      {
        slug: 'demo-ended-palindrome',
        title: 'Palindrome Check',
        description:
          'Read a single lowercase word. Print YES if it is a palindrome, otherwise NO.',
        difficulty: 'Easy',
        sampleInput: 'racecar',
        sampleOutput: 'YES',
        starterCode:
          "const s = readLine().trim();\nconst rev = s.split('').reverse().join('');\nconsole.log(s === rev ? 'YES' : 'NO');\n",
      },
      {
        slug: 'demo-ended-count-vowels',
        title: 'Count Vowels',
        description:
          'Read a string and print the number of vowels (a,e,i,o,u) case-insensitive.',
        difficulty: 'Easy',
        sampleInput: 'Codeforces',
        sampleOutput: '4',
        starterCode:
          "const s = readLine();\nconsole.log((s.match(/[aeiou]/gi) || []).length);\n",
      },
    ],
  });

  console.log('Seeded demo contests:', {
    live: live.name,
    upcoming: upcoming.name,
    ended: ended.name,
  });
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@codeforces.com' },
    update: {},
    create: {
      email: 'admin@codeforces.com',
      username: 'admin',
      role: UserRole.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@codeforces.com' },
    update: {},
    create: {
      email: 'user@codeforces.com',
      username: 'user',
      role: UserRole.USER,
    },
  });

  const practiceContest = await upsertPracticeContest();
  await seedCatalog(practiceContest.id);
  await seedDemoContests();

  // Remove old fixture contests from earlier seeds (null slug + known names).
  const junk = await prisma.contest.findMany({
    where: {
      OR: [
        { slug: null, name: { in: ['Upcoming Contest 2024', 'Live Contest 2024', 'Ended Contest 2024'] } },
        { slug: null, name: { contains: 'Interview Practice' } },
      ],
    },
    select: { id: true, name: true },
  });
  if (junk.length > 0) {
    const ids = junk.map((c) => c.id);
    await prisma.contest.deleteMany({ where: { id: { in: ids } } });
    console.log(
      `Removed ${ids.length} legacy fixture contests:`,
      junk.map((j) => j.name),
    );
  }

  // Remove legacy uncatalogued challenges only on the PRACTICE contest
  // so demo contest problems (and future contest-only items) are kept.
  const legacy = await prisma.challenge.findMany({
    where: { slug: null, contestId: practiceContest.id },
    select: { id: true },
  });
  if (legacy.length > 0) {
    const ids = legacy.map((c) => c.id);
    await prisma.challengeTestCase.deleteMany({ where: { challengeId: { in: ids } } });
    await prisma.submission.deleteMany({ where: { challengeId: { in: ids } } });
    await prisma.challenge.deleteMany({ where: { id: { in: ids } } });
    console.log(`Removed ${ids.length} legacy practice challenges without slug`);
  }

  console.log('Seed data ready:', {
    admin: admin.email,
    user: user.email,
    practiceContest: practiceContest.name,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
