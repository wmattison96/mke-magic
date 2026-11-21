import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { DashboardHome, DashboardLoadError, DashboardLoading } from "@/components/dashboard-home";
import { getPublicGameLog } from "@/lib/data/public-game-log";
import { getPublicPlayers } from "@/lib/data/public-players";
import { getSiteToday, type StatsGame } from "@/lib/stats/dashboard";

export default function Home() {
  return <AppShell activePath="/">
    <Suspense fallback={<DashboardLoading/>}>
      <DashboardLiveData/>
    </Suspense>
  </AppShell>;
}

async function DashboardLiveData() {
  const loaded = await Promise.all([getPublicGameLog(), getPublicPlayers()])
    .then(([games, players]) => ({ games, players }))
    .catch(() => null);
  if (!loaded) return <DashboardLoadError/>;

  const statsGames: StatsGame[] = loaded.games.map((game) => ({
      id: game.id,
      playedOn: game.playedOn,
      gameNumberOnDate: game.gameNumberOnDate,
      podSize: game.podSize,
      result: game.result,
      winningSeat: game.winningSeat,
      participants: game.participants.map((participant) => ({
        seat: participant.seat,
        playerId: participant.playerId,
        playerName: participant.publicPlayerName,
        deckId: participant.deckId,
        deckName: participant.deckName,
        commanderName: participant.commanderName,
        isWinner: participant.isWinner,
      })),
    }));
  return <DashboardHome games={statsGames} players={loaded.players} today={getSiteToday()}/>;
}
