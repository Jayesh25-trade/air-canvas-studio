import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useAiPerfect() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [perfectedImage, setPerfectedImage] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStrokeCountRef = useRef(0);

  const perfectDrawing = useCallback(async (canvas: HTMLCanvasElement) => {
    if (isProcessing) return;

    setIsProcessing(true);
    toast({
      title: "✨ AI Perfecting...",
      description: "Analyzing your drawing and creating a perfected version",
    });

    try {
      const imageBase64 = canvas.toDataURL("image/png");

      const { data, error } = await supabase.functions.invoke("ai-perfect", {
        body: { imageBase64 },
      });

      if (error) throw error;

      if (data?.perfectedImage) {
        setPerfectedImage(data.perfectedImage);
        setShowOverlay(true);

        // Auto-hide overlay after 8 seconds
        setTimeout(() => {
          setShowOverlay(false);
        }, 8000);

        toast({
          title: "🎨 Drawing Perfected!",
          description: "Tap the overlay to apply or wait for it to fade",
        });
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error("AI perfect error:", err);
      toast({
        title: "AI Perfect Failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  const startPauseTimer = useCallback(
    (canvas: HTMLCanvasElement, strokeCount: number) => {
      // Only trigger if new strokes were added
      if (strokeCount <= lastStrokeCountRef.current) return;
      lastStrokeCountRef.current = strokeCount;

      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

      // Don't auto-trigger if fewer than 5 strokes
      if (strokeCount < 5) return;

      pauseTimerRef.current = setTimeout(() => {
        // Will be called 3 seconds after last stroke
      }, 3000);
    },
    []
  );

  const cancelPauseTimer = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const applyPerfectedImage = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!perfectedImage) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPerfectedImage(null);
        setShowOverlay(false);
      };
      img.src = perfectedImage;
    },
    [perfectedImage]
  );

  const dismissOverlay = useCallback(() => {
    setShowOverlay(false);
    setPerfectedImage(null);
  }, []);

  return {
    isProcessing,
    perfectedImage,
    showOverlay,
    perfectDrawing,
    startPauseTimer,
    cancelPauseTimer,
    applyPerfectedImage,
    dismissOverlay,
  };
}
