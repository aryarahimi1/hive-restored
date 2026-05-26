# Hive Restored

**Federated bad-actor detection for Reddit moderators — built on Devvit.**

A one-click installable Devvit app that lets mod teams share threat intelligence about ban-evading accounts, scam-DM rings, and AI-spam karma farmers across an opt-in network of trusted subreddits — without using the subreddit-association API Reddit killed in March 2026.

---

## The opening

On **March 6, 2026**, Reddit removed the subreddit-association lookups that Saferbot, Hive Protect, and several smaller bots relied on. Thousands of mod teams woke up to find their primary anti-evasion defense bricked overnight. Right now, in May 2026, r/ModSupport is full of "what do we use now?" threads with no good answer.

This project is the answer.

## The product

When a flagged user posts in your modqueue, opening Hive from the row's mod menu shows:

> 🛑 **Behavioral match: 87%** to a known scam-DM ring.
> Banned in **4 of your 12 trusted peer subs** in the last 30 days for the same pattern.
> Account ramped karma in r/aww → first political comment 6h later → 8 sibling accounts created same week share writing-cadence fingerprint.
>
> [ Show evidence ]  [ ☐ Add mod note  ☐ Remove  ☐ Ban ]  [ Mark false positive ]

No subreddit-association lookups. No usernames or raw post/comment text shared between subs. Just **opaque behavioral hashes** and **mod-action outcomes** — federated through an opt-in trust graph the mod team controls. See [`SECURITY.md`](./SECURITY.md) for the privacy contract.

## How it works (90 seconds)

1. Mod installs Hive Restored on their sub from the Devvit App Directory
2. Mod picks 5–30 peer subs to trust (the "hive") — or applies a starter / mid-size / large preset trust circle
3. Every comment/post by a new-to-sub user triggers background fingerprinting (3 signals: posting-time entropy, n-gram writing cadence, link-domain history)
4. When a mod in any trusted peer sub bans a user, an opaque behavioral fingerprint is published to that sub's `r/<sub>/wiki/hive-threats` page
5. Other subs in the hive poll those wiki pages every 2 minutes and index the new alerts
6. When that user (or a behavioral sibling) shows up in your sub, you see the threat badge in the modqueue mod menu with ban / remove / mod-note checkboxes

---

## Install on your subreddit

Hive Restored ships through the Devvit App Directory. You need to be a moderator with **config permissions** on the target subreddit.

1. Open the app listing at `https://developers.reddit.com/apps/hive-restored` (or search "Hive Restored" in the directory).
2. Click **Install** and pick the subreddit to install on.
3. Approve the requested permissions — Hive needs moderator scope to read the modqueue, write mod notes, and edit the `hive-threats` wiki page.

**First-run setup, in order:**

- **Open the dashboard.** Hive's splash post is created on install; the dashboard lives behind it. You'll land on the Overview tab with a *Get started → Add your first peer* CTA.
- **Apply a trust-circle preset (fastest path).** From the subreddit's mod-tools menu, click **Hive: apply trust circle preset** and pick one:
  - `starter` — 5 friendly small/midsize subs (good for testing)
  - `midsize` — 10 mid-traffic subs that share scam-DM patterns
  - `large` — 30 high-traffic subs (use only if your sub is itself ≥500K)
- **Or add peers one at a time.** Use **Hive: add trusted peer sub** from the same menu, or the Trust Graph tab on the dashboard.
- **Shadow mode is on by default.** Hive computes signals, indexes peer alerts, and surfaces the badge — but it does **not** ban, remove, or write mod notes automatically. To turn on auto-action, go to the dashboard's Settings tab and uncheck *Shadow mode*. Read the FP rate on the Overview impact card for a few days before you do.
- **Verify federation.** Use **Hive: poll peers now** to force an immediate poll, then **Hive: federation status** to see how many alerts indexed. Polling otherwise runs every 2 minutes via the Devvit scheduler.

**Using the badge:** when a peer-matched user posts, open the row's mod menu in the modqueue and click **Hive: threat badge**. A popover opens with the composite score, which signals fired, the peer sub that flagged the user, plus three checkboxes — *Add mod note*, *Remove*, *Ban* — and an *Apply actions* button. Every action lands in the action log with an Undo option visible to the rest of your mod team.

---

## Run it locally (developers + hackathon judges)

You need **Node ≥22.2** and a Reddit developer account at <https://developers.reddit.com>.

```bash
git clone https://github.com/aryarahimi1/hive-restored.git
cd hive-restored
npm install
npm run login        # opens the browser to authenticate Devvit
npm run dev          # devvit playtest — uploads to your test sub and tails logs
```

The first run will ask you which subreddit to playtest against. Use a **private test subreddit you fully control** — the app installs as a real Devvit app, not a sandbox.

**Test gates** (also enforced before deploy/launch):

```bash
npm run type-check   # tsc --build
npm run lint         # eslint
npm run test         # vitest run — 216 tests
```

**Ship to your own org's App Directory:**

```bash
npm run deploy       # type-check + lint + test + devvit upload
npm run launch       # deploy + devvit publish (full App Directory listing)
```

### What's where

- **`src/server/`** — Hono server with tRPC routes, federation transport (`federation/wikiPublisher.ts`, `federation/wikiSubscriber.ts`, `federation/threatMatcher.ts`), trigger handlers (`routes/triggers.ts`), the modqueue badge form (`routes/modqueueBadge.ts`), and Redis storage (`storage/`).
- **`src/server/fingerprint/`** — the three behavioral signals: `timeEntropy.ts` (Shannon + KL), `ngramCadence.ts` (SimHash), `domainHistory.ts` (MinHash), and `composite.ts` (weighted scoring with multi-signal-agreement bonus).
- **`src/client/`** — React 19 + Tailwind 4 webview dashboard (`game.tsx`) and splash (`splash.tsx`).
- **`devvit.json`** — Devvit app manifest: mod menu items, forms, triggers, scheduler, permissions.

---

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design, federation protocol, Redis keyspace
- [`SECURITY.md`](./SECURITY.md) — privacy posture, threat model, per-publisher salt rotation
- [`docs/FINGERPRINT_SPEC.md`](./docs/FINGERPRINT_SPEC.md) — algorithmic spec for the three signals

## License

BSD-3-Clause. See [`LICENSE`](./LICENSE).
