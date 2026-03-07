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
} from "lucide-react";

const COLORS = ["#00ffcc", "#8b5cf6", "#ff3d8b", "#3b82f6", "#fbbf24", "#ffffff"];

interface ToolPaletteProps {
  tool: DrawingTool;
  onToolChange: (t: DrawingTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSave: () => void;
}

const ToolPalette = ({ tool, onToolChange, onUndo, onRedo, onClear, onSave }: ToolPaletteProps) => (
  <motion.div
    initial={{ x: -80, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ delay: 0.4 }}
    className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 sm:left-5"
  >
    <div className="glass rounded-2xl p-2 flex flex-col gap-1.5">
      {/* Mode */}
      <ToolBtn
        active={tool.mode === "draw"}
        onClick={() => onToolChange({ ...tool, mode: "draw" })}
        title="Draw"
      >
        <Paintbrush className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        active={tool.mode === "erase"}
        onClick={() => onToolChange({ ...tool, mode: "erase" })}
        title="Erase"
      >
        <Eraser className="h-4 w-4" />
      </ToolBtn>

      <div className="my-1 h-px bg-border" />

      {/* Colors */}
      {COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onToolChange({ ...tool, color: c, mode: "draw" })}
          className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
            tool.color === c && tool.mode === "draw" ? "border-foreground scale-110" : "border-transparent"
          }`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}

      <div className="my-1 h-px bg-border" />

      {/* Size */}
      <ToolBtn onClick={() => onToolChange({ ...tool, size: Math.max(1, tool.size - 2) })} title="Smaller">
        <Minus className="h-3 w-3" />
      </ToolBtn>
      <div className="flex items-center justify-center text-xs text-muted-foreground font-mono">
        {tool.size}
      </div>
      <ToolBtn onClick={() => onToolChange({ ...tool, size: Math.min(30, tool.size + 2) })} title="Larger">
        <Plus className="h-3 w-3" />
      </ToolBtn>

      <div className="my-1 h-px bg-border" />

      {/* Actions */}
      <ToolBtn onClick={onUndo} title="Undo"><Undo2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn onClick={onRedo} title="Redo"><Redo2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn onClick={onClear} title="Clear"><Trash2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn onClick={onSave} title="Save PNG"><Download className="h-4 w-4" /></ToolBtn>
    </div>
  </motion.div>
);

const ToolBtn = ({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
      active
        ? "bg-primary/20 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

export default ToolPalette;
