// Static mock data used across the product-walkthrough scenes.
// Pure constants — no functions of frame here. Each scene composes its
// own state slice from these.

export const MOCK_SUB = 'yoursub';
export const MOCK_BANNED_USER = 'example_alt';

// Demo-only midsize preset. Keep names obviously synthetic so the video does
// not imply real subreddit participation.
export const MOCK_PRESET_PEERS = [
  'hive_demo_a',
  'hive_demo_b',
  'hive_demo_c',
  'hive_demo_d',
  'hive_demo_e',
  'hive_demo_f',
  'hive_demo_g',
  'hive_demo_h',
  'hive_demo_i',
  'hive_demo_j',
] as const;

export type MockThreat = {
  alertId: string;
  publisherSub: string;
  category: string;
  composite: number;
  matchedSignals: string[];
  publishedAt: string;
  ttlAt: string;
};

export const MOCK_THREAT: MockThreat = {
  alertId: '3a9f51e2-7b04-4d2e-9f6a-1c5e8b3a44d1',
  publisherSub: 'hive_demo_a',
  category: 'cadence',
  composite: 87,
  matchedSignals: ['Cadence'],
  publishedAt: 'just now',
  ttlAt: '14d',
};

export type MockAction = {
  id: string;
  type: 'Mod' | 'Peer' | 'System';
  title: string;
  detail: string;
  ts: string;
  showUndo: boolean;
};

export const MOCK_ACTIONS_AFTER_BAN: MockAction[] = [
  {
    id: 'a1',
    type: 'Mod',
    title: 'Banned u/example_alt',
    detail:
      'Acted on a federated threat from r/hive_demo_a · alert 3a9f51e2',
    ts: 'just now',
    showUndo: false,
  },
  {
    id: 'a2',
    type: 'Peer',
    title: 'Applied preset "Midsize (10 peers)"',
    detail: '10 peers added, 0 already present.',
    ts: 'just now',
    showUndo: false,
  },
  {
    id: 'a3',
    type: 'Peer',
    title: 'Trusted r/hive_demo_c',
    detail: 'Added to the federation trust graph from the mod menu form.',
    ts: '1m ago',
    showUndo: true,
  },
];

export const MOCK_IMPACT_TARGETS = {
  flagsRaised: 1,
  modActionsTotal: 1,
  modActionsBreakdown: 'Ban 1 · Remove 0 · Modnote 0',
  falsePositives: 0,
  federationAlerts: 1,
} as const;
