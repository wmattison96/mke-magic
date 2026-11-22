import { getCommanderArtForName } from "@/lib/data/commander-metadata";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
  if (name.length < 2 || name.length > 80) {
    return Response.json({ artUrl: null }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const artUrl = await getCommanderArtForName(name);
  return Response.json({ artUrl }, {
    headers: { "Cache-Control": artUrl ? "public, max-age=3600, stale-while-revalidate=86400" : "public, max-age=300" },
  });
}
