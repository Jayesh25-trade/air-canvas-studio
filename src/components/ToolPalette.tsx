import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DrawingTool } from "@/pages/DrawingPage";
import {
  Paintbrush,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Minus,
  Plus,
  Sparkles,
  FlipHorizontal2,
  Rainbow,
  Sun,
  Moon,
  ChevronUp,
  ChevronDown,
  Palette,
  Settings2,
  Wand2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

const COLORS = ["#00ffcc", "#8b5cf6", "#ff3d8b", "#3b82f6", "#fbbf24", "#ef4444", "#10b981", "#f97316"];
const WHITEBOARD_COLORS = ["#000000", "#1e40af", "#dc2626", "#059669", "#7c3aed", "#d97706", "#6b7280", "#be185d"];

interface ToolPaletteProps {
  tool: DrawingTool;
  onToolChange: (t: DrawingTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSave: () => void;
  onAiPerfect?: () => void;
  isAiProcessing?: boolean;
}

const ToolPalette = ({ tool, onToolChange, onUndo, onRedo, onClear, onSave, onAiPerfect, isAiProcessing }: ToolPaletteProps) => {
  const [expanded, setExpanded] = useState(true);
  const colors = tool.whiteboard ? WHITEBOARD_COLORS : COLORS;
  const glass = tool.whiteboard ? "bg-white/90 border border-black/10 shadow-xl" : "glass";

  return (
    <motion.div
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="absolute left-2 top-14 bottom-2 z-30 flex flex-col gap-1.5 sm:left-4"
    >
      {/* Main compact toolbar */}
      <div className={`${glass} rounded-2xl p-1.5 flex flex-col gap-1 flex-1 min-h-0`}>
        {/* Toggle expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          title={expanded ? "Collapse" : "Expand"}
          className={`flex h-6 w-8 items-center justify-center rounded-md transition-colors ${
            tool.whiteboard ? "text-gray-400 hover:bg-gray-100" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Draw / Erase - always visible */}
        <div className="flex flex-col gap-0.5">
          <ToolBtn
            active={tool.mode === "draw"}
            onClick={() => onToolChange({ ...tool, mode: "draw" })}
            title="Draw"
            whiteboard={tool.whiteboard}
          >
            <Paintbrush className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            active={tool.mode === "erase"}
            onClick={() => onToolChange({ ...tool, mode: "erase" })}
            title="Erase"
            whiteboard={tool.whiteboard}
          >
            <Eraser className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-1 overflow-hidden"
            >
              <Divider whiteboard={tool.whiteboard} />

              {/* Colors - 4x2 grid */}
              <div className="grid grid-cols-4 gap-0.5 px-0.5">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => onToolChange({ ...tool, color: c, mode: "draw", rainbow: false })}
                    className={`h-4 w-4 rounded-full border-2 transition-all hover:scale-125 ${
                      tool.color === c && tool.mode === "draw" && !tool.rainbow
                        ? tool.whiteboard ? "border-black scale-110" : "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>

              <Divider whiteboard={tool.whiteboard} />

              {/* Brush Size - compact */}
              <div className="px-0.5 flex flex-col items-center gap-0.5">
                <span className={`text-[9px] font-mono ${tool.whiteboard ? "text-gray-500" : "text-muted-foreground"}`}>
                  {tool.size}px
                </span>
                <Slider
                  value={[tool.size]}
                  onValueChange={([v]) => onToolChange({ ...tool, size: v })}
                  min={1}
                  max={30}
                  step={1}
                  className="w-14"
                />
                <div className="flex gap-0.5">
                  <button
                    onClick={() => onToolChange({ ...tool, size: Math.max(1, tool.size - 1) })}
                    className={`h-4 w-4 flex items-center justify-center rounded text-[10px] ${
                      tool.whiteboard ? "hover:bg-gray-100 text-gray-500" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <button
                    onClick={() => onToolChange({ ...tool, size: Math.min(30, tool.size + 1) })}
                    className={`h-4 w-4 flex items-center justify-center rounded text-[10px] ${
                      tool.whiteboard ? "hover:bg-gray-100 text-gray-500" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>

              {/* Opacity - compact */}
              <div className="px-0.5 flex flex-col items-center gap-0.5">
                <span className={`text-[9px] font-mono ${tool.whiteboard ? "text-gray-500" : "text-muted-foreground"}`}>
                  {Math.round(tool.opacity * 100)}%
                </span>
                <Slider
                  value={[tool.opacity * 100]}
                  onValueChange={([v]) => onToolChange({ ...tool, opacity: v / 100 })}
                  min={10}
                  max={100}
                  step={5}
                  className="w-14"
                />
              </div>

              <Divider whiteboard={tool.whiteboard} />

              {/* Feature Toggles - 2x2 grid */}
              <div className="grid grid-cols-2 gap-0.5">
                <ToolBtn
                  active={tool.rainbow}
                  onClick={() => onToolChange({ ...tool, rainbow: !tool.rainbow, mode: "draw" })}
                  title="Rainbow"
                  whiteboard={tool.whiteboard}
                >
                  <Rainbow className="h-3.5 w-3.5" />
                </ToolBtn>
                <ToolBtn
                  active={tool.mirror}
                  onClick={() => onToolChange({ ...tool, mirror: !tool.mirror })}
                  title="Mirror"
                  whiteboard={tool.whiteboard}
                >
                  <FlipHorizontal2 className="h-3.5 w-3.5" />
                </ToolBtn>
                <ToolBtn
                  active={tool.glow}
                  onClick={() => onToolChange({ ...tool, glow: !tool.glow })}
                  title="Glow"
                  whiteboard={tool.whiteboard}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </ToolBtn>
                <ToolBtn
                  active={tool.whiteboard}
                  onClick={() => {
                    const wb = !tool.whiteboard;
                    onToolChange({
                      ...tool,
                      whiteboard: wb,
                      color: wb ? "#000000" : "#00ffcc",
                      glow: !wb,
                    });
                  }}
                  title="Whiteboard"
                  whiteboard={tool.whiteboard}
                >
                  {tool.whiteboard ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                </ToolBtn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Divider whiteboard={tool.whiteboard} />

        {/* Actions - always visible */}
        <div className="grid grid-cols-2 gap-0.5">
          <ToolBtn onClick={onUndo} title="Undo" whiteboard={tool.whiteboard}><Undo2 className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={onRedo} title="Redo" whiteboard={tool.whiteboard}><Redo2 className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={onClear} title="Clear" whiteboard={tool.whiteboard}><Trash2 className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={onSave} title="Save" whiteboard={tool.whiteboard}><Download className="h-3.5 w-3.5" /></ToolBtn>
        </div>
      </div>
    </motion.div>
  );
};

const Divider = ({ whiteboard }: { whiteboard?: boolean }) => (
  <div className={`my-0.5 h-px ${whiteboard ? "bg-gray-200" : "bg-border"}`} />
);

const ToolBtn = ({
  children,
  active,
  onClick,
  title,
  whiteboard,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
  whiteboard?: boolean;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
      active
        ? whiteboard
          ? "bg-blue-100 text-blue-600"
          : "bg-primary/20 text-primary"
        : whiteboard
          ? "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

export default ToolPalette;
