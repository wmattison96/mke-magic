import { AppShell } from "@/components/app-shell";
import { GamesExplorer } from "@/components/games/games-explorer";
import { getPublicGameLog } from "@/lib/data/public-game-log";
import { getCurrentMemberContext } from "@/lib/supabase/verified-user";

export default async function GamesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [games, memberContext, params] = await Promise.all([
    getPublicGameLog(),
    getCurrentMemberContext(),
    searchParams,
  ]);
  const focusGameId = typeof params.game === "string" ? params.game : null;

  return <AppShell activePath="/games">
    <GamesExplorer key={focusGameId ?? "all-games"} games={games} isAdmin={memberContext?.approvalStatus === "approved" && memberContext.role === "admin"} focusGameId={focusGameId}/>
  </AppShell>;
}
