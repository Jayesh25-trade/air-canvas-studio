import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import {
  createTransparentAiLayer,
  loadImageElement,
  prepareAiPayload,
} from "@/lib/aiPerfectCanvas";
import { invokeAiPerfect } from "@/lib/aiPerfectRequest";

type PerfectDrawingOptions = {
  canvas: HTMLCanvasElement;
  whiteboard: boolean;
  onDone?: () => void;
  source?: "auto" | "manual";
  onApplyStart?: () => void;
  onApplyComplete?: () => void;
  onSettled?: () => void;
};

type AiPerfectStage = "idle" | "processing" | "applying";

const SUCCESS_COOLDOWN_MS = 4200;
const RATE_LIMIT_COOLDOWN_MS = 7000;
const MIN_REQUEST_GAP_MS = 3200;

export function useAiPerfect() {
  const [aiStage, setAiStage] = useState<AiPerfectStage>("idle");
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStrokeCountRef = useRef(0);
  const cooldownRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const drawingRevisionRef = useRef(0);
  const lastRequestAtRef = useRef(0);

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

  const perfectDrawing = useCallback(async ({
    canvas,
    whiteboard,
    onDone,
    source = "manual",
    onApplyStart,
    onApplyComplete,
    onSettled,
  }: PerfectDrawingOptions) => {
    if (processingRef.current || cooldownRef.current) {
      onSettled?.();
      return;
    }

    const timeSinceLastRequest = Date.now() - lastRequestAtRef.current;
    if (lastRequestAtRef.current !== 0 && timeSinceLastRequest < MIN_REQUEST_GAP_MS) {
      const remainingMs = MIN_REQUEST_GAP_MS - timeSinceLastRequest;
      setCooldown(remainingMs);

      if (source === "manual") {
        toast({
          title: "AI is catching up",
          description: `Please wait ${Math.max(1, Math.ceil(remainingMs / 1000))}s before retrying.`,
        });
      }

      onSettled?.();
      return;
    }

    const preparedPayload = prepareAiPayload(canvas, whiteboard);
    if (!preparedPayload) {
      onSettled?.();
      return;
    }

    clearPauseTimer();
    processingRef.current = true;
    setAiStage("processing");

    const revisionAtRequestStart = drawingRevisionRef.current;
    let shouldRetryForFreshDrawing = false;
    let didApplyResult = false;

    try {
      lastRequestAtRef.current = Date.now();

      const result = await invokeAiPerfect(
        {
          imageBase64: preparedPayload.imageBase64,
          backgroundMode: preparedPayload.background.mode,
        },
        source === "manual" ? 3 : 2
      );

      if (!result.ok) {
        const message = result.error || "AI request failed";
        const status = result.status;
        const normalizedMessage = message.toLowerCase();

        if (status === 429 || normalizedMessage.includes("429") || normalizedMessage.includes("rate limit")) {
          toast({
            title: "Rate limited",
            description: "The AI service is busy. I’ll hold new requests for a few seconds to prevent repeat failures.",
            variant: "destructive",
          });
          setCooldown(Math.max(result.retryAfterMs ?? RATE_LIMIT_COOLDOWN_MS, MIN_REQUEST_GAP_MS));
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

      if (drawingRevisionRef.current !== revisionAtRequestStart) {
        shouldRetryForFreshDrawing = source === "auto";
        return;
      }

      if (!result.perfectedImage) {
        throw new Error("AI did not return an image.");
      }

      const resultImage = await loadImageElement(result.perfectedImage);

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
      setCooldown(SUCCESS_COOLDOWN_MS);

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
            onSettled,
          });
        }, 250);
      }

      onSettled?.();
    }
  }, [clearPauseTimer, setCooldown]);

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
