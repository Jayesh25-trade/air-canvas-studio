import { motion } from "framer-motion";
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
}

const ToolPalette = ({ tool, onToolChange, onUndo, onRedo, onClear, onSave }: ToolPaletteProps) => {
  const colors = tool.whiteboard ? WHITEBOARD_COLORS : COLORS;

  return (
    <motion.div
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 sm:left-5"
    >
      <div className={`${tool.whiteboard ? 'bg-white/90 border border-black/10 shadow-xl' : 'glass'} rounded-2xl p-2 flex flex-col gap-1.5 max-h-[85vh] overflow-y-auto`}>
        {/* Mode Toggle */}
        <ToolBtn
          active={tool.mode === "draw"}
          onClick={() => onToolChange({ ...tool, mode: "draw" })}
          title="Draw"
          whiteboard={tool.whiteboard}
        >
          <Paintbrush className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={tool.mode === "erase"}
          onClick={() => onToolChange({ ...tool, mode: "erase" })}
          title="Erase"
          whiteboard={tool.whiteboard}
        >
          <Eraser className="h-4 w-4" />
        </ToolBtn>

        <Divider whiteboard={tool.whiteboard} />

        {/* Colors */}
        <div className="grid grid-cols-2 gap-1">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => onToolChange({ ...tool, color: c, mode: "draw", rainbow: false })}
              className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-125 ${
                tool.color === c && tool.mode === "draw" && !tool.rainbow
                  ? (tool.whiteboard ? "border-black scale-110" : "border-foreground scale-110")
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        <Divider whiteboard={tool.whiteboard} />

        {/* Brush Size Slider */}
        <div className={`px-1 py-1 flex flex-col items-center gap-1 ${tool.whiteboard ? 'text-black' : ''}`}>
          <span className={`text-[10px] font-mono ${tool.whiteboard ? 'text-gray-600' : 'text-muted-foreground'}`}>
            {tool.size}px
          </span>
          <Slider
            value={[tool.size]}
            onValueChange={([v]) => onToolChange({ ...tool, size: v })}
            min={1}
            max={30}
            step={1}
            className="w-16"
            orientation="horizontal"
          />
          <div className="flex gap-0.5">
            <button
              onClick={() => onToolChange({ ...tool, size: Math.max(1, tool.size - 1) })}
              className={`h-5 w-5 flex items-center justify-center rounded text-xs ${tool.whiteboard ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-muted text-muted-foreground'}`}
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              onClick={() => onToolChange({ ...tool, size: Math.min(30, tool.size + 1) })}
              className={`h-5 w-5 flex items-center justify-center rounded text-xs ${tool.whiteboard ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-muted text-muted-foreground'}`}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Opacity */}
        <div className="px-1 py-1 flex flex-col items-center gap-1">
          <span className={`text-[10px] font-mono ${tool.whiteboard ? 'text-gray-600' : 'text-muted-foreground'}`}>
            {Math.round(tool.opacity * 100)}%
          </span>
          <Slider
            value={[tool.opacity * 100]}
            onValueChange={([v]) => onToolChange({ ...tool, opacity: v / 100 })}
            min={10}
            max={100}
            step={5}
            className="w-16"
          />
        </div>

        <Divider whiteboard={tool.whiteboard} />

        {/* Feature Toggles */}
        <ToolBtn
          active={tool.rainbow}
          onClick={() => onToolChange({ ...tool, rainbow: !tool.rainbow, mode: "draw" })}
          title="Rainbow Mode"
          whiteboard={tool.whiteboard}
        >
          <Rainbow className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={tool.mirror}
          onClick={() => onToolChange({ ...tool, mirror: !tool.mirror })}
          title="Mirror Drawing"
          whiteboard={tool.whiteboard}
        >
          <FlipHorizontal2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          active={tool.glow}
          onClick={() => onToolChange({ ...tool, glow: !tool.glow })}
          title="Glow Effect"
          whiteboard={tool.whiteboard}
        >
          <Sparkles className="h-4 w-4" />
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
          title="Whiteboard Mode"
          whiteboard={tool.whiteboard}
        >
          {tool.whiteboard ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </ToolBtn>

        <Divider whiteboard={tool.whiteboard} />

        {/* Actions */}
        <ToolBtn onClick={onUndo} title="Undo" whiteboard={tool.whiteboard}><Undo2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={onRedo} title="Redo" whiteboard={tool.whiteboard}><Redo2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={onClear} title="Clear" whiteboard={tool.whiteboard}><Trash2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={onSave} title="Save PNG" whiteboard={tool.whiteboard}><Download className="h-4 w-4" /></ToolBtn>
      </div>
    </motion.div>
  );
};

const Divider = ({ whiteboard }: { whiteboard?: boolean }) => (
  <div className={`my-1 h-px ${whiteboard ? 'bg-gray-200' : 'bg-border'}`} />
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
    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
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
