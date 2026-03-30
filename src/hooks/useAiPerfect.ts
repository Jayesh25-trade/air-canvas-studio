import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useAiPerfect() {
  const [isProcessing, setIsProcessing] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStrokeCountRef = useRef(0);
  const cooldownRef = useRef(false);

  const setCooldown = useCallback((ms: number) => {
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, ms);
  }, []);

  const perfectDrawing = useCallback(async (canvas: HTMLCanvasElement, onDone?: () => void) => {
    if (isProcessing || cooldownRef.current) return;

    setIsProcessing(true);

    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error("No context");

      tempCtx.fillStyle = "#0d0f17";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);

      const imageBase64 = tempCanvas.toDataURL("image/png");
      const { data, error } = await supabase.functions.invoke("ai-perfect", {
        body: { imageBase64 },
      });

      if (error) {
        const message = (error.message || "AI request failed").toLowerCase();

        if (message.includes("429") || message.includes("rate limit")) {
          toast({
            title: "Rate limited",
            description: "Too many AI requests. Please draw a bit more and retry in a few seconds.",
            variant: "destructive",
          });
          setIsProcessing(false);
          setCooldown(8000);
          return;
        }

        if (message.includes("402") || message.includes("credits")) {
          toast({
            title: "AI credits needed",
            description: "AI credits are exhausted. Please top up and try again.",
            variant: "destructive",
          });
          setIsProcessing(false);
          setCooldown(12000);
          return;
        }

        throw error;
      }

      if (data?.perfectedImage) {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setIsProcessing(false);
          return;
        }

        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          lastStrokeCountRef.current = 0;
          onDone?.();
          setIsProcessing(false);
          setCooldown(5000);
        };
        img.onerror = () => {
          setIsProcessing(false);
          toast({
            title: "AI Perfect Failed",
            description: "Could not load AI image result.",
            variant: "destructive",
          });
        };
        img.src = data.perfectedImage;
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setIsProcessing(false);
    } catch (err: any) {
      console.error("AI perfect error:", err);
      toast({
        title: "AI Perfect Failed",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  }, [isProcessing, setCooldown]);

  const startPauseTimer = useCallback(
    (canvas: HTMLCanvasElement, strokeCount: number, onDone?: () => void) => {
      if (strokeCount <= lastStrokeCountRef.current) return;
      lastStrokeCountRef.current = strokeCount;

      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      if (strokeCount < 3) return;

      pauseTimerRef.current = setTimeout(() => {
        perfectDrawing(canvas, onDone);
      }, 3000);
    },
    [perfectDrawing]
  );

  const cancelPauseTimer = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  return {
    isProcessing,
    perfectDrawing,
    startPauseTimer,
    cancelPauseTimer,
  };
}
