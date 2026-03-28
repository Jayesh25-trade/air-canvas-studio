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
  const [canvasActions, setCanvasActions] = useState<{
    undo?: () => void;
    redo?: () => void;
    clear?: () => void;
    save?: () => void;
    getCanvas?: () => HTMLCanvasElement | null;
    getStrokeCount?: () => number;
    clearStrokes?: () => void;
  }>({});
  const canvasActionsRef = useRef(canvasActions);
  canvasActionsRef.current = canvasActions;

  const {
    isProcessing,
    perfectDrawing,
    startPauseTimer,
    cancelPauseTimer,
  } = useAiPerfect();

  const handleUndo = useCallback(() => canvasActions.undo?.(), [canvasActions]);
  const handleRedo = useCallback(() => canvasActions.redo?.(), [canvasActions]);
  const handleClear = useCallback(() => canvasActions.clear?.(), [canvasActions]);
  const handleSave = useCallback(() => canvasActions.save?.(), [canvasActions]);

  const handleAiPerfect = useCallback(() => {
    const actions = canvasActionsRef.current;
    const canvas = actions.getCanvas?.();
    if (canvas) {
      perfectDrawing(canvas, () => {
        canvasActionsRef.current.clearStrokes?.();
      });
    }
  }, [perfectDrawing]);

  // Called by DrawingCanvas whenever a stroke ends
  const handleStrokeEnd = useCallback(() => {
    const actions = canvasActionsRef.current;
    const canvas = actions.getCanvas?.();
    const count = actions.getStrokeCount?.() ?? 0;
    if (canvas && count > 0) {
      startPauseTimer(canvas, count, () => {
        canvasActionsRef.current.clearStrokes?.();
      });
    }
  }, [startPauseTimer]);

  // Called when user starts drawing
  const handleStrokeStart = useCallback(() => {
    cancelPauseTimer();
  }, [cancelPauseTimer]);

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${tool.whiteboard ? 'bg-white' : 'bg-background'}`}>
      <TopBar cameraReady={cameraReady} gesture={gesture} whiteboard={tool.whiteboard} />

      <DrawingCanvas
        tool={tool}
        onCameraReady={setCameraReady}
        onGestureChange={setGesture}
        onActionsReady={setCanvasActions}
        onStrokeEnd={handleStrokeEnd}
        onStrokeStart={handleStrokeStart}
      />

      <AiPerfectOverlay isProcessing={isProcessing} />

      <ToolPalette
        tool={tool}
        onToolChange={setTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onSave={handleSave}
        onAiPerfect={handleAiPerfect}
        isAiProcessing={isProcessing}
      />

      <GestureGuide gesture={gesture} whiteboard={tool.whiteboard} />
    </div>
  );
};

export default DrawingPage;
