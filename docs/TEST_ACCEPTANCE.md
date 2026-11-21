# Acceptance and Regression Checklist

Codex should run automated tests wherever possible, then give the owner precise browser and account steps. Don't claim a hosted operation passed unless observed.

## Data QA (all after import; no assumed demo data)

- [ ] Parsed files: 141 games / 565 seats / 6 members / 126 commanders / 61 member decks / 131 guest seat appearances.
- [ ] Pod counts: 3P=9, 4P=123, 5P=8, 6P=1.
- [ ] 56 `Carried forward` date flags preserved; source game keys remain unique.
- [ ] Exactly 27 games under two-member threshold (still visible in Games).
- [ ] Exactly 114 games eligible for participation-only analysis.
- [ ] Exactly 111 single-winner games eligible for win-based stats; exactly 97 of those are four-player.
- [ ] `4P-0046` Draw, `4P-0067` Shared winner, `4P-0106` Winner missing all display and contribute zero win-based denominators.
- [ ] Ken appears as Guest, not Keenan; Keenan has a registered empty player profile until new games are logged.
- [ ] A guest winner in an eligible game credits all present members with games but no win, with winner label `Guest (Seat N)`.
- [ ] Re-import creates exactly zero additional games, seats, decks, players, or commanders.
- [ ] Local fixture and production query share one eligibility function; rates use N/A for no eligible games.

## Game UI / Tracking

- [ ] Public Games history lists all 141 source games and newest first, with source tag and special result status.
- [ ] Detail view shows seats in order, all commander names, winner seat, and notes. Original guest names are **never shown** in public DOM or API payloads.
- [ ] Valid member log supports 3, 4, or 5+ seats; 2+ member rule applies for analytics, not for whether an archival game can be stored.
- [ ] A new 4-player match with two members and two Guests saves the two different guest seats and can name a Guest as winner.
- [ ] Validation rejects duplicate member, duplicate/noncontiguous seat, missing commander/deck, nonparticipant winner, and double submit.
- [ ] Backdated game receives an immutable daily sequence without renumbering imported records; two concurrent saves cannot collide.
- [ ] Unauthorized anonymous write/edit/delete denied by server and database; non-admin member may create but cannot edit completed games.

## Dashboard and stats

- [ ] Dashboard has **exactly three** top cards (active players, games, unique decks); not four.
- [ ] Dashboard all-time uses **97** historic four-player win-eligible games before any newly logged games; no 123-game source total masquerading as official stats.
- [ ] Player bar chart includes 25% baseline and a tooltip showing N and wins.
- [ ] Leaderboard and hot/cold use only eligible sample; deck best 5 min **five** games; player profile deck rate sort min **four** games.
- [ ] Source qualifications displayed (Nelson's recorded history, not complete census); filters update both numerators and denominators.
- [ ] Guest-only or one-member games do not alter dashboard or deck leaderboard results.
- [ ] Player and member-owned deck quadrants have N labels, distinct IDs, 3/4/5+ filters, mobile usability.
- [ ] Elo is visibly **provisional** unless owner approves final method. Guest seats never appear in member rating leaderboards.

## Mobile / release

- [ ] Existing polished desktop look remains intact. Test 375px / 393px / 430px / 768px and desktop; navigation and tables usable.
- [ ] Public and authenticated flows covered by loading/error/empty states, keyboard and accessible labels where practical.
- [ ] Only `@supabase/ssr` (or newer officially supported equivalent) handles SSR cookies, not retired Auth Helpers. Recheck Next.js 16 API with current official docs.
- [ ] No secret credentials, guest source CSVs or raw guest names committed; `.gitignore` confirmed.
- [ ] `npm run lint`, available test script, `npx tsc --noEmit`, and `npm run build` pass (or exact blocker documented).
- [ ] Play nav item is visible as deferred; there is no partial fake life-tracking feature.
