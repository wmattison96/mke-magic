type ScryfallAutocompleteResponse = { data?: unknown };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return Response.json({ names: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const endpoint = new URL("https://api.scryfall.com/cards/autocomplete");
  endpoint.searchParams.set("q", query);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ManaTablePlaygroup/1.0 (commander name lookup)",
      },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) {
      return Response.json({ error: "Commander search is temporarily unavailable." }, { status: 503 });
    }

    const payload = (await response.json()) as ScryfallAutocompleteResponse;
    const names = Array.isArray(payload.data)
      ? payload.data.filter((name): name is string => typeof name === "string").slice(0, 8)
      : [];
    return Response.json({ names }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=3600" } });
  } catch {
    return Response.json({ error: "Commander search is temporarily unavailable." }, { status: 503 });
  }
}
