import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "npm:zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RequestSchema = z.object({
  imageBase64: z.string().min(100, "imageBase64 is required"),
  backgroundMode: z.enum(["dark", "light"]).default("dark"),
});

const MODEL_CANDIDATES = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsedBody = RequestSchema.safeParse(await req.json());

    if (!parsedBody.success) {
      return jsonResponse({ ok: false, error: "No image provided", status: 400, retryable: false }, 400);
    }

    const { imageBase64, backgroundMode } = parsedBody.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const backgroundPrompt =
      backgroundMode === "light"
        ? "a pure white background"
        : "a flat deep charcoal background";

    const requestBodyForModel = (model: string) => ({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Refine this sketch into a clean, professional drawing while preserving the exact composition. HARD RULES: keep the same crop and aspect ratio, keep every line in the same position, preserve the same number of elements, preserve the original colors, smooth only the line quality, do not add decoration or extra objects, do not add shadows, do not add text, and keep the background as ${backgroundPrompt}. Return exactly one finished image.`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:")
                  ? imageBase64
                  : `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      modalities: ["image", "text"],
    });

    const callGateway = (model: string) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBodyForModel(model)),
      });

    let response: Response | null = null;
    let errorText = "";
    let lastStatus = 500;

    for (const model of MODEL_CANDIDATES) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        response = await callGateway(model);

        if (response.ok) {
          break;
        }

        lastStatus = response.status;
        errorText = await response.text();
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) * 1000 : undefined;

        if (response.status === 400) {
          console.warn("ai-perfect model rejected image, switching model", { model, errorText });
          break;
        }

        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await wait(Math.max(retryAfterMs ?? 0, 1200 * attempt));
          continue;
        }

        break;
      }

      if (response?.ok) {
        break;
      }
    }

    if (!response || !response.ok) {
      if (lastStatus === 429) {
        return jsonResponse({
          ok: false,
          error: "Rate limited. Please wait a moment and try again.",
          status: 429,
          retryAfterMs: 5000,
          retryable: true,
        });
      }

      if (lastStatus === 402) {
        return jsonResponse({
          ok: false,
          error: "Credits exhausted. Please add funds in Settings.",
          status: 402,
          retryable: false,
        });
      }

      console.error("AI gateway error:", lastStatus, errorText);
      return jsonResponse({
        ok: false,
        error: "AI processing failed",
        status: lastStatus,
        retryable: lastStatus >= 500,
      });
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return jsonResponse({ ok: false, error: "AI did not return an image", status: 500, retryable: true });
    }

    return jsonResponse({ ok: true, perfectedImage: imageUrl, status: 200, retryable: false });
  } catch (e) {
    console.error("ai-perfect error:", e);
    return jsonResponse({
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
      status: 500,
      retryable: true,
    });
  }
});
