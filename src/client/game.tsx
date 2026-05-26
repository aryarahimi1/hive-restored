import './index.css';

import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { trpc } from './trpc';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../server/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type OverviewStats = RouterOutputs['dashboard']['overview']['stats'];
type Peer = RouterOutputs['dashboard']['trustGraph']['list'][number];
type Threat = RouterOutputs['dashboard']['threats']['feed'][number];
type ActionLogEntry = RouterOutputs['dashboard']['actionLog']['list'][number];
type DashboardSettings = RouterOutputs['dashboard']['settings']['get'];
type MetricsSummary = RouterOutputs['dashboard']['metrics']['summary'];
type TabId = 'overview' | 'trust' | 'threats' | 'actions' | 'settings';

type DashboardState = {
  overview: OverviewStats;
  peers: Peer[];
  threats: Threat[];
  actions: ActionLogEntry[];
  settings: DashboardSettings;
  metrics: MetricsSummary;
};

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.56_0.14_38)]';
const INPUT_FOCUS_RING = `${FOCUS_RING} focus-visible:ring-2 focus-visible:ring-[oklch(0.56_0.14_38)]`;

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setPrefers(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return prefers;
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'trust', label: 'Trust Graph' },
  { id: 'threats', label: 'Threat Feed' },
  { id: 'actions', label: 'Action Log' },
  { id: 'settings', label: 'Settings' },
];

const statusCopy = {
  setup_needed: {
    label: 'Setup needed',
    detail: 'Add at least one trusted peer subreddit to start federation polling.',
  },
  ready: {
    label: 'Ready to poll',
    detail: 'Trusted peers are configured. Scheduled polling can index threats.',
  },
  polling: {
    label: 'Federation active',
    detail: 'Hive is polling trusted peers and indexing incoming threat records.',
  },
};

function statusFor(state: string): { label: string; detail: string } {
  if (state === 'ready') return statusCopy.ready;
  if (state === 'polling') return statusCopy.polling;
  return statusCopy.setup_needed;
}

function formatRelativeTime(isoOrMs: string | number): string {
  const then = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTimeUntil(iso: string): string {
  const seconds = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function categoryLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function signalLabel(threat: Threat): string {
  if (threat.matchedSignals.length === 0) return 'No shared hashes';
  return threat.matchedSignals.map(categoryLabel).join(', ');
}

async function fetchDashboardState(): Promise<DashboardState> {
  const [overview, peers, threats, actions, settings, metrics] = await Promise.all([
    trpc.dashboard.overview.stats.query(),
    trpc.dashboard.trustGraph.list.query(),
    trpc.dashboard.threats.feed.query(),
    trpc.dashboard.actionLog.list.query({ limit: 30 }),
    trpc.dashboard.settings.get.query(),
    trpc.dashboard.metrics.summary.query(),
  ]);

  return { overview, peers, threats, actions, settings, metrics };
}

export const App = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [peerInput, setPeerInput] = useState('');
  const [settingsDraft, setSettingsDraft] = useState<DashboardSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tablistRef = useRef<HTMLElement | null>(null);

  const focusTabButton = (id: TabId) => {
    const root = tablistRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLButtonElement>(`#tab-${id}`);
    el?.focus();
  };

  const handleTablistKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex === -1) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextId = tabs[nextIndex]!.id;
    setActiveTab(nextId);
    // Defer focus until React applies the tabIndex update so the button is focusable.
    requestAnimationFrame(() => focusTabButton(nextId));
  };

  const loadDashboard = async () => {
    try {
      setLoadError(null);
      const data = await fetchDashboardState();
      setDashboard(data);
      setSettingsDraft(data.settings);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Failed to load the dashboard.',
      );
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, []);

  const sortedPeers = useMemo(() => {
    return [...(dashboard?.peers ?? [])].sort((a, b) => a.peer.localeCompare(b.peer));
  }, [dashboard?.peers]);

  const addPeer = async () => {
    const nextPeer = peerInput.trim();
    if (!nextPeer) return;

    setBusy(true);
    setMessage(null);
    try {
      const result = await trpc.dashboard.trustGraph.add.mutate(nextPeer);
      setPeerInput('');
      setMessage(`Added r/${result.peer} to your trust graph.`);
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add peer.');
    } finally {
      setBusy(false);
    }
  };

  const removePeer = async (peer: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await trpc.dashboard.trustGraph.remove.mutate(peer);
      setMessage(`Removed r/${peer} from your trust graph.`);
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove peer.');
    } finally {
      setBusy(false);
    }
  };

  const undoAction = async (id: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await trpc.dashboard.actionLog.undo.mutate(id);
      setMessage(result.detail);
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not undo action.');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!settingsDraft) return;

    setBusy(true);
    setMessage(null);
    try {
      const settings = await trpc.dashboard.settings.update.mutate(settingsDraft);
      setSettingsDraft(settings);
      setMessage('Saved dashboard settings.');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  };

  const overview = dashboard?.overview;
  const status = overview ? statusFor(overview.federationState) : null;

  return (
    <div className="min-h-screen bg-[oklch(0.96_0.012_72)] text-[oklch(0.19_0.026_62)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-[oklch(0.85_0.035_62)] bg-[oklch(0.985_0.008_72)] p-5 shadow-[0_24px_80px_rgba(65,45,25,0.12)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.24em] text-[oklch(0.48_0.09_42)] uppercase">
                Hive Restored
              </p>
              <h1 className="mt-3 text-3xl leading-tight font-black tracking-[-0.04em] sm:text-5xl">
                Federation control room for r/{overview?.sub ?? 'loading'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[oklch(0.38_0.028_62)] sm:text-base">
                Trust the subs you know, review the signals they publish, and keep
                every moderator action visible before Hive recommends a move.
              </p>
            </div>

            <div className="rounded-3xl bg-[oklch(0.2_0.04_58)] p-4 text-[oklch(0.97_0.008_72)] lg:min-w-72">
              <p className="text-xs font-semibold tracking-[0.18em] text-[oklch(0.78_0.08_62)] uppercase">
                Status
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.03em]">
                {status?.label ?? 'Loading'}
              </p>
              <p className="mt-2 text-sm leading-5 text-[oklch(0.83_0.02_72)]">
                {status?.detail ?? 'Fetching dashboard data from Devvit.'}
              </p>
              {settingsDraft ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[oklch(0.28_0.04_58)] px-3 py-1 text-xs font-semibold text-[oklch(0.86_0.04_72)]">
                  <span
                    aria-hidden="true"
                    className={
                      settingsDraft.shadowMode
                        ? 'h-2 w-2 rounded-full bg-[oklch(0.78_0.13_72)]'
                        : 'h-2 w-2 rounded-full bg-[oklch(0.7_0.18_28)]'
                    }
                  />
                  {settingsDraft.shadowMode
                    ? 'Shadow mode on — advisory only'
                    : 'Shadow mode off — auto-action enabled'}
                </p>
              ) : null}
            </div>
          </div>

          <nav
            ref={tablistRef}
            className="mt-5 flex flex-wrap gap-2"
            aria-label="Dashboard sections"
            role="tablist"
            onKeyDown={handleTablistKeyDown}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className={
                    isActive
                      ? `rounded-full bg-[oklch(0.2_0.04_58)] px-4 py-2 text-sm font-black text-[oklch(0.97_0.008_72)] ${FOCUS_RING}`
                      : `rounded-full bg-[oklch(0.94_0.018_72)] px-4 py-2 text-sm font-black text-[oklch(0.36_0.045_58)] transition hover:bg-[oklch(0.9_0.025_70)] ${FOCUS_RING}`
                  }
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        {loadError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border border-[oklch(0.72_0.12_32)] bg-[oklch(0.97_0.03_42)] px-4 py-3 text-sm font-medium text-[oklch(0.34_0.06_42)]"
          >
            {loadError}
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-[oklch(0.82_0.05_72)] bg-[oklch(0.99_0.012_78)] px-4 py-3 text-sm font-medium text-[oklch(0.34_0.04_62)]"
          >
            {message}
          </div>
        ) : null}

        {activeTab === 'overview' ? (
          <TabPanel id="overview">
            <OverviewTab
              overview={overview}
              peers={sortedPeers}
              threats={dashboard?.threats ?? []}
              actions={dashboard?.actions ?? []}
              metrics={dashboard?.metrics ?? null}
              onGoToTrust={() => {
                setActiveTab('trust');
                focusTabButton('trust');
              }}
            />
          </TabPanel>
        ) : null}
        {activeTab === 'trust' ? (
          <TabPanel id="trust">
            <TrustGraphTab
              peers={sortedPeers}
              peerInput={peerInput}
              busy={busy}
              onPeerInput={setPeerInput}
              onAddPeer={addPeer}
              onRemovePeer={removePeer}
            />
          </TabPanel>
        ) : null}
        {activeTab === 'threats' ? (
          <TabPanel id="threats">
            <ThreatFeedTab threats={dashboard?.threats ?? []} onRefresh={loadDashboard} />
          </TabPanel>
        ) : null}
        {activeTab === 'actions' ? (
          <TabPanel id="actions">
            <ActionLogTab
              entries={dashboard?.actions ?? []}
              busy={busy}
              onUndoAction={undoAction}
            />
          </TabPanel>
        ) : null}
        {activeTab === 'settings' ? (
          <TabPanel id="settings">
            <SettingsTab
              settings={settingsDraft}
              busy={busy}
              onSettingsChange={setSettingsDraft}
              onSave={saveSettings}
            />
          </TabPanel>
        ) : null}
      </main>
    </div>
  );
};

function TabPanel(props: { id: TabId; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`panel-${props.id}`}
      aria-labelledby={`tab-${props.id}`}
      tabIndex={0}
      className={`rounded-[2rem] ${FOCUS_RING}`}
    >
      {props.children}
    </div>
  );
}

function OverviewTab(props: {
  overview: OverviewStats | undefined;
  peers: Peer[];
  threats: Threat[];
  actions: ActionLogEntry[];
  metrics: MetricsSummary | null;
  onGoToTrust: () => void;
}) {
  if (!props.overview) {
    return <OverviewSkeleton />;
  }

  const lastPollText = props.overview.lastPoll
    ? `${formatRelativeTime(props.overview.lastPoll.ts)} (${props.overview.lastPoll.added} new)`
    : 'Never';

  const showGettingStarted = props.overview.trustedPeers === 0;

  return (
    <section className="grid gap-5">
      {showGettingStarted ? (
        <div className="rounded-3xl border-2 border-[oklch(0.62_0.16_42)] bg-[oklch(0.97_0.025_64)] p-5">
          <p className="text-xs font-bold tracking-[0.14em] text-[oklch(0.4_0.1_38)] uppercase">
            Get started
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
            No trusted peers yet
          </h2>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[oklch(0.36_0.04_52)]">
            Hive needs at least one peer subreddit before any federation can happen.
            Add one you already trust — or apply a starter trust circle preset from
            the mod menu — and the rest of this dashboard wakes up.
          </p>
          <button
            type="button"
            onClick={props.onGoToTrust}
            className={`mt-4 min-h-[44px] rounded-full bg-[oklch(0.58_0.17_39)] px-5 py-2 text-sm font-black text-[oklch(0.98_0.006_72)] transition hover:bg-[oklch(0.52_0.18_39)] ${FOCUS_RING}`}
          >
            Add your first peer →
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Trusted peers" value={props.overview.trustedPeers} />
        <Metric label="Active threats" value={props.overview.activeThreats} />
        <Metric label="Indexed total" value={props.overview.threatsIndexed} />
        <Metric label="Last poll" value={lastPollText} compact />
      </div>

      <ImpactCard metrics={props.metrics} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Demo path" detail="The fastest story to show judges in 90 seconds.">
          <ol className="space-y-3 text-sm font-semibold text-[oklch(0.38_0.028_62)]">
            <li>1. Add one trusted peer subreddit.</li>
            <li>2. Let the peer publish a ban fingerprint to its wiki feed.</li>
            <li>3. Poll peers, then show the indexed alert and audit trail.</li>
          </ol>
        </Panel>
        <Panel title="Recent activity" detail="Latest audit entries from this install.">
          <div className="space-y-2">
            {props.actions.slice(0, 3).length === 0 ? (
              <EmptyState
                title="No actions yet"
                detail="Peer edits, polls, publishes, and setting changes appear here."
              />
            ) : (
              props.actions.slice(0, 3).map((entry) => <ActionRow key={entry.id} entry={entry} />)
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Trusted peers" detail="Configured federation sources.">
          <div className="space-y-2">
            {props.peers.slice(0, 5).length === 0 ? (
              <EmptyState title="No peers yet" detail="Open Trust Graph to add your first peer." />
            ) : (
              props.peers.slice(0, 5).map((peer) => <PeerSummary key={peer.peer} peer={peer} />)
            )}
          </div>
        </Panel>
        <Panel title="Threat preview" detail="Most recent indexed peer alerts.">
          <div className="space-y-2">
            {props.threats.slice(0, 2).length === 0 ? (
              <EmptyState
                title="No alerts indexed"
                detail="Open Threat Feed after a peer poll finds published alerts."
              />
            ) : (
              props.threats.slice(0, 2).map((threat) => (
                <ThreatRow key={threat.alertId} threat={threat} />
              ))
            )}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function ImpactCard(props: { metrics: MetricsSummary | null }) {
  const metrics = props.metrics;
  const allZero =
    metrics === null ||
    (metrics.flagsRaised === 0 &&
      metrics.modActions.total === 0 &&
      metrics.falsePositives === 0 &&
      metrics.federationAlerts === 0);

  return (
    <Panel
      title="Impact"
      detail="Lifetime counters across this install — visible to moderators."
    >
      {allZero ? (
        <EmptyState
          title="Metrics warming up"
          detail="Numbers will appear as mods take actions."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ImpactTile
            title="Flags raised"
            detail="Posts and comments surfaced for review."
            value={metrics.flagsRaised}
          />
          <ImpactTile
            title="Mod actions"
            detail={`Ban ${metrics.modActions.ban} · Remove ${metrics.modActions.remove} · Modnote ${metrics.modActions.modnote}`}
            value={metrics.modActions.total}
          />
          <ImpactTile
            title="False positives"
            detail="Alerts moderators dismissed as not harmful."
            value={metrics.falsePositives}
          />
          <ImpactTile
            title="Federation alerts"
            detail="Threat fingerprints indexed from trusted peers."
            value={metrics.federationAlerts}
          />
        </div>
      )}
    </Panel>
  );
}

function ImpactTile(props: { title: string; detail: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[oklch(0.86_0.032_68)] bg-[oklch(0.985_0.006_72)] p-4">
      <p className="text-xs font-bold tracking-[0.14em] text-[oklch(0.5_0.05_58)] uppercase">
        {props.title}
      </p>
      <p className="mt-1 text-xs leading-4 text-[oklch(0.45_0.028_62)]">{props.detail}</p>
      <p className="mt-3 text-4xl font-black tracking-[-0.05em]">{props.value}</p>
    </div>
  );
}

function TrustGraphTab(props: {
  peers: Peer[];
  peerInput: string;
  busy: boolean;
  onPeerInput: (value: string) => void;
  onAddPeer: () => void;
  onRemovePeer: (peer: string) => void;
}) {
  return (
    <Panel title="Trust Graph" detail="Add peer subs whose moderation signals should reach this install.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={`min-w-0 flex-1 rounded-2xl border border-[oklch(0.82_0.035_68)] bg-[oklch(0.99_0.006_72)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[oklch(0.56_0.14_38)] ${INPUT_FOCUS_RING}`}
          value={props.peerInput}
          onChange={(event) => props.onPeerInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void props.onAddPeer();
          }}
          placeholder="modsupport"
          aria-label="Peer subreddit name"
        />
        <button
          className={`rounded-2xl bg-[oklch(0.58_0.17_39)] px-4 py-3 text-sm font-black text-[oklch(0.98_0.006_72)] transition hover:bg-[oklch(0.52_0.18_39)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          onClick={() => void props.onAddPeer()}
          disabled={props.busy || props.peerInput.trim().length === 0}
        >
          Add peer
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {props.peers.length === 0 ? (
          <EmptyState
            title="No peers yet"
            detail="Start with one friendly test subreddit, then poll peers from the mod menu."
          />
        ) : (
          props.peers.map((peer) => (
            <PeerRow
              key={peer.peer}
              peer={peer}
              busy={props.busy}
              onRemovePeer={props.onRemovePeer}
            />
          ))
        )}
      </div>
    </Panel>
  );
}

function ThreatFeedTab(props: { threats: Threat[]; onRefresh: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Panel title="Threat Feed" detail="Incoming peer alerts indexed from trusted subreddit wiki feeds.">
      <div
        className="space-y-3"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label={`Peer threat feed, ${props.threats.length} active`}
      >
        {props.threats.length === 0 ? (
          <EmptyState
            title="No peer threats indexed"
            detail="Once a trusted peer publishes a ban fingerprint, it will appear here for review."
          />
        ) : (
          props.threats.map((threat) => (
            <ThreatRow
              key={threat.alertId}
              threat={threat}
              onRefresh={props.onRefresh}
              expanded={expandedId === threat.alertId}
              onToggleExpand={() =>
                setExpandedId((current) =>
                  current === threat.alertId ? null : threat.alertId,
                )
              }
            />
          ))
        )}
      </div>
    </Panel>
  );
}

function ActionLogTab(props: {
  entries: ActionLogEntry[];
  busy: boolean;
  onUndoAction: (id: string) => void;
}) {
  return (
    <Panel title="Action Log" detail="Recent setup and moderation events stored for auditability.">
      <div className="grid gap-3 md:grid-cols-2">
        {props.entries.length === 0 ? (
          <EmptyState
            title="No dashboard actions yet"
            detail="Peer edits, polls, publishes, and setting changes land here."
          />
        ) : (
          props.entries.map((entry) => (
            <ActionRow
              key={entry.id}
              entry={entry}
              busy={props.busy}
              onUndoAction={props.onUndoAction}
            />
          ))
        )}
      </div>
    </Panel>
  );
}

function SettingsTab(props: {
  settings: DashboardSettings | null;
  busy: boolean;
  onSettingsChange: (settings: DashboardSettings) => void;
  onSave: () => void;
}) {
  if (!props.settings) {
    return (
      <Panel title="Settings" detail="Loading moderation defaults.">
        <EmptyState title="Loading settings" detail="Fetching settings from Redis." />
      </Panel>
    );
  }

  const shadowMode = props.settings.shadowMode ?? true;
  const autoAction = props.settings.autoAction ?? false;
  const reviewThreshold = props.settings.reviewThreshold ?? 55;
  const flagThreshold = props.settings.flagThreshold ?? 75;

  return (
    <Panel title="Settings" detail="Keep the demo in advisory mode unless moderators opt in.">
      <div className="grid gap-4 lg:grid-cols-2">
        <ToggleRow
          title="Shadow mode"
          detail="Show warnings and write audit context without applying automatic actions."
          checked={shadowMode}
          onChange={(nextShadowMode) =>
            props.onSettingsChange({
              shadowMode: nextShadowMode,
              autoAction,
              reviewThreshold,
              flagThreshold,
            })
          }
        />
        <ToggleRow
          title="Auto action"
          detail="Reserved for later. Keep off for hackathon demos and beta outreach."
          checked={autoAction}
          onChange={(nextAutoAction) =>
            props.onSettingsChange({
              shadowMode,
              autoAction: nextAutoAction,
              reviewThreshold,
              flagThreshold,
            })
          }
        />
        <NumberField
          label="Review threshold"
          value={reviewThreshold}
          onChange={(reviewThreshold) =>
            props.onSettingsChange({
              shadowMode,
              autoAction,
              reviewThreshold,
              flagThreshold,
            })
          }
        />
        <NumberField
          label="Flag threshold"
          value={flagThreshold}
          onChange={(flagThreshold) =>
            props.onSettingsChange({
              shadowMode,
              autoAction,
              reviewThreshold,
              flagThreshold,
            })
          }
        />
      </div>

      <button
        className={`mt-5 rounded-2xl bg-[oklch(0.2_0.04_58)] px-5 py-3 text-sm font-black text-[oklch(0.97_0.008_72)] transition hover:bg-[oklch(0.26_0.045_58)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
        onClick={() => void props.onSave()}
        disabled={props.busy}
      >
        Save settings
      </button>
    </Panel>
  );
}

function OverviewSkeleton() {
  return (
    <section className="grid gap-5" aria-busy="true" aria-label="Loading dashboard overview">
      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-[oklch(0.86_0.032_68)] bg-[oklch(0.985_0.006_72)] p-4"
          >
            <div className="shimmer h-3 w-20 rounded-full" />
            <div className="shimmer mt-3 h-9 w-24 rounded-2xl" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <section
            key={i}
            className="rounded-[2rem] border border-[oklch(0.86_0.032_68)] bg-[oklch(0.985_0.006_72)] p-5"
          >
            <div className="shimmer h-6 w-40 rounded-2xl" />
            <div className="shimmer mt-2 h-3 w-56 rounded-full" />
            <div className="mt-5 space-y-2">
              <div className="shimmer h-12 w-full rounded-2xl" />
              <div className="shimmer h-12 w-full rounded-2xl" />
              <div className="shimmer h-12 w-5/6 rounded-2xl" />
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <section
            key={i}
            className="rounded-[2rem] border border-[oklch(0.86_0.032_68)] bg-[oklch(0.985_0.006_72)] p-5"
          >
            <div className="shimmer h-6 w-44 rounded-2xl" />
            <div className="shimmer mt-2 h-3 w-52 rounded-full" />
            <div className="mt-5 space-y-2">
              <div className="shimmer h-14 w-full rounded-2xl" />
              <div className="shimmer h-14 w-full rounded-2xl" />
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function Metric(props: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-3xl border border-[oklch(0.86_0.032_68)] bg-[oklch(0.985_0.006_72)] p-4">
      <p className="text-xs font-bold tracking-[0.14em] text-[oklch(0.5_0.05_58)] uppercase">
        {props.label}
      </p>
      <p
        className={
          props.compact
            ? 'mt-2 text-lg font-black tracking-[-0.03em]'
            : 'mt-2 text-4xl font-black tracking-[-0.05em]'
        }
      >
        {props.value}
      </p>
    </div>
  );
}

function Panel(props: { title: string; detail: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-[oklch(0.86_0.032_68)] bg-[oklch(0.985_0.006_72)] p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-[-0.04em]">{props.title}</h2>
          <p className="mt-1 text-sm leading-5 text-[oklch(0.43_0.028_62)]">{props.detail}</p>
        </div>
      </div>
      {props.children}
    </section>
  );
}

function PeerSummary(props: { peer: Peer }) {
  return (
    <div className="rounded-2xl bg-[oklch(0.95_0.018_72)] px-4 py-3">
      <p className="font-black tracking-[-0.02em]">r/{props.peer.peer}</p>
      <p className="text-xs font-medium text-[oklch(0.48_0.03_62)]">
        Added {formatRelativeTime(props.peer.addedAt)}
      </p>
    </div>
  );
}

function reputationBadgeColor(fpRate: number): string {
  // AA contrast on the oklch(0.95 0.018 72) chip background: darkened from
  // 0.55 → 0.42 to clear 4.5:1.
  if (fpRate > 20) return 'text-[oklch(0.42_0.17_42)]'; // amber warning
  return 'text-[oklch(0.42_0.03_62)]'; // quiet gray (also bumped from 0.52)
}

function ReputationBadge(props: { reputation: Peer['reputation'] }) {
  const { threats, fp, fpRate } = props.reputation;
  if (threats === 0) {
    return (
      <span className="text-xs font-medium text-[oklch(0.6_0.02_62)]">—</span>
    );
  }
  return (
    <span className={`text-xs font-semibold ${reputationBadgeColor(fpRate)}`}>
      {fp} FP / {threats} ({fpRate}%)
    </span>
  );
}

function PeerRow(props: {
  peer: Peer;
  busy: boolean;
  onRemovePeer: (peer: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timeoutId = window.setTimeout(() => setConfirming(false), 5000);
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-peer-confirm]')) return;
      setConfirming(false);
    };
    window.addEventListener('mousedown', handleClickAway);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('mousedown', handleClickAway);
    };
  }, [confirming]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[oklch(0.95_0.018_72)] px-4 py-3">
      <div>
        <p className="font-black tracking-[-0.02em]">r/{props.peer.peer}</p>
        <p className="text-xs font-medium text-[oklch(0.48_0.03_62)]">
          Added {formatRelativeTime(props.peer.addedAt)}
        </p>
        <ReputationBadge reputation={props.peer.reputation} />
      </div>
      {confirming ? (
        <div className="flex items-center gap-2" data-peer-confirm>
          <span className="text-xs font-semibold text-[oklch(0.42_0.04_52)]">Remove?</span>
          <button
            className={`min-h-[44px] rounded-full bg-[oklch(0.58_0.17_39)] px-4 py-2 text-sm font-black text-[oklch(0.98_0.006_72)] transition hover:bg-[oklch(0.52_0.18_39)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            onClick={() => {
              setConfirming(false);
              void props.onRemovePeer(props.peer.peer);
            }}
            disabled={props.busy}
          >
            Confirm
          </button>
          <button
            className={`min-h-[44px] rounded-full border border-[oklch(0.78_0.035_62)] px-4 py-2 text-sm font-black text-[oklch(0.42_0.04_52)] transition hover:bg-[oklch(0.91_0.026_62)] ${FOCUS_RING}`}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className={`min-h-[44px] rounded-full border border-[oklch(0.78_0.035_62)] px-4 py-2 text-sm font-black text-[oklch(0.42_0.04_52)] transition hover:bg-[oklch(0.91_0.026_62)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          data-peer-confirm
          onClick={() => setConfirming(true)}
          disabled={props.busy}
        >
          Remove
        </button>
      )}
    </div>
  );
}

function ThreatRow(props: {
  threat: Threat;
  onRefresh?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isExpandable = props.onToggleExpand !== undefined;
  const isExpanded = props.expanded ?? false;

  const handleMarkFP = async () => {
    setMarking(true);
    setMarkError(null);
    try {
      await trpc.dashboard.threats.markFalsePositive.mutate({
        alertId: props.threat.alertId,
        publisherSub: props.threat.publisherSub,
      });
      props.onRefresh?.();
    } catch (err) {
      setMarkError(
        err instanceof Error
          ? `Could not mark as false positive: ${err.message}`
          : 'Could not mark as false positive. Try again.',
      );
    } finally {
      setMarking(false);
    }
  };

  return (
    <article className="rounded-3xl border border-[oklch(0.84_0.035_68)] bg-[oklch(0.96_0.012_72)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[oklch(0.52_0.06_42)] uppercase">
            r/{props.threat.publisherSub} · {props.threat.alertId.slice(0, 8)}
          </p>
          <h3 className="mt-1 text-xl font-black tracking-[-0.04em]">
            {categoryLabel(props.threat.category)}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {props.onRefresh !== undefined ? (
            <button
              className={
                props.threat.markedFP
                  ? `min-h-[44px] rounded-full border border-[oklch(0.75_0.04_62)] px-4 py-2 text-sm font-black text-[oklch(0.42_0.03_62)] cursor-default opacity-60 ${FOCUS_RING}`
                  : `min-h-[44px] rounded-full border border-[oklch(0.78_0.035_62)] px-4 py-2 text-sm font-black text-[oklch(0.42_0.04_52)] transition hover:bg-[oklch(0.91_0.026_62)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`
              }
              onClick={() => void handleMarkFP()}
              disabled={props.threat.markedFP || marking}
              aria-label="Mark alert as false positive"
            >
              {props.threat.markedFP ? 'Marked FP' : 'Mark FP'}
            </button>
          ) : null}
          <div className="rounded-2xl bg-[oklch(0.22_0.04_58)] px-4 py-2 text-right text-[oklch(0.97_0.008_72)]">
            <p className="text-xs font-semibold text-[oklch(0.8_0.04_72)]">Composite</p>
            <p className="text-2xl font-black">{props.threat.composite ?? 'n/a'}</p>
          </div>
        </div>
      </div>
      {markError ? (
        <p
          role="alert"
          className="mt-3 rounded-2xl bg-[oklch(0.96_0.04_42)] px-3 py-2 text-xs font-semibold text-[oklch(0.36_0.08_42)]"
        >
          {markError}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Fact label="Signals" value={signalLabel(props.threat)} />
        <Fact label="Published" value={formatRelativeTime(props.threat.publishedAt)} />
        <Fact label="Expires in" value={formatTimeUntil(props.threat.ttlAt)} />
      </dl>
      {isExpandable ? (
        <>
          <button
            className={`mt-4 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-2xl bg-[oklch(0.985_0.006_72)] px-4 py-3 text-xs font-black tracking-[0.12em] text-[oklch(0.42_0.04_52)] uppercase transition hover:bg-[oklch(0.95_0.018_72)] ${FOCUS_RING}`}
            onClick={props.onToggleExpand}
            aria-expanded={isExpanded}
            aria-controls={`threat-detail-${props.threat.alertId}`}
          >
            <span>{isExpanded ? 'Hide detail' : 'Show detail'}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: reducedMotion ? 'none' : 'transform 200ms ease',
              }}
            >
              <path
                d="M3 5L7 9L11 5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div
            id={`threat-detail-${props.threat.alertId}`}
            className={
              reducedMotion
                ? 'grid overflow-hidden'
                : 'grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out'
            }
            style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
          >
            <div className="min-h-0">
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <Fact
                  label="Matched signal"
                  value={
                    props.threat.matchedSignals.length === 0
                      ? 'None'
                      : props.threat.matchedSignals.map(categoryLabel).join(' + ')
                  }
                />
                <Fact
                  label="Similarity"
                  value={
                    props.threat.composite === null
                      ? 'n/a'
                      : `${props.threat.composite}%`
                  }
                />
                <Fact label="Publisher" value={`r/${props.threat.publisherSub}`} />
                <Fact label="Alert ID" value={props.threat.alertId} />
                <Fact
                  label="TTL"
                  value={`${formatTimeUntil(props.threat.ttlAt)} (${new Date(props.threat.ttlAt).toLocaleString()})`}
                />
              </dl>
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}

function ActionRow(props: {
  entry: ActionLogEntry;
  busy?: boolean;
  onUndoAction?: (id: string) => void;
}) {
  return (
    <article className="rounded-3xl bg-[oklch(0.95_0.018_72)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-[oklch(0.88_0.04_68)] px-3 py-1 text-xs font-black text-[oklch(0.36_0.055_55)]">
          {categoryLabel(props.entry.type)}
        </span>
        <time className="text-xs font-semibold text-[oklch(0.48_0.03_62)]">
          {formatRelativeTime(props.entry.ts)}
        </time>
      </div>
      <h3 className="mt-3 text-lg font-black tracking-[-0.03em]">{props.entry.title}</h3>
      <p className="mt-1 text-sm leading-5 text-[oklch(0.4_0.03_62)]">
        {props.entry.detail}
      </p>
      {props.entry.undo && props.onUndoAction ? (
        <button
          className={`mt-3 rounded-full border border-[oklch(0.78_0.035_62)] px-3 py-1 text-xs font-black text-[oklch(0.42_0.04_52)] transition hover:bg-[oklch(0.91_0.026_62)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          onClick={() => props.onUndoAction?.(props.entry.id)}
          disabled={props.busy}
        >
          Undo
        </button>
      ) : null}
    </article>
  );
}

function ToggleRow(props: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-3xl bg-[oklch(0.95_0.018_72)] p-4">
      <span>
        <span className="block font-black tracking-[-0.03em]">{props.title}</span>
        <span className="mt-1 block text-sm leading-5 text-[oklch(0.43_0.028_62)]">
          {props.detail}
        </span>
      </span>
      <input
        className={`mt-1 h-5 w-5 accent-[oklch(0.58_0.17_39)] ${INPUT_FOCUS_RING}`}
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const inputId = `number-field-${props.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="rounded-3xl bg-[oklch(0.95_0.018_72)] p-4">
      <label
        htmlFor={inputId}
        className="block text-xs font-bold tracking-[0.14em] text-[oklch(0.42_0.05_58)] uppercase"
      >
        {props.label}
      </label>
      <input
        id={inputId}
        className={`mt-3 w-full rounded-2xl border border-[oklch(0.82_0.035_68)] bg-[oklch(0.99_0.006_72)] px-4 py-3 text-sm font-black outline-none transition focus:border-[oklch(0.56_0.14_38)] ${INPUT_FOCUS_RING}`}
        type="number"
        min={0}
        max={100}
        value={props.value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          props.onChange(next);
        }}
      />
    </div>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[oklch(0.985_0.006_72)] px-3 py-2">
      <dt className="text-xs font-bold tracking-[0.12em] text-[oklch(0.52_0.045_62)] uppercase">
        {props.label}
      </dt>
      <dd className="mt-1 font-black tracking-[-0.02em]">{props.value}</dd>
    </div>
  );
}

function EmptyState(props: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[oklch(0.78_0.035_68)] bg-[oklch(0.965_0.012_72)] p-5">
      <p className="font-black tracking-[-0.03em]">{props.title}</p>
      <p className="mt-1 text-sm leading-5 text-[oklch(0.43_0.028_62)]">{props.detail}</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
