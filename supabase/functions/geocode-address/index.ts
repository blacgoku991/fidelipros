import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  "https://fidelipro.com",
  "https://www.fidelipro.com",
];

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.includes(origin) || /\.lovable\.(app|dev)$/.test(origin)
        ? origin
        : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Simple in-memory cache (per cold start) — adresse normalisée → résultat
const cache = new Map<string, any>();

Deno.serve(async (req) => {
  const corsHeaders = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const body = await req.json().catch(() => ({}));
    const address = String((body as any).address || "").trim();
    if (address.length < 4) return json({ error: "address too short" }, 400);

    const cacheKey = address.toLowerCase().replace(/\s+/g, " ");
    if (cache.has(cacheKey)) return json(cache.get(cacheKey));

    // Call Lovable AI Gateway via REST (function calling for structured output)
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Tu es un service de géocodage français. Retourne les coordonnées GPS précises d'une adresse. Si l'adresse est ambiguë, prends la plus probable en France. Si impossible, retourne null pour tous les champs.",
          },
          { role: "user", content: `Adresse : ${address}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_coordinates",
              description: "Renvoie les coordonnées GPS de l'adresse",
              parameters: {
                type: "object",
                properties: {
                  lat: { type: ["number", "null"], description: "Latitude WGS84" },
                  lng: { type: ["number", "null"], description: "Longitude WGS84" },
                  formatted_address: { type: ["string", "null"] },
                  city: { type: ["string", "null"] },
                  country: { type: ["string", "null"] },
                },
                required: ["lat", "lng"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_coordinates" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("[geocode] AI gateway error", aiRes.status, t);
      if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
      if (aiRes.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
      return json({ error: "ai_error" }, 502);
    }

    const payload = await aiRes.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ lat: null, lng: null, error: "no_tool_call" }, 200);

    let parsed: any = {};
    try {
      parsed = JSON.parse(call.function.arguments || "{}");
    } catch {
      parsed = {};
    }

    const lat = typeof parsed.lat === "number" ? parsed.lat : null;
    const lng = typeof parsed.lng === "number" ? parsed.lng : null;
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      const result = { lat: null, lng: null, formatted_address: null, error: "not_found" };
      cache.set(cacheKey, result);
      return json(result);
    }

    const result = {
      lat,
      lng,
      formatted_address: parsed.formatted_address ?? address,
      city: parsed.city ?? null,
      country: parsed.country ?? "FR",
    };
    cache.set(cacheKey, result);
    return json(result);
  } catch (e) {
    console.error("[geocode] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
