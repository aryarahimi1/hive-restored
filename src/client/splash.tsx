import './index.css';

import { navigateTo, requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { trpc } from './trpc';

type SplashStats = {
  subredditName: string | null;
  trustedPeers: number;
  threatsIndexed: number;
  lastPollAt: number | null;
};

type SplashState =
  | { kind: 'loading'; subredditName: string | null }
  | { kind: 'mod'; stats: SplashStats }
  | { kind: 'guest'; subredditName: string | null };

function formatRelativeTime(ms: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-md border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
      <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
    </div>
  );
}

function SkeletonTiles() {
  return (
    <div className="flex w-full max-w-sm gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-1 flex-col items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="h-3 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 w-14 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

export const Splash = () => {
  const [state, setState] = useState<SplashState>({
    kind: 'loading',
    subredditName: null,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Always fetch init.get first — works for everyone, gives us the sub name
      // plus a non-throwing isModerator flag so we can avoid firing mod-gated
      // queries (and their server-side error logs) for non-mod splash views.
      let subredditName: string | null = null;
      let isModerator = false;
      try {
        const init = await trpc.init.get.query();
        subredditName = init.subredditName ?? null;
        isModerator = init.isModerator === true;
      } catch {
        // init shouldn't throw, but fail safe.
      }
      if (cancelled) return;

      if (!isModerator) {
        setState({ kind: 'guest', subredditName });
        return;
      }

      // Mod path: fire the gated queries. Either both resolve or both throw.
      try {
        const [overview, peers] = await Promise.all([
          trpc.dashboard.overview.stats.query(),
          trpc.dashboard.trustGraph.list.query(),
        ]);
        if (cancelled) return;
        setState({
          kind: 'mod',
          stats: {
            subredditName: subredditName ?? overview.sub ?? null,
            trustedPeers: peers.length,
            threatsIndexed: overview.threatsIndexed,
            lastPollAt: overview.lastPoll?.ts ?? null,
          },
        });
      } catch {
        if (cancelled) return;
        setState({ kind: 'guest', subredditName });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const subLabel =
    (state.kind === 'mod' ? state.stats.subredditName : state.subredditName) ?? null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
          Hive Restored
        </h1>
        <p className="text-center text-sm text-gray-600 dark:text-gray-300">
          Federated bad-actor detection for moderators.
        </p>
        {subLabel && (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            r/{subLabel}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-sm justify-center">
        {state.kind === 'loading' && <SkeletonTiles />}
        {state.kind === 'mod' && (
          <div className="flex w-full gap-2">
            <StatTile
              label="Trusted peers"
              value={String(state.stats.trustedPeers)}
            />
            <StatTile
              label="Last poll"
              value={
                state.stats.lastPollAt
                  ? formatRelativeTime(state.stats.lastPollAt)
                  : 'never'
              }
            />
            <StatTile
              label="Threats indexed"
              value={String(state.stats.threatsIndexed)}
            />
          </div>
        )}
        {state.kind === 'guest' && (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Moderator sign-in required to view federation status.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-center">
        <button
          className="flex h-10 w-auto cursor-pointer items-center justify-center rounded-full bg-[#d93900] px-5 text-white transition-colors hover:bg-[#c23300] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.56_0.14_38)] dark:bg-orange-600 dark:hover:bg-orange-700"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
        >
          Open dashboard
        </button>
      </div>

      <footer className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 text-[0.8em] text-gray-600 dark:text-gray-400">
        <button
          className="cursor-pointer rounded transition-colors hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.56_0.14_38)] dark:hover:text-white"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          className="cursor-pointer rounded transition-colors hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.56_0.14_38)] dark:hover:text-white"
          onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
        >
          r/Devvit
        </button>
      </footer>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
