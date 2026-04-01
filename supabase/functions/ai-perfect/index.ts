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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsedBody = RequestSchema.safeParse(await req.json());

    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    let response = await callGateway("google/gemini-3.1-flash-image-preview");

    // Retry on provider-side rejections with a second fast image model.
    if (!response.ok && response.status === 400) {
      const firstErrorText = await response.text();
      console.warn("ai-perfect primary model rejected image, retrying with fallback model", firstErrorText);
      response = await callGateway("google/gemini-2.5-flash-image");
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "AI did not return an image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ perfectedImage: imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-perfect error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
