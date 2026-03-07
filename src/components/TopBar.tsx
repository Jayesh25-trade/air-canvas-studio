import { motion } from "framer-motion";
import { Camera, CameraOff, Hand } from "lucide-react";

interface TopBarProps {
  cameraReady: boolean;
  gesture: string;
}

const gestureLabels: Record<string, string> = {
  none: "No hand detected",
  draw: "✏️ Drawing",
  erase: "🧹 Erasing",
  stop: "✋ Paused",
  clear: "✊ Clear",
};

const TopBar = ({ cameraReady, gesture }: TopBarProps) => (
  <motion.div
    initial={{ y: -60, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.2 }}
    className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6"
  >
    <div className="flex items-center gap-2">
      <Hand className="h-5 w-5 text-primary" />
      <span className="text-lg font-bold tracking-tight">
        <span className="neon-text-cyan">Air</span>
        <span className="text-foreground">Draw</span>
      </span>
    </div>

    <div className="flex items-center gap-4">
      <div className="glass rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {gestureLabels[gesture] || gesture}
      </div>
      <div className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
        {cameraReady ? (
          <>
            <Camera className="h-4 w-4 text-primary" />
            <span className="text-xs text-primary font-medium">Live</span>
          </>
        ) : (
          <>
            <CameraOff className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive font-medium">Off</span>
          </>
        )}
      </div>
    </div>
  </motion.div>
);

export default TopBar;
