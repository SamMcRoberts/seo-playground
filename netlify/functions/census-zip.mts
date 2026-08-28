export default async (request: Request) => {
  const url = new URL(request.url);
  const zip = (url.searchParams.get("zip") || "").trim();

  if (!/^\d{5}$/.test(zip)) {
    return Response.json({ error: "A five-digit ZIP code is required." }, { status: 400 });
  }

  const geoid = "86000US" + zip;
  const reporterUrl = new URL("https://api.censusreporter.org/1.0/data/show/latest");
  reporterUrl.searchParams.set("table_ids", "B19013,B25077");
  reporterUrl.searchParams.set("geo_ids", geoid);

  try {
    const response = await fetch(reporterUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "WFCCI/1.0 (working-family-inflation.netlify.app)"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return Response.json(
        { error: "ACS data service request failed.", status: response.status },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const geo = payload?.data?.[geoid];
    const home = Number(geo?.B25077?.estimate?.B25077001);
    const income = Number(geo?.B19013?.estimate?.B19013001);
    const name = payload?.geography?.[geoid]?.name || ("ZCTA5 " + zip);
    const vintage = payload?.release?.name || "ACS 5-year";

    if (!geo) {
      return Response.json({ error: "No ACS data found for that ZIP code." }, { status: 404 });
    }

    if (!Number.isFinite(home) || home <= 0 || !Number.isFinite(income) || income <= 0) {
      return Response.json({ error: "ACS data for that ZIP code is incomplete." }, { status: 422 });
    }

    return Response.json(
      {
        name,
        zip,
        home: Math.round(home),
        income: Math.round(income),
        vintage
      },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
        }
      }
    );
  } catch {
    return Response.json(
      { error: "ACS ZIP lookup is temporarily unavailable." },
      { status: 502 }
    );
  }
};

export const config = {
  path: "/api/census-zip"
};
