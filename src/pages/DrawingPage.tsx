import { useState, useCallback } from "react";
import DrawingCanvas from "@/components/DrawingCanvas";
import ToolPalette from "@/components/ToolPalette";
import TopBar from "@/components/TopBar";
import GestureGuide from "@/components/GestureGuide";

export type DrawingTool = {
  color: string;
  size: number;
  mode: "draw" | "erase";
};

const DrawingPage = () => {
  const [tool, setTool] = useState<DrawingTool>({
    color: "#00ffcc",
    size: 4,
    mode: "draw",
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
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <TopBar cameraReady={cameraReady} gesture={gesture} />

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

      <GestureGuide gesture={gesture} />
    </div>
  );
};

export default DrawingPage;
