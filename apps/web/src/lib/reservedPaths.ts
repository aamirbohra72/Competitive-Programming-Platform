/** App routes that must never render as /[username] profile pages. */
const RESERVED = new Set([
  'contests',
  'contest',
  'practice',
  'login',
  'admin',
  'api',
  'learn',
  'blog',
  'billing',
  'affiliate',
  'referral',
  'leaderboard',
  'projects',
  'submissions',
  'interview',
  'gift',
  'certificates',
  'placement',
  'ta-help',
  'dsa-sheet',
  'challenges',
  'roadmaps',
  'visualizer',
  'communication',
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED.has(username.toLowerCase());
}
