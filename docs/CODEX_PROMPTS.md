# Codex Implementation Prompts — Updated v1.1 (Real Data First)

**How to use:** Extract the ZIP, copy the **contents** of `copy_into_SOURCE/` into your EXISTING VS Code project folder (`SOURCE`), then paste **Prompt 1 only** into Codex. After Codex reports completion, inspect/run the result and advance one prompt at a time. Do not paste all prompts at once. `START_HERE.md` has the exact Mac steps.

**Source-of-truth order:** (1) owner page requirements in `docs/FEATURE_SPEC.md`; (2) approved data/guest/eligibility rules in `docs/DATA_CONTRACT.md` (overrides older import assumptions); (3) `docs/TEST_ACCEPTANCE.md`; (4) these milestone prompts. Assistant-proposed Analytics and Elo choices are provisional, not invented owner approval.

---

## PROMPT 1 — Existing-app audit, secure data model, historical dry run (PASTE THIS NOW)

You are working in my **EXISTING** local Next.js 16 / TypeScript / Tailwind project, opened as `SOURCE` in VS Code. The site already has a polished, responsive design and navigation. **Do not scaffold a new app, redesign it, or replace its working components.** Keep Dashboard, Players, Decks, Games, Tracking, Analytics, and a future `Play` placeholder.

**Read these files fully before editing:** `docs/FEATURE_SPEC.md`, `docs/DATA_CONTRACT.md`, `docs/TEST_ACCEPTANCE.md`, and `data/historical/README.md`. Inspect the actual CSV headers rather than relying on memory or assuming the original Excel format. The data source is **finalized**: 141 historical games, 565 seats, 6 members, 61 member-owned decks, 126 canonical commander identities. Guest entries are **not member accounts**; Ken is **not** Keenan.

Implement **Milestone 1 only**, with no Supabase credentials required:

1. Inspect existing routes, components, scripts, dependencies, and demo data. Briefly document what you will preserve, what is mock data, and the smallest set of changes needed. Use installed dependencies if suitable. Do not wipe the current UI.
2. Run `python3 scripts/verify_historical_data.py` **before any change to the import files**. Verify data are ignored by Git with `git check-ignore data/historical/games.csv` (if repo is initialized). These contain private original guest names; NEVER move them to `public/`, expose them through browser API routes, or commit them.
3. Design and implement Postgres/Supabase migration SQL with unique stable source IDs, distinct approved members, commander registry, member-owned decks, games, game participants, import provenance and safe auth/role mapping. **Guest seats must have nullable member/deck IDs but a required commander and seat. Store winning seat independently of any member ID.** Preserve the three historical exceptions. Make private guest-name provenance inaccessible to anonymous users. Use RLS/grants and safe public read projections; do not leak data through views/functions.
4. Implement reusable TypeScript data types and validation/eligibility logic. Manual games must have a single winning seat, but historical import must preserve Draw, Shared winner, and Winner missing rows. Implement the precise 2+ member / single-winner / 4-player filters in one place.
5. Build an **offline, read-only** import dry-run/verification command (e.g. `npm run historical:check`) that parses `data/historical/*.csv`, checks all foreign keys, counts, source keys, guest seats, dates and exceptions, and prints an import plan. **Do not perform hosted writes** and do not re-normalize the approved commander names. Add useful automated fixture tests.
6. Keep original pages compiling even if backend env variables are absent. Remove *misleading* production demo statistics or mark the existing demo mode clearly as demonstration-only until the real DB is connected. Avoid expensive new dependencies. Add `.env.example` for public Supabase URL/publishable key and server-only secrets if required; never invent credentials.
7. Verify lint, available tests, typecheck, and production build. If an external API or Supabase setting is needed, document exactly what I must do and STOP rather than guessing.

**Acceptance gates:** Existing design still intact; offline verifier passes **141 games / 565 seats / 6 players / 61 decks / 126 commanders / 131 guest seats / 114 participation-eligible / 111 win-eligible / 97 four-player win-eligible / 56 carried dates / 3 exceptional results**; schema supports guest winner; read-only dry-run has no network writes; local build passes. Do not implement actual import, Tracking forms, Dashboard calculations, advanced charts or Play at this step.

**STOP and report:** files changed, commands run/results, dry-run reconciliation, migration/RLS design, and exact setup steps I need before Prompt 2. Do not continue to later prompts automatically.

---

## PROMPT 2 — Supabase connection, real import, secure public read

Read all three docs plus the Milestone 1 implementation. Preserve existing UI and local raw data privacy. Implement **Milestone 2 only**.

Use an existing Supabase project if credentials are configured. Otherwise, do all remaining local work possible and give me a **beginner-friendly, exact setup checklist** to create a Supabase project and put the project URL and publishable key in `.env.local`; **stop before remote operations** if credentials or explicit project access are missing. Follow the current official Supabase Next.js SSR guide using `@supabase/ssr` and verified server identity/claims. Do not use deprecated Auth Helpers or trust user-editable profile fields for authorization. The admin must be linked by an explicitly approved auth-user-to-player role assignment, **never by checking the name “Will.”**

Apply migrations to the intended project with a safe migration workflow. Implement RLS and public-safe read access. Store original guest names only in restricted provenance; public APIs show **Guest**. Approved authenticated members may later create new games; only admin may correct/delete completed games. Add tests or SQL checks proving anonymous/non-admin writes fail. Keep any privileged key strictly server-side.

Implement a one-time **idempotent importer** of `data/historical/*.csv`: dry run first; resolve the stable source IDs; insert the approved six players, 126 commanders, 61 member decks, 141 games, and 565 seats; preserve the 3 exceptional results, inferred date origins, guest-winning seats and source notes. Do not generate fake games, guess card identities, re-open approved corrections, or overwrite later manually entered rows. If CSV/schema mapping or deployed counts differ, print a reconciliation error and STOP without declaring success. Rerun import to verify **no duplicates**.

Provide a simple **public, sanitized data-access query** usable by Games/Dashboard pages; raw CSVs must not be needed at runtime once imported. Run tests, lint, typecheck/build. Stop with the real database counts, access checks, and exact user setup needed to run locally.

**Acceptance:** All 141 visible via safe read queries (not necessarily fully displayed yet), 565 seats, no original guest names in anonymous payloads, idempotent import, member/admin mapping documented, no fictional production records.

**STOP** after Milestone 2.

---

## PROMPT 3 — Actual Games history and authenticated Tracking

Read `docs/FEATURE_SPEC.md` sections 5–6, `DATA_CONTRACT.md`, and the live schema. Implement **Milestone 3 only**, preserving the site look.

**Games:** replace fictional rows with a paginated/searchable newest-first history of **all 141** imported games including those below the stats threshold and the three exceptional results. Show local date, stable within-day game number, source tag, notes, seats in order and exact canonical commander labels. Guest seat reads **Guest** (and optional seat number), not an original private name. Highlight most recent winner where a single winner exists; show Draw/Shared winner/Winner missing as appropriate, never a made-up winner. Filtering by date/member/commander/winner; deep links to real member/deck details, but no fake guest profiles. Cumulative game history chart should state whether it counts all logged games or qualified games.

**Tracking:** secure login/onboarding for approved playgroup members, minimal mobile-friendly quick game entry, default/editable date, optional location/notes, 3–6 ordered seats, members selecting owned decks (auto-register a new member+commander if needed), and one or more **Guest** seats selecting a commander without creating an account or permanent member deck. Guest may be winner. New games require a single winner and unique contiguous seats; distinct guests are separate seat rows. Let authenticated member submit even if fewer than 2 members played; those games are stored but excluded from official stats. Prefer cached/correct commander autocomplete; never silently change approved historical labels. Support review-before-save, idempotency/double-submit protection and atomic writes.

**Permissions:** anonymous read; approved member can create; only admin can edit/delete completed history. Record correction/audit event and cause recomputation of derived analytics. Reject direct unauthorized API calls in addition to hiding controls. Tests for invalid seats, duplicate member, ownership, winner guest, duplicate submission, daily numbering and corrections.

Do not build charts outside Games or the Play life tracker. Run tests/lint/typecheck/build. **STOP** with a manual checklist for anonymous, member and admin sessions.

---

## PROMPT 4 — Real Dashboard, original exact design requirements

Read `FEATURE_SPEC.md` section 2, `DATA_CONTRACT.md` and existing layouts. Implement **Milestone 4 only**. **All Dashboard summary stats/charts use four-player games with at least two members and a single winner**. In the 141-game snapshot this is **97 games**, not 123 or 141. No placeholder/random numbers in production. Respect All time / Last 365 days / Last 30 days, with reliable empty states for quiet date ranges.

Implement exactly **three** top cards (active member players in eligible games, games played, distinct member-owned decks played); player win-rate bar with **25% baseline**, player Elo ranking clearly labeled **provisional**, player games/wins/% leaderboard, top five decks by win% (min 5 games), top five decks by provisional Elo (min 5 games), deck diversity donut (share of distinct eligible **member-owned** decks by owner, not appearances), latest three eligible games, cumulative eligible games and cumulative unique member decks, and hot/cold last-five eligible games (min two appearances; provisional rule). Links to Player/Deck/Game detail pages.

Use a **single tested stats module** and transparent filters. Guest-winning eligible games count as games, but not member wins. Sample sizes and the “Nelson's recorded historical sample” qualifier should be visible. Elo remains provisional until the owner approves the formula; guest seats should be treated as virtual opponents for provisional Elo as specified, not fake member ranks. Do not silently mix 3P/5+ into dashboard.

Run deterministic tests, lint/typecheck/build, review responsive chart/table layouts, and **STOP**.

---

## PROMPT 5 — Real Players and Decks directories and profiles

Read `FEATURE_SPEC.md` sections 3–4 and shared definitions, plus `DATA_CONTRACT.md`. Implement **Milestone 5 only**, without reworking existing layout.

**Players:** six member cards including Keenan with no history (`N/A`, not invented results). Rectangular cards with circular avatar (fallback: picture of most played deck's commander), name, eligible win%, provisional Elo, and most-played deck. Detail pages: key stats, two color occurrence distributions (unique member decks and member deck appearances), seat distribution and seat-specific win rate, deck table and 4-game minimum for rate sorting, chronological win% and Elo, opponents shared games, most common/opponent decks, top wins/losses vs decks, streaks and Elo extrema. Pod toggle 3 / 4 / 5+ (separated), default 4.

**Decks:** owner+commander identity, no guest owner profile. Search by member or canonical commander; best 10 and worst 5 min **five games**; sortable win% or provisional Elo; individual deck full-card image (when trusted metadata available), optional **individual deck** Moxfield URL editable only by owner/admin, own eligible wins/games/Elo, highlighted appearances-vs-win% quadrant, cumulative appearances/wins, most common opponent member decks, three most beaten/three most lost-to, sample sizes and links. Optional known Moxfield user URLs belong on member profiles, not automatically assigned to decks.

Card metadata / images: enrich only through legitimate card-data API with caching/rate limits; historical canonical spellings are primary keys and must not be silently rewritten if API lookup fails. For unresolved metadata, use neutral fallback; **unknown color identity is not the same as colorless**. Keep mobile readability and no mock data in production.

Test profile statistics against real import plus deterministic synthetic fixtures. Run lint/typecheck/build and **STOP**.

---

## PROMPT 6 — Advanced Analytics, matrices and provisional Elo

Read `FEATURE_SPEC.md` sections 7 and 9, `DATA_CONTRACT.md` and `TEST_ACCEPTANCE.md`. Implement **Milestone 6 only** using the centrally tested eligible-games service. All Analytics panels are **assistant-proposed** features pending owner refinement; label questionable interpretations clearly and do not silently introduce an unapproved power ranking.

Build player and member-deck games-played-vs-win%-quadrant charts, color-identity occurrence shares and color-involved win rates, 4-player seat distribution/seat success, player shared-games matrix, member deck shared-games matrix (limit initial view to top ten most-used decks), expected wins / wins-above-expectation, cumulative and rolling ten-appearance trends, chronological Elo trends, sorting and 3 / 4 / 5+ + date/member/deck filters. Retain exact actual pod size for 5+ expected wins. Rank only member players/member-owned decks; guest commanders remain in eligible game/opponent context without creating player/deck ranking rows. Do not treat shared-game win rate as head-to-head 1v1 or two opposing cells as complementary. No misleading small samples or causal conclusions.

Provisional Elo: reproducible, deterministic per-pod group and per entity (player and member-owned deck); compute each eligible winner-vs-other seat as described in the spec; guest seats are **fresh temporary 1000-rated seats in each game** and have no persisted rating. Game-by-game zero-sum across **all seats**, not necessarily across members alone. A guest winner must work. Test chronological corrections, double-counting, equal ratings, separate 3/4/5+ rankings, and cases with multiple guests. Display as “Provisional Elo” until owner signs off.

Test responsive interactions at 375/393/430/768px and desktop. Run tests/lint/typecheck/build. **STOP**.

---

## PROMPT 7 — End-to-end QA, security, deployment readiness

Read all docs and inspect the repository, current Supabase configuration and logs. Implement **Milestone 7 only**, with no new major features. Audit data integrity and permissions (guest provenance/private tables; public views; server-authorized admin correction; member onboarding; safe service keys), idempotent import and 141/565/114/111/97 reconciliation, source labels, empty states, false demo data removal, game creation/correction backfill effects on charts/Elo, mobile tap targets and tables, and accessible controls. Ensure no raw historical CSV or private guest names are in public assets or Git.

Run lint, tests, `npx tsc --noEmit` where applicable, and production build; fix regressions. Supply a **beginner-friendly deployment guide** for Vercel + Supabase, env vars, auth redirect allowlist, domain optional, migrations, backup/export and validating the live site from a phone without the Mac running. Never assert deployment happened unless verified. Keep **Play** as a functional placeholder, to be designed separately later.

**STOP** and report passes, failures, remaining manual owner steps, and exact production verification checklist.

---

## NOT NOW — Later Play life tracker

The visible Play navigation tab should remain a clearly deferred page. Eventually: lobby -> choose member/guest participants, commanders and seats -> life/commander damage/poison -> optional collaborative live updates -> winner/confirm -> save **exactly one** completed game through the same game persistence service. No live state, WebSockets or counter UI in the seven milestones above.
