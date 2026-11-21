import { AppShell } from "@/components/app-shell";
import { PlayerDirectory } from "@/components/profiles/player-directory";
import { getCommanderMetadata } from "@/lib/data/commander-metadata";
import { getPublicProfileData } from "@/lib/data/public-profiles";
import { buildProfileStatistics, parsePodFilter, sortPlayerDirectoryProfiles } from "@/lib/stats/profiles";

export const instant = false;

export default async function PlayersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [data, query] = await Promise.all([getPublicProfileData(), searchParams]);
  const podFilter = parsePodFilter(query.pods);
  const initial = buildProfileStatistics(data.games, data.players, data.decks, podFilter);
  const mostPlayed = [...initial.players.values()].flatMap((profile) => profile.mostPlayedDeck ? [profile.mostPlayedDeck] : []);
  const metadata = await getCommanderMetadata(mostPlayed);
  const profiles = buildProfileStatistics(data.games, data.players, data.decks, podFilter, metadata);
  const entries = sortPlayerDirectoryProfiles(profiles.players.values())
    .map((stats) => ({ stats, commanderArtwork: stats.mostPlayedDeck ? metadata.get(stats.mostPlayedDeck.commanderId)?.artUrl ?? null : null }));

  return <AppShell activePath="/players"><PlayerDirectory
    entries={entries}
    podFilter={podFilter}
    recordedGames={profiles.totalGamesInPod}
    participationGames={profiles.participationEligibleGames}
    winGames={profiles.winEligibleGames}
  /></AppShell>;
}
