import { context, reddit } from '@devvit/web/server';

export function requireSubredditName(): string {
  const sub = context.subredditName;
  if (!sub) {
    throw new Error('Subreddit context is unavailable');
  }
  return sub;
}

export async function assertCurrentUserIsModerator(sub: string): Promise<string> {
  const username = await reddit.getCurrentUsername();
  if (!username) {
    throw new Error('You must be signed in as a moderator to use the dashboard');
  }

  const mods = await reddit
    .getModerators({ subredditName: sub, username })
    .all();

  if (mods.length === 0) {
    throw new Error('Moderator access required');
  }

  return username;
}

export async function withModeratorAccess<T>(
  fn: (sub: string, username: string) => Promise<T>,
): Promise<T> {
  const sub = requireSubredditName();
  const username = await assertCurrentUserIsModerator(sub);
  return fn(sub, username);
}
