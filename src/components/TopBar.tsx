import { motion } from "framer-motion";
import { Camera, CameraOff, Hand } from "lucide-react";

interface TopBarProps {
  cameraReady: boolean;
  gesture: string;
  whiteboard?: boolean;
}

const gestureLabels: Record<string, string> = {
  none: "No hand detected",
  draw: "✏️ Drawing",
  erase: "🧹 Erasing",
  stop: "✋ Paused",
  clear: "✊ Clear",
};

const TopBar = ({ cameraReady, gesture, whiteboard }: TopBarProps) => (
  <motion.div
    initial={{ y: -60, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.2 }}
    className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6"
  >
    <div className="flex items-center gap-2">
      <Hand className={`h-5 w-5 ${whiteboard ? 'text-blue-600' : 'text-primary'}`} />
      <span className="text-lg font-bold tracking-tight">
        <span className={whiteboard ? 'text-blue-600' : 'neon-text-cyan'}>Air</span>
        <span className={whiteboard ? 'text-gray-800' : 'text-foreground'}>Draw</span>
      </span>
    </div>

    <div className="flex items-center gap-4">
      <div className={`${whiteboard ? 'bg-white/80 border border-gray-200 shadow-sm' : 'glass'} rounded-lg px-3 py-1.5 text-xs font-medium ${whiteboard ? 'text-gray-600' : 'text-muted-foreground'}`}>
        {gestureLabels[gesture] || gesture}
      </div>
      <div className={`flex items-center gap-2 ${whiteboard ? 'bg-white/80 border border-gray-200 shadow-sm' : 'glass'} rounded-lg px-3 py-1.5`}>
        {cameraReady ? (
          <>
            <Camera className={`h-4 w-4 ${whiteboard ? 'text-green-600' : 'text-primary'}`} />
            <span className={`text-xs font-medium ${whiteboard ? 'text-green-600' : 'text-primary'}`}>Live</span>
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
