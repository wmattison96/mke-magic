import { AppShell } from "@/components/app-shell";
import { DeckDirectory } from "@/components/profiles/deck-directory";
import { getPublicProfileData } from "@/lib/data/public-profiles";
import { buildProfileStatistics, parsePodFilter } from "@/lib/stats/profiles";

export const instant = false;

export default async function DecksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [data, query] = await Promise.all([getPublicProfileData(), searchParams]);
  const podFilter = parsePodFilter(query.pods);
  const profiles = buildProfileStatistics(data.games, data.players, data.decks, podFilter);
  return <AppShell activePath="/decks"><DeckDirectory
    decks={profiles.deckDirectory}
    podFilter={podFilter}
    recordedGames={profiles.totalGamesInPod}
    participationGames={profiles.participationEligibleGames}
    winGames={profiles.winEligibleGames}
  /></AppShell>;
}
