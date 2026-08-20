---
name: Nearby map data
description: How HelpChain fetches nearby churches and donation centres reliably across web and native.
---

Use the project API server as the intermediary for public nearby-place searches rather than calling Overpass directly from the Expo client.

**Why:** The public Overpass endpoint blocked the browser app origin with a CORS policy, while the server-side request and API response worked reliably.

**How to apply:** Keep future nearby-point-of-interest lookups behind an API route with validated coordinates. The mobile app should consume that route and continue to use device map deep links for navigation.