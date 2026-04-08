import { supabase } from "@/integrations/supabase/client";

type InvokeAiPerfectBody = {
  imageBase64: string;
  backgroundMode: "dark" | "light";
};

export type AiPerfectFunctionResponse = {
  ok: boolean;
  perfectedImage?: string;
  error?: string;
  status?: number;
  retryAfterMs?: number;
  retryable?: boolean;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (status?: number, message?: string) => {
  const normalizedMessage = (message ?? "").toLowerCase();
  return (
    status === 429 ||
    status === 408 ||
    (typeof status === "number" && status >= 500) ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("try again") ||
    normalizedMessage.includes("temporar") ||
    normalizedMessage.includes("timeout")
  );
};

const normalizeSuccess = (data: any): AiPerfectFunctionResponse => {
  if (!data) {
    return {
      ok: false,
      error: "AI did not return a response.",
      status: 500,
      retryable: true,
    };
  }

  if (typeof data.ok === "boolean") {
    return {
      ok: data.ok,
      perfectedImage: data.perfectedImage,
      error: data.error,
      status: data.status,
      retryAfterMs: data.retryAfterMs,
      retryable: data.retryable ?? isRetryable(data.status, data.error),
    };
  }

  if (data.perfectedImage) {
    return {
      ok: true,
      perfectedImage: data.perfectedImage,
      status: 200,
      retryable: false,
    };
  }

  return {
    ok: false,
    error: data.error || "AI did not return an image.",
    status: data.status,
    retryAfterMs: data.retryAfterMs,
    retryable: data.retryable ?? isRetryable(data.status, data.error),
  };
};

const normalizeError = async (error: any): Promise<AiPerfectFunctionResponse> => {
  let message = error?.message || "AI request failed";
  let status = error?.context?.status;
  let retryAfterMs: number | undefined;
  let retryable: boolean | undefined;

  if (error?.context && typeof error.context.clone === "function") {
    try {
      const payload = await error.context.clone().json();
      if (payload?.error) {
        message = payload.error;
      }

      if (typeof payload?.status === "number") {
        status = payload.status;
      }

      if (typeof payload?.retryAfterMs === "number") {
        retryAfterMs = payload.retryAfterMs;
      }

      if (typeof payload?.retryable === "boolean") {
        retryable = payload.retryable;
      }
    } catch {
      // Ignore malformed function error bodies and fall back to the error object.
    }
  }

  return {
    ok: false,
    error: message,
    status,
    retryAfterMs,
    retryable: retryable ?? isRetryable(status, message),
  };
};

export async function invokeAiPerfect(
  body: InvokeAiPerfectBody,
  maxAttempts = 2
): Promise<AiPerfectFunctionResponse> {
  let lastResult: AiPerfectFunctionResponse = {
    ok: false,
    error: "AI request failed",
    status: 500,
    retryable: true,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await supabase.functions.invoke("ai-perfect", { body });
    const result = error ? await normalizeError(error) : normalizeSuccess(data);

    if (result.ok) {
      return result;
    }

    lastResult = result;

    if (!result.retryable || attempt === maxAttempts) {
      return result;
    }

    const retryDelay = Math.max(result.retryAfterMs ?? 0, 1200 * attempt);
    await wait(retryDelay + Math.round(Math.random() * 250));
  }

  return lastResult;
}