import { Router, type IRouter } from "express";

const router: IRouter = Router();

function parseCoordinate(value: unknown, min: number, max: number) {
  const coordinate = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
}

router.get("/nearby-donation-destinations", async (req, res) => {
  const latitude = parseCoordinate(req.query.lat, -90, 90);
  const longitude = parseCoordinate(req.query.lng, -180, 180);

  if (latitude === null || longitude === null) {
    res.status(400).json({ error: "Valid lat and lng query parameters are required." });
    return;
  }

  const query = `[out:json][timeout:20];
(
  nwr(around:10000,${latitude},${longitude})[amenity=place_of_worship];
  nwr(around:10000,${latitude},${longitude})[amenity=community_centre];
  nwr(around:10000,${latitude},${longitude})[amenity=social_facility];
  nwr(around:10000,${latitude},${longitude})[amenity=food_bank];
  nwr(around:10000,${latitude},${longitude})[office=charity];
);
out center tags;`;

  try {
    const response = await fetch("https://lz4.overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "HelpChain nearby donation destination lookup",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass lookup failed with ${response.status}`);
    }

    const data = (await response.json()) as { elements?: unknown[] };
    res.set("Cache-Control", "public, max-age=300");
    res.json({ elements: Array.isArray(data.elements) ? data.elements : [] });
  } catch (error) {
    req.log?.warn({ err: error }, "Nearby donation destination lookup failed");
    res.status(502).json({ error: "Nearby donation destinations are temporarily unavailable." });
  }
});

export default router;