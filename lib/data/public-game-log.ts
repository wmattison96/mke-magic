import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PUBLIC_GAME_LOG_TAG } from "@/lib/data/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import { getEligibility, type HistoricalResult } from "@/lib/historical/model";

type GameRow = {
  id: string;
  played_on: string;
  game_number_on_date: number;
  pod_size: number;
  member_count: number;
  result_type: HistoricalResult;
  winning_seat: number | null;
  source: "spreadsheet" | "manual" | "play";
  date_origin: "explicit" | "carried_forward" | "manual";
  location: string | null;
  public_notes: string | null;
  created_at: string;
};

type ParticipantRow = {
  game_id: string;
  seat: number;
  participant_type: "member" | "guest";
  public_player_name: string;
  player_id: string | null;
  deck_id: string | null;
  commander_id: string;
  commander_name: string;
  deck_name: string | null;
  is_winner: boolean;
};

export interface PublicGameLogEntry {
  id: string;
  playedOn: string;
  gameNumberOnDate: number;
  podSize: number;
  memberCount: number;
  result: HistoricalResult;
  winningSeat: number | null;
  source: GameRow["source"];
  dateOrigin: GameRow["date_origin"];
  location: string | null;
  publicNotes: string | null;
  analyticsEligible: boolean;
  winStatsEligible: boolean;
  officialFourPlayerWinStatsEligible: boolean;
  participants: Array<{
    seat: number;
    playerType: ParticipantRow["participant_type"];
    publicPlayerName: string;
    playerId: string | null;
    deckId: string | null;
    commanderId: string;
    commanderName: string;
    deckName: string | null;
    isWinner: boolean;
  }>;
}

/** Reads only the safe projections; raw CSV and private provenance are never used at runtime. */
export async function getPublicGameLog(limit = Number.POSITIVE_INFINITY): Promise<PublicGameLogEntry[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_GAME_LOG_TAG);

  const supabase = createPublicClient();
  const pageSize = 500;
  const requestedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : Number.POSITIVE_INFINITY;
  const games: GameRow[] = [];
  for (let offset = 0; offset < requestedLimit; offset += pageSize) {
    const take = Math.min(pageSize, requestedLimit - offset);
    const { data, error } = await supabase
      .from("readable_games")
      .select("id,played_on,game_number_on_date,pod_size,member_count,result_type,winning_seat,source,date_origin,location,public_notes,created_at")
      .order("played_on", { ascending: false })
      .order("game_number_on_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + take - 1);
    if (error) throw new Error("Unable to load the public game history.");
    const rows = (data ?? []) as GameRow[];
    games.push(...rows);
    if (rows.length < take) break;
  }
  if (games.length === 0) return [];

  const participantsByGame = new Map<string, ParticipantRow[]>();
  const gameIdBatchSize = 400;
  const participantPageSize = 1000;
  for (let gameOffset = 0; gameOffset < games.length; gameOffset += gameIdBatchSize) {
    const gameIds = games.slice(gameOffset, gameOffset + gameIdBatchSize).map((game) => game.id);
    for (let offset = 0; ; offset += participantPageSize) {
      const { data, error } = await supabase
        .from("readable_game_participants")
        .select("game_id,seat,participant_type,public_player_name,player_id,deck_id,commander_id,commander_name,deck_name,is_winner")
        .in("game_id", gameIds)
        .order("game_id", { ascending: true })
        .order("seat", { ascending: true })
        .range(offset, offset + participantPageSize - 1);
      if (error) throw new Error("Unable to load public game participants.");
      const rows = (data ?? []) as ParticipantRow[];
      for (const row of rows) {
        const group = participantsByGame.get(row.game_id) ?? [];
        group.push(row);
        participantsByGame.set(row.game_id, group);
      }
      if (rows.length < participantPageSize) break;
    }
  }

  return games.map((game) => {
    const participants = participantsByGame.get(game.id) ?? [];
    const eligibility = getEligibility(
      { podSize: game.pod_size, result: game.result_type, winnerSeat: game.winning_seat },
      participants.map((participant) => ({ playerId: participant.player_id })),
    );
    if (eligibility.memberCount !== game.member_count) {
      throw new Error(`Public game ${game.id} has a participant/member count mismatch.`);
    }
    if (participants.some((participant) => participant.participant_type === "guest" && participant.public_player_name !== "Guest")) {
      throw new Error(`Public game ${game.id} contains a non-sanitized guest label.`);
    }

    return {
      id: game.id,
      playedOn: game.played_on,
      gameNumberOnDate: game.game_number_on_date,
      podSize: game.pod_size,
      memberCount: eligibility.memberCount,
      result: game.result_type,
      winningSeat: game.winning_seat,
      source: game.source,
      dateOrigin: game.date_origin,
      location: game.location,
      publicNotes: game.public_notes,
      analyticsEligible: eligibility.participationEligible,
      winStatsEligible: eligibility.winStatsEligible,
      officialFourPlayerWinStatsEligible: eligibility.officialFourPlayerWinStatsEligible,
      participants: participants.map((participant) => ({
        seat: participant.seat,
        playerType: participant.participant_type,
        publicPlayerName: participant.public_player_name,
        playerId: participant.player_id,
        deckId: participant.deck_id,
        commanderId: participant.commander_id,
        commanderName: participant.commander_name,
        deckName: participant.deck_name,
        isWinner: participant.is_winner,
      })),
    };
  });
}
