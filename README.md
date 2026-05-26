# Hive Restored

**Federated bad-actor detection for Reddit moderators — built on Devvit.**

A one-click installable Devvit app that lets mod teams share threat intelligence about ban-evading accounts, scam-DM rings, and AI-spam karma farmers across an opt-in network of trusted subreddits — without using the subreddit-association API Reddit killed in March 2026.

---

## The opening

On **March 6, 2026**, Reddit removed the subreddit-association lookups that Saferbot, Hive Protect, and several smaller bots relied on. Thousands of mod teams woke up to find their primary anti-evasion defense bricked overnight. Right now, in May 2026, r/ModSupport is full of "what do we use now?" threads with no good answer.

This project is the answer.

## The product

When a flagged user appears in your modqueue, **Hive Restored** shows:

> 🛑 **Behavioral match: 87%** to a known scam-DM ring.
> Banned in **4 of your 12 trusted peer subs** in the last 30 days for the same pattern.
> Account ramped karma in r/aww → first political comment 6h later → 8 sibling accounts created same week share writing-cadence fingerprint.
>
> [ Review evidence ]  [ Ban + report ring ]  [ Mark false positive ]

No subreddit-association lookups. No usernames or raw post/comment text shared between subs. Just **opaque behavioral hashes** and **mod-action outcomes** — federated through an opt-in trust graph the mod team controls.

## Why this can win the hackathon

- **Solves a fresh, screaming pain point** — Reddit broke the old tools 7 weeks before the hackathon started
- **Eligible for all three $10K prizes** — Best New Mod Tool, Moderator's Choice, and (with a port-companion) Best Ported Data API App
- **Past Devvit winners shared one trait**: polished narrow scope. This is one app, one workflow, one demo
- **Sustained payout**: Reddit Developer Funds 2026 pays $1K at 250 qualified installs — every desperate sub = 1 install closer

## How it works (90 seconds)

1. Mod installs Hive Restored on their sub from the Devvit App Directory
2. Mod picks 5–30 peer subs to trust (the "hive"), and which signals to share
3. Every comment/post by a new-to-sub user triggers background fingerprinting (3 signals: posting-time entropy, n-gram writing cadence, link-domain history)
4. When a mod in any trusted peer sub bans a user, an opaque behavioral fingerprint is published to the hive
5. When that user (or a behavioral sibling) shows up in your sub, you see the threat badge in modqueue with one-click action

## Status

✅ **Feature-complete, beta-distribution week** — May 2026. Days 1–6 of `PLAN.md` are shipped: three behavioral signals, federation over wiki transport, the trust graph, the modqueue badge, the mod dashboard, and metrics. See `docs/DEVPOST_SUBMISSION.md` for the submission narrative, `docs/DEMO_SCRIPT.md` for the 90-second walkthrough, `docs/VIDEO_PRODUCTION.md` for recording assets, and `docs/OUTREACH_PLAYBOOK.md` for the beta install playbook.

## Repo layout

```
hive-restored/
├── docs/              ← specs, decisions, outreach drafts
├── src/               ← Devvit app (TypeScript + React webview)
├── PLAN.md            ← 4-week build roadmap
├── ARCHITECTURE.md    ← system design
└── README.md          ← you are here
```
