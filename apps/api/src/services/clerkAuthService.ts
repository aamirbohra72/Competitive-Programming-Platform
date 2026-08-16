import { createClerkClient, verifyToken } from '@clerk/backend';
import { prisma } from '@codeforces/db';
import { generateToken } from '@codeforces/auth';

function getClerkSecret(): string {
  const key = process.env.CLERK_SECRET_KEY?.trim();
  if (!key) {
    throw new Error('CLERK_SECRET_KEY is not configured');
  }
  return key;
}

function usernameFromEmail(email: string, clerkUserId: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
  const suffix = clerkUserId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toLowerCase();
  return `${base || 'user'}_${suffix}`.slice(0, 30);
}

export async function exchangeClerkSession(clerkJwt: string) {
  const secretKey = getClerkSecret();

  // Windows clocks often drift 20–60s; Clerk session JWTs are ~60s TTL.
  // Without generous skew, clerk-exchange fails and the API JWT is never minted.
  const skewMs = Number(process.env.CLERK_CLOCK_SKEW_MS || 120_000);
  const payload = await verifyToken(clerkJwt, {
    secretKey,
    clockSkewInMs: Number.isFinite(skewMs) && skewMs > 0 ? skewMs : 120_000,
  });
  const clerkUserId = payload.sub;
  if (!clerkUserId) {
    throw new Error('INVALID_CLERK_TOKEN');
  }

  const clerk = createClerkClient({ secretKey });
  const clerkUser = await clerk.users.getUser(clerkUserId);
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error('CLERK_EMAIL_MISSING');
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ clerkUserId }, { email }],
    },
  });

  if (!user) {
    let username = usernameFromEmail(email, clerkUserId);
    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken) {
      username = `${username.slice(0, 24)}_${Math.floor(Math.random() * 999)}`;
    }
    user = await prisma.user.create({
      data: {
        email,
        username,
        clerkUserId,
      },
    });
  } else if (!user.clerkUserId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { clerkUserId },
    });
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    token,
  };
}
