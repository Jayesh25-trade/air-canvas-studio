import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  createTransparentAiLayer,
  loadImageElement,
  prepareAiPayload,
} from "@/lib/aiPerfectCanvas";

type PerfectDrawingOptions = {
  canvas: HTMLCanvasElement;
  whiteboard: boolean;
  onDone?: () => void;
  source?: "auto" | "manual";
  onApplyStart?: () => void;
  onApplyComplete?: () => void;
};

type AiPerfectStage = "idle" | "processing" | "applying";

export function useAiPerfect() {
  const [aiStage, setAiStage] = useState<AiPerfectStage>("idle");
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStrokeCountRef = useRef(0);
  const cooldownRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const drawingRevisionRef = useRef(0);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const setCooldown = useCallback((ms: number) => {
    cooldownRef.current = true;

    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }

    cooldownTimerRef.current = setTimeout(() => {
      cooldownRef.current = false;
    }, ms);
  }, []);

  const resolveFunctionError = useCallback(async (error: any) => {
    let message = error?.message || "AI request failed";
    const status = error?.context?.status;

    if (error?.context && typeof error.context.clone === "function") {
      try {
        const payload = await error.context.clone().json();
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        // Ignore JSON parsing issues and use the default message.
      }
    }

    return { message, status };
  }, []);

  const perfectDrawing = useCallback(async ({
    canvas,
    whiteboard,
    onDone,
    source = "manual",
    onApplyStart,
    onApplyComplete,
  }: PerfectDrawingOptions) => {
    if (processingRef.current || cooldownRef.current) return;

    const preparedPayload = prepareAiPayload(canvas, whiteboard);
    if (!preparedPayload) return;

    clearPauseTimer();
    processingRef.current = true;
    setAiStage("processing");

    const revisionAtRequestStart = drawingRevisionRef.current;
    let shouldRetryForFreshDrawing = false;
    let didApplyResult = false;

    try {
      const { data, error } = await supabase.functions.invoke("ai-perfect", {
        body: {
          imageBase64: preparedPayload.imageBase64,
          backgroundMode: preparedPayload.background.mode,
        },
      });

      if (error) {
        const { message, status } = await resolveFunctionError(error);
        const normalizedMessage = message.toLowerCase();

        if (status === 429 || normalizedMessage.includes("429") || normalizedMessage.includes("rate limit")) {
          toast({
            title: "Rate limited",
            description: "Too many AI requests right now. Auto-perfect will be available again in a few seconds.",
            variant: "destructive",
          });
          setCooldown(6000);
          return;
        }

        if (status === 402 || normalizedMessage.includes("402") || normalizedMessage.includes("credits")) {
          toast({
            title: "AI credits needed",
            description: "AI credits are exhausted. Please top up and try again.",
            variant: "destructive",
          });
          setCooldown(12000);
          return;
        }

        throw new Error(message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.perfectedImage) {
        throw new Error("AI did not return an image.");
      }

      if (drawingRevisionRef.current !== revisionAtRequestStart) {
        shouldRetryForFreshDrawing = source === "auto";
        return;
      }

      const resultImage = await loadImageElement(data.perfectedImage);

      if (drawingRevisionRef.current !== revisionAtRequestStart) {
        shouldRetryForFreshDrawing = source === "auto";
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No context");
      }

      setAiStage("applying");

      onApplyStart?.();

      const transparentLayer = createTransparentAiLayer(
        resultImage,
        preparedPayload.background,
        canvas,
        preparedPayload.region
      );

      if (whiteboard) {
        context.fillStyle = preparedPayload.background.css;
        context.fillRect(
          preparedPayload.region.x,
          preparedPayload.region.y,
          preparedPayload.region.width,
          preparedPayload.region.height
        );
      } else {
        context.clearRect(
          preparedPayload.region.x,
          preparedPayload.region.y,
          preparedPayload.region.width,
          preparedPayload.region.height
        );
      }

      context.drawImage(
        transparentLayer,
        preparedPayload.region.x,
        preparedPayload.region.y,
        preparedPayload.region.width,
        preparedPayload.region.height
      );

      lastStrokeCountRef.current = 0;
      onDone?.();
      onApplyComplete?.();
      didApplyResult = true;
      setCooldown(2500);

      await new Promise((resolve) => setTimeout(resolve, 420));
      setAiStage("idle");
    } catch (err: any) {
      console.error("AI perfect error:", err);
      toast({
        title: "AI Perfect Failed",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
      setAiStage("idle");
    } finally {
      processingRef.current = false;

      if (!didApplyResult) {
        setAiStage("idle");
      }

      if (shouldRetryForFreshDrawing && !cooldownRef.current) {
        window.setTimeout(() => {
          void perfectDrawing({
            canvas,
            whiteboard,
            onDone,
            source: "auto",
            onApplyStart,
            onApplyComplete,
          });
        }, 250);
      }
    }
  }, [clearPauseTimer, resolveFunctionError, setCooldown]);

  const startPauseTimer = useCallback(
    (canvas: HTMLCanvasElement, strokeCount: number, whiteboard: boolean, onDone?: () => void) => {
      if (strokeCount <= lastStrokeCountRef.current) return;
      lastStrokeCountRef.current = strokeCount;

      clearPauseTimer();
      if (strokeCount < 1) return;

      pauseTimerRef.current = setTimeout(() => {
        void perfectDrawing({ canvas, whiteboard, onDone, source: "auto" });
      }, 3000);
    },
    [clearPauseTimer, perfectDrawing]
  );

  const cancelPauseTimer = useCallback(() => {
    clearPauseTimer();
  }, [clearPauseTimer]);

  const markDrawingActivity = useCallback(() => {
    drawingRevisionRef.current += 1;
  }, []);

  useEffect(() => {
    return () => {
      clearPauseTimer();

      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [clearPauseTimer]);

  return {
    aiStage,
    isProcessing: aiStage !== "idle",
    perfectDrawing,
    startPauseTimer,
    cancelPauseTimer,
    markDrawingActivity,
  };
}
