import { motion } from "framer-motion";

interface GestureGuideProps {
  gesture: string;
  whiteboard?: boolean;
}

const gestures = [
  { emoji: "☝️", label: "Index finger", action: "Draw" },
  { emoji: "✋", label: "Open hand", action: "Pause" },
  { emoji: "✌️", label: "Two fingers", action: "Erase" },
  { emoji: "✊", label: "Closed fist", action: "Clear" },
];

const GestureGuide = ({ gesture, whiteboard }: GestureGuideProps) => (
  <motion.div
    initial={{ y: 60, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.6 }}
    className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-4 sm:bottom-5"
  >
    <div className={`${whiteboard ? 'bg-white/90 border border-gray-200 shadow-lg' : 'glass'} rounded-2xl px-4 py-2 flex items-center gap-5`}>
      {gestures.map((g) => {
        const isActive = gesture === g.action.toLowerCase();
        return (
          <div
            key={g.action}
            className={`flex items-center gap-1.5 text-xs transition-all ${
              isActive
                ? whiteboard ? "text-blue-600 scale-110 font-semibold" : "text-primary scale-110 font-semibold"
                : whiteboard ? "text-gray-500" : "text-muted-foreground"
            }`}
          >
            <span className="text-base">{g.emoji}</span>
            <span className="hidden sm:inline">{g.action}</span>
          </div>
        );
      })}
    </div>
  </motion.div>
);

export default GestureGuide;
