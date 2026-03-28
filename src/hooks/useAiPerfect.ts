import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useAiPerfect() {
  const [isProcessing, setIsProcessing] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStrokeCountRef = useRef(0);
  const cooldownRef = useRef(false);

  const perfectDrawing = useCallback(async (canvas: HTMLCanvasElement, onDone?: () => void) => {
    if (isProcessing || cooldownRef.current) return;

    setIsProcessing(true);

    try {
      // Create a temp canvas with background for context
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error("No context");
      
      // Add dark background so AI can see the drawing context
      tempCtx.fillStyle = "#0d0f17";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);

      const imageBase64 = tempCanvas.toDataURL("image/png");

      const { data, error } = await supabase.functions.invoke("ai-perfect", {
        body: { imageBase64 },
      });

      if (error) throw error;

      if (data?.perfectedImage) {
        // Auto-apply the perfected image onto the canvas
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setIsProcessing(false);
            // Reset stroke counter so next drawing session triggers auto-AI
            lastStrokeCountRef.current = 0;
            onDone?.();
            // Cooldown to prevent re-triggering immediately
            cooldownRef.current = true;
            setTimeout(() => { cooldownRef.current = false; }, 5000);
          };
          img.onerror = () => {
            setIsProcessing(false);
            onDone?.();
          };
          img.src = data.perfectedImage;
        } else {
          setIsProcessing(false);
          onDone?.();
        }
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        setIsProcessing(false);
        onDone?.();
      }
    } catch (err: any) {
      console.error("AI perfect error:", err);
      toast({
        title: "AI Perfect Failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
      setIsProcessing(false);
      onDone?.();
    }
  }, [isProcessing]);

  const startPauseTimer = useCallback(
    (canvas: HTMLCanvasElement, strokeCount: number, onDone?: () => void) => {
      if (strokeCount <= lastStrokeCountRef.current) return;
      lastStrokeCountRef.current = strokeCount;

      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

      // Need at least 3 strokes before auto-triggering
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
