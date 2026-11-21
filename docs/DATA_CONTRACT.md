# Approved Historical Data Contract — v1.1

**This file takes precedence over older assumptions about importing the spreadsheet in `FEATURE_SPEC.md`.** The original log was cleaned and commander-name corrections from the owner were incorporated. Do not re-run fuzzy matching, scrape Moxfield, or request another round of approvals for names already in the mapping.

## 1. Exact input and counts

Private files in `data/historical/` are the final, approved **read-only** historical export. CSVs are UTF-8 and may contain a BOM. Headers are authoritative: read them from the actual files and fail clearly on mismatch.

| File | Role | Rows expected |
|---|---|---:|
| `players.csv` | Six approved member identities and optional Moxfield user URLs | 6 |
| `commander_registry.csv` | Canonical commander/commander-pair identity, not guaranteed verified card metadata | 126 |
| `member_decks.csv` | Stable member+commander decks, not guest-owned decks | 61 |
| `games.csv` | One game per source game, outcome, inferred-date origin, eligibility flags, notes | 141 |
| `game_participants.csv` | Exactly one row per actual seat, including guest seats | 565 |
| `commander_aliases.csv` | Original labels -> accepted canonical names, audit provenance | 204 distinct alias pairs |
| `game_log_readable.csv` | Human-readable wide table for display QA, not primary relational import | 141 |
| `audit_exceptions.csv` | Reference explanations for exclusions | Reference only |
| `validation_summary.json` | Expected reconciliation totals | One JSON object |

Snapshot invariants: 141 games; 565 seats; 6 members; 131 guest appearances; 61 member-owned decks; 126 commander identities; 114 games with at least two member seats; 111 of those with one winner; 97 eligible 4-player single-winner games; 27 games below the two-member threshold; 56 carried-forward dates; 3 exceptional results; 69 corrected review groups. Pod-size totals: 9 three-player, 123 four-player, eight five-player, one six-player. As of this snapshot the latest game date is 2026-11-18.

All rows must survive the import. The dataset describes **Nelson's recorded games**, not the playgroup's complete, independently sampled history. Public stats should disclose that limitation.

## 2. Relational mapping (historical CSV -> live database)

**Players:** `players.player_id` is the stable approved key (`nelson`, `will`, `manfred`, `josh`, `sam`, `keenan`). Import this key into a unique `historical_player_key` or equivalent; internal Postgres IDs may be UUIDs. Use `players.name` and `moxfield_url` for display. **Ken is not Keenan**. Do not create a member row for Ken or the 130 other guest seat appearances.

**Commanders:** `commander_registry.commander_id` is the stable source key. Preserve `canonical_name` exactly; it can contain pairs separated by `/` and may not correspond to a single Scryfall printing. Optional card metadata enrichment happens later and must not silently overwrite reviewed canonical names. `commander_aliases` can remain a private lookup/audit table; importing its original names is not necessary for all public views.

**Member decks:** `member_decks.deck_id` maps to a stable `historical_deck_key`; `player_id` references the historical player key and `commander_id` the imported commander. **Unique owning member + commander identity**. Imported `moxfield_deck_url` may be blank. A Moxfield *user profile URL* on a player is different from an individual *deck URL*.

**Games:** Import `games.source_game_key` to a non-null, unique source import key with `source='spreadsheet'`. Preserve `game_id` as a historic display/audit key, `date` as the date (no timezone conversion), `date_origin` (`Explicit` / `Carried forward`), `pod_size`, `member_count`, `result`, `winner_seat`, `winner` (source description), `notes`, `source_sheet_row`. Each game gets a deterministic immutable `game_number_on_date` assigned across all pod sheets by date and then a stable source tie-breaker. Do **not** interpret within-day cross-worksheet numbering as confirmed real chronology. The CSV fields `analytics_eligible`, `win_stats_eligible`, `official_4p_win_stats_eligible` are **reconciliation checks**: recompute these from game/seat data and assert equality rather than using raw booleans as permanent unvalidated truth.

**Participants:** `game_participants.game_id` joins `games.game_id`, `seat` is an integer 1..pod_size, `commander_id` joins the commander registry. If `is_member=1`, resolve `player_id` to a real member and `deck_id` to that member's deck. If `is_member=0`, **player_id and deck_id MUST be null**; store the original guest name from `source_guest_name` / `original_player_name` only in a protected provenance field, never public responses or statistics grouping. Public seat display is literally `Guest` (optionally `Guest · Seat N`). A single-winner `winner_seat` selects the winning participant even if they are a Guest. Do not reconstruct guest deck ownership or collapse different guest seats into a single fake player.

**Exceptional outcomes:** The 3 `games.csv` rows with `result` other than `Single winner` are `4P-0046` (Draw), `4P-0067` (Shared winner), and `4P-0106` (Winner missing). All have full seat records. Keep the original result/winner-description field; `winner_seat` is null; do **not** infer individual win flags for the shared-winner row, because the participant CSV marks zero winners there. Preserve them as historic *exceptional* games, excluded from win-based denominators. New manual games are stricter: exactly one winning seat.

**Guest winners:** A single-winner game may have winning seat `is_member=0`; its member participants each have an eligible appearance but no win. No winner member ID is required. A required non-null `winner_player_id` column would be incorrect.

## 3. Eligibility rules — approved

Define these in one reusable stats/query module. Do not copy/paste variant logic between charts.

```
memberCount = count(occupied seats whose player_id maps to an approved member)
participationEligible = memberCount >= 2
winStatsEligible = participationEligible && result_type === 'single_winner' && winner_seat exists
fourPlayerOfficial = winStatsEligible && pod_size === 4
```

- **Historical listing (Games):** all **141**, even 27 under threshold and 3 exceptional results.
- **Participation-only eligible analytics:** **114**, provided labels clearly state this includes 3 exceptional results and does not imply complete win data.
- **Wins/win rates/losses/expected wins/Elo:** **111**, excluding all 27 under threshold and all 3 exceptional outcomes.
- **All-time Dashboard:** **97** four-player single-winner eligible games, for *all* cards, streaks, leaderboards, cumulative charts, and latest-three panels. Do not mix a 123-game activity numerator with a 97-game win denominator.
- **Player and member deck rankings:** only six members and their 61 member-owned decks. Guest commanders are stored and can appear in game history and clearly labeled opponent/color analyses when participation-eligible; guest names are not separate ranked players/decks.
- **Pod dataset toggle:** 3, 4, 5+; exact 5/6 sizes retained and used for expected-win calculation. No cross-pod mixing in rank/score computations.
- **Date filters:** compare against `played_on` in the site's intended timezone, **not** the import execution date. Provide honest empty states in recent windows with no matches.

## 4. Security/privacy contract

- Historical CSVs contain **original guest names** as private audit data. Never put them in `/public`, serve them as downloadable routes, import them into a table with unrestricted anonymous `SELECT`, print them in public console/UI, or commit them to a public Git repository.
- Prefer separate private provenance tables or explicit column-restricted public projections. Audit Supabase grants and RLS (including any `security definer` views/functions). Never expose a service-role key to the browser or `NEXT_PUBLIC_` variables.
- Authorization based on verified authenticated account -> approved member mapping. An account saying display name “Will” has no admin rights unless explicitly mapped by the admin bootstrap process. Only admin edits/deletes history; approved members can add valid new games.
- Keep local source CSVs `.gitignore`d. `scripts/verify_historical_data.py` reads them locally; the real import script must be explicitly invoked, idempotent, and safe to rerun.

## 5. Import order and invariants

1. Parse CSV headers and normalize string/BOM formats; do not auto-correct submitted canonical names.
2. Dry-run and verify counts and foreign-key resolution **before** remote writes. Show a sample from beginning/middle/end, special outcomes, guest wins, and carried dates.
3. Schema migration with unique indexes for `source_game_key`, member+commander deck, game+seat, and date+stable daily number. Protect raw audit tables.
4. Insert/upsert 6 players -> 126 commanders -> 61 member decks -> 141 games -> 565 seats -> protected aliases/provenance, in transactions or safe resumable batches. **Do not delete or overwrite newer manually entered results.**
5. Requery full database; ensure all 141 unique source keys exist once, all seats match games, no orphan refs, and expected eligibility counts agree. Re-run importer to prove no duplicate games/seats.
6. Report dry-run and actual import numbers, mismatches, and all skipped/conflicting rows; stop on any discrepancy until corrected. Never silently mark success after partial import.

## 6. Reference files

`MTG_Final_Clean_Game_Results.xlsx` is useful for a person to view a tidy game log; `mtg_historical_clean.sqlite3` is a staging reference for debugging. Both are **optional** and should remain outside the web application's public/build tree. The **normalized CSVs** are the canonical machine-readable import source. `game_log_readable.csv` is for acceptance comparison, not the primary relational schema.
