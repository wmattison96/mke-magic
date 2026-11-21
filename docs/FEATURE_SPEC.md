# MTG Playgroup Website — Functional Specification

**Version:** 1.1 — real-data implementation baseline (November 20, 2026)  
**Based on:** Completed feature worksheet, reviewed member/guest commander corrections, and finalized 141-game historical export  
**Status:** Owner page requirements remain authoritative; newly approved historical-data rules are authoritative; assistant-suggested Analytics and Elo methods remain provisional where labeled **PROPOSAL**.  
**Implementation scope:** Dashboard, Players, Decks, Games, Tracking, Analytics, authentication, and **early import of the finalized historical dataset**. **Play** remains a visible but nonfunctional future tab.

> **Source-of-truth rule:** Preserve the existing polished Next.js application and its visual system. Replace its fictional data with genuinely calculated statistics from stored game records. Do not create a new project, invent historical results, or present mock data as real. `docs/DATA_CONTRACT.md` controls historical import interpretation where it differs from earlier placeholder assumptions.

> **Data source approved:** `data/historical/*.csv` contains the corrected 141-game snapshot. The Excel workbook and staging SQLite are **reference/audit artifacts**, not alternate production sources. Import by source key and verify counts. Historical CSVs contain private original guest names; **keep them out of `public/`, public APIs, and Git**.

## 1. Overall rules and definitions

### 1.1 Game scope and pod-size datasets — OWNER REQUIREMENTS

- Format: **Commander**; default starting life 40 (relevant when Play is built later).
- Four-player games are the **only** source of Dashboard statistics and charts, regardless of any other page filter.
- Players, Decks, Games, and Analytics should offer a **3-player / 4-player / 5+-player** dataset toggle where performance statistics are shown. Each dataset is evaluated separately; do not silently combine results from these groups. Default to **4-player**.
- A 5+ dataset may contain games with different actual player counts. Preserve each game's exact pod size. For expected-win and efficiency analyses, use each game's own expected probability, `1 / actual_pod_size`, rather than a blanket 20%.
- Dashboard time options: **All time / Last 365 days / Last 30 days**. Interpret as rolling windows ending today in the site's configured local timezone. **PROPOSAL:** make the same date filter available in Analytics; use sensible defaults elsewhere.
- The source worksheet says draws, shared wins, and incomplete/no-contest games are **omitted** from official win statistics. **Preserve all historical rows**, including the 3 exceptional results, visibly labeled as draw, shared-winner, or winner-missing. New manual games must have exactly one winner and a complete seat roster. Future Play drafts do not count. Do not invent partial-win rules.
- All statistics refer to the **recorded sample**, which may not cover every playgroup game; show that qualifier in appropriate footers or tooltips. Imported records should retain provenance.
- Use strict, stable identifiers for players and decks; display names are not identifiers.

### 1.2 Identity and ownership — OWNER REQUIREMENTS

- Approved **member players** are Nelson, Will, Manfred, Josh, Sam, and Keenan. **Ken is a guest, not Keenan**. All other historical names are guest appearances. Guest seats display simply **Guest** in public game history; raw source names are retained in protected import provenance, never exposed on public pages.
- A **member-owned deck is a distinct member pilot + commander (or commander pair) combination**. Will playing a commander and Manfred playing the same commander are separate decks. A renamed or rebuilt list retains its deck record as long as its pilot and commander identity remain the same. **Guest seats preserve commander identities but do not create fake member-owned deck profiles.**
- Different pilots cannot share the same deck record. A deck's display name is editable without changing its identity.
- The optional Moxfield link is a **URL only** for this release. Do not require Moxfield login, unofficial scraping, decklist sync, price, or card inventory.
- Commander names, color identity, and card images should be resolved via a legitimate card-data provider (**PROPOSAL: Scryfall public API**, with request caching/throttling). Store canonical card IDs/names and resolved color identity for reproducible reporting; allow manual fallback if the service is down.
- Partner/background-style multiple commanders need an ordered-for-display but normalized-for-identity set of commander IDs; derive the deck's identity as the union of the commanders' color identities (**PROPOSAL**).

### 1.3 Permission model — OWNER REQUIREMENTS, with explicit conflict resolution

- Anyone can browse read-only statistics and histories without an account.
- Only authenticated **approved playgroup members** can submit new completed games from Tracking. A member may enter one or more **Guest** seats (with commanders) without creating guest accounts.
- A member can edit their own player profile and their own decks/Moxfield links (**PROPOSAL**).
- **Only the owner/admin (Will) can edit or delete already completed games.** This more specific Games requirement takes precedence over the worksheet's earlier general sentence about logged-in players editing/deleting games.
- Editing rights must be checked on the server and in database policies, not just by hiding controls. Identify the owner by a secure account/role mapping; never by the display name 'Will'.
- **PROPOSAL:** Invite-only membership (or admin-approved account linkage) avoids someone creating an account and claiming another player's profile. Do not enable open public signup with game-writing permission.

### 1.4 Historical records and eligibility — APPROVED OWNER RULES

- **Store every original game**: 141 games and 565 seated participant records. Nine 3-player, 123 four-player, eight 5-player, one 6-player.
- **Stats eligibility gate**: games with **at least two member seats** are eligible for participation/appearance analytics (**114 games**). Games with fewer than two members (**27**) remain visible in Games, but do not contribute to Dashboard, deck summaries, or Analytics. For consistent player profile rates, apply this same gate.
- **Outcome gate**: only eligible games with a **single known winner** count toward wins, losses, win rate, Elo, and comparable rankings (**111 games**). Three exceptional outcomes remain visible but do not enter win-based denominators. Official four-player win-based Dashboard sample: **97 games**. Activity plots that intentionally count all 114 analytics-eligible games must label the different denominator; for the Dashboard use the same 97 single-winner four-player sample throughout.
- Guest commanders and winning guest seats are real. If a guest wins an otherwise eligible pod, every participating member records a game and zero wins. Store **winner seat**, not solely a member player ID. Ranking pages list members and member-owned decks, not individual guest identities; guest commander appearances can be used in explicitly labeled opponent/context calculations on eligible games.
- **56** dates were filled by carrying forward the previous explicit date within the original worksheet. Preserve `date_origin='Carried forward'`. Historical dates are approved for import despite uncertainty.
- The snapshot includes **61 member-owned decks**, **126 canonical commander identities**, **131 guest seat appearances**, **69 answered commander review groups**, and 3 special result types. Never use name heuristics to merge identities beyond the provided reviewed alias map.
- Import must be **idempotent** using `source_game_key`. Do not discard, auto-correct, or silently re-date the approved records. Source data reflect Nelson's recorded sample, not complete and unbiased playgroup history.

### 1.5 Shared statistical definitions

| Metric | Definition |
|---|---|
| Games played (player) | Number of completed eligible games including the player; one participation per game. |
| Wins (player) | Number of those games won by the player. |
| Win rate | `wins / games`, counting only eligible games with a single known winner; display %, `N/A` when denominator is 0. |
| Games played (deck) | Number of eligible appearances of that pilot + commander deck. |
| Wins (deck) | Number of those appearances ending in the pilot's victory. |
| Baseline expected wins | Sum of `1 / pod_size` over the entity's eligible appearances. For 4-player-only, expected win rate = 25%. |
| Wins above expectation | `actual_wins - expected_wins`; descriptive, not a statistically proven power rating. |
| Unique decks | Count of distinct deck IDs with at least one eligible appearance, not all registered unused decks. |
| Color share by decks | Each distinct deck adds 1 to **each** color in its commander color identity. Divide each color's count by total color appearances across all eligible decks; percentages sum to 100%. A two-color deck contributes 1 occurrence to each color. |
| Color share by games | Each appearance of a deck adds 1 to each of its colors; normalize color occurrences across eligible appearances. |
| Shared games vs opponent | Games where both players appeared, even when a third player won. A's win rate vs B is `A_wins_in_shared_games / shared_games`; B's rate does not have to equal `1 - A's`. |
| Win/loss streak | Consecutive appearances **by that player or deck**, ignoring other games they did not participate in. |
| Chronology | Use game date, then a deterministic within-day game sequence / stable ID; changing historical games must trigger recomputation of historical trends and Elo. |

**PROPOSAL:** Show counts and sample-size warnings next to rates. Do not rank a zero-game deck; follow each page's explicitly requested minimum eligible appearances. The word “eligible” refers to the **two-member and single-winner gates** for win-based measures; any non-win activity metric must explicitly identify its broader denominator.

## 2. Dashboard — OWNER REQUIREMENTS

**Scope:** Four-player, two-or-more-member, **single-winner** games **only** (97 historical games before new entries), with All time / Last 365 days / Last 30 days toggle. Clicking any player or deck navigates to its detail page. Exclude guest-only or guest-majority groups with fewer than two members; guest seats can still win eligible games.

1. **Exactly three top cards:** Active players (distinct players in eligible recorded games), Total Games Played, Total Unique Decks Played (distinct pilot + commander combinations).
2. **Player win-rate bar chart:** All active players, percentages, an explicit **25% expected-win reference line**, and games/wins in tooltip or adjoining values.
3. **Player Elo ranking:** All active players in descending current rating, displaying rank and games counted. Calculation specified in section 9; pending owner approval.
4. **Player leaderboard:** All active players, total games, total wins, win percentage. Allow sorting (**PROPOSAL**).
5. **Top five decks by win rate:** At least **5** eligible recorded games per deck; show player/commander, sample size, percentage, and direct deck link.
6. **Top five decks by Elo:** Rating and owner + commander; **PROPOSAL:** also require 5 games to avoid noisy rankings.
7. **Deck diversity donut chart:** Percentage of all eligible **unique decks** owned by each player, rather than share of games. Example: a player owning 54% of all unique decks occupies 54% of this chart.
8. **Recent games:** Show last **three** completed four-player games and winner, linking to Games details.
9. **Cumulative games over time:** Date on x-axis; running total of eligible recorded games on y-axis.
10. **Cumulative unique decks played over time:** Date on x-axis; running count of distinct pilot + commander deck IDs seen in eligible games.
11. **Current hot/cold players:** Best and worst performers in the most recent **five group-wide eligible games**. **PROPOSAL:** show each qualifying player's `wins / appearances` in those five games, require at least **two appearances**, and state the window and denominator. If no one qualifies, show a neutral insufficient-data state.

**PROPOSAL on date toggle:** Charts and ranks recompute for the selected date window; the label 'current Elo' uses chronological games up to the window's end, so a 30-day rating does not reset to 1000 on day one. If the toggle is selected, display both 'period games' and 'rating as of period end' where relevant.

## 3. Players — OWNER REQUIREMENTS

### 3.1 Player directory

- Rectangle-style player cards, circle avatar at left, compact stats at right: player name, win rate, Elo, and most-played deck; clicking opens `/players/[id]`.
- Default avatar is the commander image from the player's most-played eligible deck; signed-in player can later choose an image.
- Show all registered players; never fabricate a record for someone with no games (show `N/A`).

### 3.2 Individual player page

- Header with avatar, first name, games played, distinct decks played, wins, win percentage, Elo, most-played deck, and optional Moxfield-related links if known.
- Two **color distribution** breakdowns: by distinct decks and by actual games played. Count each W/U/B/R/G color appearance independently, then normalize as defined above; include colorless category if present (**PROPOSAL**).
- **Seat-order plots:** percentage of the player's appearances in seats 1–4; and their win rate from each seat 1–4. For 3-/5+-player views, adapt the seat list to the actual selected pod sizes rather than truncating at four (**PROPOSAL**).
- **Deck summary table:** Each deck's games, wins, win %, sortable by play count or win rate. When sorting/ranking by win %, a **minimum of 4 games** is required. Link every row to its deck profile.
- **Time-series charts:** win rate over time and Elo over time, both using chronological appearances; visibly distinguish a cumulative rate from a rolling trend (**PROPOSAL**).
- **Opponents:** which opponents they have shared the most games with, count of shared games and their own win rate in those shared games.
- **Opponent deck results:** 3 most commonly faced distinct pilot+commander decks; 3 most wins against; 3 most losses against. Show totals and win rates, with links.
- **Career extrema:** longest consecutive win streak, longest consecutive losing streak, peak and minimum Elo.
- Player's rank on this page uses **raw win rate**, not the adjusted rating.

**PROPOSAL:** Define “peak/minimum Elo” after the player's first eligible appearance, not the initial baseline rating; provide `N/A` for zero-game players.

## 4. Decks — OWNER REQUIREMENTS

### 4.1 Deck directory

- Search bar supports commander name and player name; search by names/aliases, and select matches from real stored decks.
- **Best 10 decks** sorted by selected **win % or Elo**, and **worst 5** similarly; only decks with **at least 5 eligible games** qualify. Show pilot name, commander, games, wins, rate, Elo.
- Clicking a row opens `/decks/[id]`.

### 4.2 Individual deck page

- Display commander **whole-card image if available**, pilot, optional Moxfield URL. If absent show “Not available”; logged-in owner can add/edit the URL.
- Main stats: games, wins, win rate, deck Elo.
- **Relative performance quadrant:** Scatter plot across all eligible distinct pilot+commander decks, x = games played, y = win rate; selected deck highlighted in another color, crosshairs, labels/tooltips. Details in Analytics.
- **History:** cumulative appearances and cumulative wins vs date (two lines).
- **Most commonly faced** pilot+commander decks with meeting count, own wins and own win rate, and the opponent deck's Elo (clearly labeled; different from head-to-head Elo).
- **Three most beaten opponent decks** and **three most lost-to decks** with record and links. If no wins/losses, show “None”.

## 5. Games — OWNER REQUIREMENTS

- Simple completed-game history, newest first. At top: cumulative total-games-by-date chart and a **most recent winner** highlight.
- Each game entry shows local date, stable **game number within the same date** (“June 21, 2025 — Game 1”), optional location, and the source tag: `spreadsheet`, `manual`, or eventually `play`. Imported same-day numbers are deterministically allocated from date + source ordering; they do **not** claim exact real-world order across distinct historical worksheets.
- Expanding/clicking an entry reveals players in **seat order**, each player's commander/deck, winner, and optional game notes. The requested essential details are player, seat order, commander, winner.
- Search/filter by date, player, commander/deck, and winner (**PROPOSAL:** based on original candidate feature label; implement simple filters, not an elaborate query builder).
- **New manually completed game**: valid seated participants (members and optionally guest seats), commander/deck assignment, unique contiguous seats, and one recorded winning **seat**. **Imported historic exception**: retain the special result and original winner-description text, but flag it noncompetitive for win-rate calculations.
- Only owner/admin may edit/correct/delete completed results, including imported games. Audit corrections (**PROPOSAL**).
- Game numbering is stable after creation; inserting a backdated game receives the next available number for that date, with a unique constraint. No obligation to renumber prior games.

## 6. Tracking — OWNER REQUIREMENTS

- The simplest possible quick-entry form, available to authenticated group members.
- Default game date to today's date (editable). Optional location and free-text notes.
- Choose registered member players **or Guest for each seat**; choose a member-owned deck for members and a canonical commander for a Guest; set **seat order** and **exactly one winning seat** (which may be a Guest). Do not require guest accounts or a permanent guest-owned deck.
- Deck dropdown filters to the selected pilot's registered decks; a typed new commander must be resolved against a canonical MTG card search rather than creating duplicate/misspelled names. Support a plain-text/manual fallback only with explicit confirmation if card lookup is temporarily unavailable (**PROPOSAL**).
- Register a new pilot+commander deck automatically if needed, using a unique normalized identity, and reuse it on later games.
- Validation: no repeated **member player** within a game (multiple separate Guest seats are valid), unique contiguous seats 1..N, all member decks owned by their pilots, one recognized winning seat, no incomplete save. Reject invalid submissions and retain form state when showing an error.
- Member can submit once; confirmation from every player is **not** required. Show a review screen/summary before save (**PROPOSAL**).
- Prevent accidental double-submit; use transactional write and idempotency token (**PROPOSAL**).
- Historical spreadsheet import is **one-time developer/admin setup**, **not** a recurring user-facing import feature. Record its source on saved games; supply a separate mapping/reconciliation process once the actual spreadsheet is available.
- **Play** must eventually write using this **same completed-game model**, but do not build its life-tracker now.

## 7. Advanced Analytics — ASSISTANT PROPOSAL FOR REVIEW

**Default filters:** Four-player, all-time; independent toggle: 3 / 4 / 5+ players. Optional time filter All time / Last 365 days / Last 30 days; player and deck drill-down. All win-based visuals exclude games with fewer than two member seats and exceptional outcomes. State exact eligible game count and sample sizes. Any chart point can lead to the corresponding profile. Do not create player-ranking rows or permanent deck records for anonymous Guest seats.

### A1. Player participation × win-rate quadrant — MUST (proposed)

- Scatter: x = **eligible games played** by player, y = **raw win percentage**. Each dot is a player; hover shows name, wins, games, %, Elo.
- Vertical split at median game count among displayed eligible players; horizontal split at baseline expected win rate (25% for 4-player). Label quadrants e.g. *Established winners*, *High-volume below baseline*, *Promising small sample*, *Small sample / below baseline*.
- Display players with fewer than **5** appearances as faded points, not hidden. A line at baseline and visible sample-size annotation prevent overinterpretation.

### A2. Deck participation × win-rate quadrant — MUST (proposed)

- Scatter: x = deck appearances, y = deck raw win %. Unique dot = **pilot + commander(s)**, even when commanders match. Hover = pilot, commander(s), games, wins, win %, Elo.
- Median games split and pod-specific expected win reference; five-game eligibility for ranked highlights, visually flag lower samples. Support highlighting the selected deck from its profile.

### A3. Color identity / strategy profile — MUST (proposed)

- Distribution of W/U/B/R/G (and colorless if needed) as **color occurrence shares**, separately for unique decks and games played, across all players and per selected player. Multicolor decks count once toward each constituent color; do not call these shares a fraction of all decks unless explicitly relabeled.
- Win percentage and number of games **involving each color**, and average Elo by decks containing that color. These color categories overlap; clearly say a two-color deck contributes to two categories.
- Show most-used commander color combinations as a breakdown (e.g. GU, RG, mono-red), and a filtered list of decks. Avoid misleading causal conclusions.

### A4. Seat advantage and seat-adjusted comparison — MUST (proposed)

- Overall seat distribution, wins, and win rate by seat **1–4 for four-player games**, with horizontal 25% baseline. Drill down by player/deck; include seat-specific `wins / appearances` and N.
- Option to compare a player's observed wins with seat-conditional expected wins estimated from the full **eligible group** (not from that player's own outcomes) (**Later; proposal**). This is descriptive and unstable for tiny samples.
- Seat is recorded on the game record; never infer turn order for old games without this information.

### A5. Player versus player matrix — MUST (proposed)

- Table/heat map; cell (row A, column B) = **A's wins in games containing both A and B / number of their shared games**. Show `wins / shared games`, raw %, and sample size. Diagonal blank.
- Third-party wins are possible; opposing matrix cells are **not complements**. Click to filter shared game history.

### A6. Deck versus deck matrix and notable matchups — MUST (proposed)

- Compare distinct pilot+commander deck IDs that actually appeared in the same game. Cell (A,B) shows A wins / shared appearances and sample size. Do not imply this is one-on-one combat or a causal counterpick.
- Limit initial matrix to top **10 most-played eligible decks**, with search / selected deck override, for readability. Show strongest and weakest recorded matchups with **at least 5 shared games**; otherwise mark as preliminary.

### A7. Power outliers / performance against expectation — MUST (proposed)

- For player and deck: expected wins = sum `1/pod_size` across eligible appearances; actual - expected wins; raw observed and expected win %; rank/plot outliers by win surplus.
- Include a 95% Wilson interval around win percentage for a fixed pod size and a sample-size marker (**PROPOSAL**). In 5+ mixed-size games, Wilson around raw rate can be shown for descriptive context only; compare actual-vs-expected with per-game baselines.
- Label as *recorded performance outliers*, not an objective measure of deck power or player skill. Do not rank highly from a single win.

### A8. Chronological trends, Elo, and hot/cold windows — MUST (proposed)

- Cumulative win % plus rolling **last 10 appearances** for a selected player/deck; use fewer than 10 appearances only with a visible N label.
- Elo trajectories by date and usage over time; game/unique-deck introduction trends; compare two selected players or decks if practical.
- Highlight periods of change without claiming statistical significance from tiny samples.

### A9. Rankings and advanced filtering — MUST (proposed)

- Sortable total wins, win %, games, Elo, wins above expectation; separate player and deck views. Enforce deck minimum **5** for rankings and **4** in player-profile deck summary when sorting by rate. For other exploration, include low-N entries with clear warnings.
- Filter by dataset (3, 4, 5+), time, player, deck, specific commander/color identity. All filters must affect numerators and denominators consistently.
- For comparisons involving zero games, display `N/A` rather than zero win rate.

**Recommended presentation:** Make deck and player quadrant plots and seat-order bar charts the visual anchors; place interactive matchup matrices and color analysis below. Prioritize a readable mobile experience (tables scroll horizontally or collapse into cards).

**Defer until requested:** Seat-conditional expectation models; bracket/tournament analytics; arbitrary power-level scoring; causal deck match-up claims; detailed decklist/card analysis.

## 8. Play — DEFERRED, with future compatibility

- Navigation contains a **Play** tab now, marked “Coming later” or equivalent; do not implement an in-game life tracker in this milestone.
- Future planned flow: create lobby → select players/decks/seat order → track life and optional commander damage/poison → declare winner → confirm → finalize into completed Game + participants.
- Design schema so `source='play'` can be supported without a migration of historical game rows; never count active/abandoned games in official statistics.
- Do **not** build live synchronization, counters, multi-device state, or playback logs yet. Existing worksheet's Play/hand-off unanswered fields remain unapproved.

## 9. Elo rating proposal — EXPLICITLY SUBJECT TO OWNER APPROVAL

**Why a proposal:** The owner requested Elo that slightly favors winning from a later seat, but did not prescribe a mathematical system. The following transparent multiplayer rule avoids inventing results between players who tied for second/third/fourth.

- Maintain **separate player Elo and deck Elo**, each starting at `1000` within a pod-size dataset. Do not carry 3-player ratings into 4-player or 5+ games. For eligible games with Guest seats, a **PROPOSED** calculation treats each guest seat as a temporary neutral 1000-rated opponent for that game: compute all seat deltas, but persist ratings only for member players/member-owned decks. The zero-sum statement applies to **all seats including temporary guests**, not to member ratings alone. Guest seats do not get public ratings or permanent deck Elo.
- Recalculate in reproducible date/game-number/ID order. Use **K = 24**. Ratings are historical and derived, never manually edited.
- For each game with N participants, treat the winner as having a pairwise win against every other player; pairs of nonwinners receive a **0.5/0.5** tie for this Elo calculation (not a recorded match draw).
- For each participant i, expected pairwise result against j: `E(i,j)=1/(1+10^((Rj-Ri)/400))`. Actual pairwise result `S(i,j)` = 1 winner-over-loser, 0 loser-versus-winner, 0.5 loser-versus-loser.
- Initial rating change: `delta(i) = K / (N-1) * sum_over_j(S(i,j)-E(i,j))`. This is mathematically zero-sum across all participants.
- Slight **seat-specific victory bonus**: multiply the *winner's* computed positive delta by `factor = clamp(1 + 0.03 * (winner_seat - (N+1)/2), 0.90, 1.10)`. Redistribute the difference equally among the N-1 other participants to retain a zero-sum total. Seat 4 in a four-player game gets a slightly higher winning gain than seat 1; it does **not** normalize a player to their historical personal seat win rate.
- The player and deck rating systems run independently with the exact same algorithm, using their respective IDs. Display rounded integers but compute using full precision; historical Elo points are after each appearance.
- Count only eligible **single-winner** games with known valid seat order. The approved 141-game import has complete 3–6 seat rosters; preserve all rows even when outcome is exceptional. **No seat reconstruction is required** for the supplied snapshot. Guests do not receive member identities or persistent rating histories.
- Ties in rating display are handled deterministically; min/peak ratings exclude pre-first-game baseline. Add unit tests for zero-sum, seat bonus monotonicity, chronological corrections, 3 vs 4 vs 5+, and equal-rating scenarios.

**Proposed example:** For identical starting ratings and equal playing conditions, later-seat winners earn *slightly* more rating points; every game's summed player Elo delta is zero, and separately every game's summed deck Elo delta is zero.

## 10. Data model and engineering guidance — PROPOSAL

Recommended architecture: Keep the existing **Next.js 16 App Router / TypeScript / Tailwind** project and its polished interface. Use **Supabase Postgres + Auth** as the low-maintenance hosted backend, with careful row-level security (RLS), server-side authorization, and `@supabase/ssr` based on the current official Next.js guide. Verify installed versions and framework APIs instead of blindly copying older snippets. No secrets should be checked into git. Local Stage 1 dry-run must work **without** Supabase credentials.

| Table / concept | Important fields / constraints |
|---|---|
| `players` | Stable internal ID, unique member key (`nelson`, `will`, etc.), public display label, optional avatar/Moxfield profile, optional safely linked auth account. **Six member rows initially**, not a fabricated Guest player. |
| `commanders` | Stable ID and canonical name, optional card-service ID and validated color identity/image, optional partner pair constituents. Import **126** canonical labels unchanged. |
| `decks` | Stable ID, **member** owner ID, commander identity, optional display name / Moxfield deck URL; unique(member owner, normalized commander identity). Import **61** historical member decks. |
| `games` | Stable internal ID, `source_game_key` unique for imported records, date, deterministic immutable game number on date, pod size, result type (`single_winner`, `draw`, `shared_winner`, `winner_missing`), **winning seat nullable**, optional original exceptional-winner text, optional location/notes, source, date provenance, created_by audit metadata. |
| `game_participants` | Game ID, seat integer unique within game, member player ID **nullable for guests**, public display type (`member`/`guest`), commander ID always required, member deck ID required for members / **null for guest**, optional original guest name in **private provenance only**, original commander label in private audit, winning-seat indicator if single winner. |
| `memberships` / role mapping | Supabase auth user ID mapped securely to approved member player ID, admin vs member role, approval state; no public sign-up role escalation. |
| `game_audit` | Who changed a completed game, timestamp, old/new state. No untracked historical corrections. |
| `import_batches` / private provenance | Source batch, original alias and guest names, date-origin, source sheet-row, source IDs, fingerprints, idempotent imports. Never expose raw guest names to anonymous readers. |

**Consistency rules:** A **new manual** game has 3–6 seats (configurable), unique member participants, zero or more distinct guest seats, contiguous seat order, **exactly one winning seat**, a deck for each member and a commander for each guest. Historical games may have draw/shared/missing winner and still remain in Games. The save operation, daily sequence assignment, and participation writes should be atomic. Make a reusable validation module for manual entry and future Play finalization. Editing historical games must recompute derived analytics.

**Historical data:** The finalized dataset **is supplied** under `data/historical/`, with explicit mapping in `docs/DATA_CONTRACT.md`. **Read CSVs, not a speculative spreadsheet parser.** Build an offline dry-run and reconciliation, followed by a safe idempotent Supabase/Postgres importer. Keep `source=spreadsheet` and unique source keys. Use the approved alias table: do not redo or second-guess the owner's commander corrections. Keep the original Excel/SQLite as optional references outside production.

**Card metadata:** Use Scryfall (or verified equivalent) only for name autocomplete, color identity, and images. Cache lookups. Respect provider rate limits and image attribution/terms. Never depend on a private Moxfield API. A deck's optional URL is a normal link with URL validation.

**Statistics architecture:** Centralize all calculation logic in tested, deterministic TypeScript utilities or database functions; do not independently recompute win % or Elo in each page component. Provide a `games + participants` read layer with consistent filters; filter before grouping. Avoid storing manually-maintained win totals / ratings that can become stale.

**UI:** Preserve the existing modern clean-analytics visual language and components. Responsive desktop/tablet/mobile; accessible chart labels, empty states, loading and error states, deep links from cards/tables/charts. Keep user-provided page counts and dashboard limits exact.

## 11. Revised delivery plan and acceptance criteria — IMPORT MOVED EARLY

**Stop after each Codex prompt, review output, and only then continue.** Exact instructions are in `CODEX_PROMPTS.md`.

### Milestone 1 — Existing repo audit, Postgres schema, historical import dry-run (NO credentials required)
- Inspect the existing project. Define secure guest-capable model, migrations, typed validators, and a **read-only local CSV import validator**. Keep the UI and routes intact.
- **Accept:** `python3 scripts/verify_historical_data.py` checks the supplied file totals; Codex's dry-run predicts 141 games, 565 seats, 6 members, 61 member decks, 126 commander identities, 56 carried dates and 3 special results. No hosted writes, no real public route serving raw files.

### Milestone 2 — Supabase setup, authorization foundation, import once
- Guided hosted configuration, auth and role mapping, RLS and public-safe reads, migration and real-data import. Import is idempotent and produces a reconciliation report; no extra fake records.
- **Accept:** All baseline counts match; rerunning import changes no counts; anonymous reads cannot see protected guest/source fields; only approved members are eligible to create, admin to correct.

### Milestone 3 — Games history and secure Tracking
- Show all 141 source games including special result tags, chronological seat-order display and winner seat, filters. Implement member-authenticated manual logging with optional Guest seats and admin-only corrections.
- **Accept:** New valid game can be entered and revisited, invalid/duplicate save rejected, guest winner works, direct unauthorized writes fail.

### Milestone 4 — Dashboard (real four-player stats only)
- Exactly 3 top cards and all owner-specified panels/charts, directly driven by eligible completed results; timeframe toggle.
- **Accept:** All-time historical Dashboard uses **97 eligible four-player single-winner games**, not all 123 four-player source records; no fake data.

### Milestone 5 — Players and Decks profiles
- Directories, profile pages, per-seat analysis, commander image fallback, member-owned deck results and Moxfield URLs.
- **Accept:** 6 members visible including Keenan with zero history; guest players not ranked; decks remain distinct by member+commander; all links/thresholds accurate.

### Milestone 6 — Proposed Advanced Analytics and provisional Elo
- Quadrants, matrices, color/seat analysis, chronological trends, Elo (provisional), low-N warnings and mobile-usable tables.
- **Accept:** Eligible counts/denominators, opponent-vs-shared-game interpretation, guest handling, and 3/4/5+ separation tested.

### Milestone 7 — QA, deployment readiness, and handoff
- Security audit, corrections and data reconciliation checks, responsive/mobile review, backups/export, production build, safe rollout guidance for Vercel + Supabase.
- **Accept:** A nonmember can browse only public data; an approved member can log a game; admin can correct; user can deploy without guessing; Play remains deferred.

### Deferred — Play life tracker
- Keep a placeholder in navigation. Live game tracking and automatic finalization to Games require a separately approved feature spec.

## 12. Decision register — not yet user-approved

| Decision | Suggested default | Owner review needed? |
|---|---|---|
| Multiplayer Elo formula and seat weighting | Section 9, K=24, seat factor 3% per step | **Yes**, approve before presenting rating as official. |
| Hot/cold player eligibility | Last five 4-player games; min two appearances | Yes. |
| Time window semantics | Rolling 365 and 30 days | Yes, unless this matches intended 'last year'. |
| Analytics colorless/partner commander handling | Include colorless; union commander colors | Yes if relevant. |
| Auth onboarding | Invite/admin-approved members, public read | Yes. |
| Backend provider | Supabase hosted Postgres + Auth | Yes, after reviewing current project and setup needs. |
| 5+ mixed-size expected wins | Per-game 1/N; aggregate 5+ without falsely implying single baseline | Yes. |
| Import of historical special outcomes | **Approved**: preserve all 3 special results, exclude from win-based stats | **No**; resolved in data review. |

**Implementation note to Codex:** Treat this document as functional scope, not authorization to silently resolve the remaining open decisions. The guest/date/commander/eligibility rules and historical import are **now approved and non-negotiable**. Preserve protected source information without publicly exposing guest names. Use clearly labeled provisional defaults for Elo and assistant-proposed Analytics. Stop at the requested milestone, summarize modified files, validation counts and tests; never claim features complete until verified.
