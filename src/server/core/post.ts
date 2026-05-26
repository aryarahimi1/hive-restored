import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'Hive Restored — Federated bad-actor detection (mods only)',
    textFallback: {
      text:
        'Hive Restored is now active. Open this post for the moderation dashboard: ' +
        'live threat scores, federation status, and action log.',
    },
  });
};
