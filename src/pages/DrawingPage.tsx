import { useState, useCallback } from "react";
import DrawingCanvas from "@/components/DrawingCanvas";
import ToolPalette from "@/components/ToolPalette";
import TopBar from "@/components/TopBar";
import GestureGuide from "@/components/GestureGuide";

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
  }>({});

  const handleUndo = useCallback(() => canvasActions.undo?.(), [canvasActions]);
  const handleRedo = useCallback(() => canvasActions.redo?.(), [canvasActions]);
  const handleClear = useCallback(() => canvasActions.clear?.(), [canvasActions]);
  const handleSave = useCallback(() => canvasActions.save?.(), [canvasActions]);

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${tool.whiteboard ? 'bg-white' : 'bg-background'}`}>
      <TopBar cameraReady={cameraReady} gesture={gesture} whiteboard={tool.whiteboard} />

      <DrawingCanvas
        tool={tool}
        onCameraReady={setCameraReady}
        onGestureChange={setGesture}
        onActionsReady={setCanvasActions}
      />

      <ToolPalette
        tool={tool}
        onToolChange={setTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onSave={handleSave}
      />

      <GestureGuide gesture={gesture} whiteboard={tool.whiteboard} />
    </div>
  );
};

export default DrawingPage;
