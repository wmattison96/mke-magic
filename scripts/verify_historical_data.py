#!/usr/bin/env python3
"""Offline integrity verifier for the approved private MTG CSV snapshot.
Standard library only. Run from any working directory:
    python3 scripts/verify_historical_data.py
This is a READ-ONLY check. It never connects to a database.
"""
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'data' / 'historical'
EXPECTED = {
    'historical_games': 141,
    'seats_logged': 565,
    'member_players': 6,
    'guest_seat_appearances': 131,
    'games_with_2plus_members': 114,
    'games_with_2plus_members_and_single_winner': 111,
    'official_four_player_single_winner_games': 97,
    'excluded_less_than_two_members': 27,
    'games_draw_or_shared_or_missing_winner': 3,
    'date_carried_forward': 56,
    'unique_canonical_commanders': 126,
    'unique_member_decks': 61,
    'distinct_original_alias_pairs': 204,
}

def load(name):
    with (BASE / name).open(encoding='utf-8-sig', newline='') as fp:
        return list(csv.DictReader(fp))

def require(condition, message):
    if not condition:
        raise AssertionError(message)

def main():
    games = load('games.csv')
    seats = load('game_participants.csv')
    players = load('players.csv')
    decks = load('member_decks.csv')
    commanders = load('commander_registry.csv')
    aliases = load('commander_aliases.csv')
    readable = load('game_log_readable.csv')
    keys = {r['game_id']: r for r in games}
    require(len(keys) == len(games), 'Duplicate historical game IDs')
    require(len({r['source_game_key'] for r in games}) == len(games), 'Duplicate source keys')
    player_ids = {r['player_id'] for r in players}
    deck_ids = {r['deck_id']: r for r in decks}
    commander_ids = {r['commander_id'] for r in commanders}
    grouped = defaultdict(list)
    for seat in seats:
        require(seat['game_id'] in keys, f'Orphan game seat: {seat["game_id"]}')
        require(seat['commander_id'] in commander_ids, f'Unknown commander in {seat["game_id"]}')
        is_member = seat['is_member'] == '1'
        if is_member:
            require(seat['player_id'] in player_ids, f'Unknown member in {seat["game_id"]}')
            require(seat['deck_id'] in deck_ids, f'Unknown member deck in {seat["game_id"]}')
            require(deck_ids[seat['deck_id']]['player_id'] == seat['player_id'], f'Deck owner mismatch in {seat["game_id"]}')
            require(deck_ids[seat['deck_id']]['commander_id'] == seat['commander_id'], f'Deck commander mismatch in {seat["game_id"]}')
        else:
            require(not seat['player_id'] and not seat['deck_id'], f'Guest member/deck ID in {seat["game_id"]}')
            require(seat['display_player'] == 'Guest', f'Guest public name not sanitized in {seat["game_id"]}')
        grouped[seat['game_id']].append(seat)
    for game_id, game in keys.items():
        rows = grouped[game_id]
        pod_size = int(game['pod_size'])
        require(len(rows) == pod_size, f'Seat count mismatch: {game_id}')
        require(sorted(int(s['seat']) for s in rows) == list(range(1, pod_size + 1)), f'Invalid seat order: {game_id}')
        member_count = sum(s['is_member'] == '1' for s in rows)
        require(member_count == int(game['member_count']), f'Member count mismatch: {game_id}')
        eligible = member_count >= 2
        single = game['result'] == 'Single winner'
        winner_rows = [s for s in rows if s['is_winner'] == '1']
        require(len(winner_rows) == (1 if single else 0), f'Wrong winner flags: {game_id}')
        if single:
            require(int(game['winner_seat']) == int(winner_rows[0]['seat']), f'Wrong winning seat: {game_id}')
        else:
            require(not game['winner_seat'], f'Exception must have no winning seat: {game_id}')
        for field, expected in [('analytics_eligible', eligible), ('win_stats_eligible', eligible and single), ('official_4p_win_stats_eligible', eligible and single and pod_size == 4)]:
            require((game[field] == '1') == expected, f'Eligibility mismatch ({field}): {game_id}')
    actual = {
        'historical_games': len(games),
        'seats_logged': len(seats),
        'member_players': len(players),
        'guest_seat_appearances': sum(s['is_member'] == '0' for s in seats),
        'games_with_2plus_members': sum(g['analytics_eligible'] == '1' for g in games),
        'games_with_2plus_members_and_single_winner': sum(g['win_stats_eligible'] == '1' for g in games),
        'official_four_player_single_winner_games': sum(g['official_4p_win_stats_eligible'] == '1' for g in games),
        'excluded_less_than_two_members': sum(g['analytics_eligible'] == '0' for g in games),
        'games_draw_or_shared_or_missing_winner': sum(g['result'] != 'Single winner' for g in games),
        'date_carried_forward': sum(g['date_origin'] == 'Carried forward' for g in games),
        'unique_canonical_commanders': len(commanders),
        'unique_member_decks': len(decks),
        'distinct_original_alias_pairs': len(aliases),
    }
    require(len(readable) == len(games), 'Readable game log mismatch')
    require(set(actual) == set(EXPECTED), 'Invalid verifier field set')
    for metric, expected in EXPECTED.items():
        require(actual[metric] == expected, f'{metric}: got {actual[metric]}, expected {expected}')
    require({r['player_id'] for r in players} == {'nelson','will','manfred','josh','sam','keenan'}, 'Wrong member roster')
    require(Counter(int(g['pod_size']) for g in games) == Counter({3:9,4:123,5:8,6:1}), 'Pod-size totals mismatch')
    require({g['game_id'] for g in games if g['result'] != 'Single winner'} == {'4P-0046','4P-0067','4P-0106'}, 'Unexpected exceptional game IDs')
    saved = json.loads((BASE / 'validation_summary.json').read_text())
    for field, value in EXPECTED.items():
        require(saved[field] == value, f'Snapshot metadata disagrees for {field}')
    print('PASS: approved MTG historical snapshot integrity checks')
    for metric, count in actual.items():
        print(f'  {metric}: {count}')
    print('  pods: 3P=9, 4P=123, 5P=8, 6P=1')
    print('  NOTE: raw original guest names are private provenance, not public display data')

if __name__ == '__main__':
    main()
