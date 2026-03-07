import { motion } from "framer-motion";

interface GestureGuideProps {
  gesture: string;
}

const gestures = [
  { emoji: "☝️", label: "Index finger", action: "Draw" },
  { emoji: "✋", label: "Open hand", action: "Pause" },
  { emoji: "✌️", label: "Two fingers", action: "Erase" },
  { emoji: "✊", label: "Closed fist", action: "Clear" },
];

const GestureGuide = ({ gesture }: GestureGuideProps) => (
  <motion.div
    initial={{ y: 60, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.6 }}
    className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-4 sm:bottom-5"
  >
    <div className="glass rounded-2xl px-4 py-2 flex items-center gap-5">
      {gestures.map((g) => (
        <div
          key={g.action}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            gesture === g.action.toLowerCase()
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          <span className="text-base">{g.emoji}</span>
          <span className="hidden sm:inline">{g.action}</span>
        </div>
      ))}
    </div>
  </motion.div>
);

export default GestureGuide;
