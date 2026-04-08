import { useState, useCallback, useRef } from "react";
import DrawingCanvas from "@/components/DrawingCanvas";
import ToolPalette from "@/components/ToolPalette";
import TopBar from "@/components/TopBar";
import GestureGuide from "@/components/GestureGuide";
import AiPerfectOverlay from "@/components/AiPerfectOverlay";
import { useAiPerfect } from "@/hooks/useAiPerfect";

export type DrawingTool = {
  color: string;
  size: number;
  mode: "draw" | "erase";
  opacity: number;
  whiteboard: boolean;
  rainbow: boolean;
  mirror: boolean;
  glow: boolean;
};

const DrawingPage = () => {
  const [tool, setTool] = useState<DrawingTool>({
    color: "#00ffcc",
    size: 4,
    mode: "draw",
    opacity: 1,
    whiteboard: false,
    rainbow: false,
    mirror: false,
    glow: true,
  });
  const [cameraReady, setCameraReady] = useState(false);
  const [gesture, setGesture] = useState<string>("none");
  const [trackingPaused, setTrackingPaused] = useState(false);
  const [canvasActions, setCanvasActions] = useState<{
    undo?: () => void;
    redo?: () => void;
    clear?: () => void;
    save?: () => void;
    getCanvas?: () => HTMLCanvasElement | null;
    getStrokeCount?: () => number;
    clearStrokes?: () => void;
    setTrackingPaused?: (paused: boolean) => void;
  }>({});
  const canvasActionsRef = useRef(canvasActions);
  canvasActionsRef.current = canvasActions;

  const {
    aiStage,
    isProcessing,
    perfectDrawing,
    startPauseTimer,
    cancelPauseTimer,
    markDrawingActivity,
  } = useAiPerfect();

  const handleUndo = useCallback(() => canvasActions.undo?.(), [canvasActions]);
  const handleRedo = useCallback(() => canvasActions.redo?.(), [canvasActions]);
  const handleClear = useCallback(() => canvasActions.clear?.(), [canvasActions]);
  const handleSave = useCallback(() => canvasActions.save?.(), [canvasActions]);

  const handleAiPerfect = useCallback(() => {
    const actions = canvasActionsRef.current;
    const canvas = actions.getCanvas?.();
    if (canvas) {
      actions.setTrackingPaused?.(true);
      setTrackingPaused(true);
      setGesture("stop");

      perfectDrawing({
        canvas,
        whiteboard: tool.whiteboard,
        onDone: () => {
          canvasActionsRef.current.clearStrokes?.();
        },
        onApplyStart: () => {
          canvasActionsRef.current.setTrackingPaused?.(true);
          setTrackingPaused(true);
        },
        onApplyComplete: () => {
          canvasActionsRef.current.setTrackingPaused?.(false);
          setTrackingPaused(false);
        },
        onSettled: () => {
          canvasActionsRef.current.setTrackingPaused?.(false);
          setTrackingPaused(false);
        },
      });
    }
  }, [perfectDrawing, tool.whiteboard]);

  // Called by DrawingCanvas whenever a stroke ends
  const handleStrokeEnd = useCallback(() => {
    const actions = canvasActionsRef.current;
    const canvas = actions.getCanvas?.();
    const count = actions.getStrokeCount?.() ?? 0;
    if (canvas && count > 0) {
      startPauseTimer(canvas, count, tool.whiteboard, () => {
        canvasActionsRef.current.clearStrokes?.();
      });
    }
  }, [startPauseTimer, tool.whiteboard]);

  // Called when user starts drawing
  const handleStrokeStart = useCallback(() => {
    cancelPauseTimer();
    markDrawingActivity();
  }, [cancelPauseTimer, markDrawingActivity]);

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${tool.whiteboard ? 'bg-white' : 'bg-background'}`}>
      <TopBar cameraReady={cameraReady} gesture={gesture} whiteboard={tool.whiteboard} />

      <DrawingCanvas
        tool={tool}
        trackingPaused={trackingPaused}
        onCameraReady={setCameraReady}
        onGestureChange={setGesture}
        onActionsReady={setCanvasActions}
        onStrokeEnd={handleStrokeEnd}
        onStrokeStart={handleStrokeStart}
      />

      <AiPerfectOverlay stage={aiStage} />

      <ToolPalette
        tool={tool}
        onToolChange={setTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onSave={handleSave}
        onAiPerfect={handleAiPerfect}
        isAiProcessing={isProcessing}
        aiLabel={trackingPaused ? "Paused" : undefined}
      />

      <GestureGuide gesture={gesture} whiteboard={tool.whiteboard} />
    </div>
  );
};

export default DrawingPage;
