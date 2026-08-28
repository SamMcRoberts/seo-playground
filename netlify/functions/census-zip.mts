export default async (request: Request) => {
  const url = new URL(request.url);
  const zip = (url.searchParams.get("zip") || "").trim();

  if (!/^\d{5}$/.test(zip)) {
    return Response.json({ error: "A five-digit ZIP code is required." }, { status: 400 });
  }

  const censusUrl = new URL("https://api.census.gov/data/2024/acs/acs5");
  censusUrl.searchParams.set("get", "NAME,B25077_001E,B19013_001E");
  censusUrl.searchParams.set("for", "zip code tabulation area:" + zip);

  try {
    const response = await fetch(censusUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return Response.json(
        { error: "Census API request failed.", status: response.status },
        { status: 502 }
      );
    }

    const data = await response.json();
    if (!Array.isArray(data) || !data[0] || !data[1]) {
      return Response.json({ error: "No ACS data found for that ZIP code." }, { status: 404 });
    }

    const headers = data[0];
    const values = data[1];
    const row = Object.fromEntries(headers.map((key: string, i: number) => [key, values[i]]));
    const home = Number(row.B25077_001E);
    const income = Number(row.B19013_001E);

    if (!Number.isFinite(home) || home <= 0 || !Number.isFinite(income) || income <= 0) {
      return Response.json({ error: "ACS data for that ZIP code is incomplete." }, { status: 422 });
    }

    return Response.json(
      {
        name: row.NAME,
        zip,
        home: Math.round(home),
        income: Math.round(income),
        vintage: "2024 ACS 5-year"
      },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
        }
      }
    );
  } catch (error) {
    return Response.json(
      { error: "Census lookup is temporarily unavailable." },
      { status: 502 }
    );
  }
};

export const config = {
  path: "/api/census-zip"
};
