import { motion, AnimatePresence } from "framer-motion";
import { Wand2 } from "lucide-react";

interface AiPerfectOverlayProps {
  isProcessing: boolean;
}

const AiPerfectOverlay = ({ isProcessing }: AiPerfectOverlayProps) => {
  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute top-20 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="glass rounded-2xl px-6 py-3 flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Wand2 className="h-5 w-5 text-primary" />
            </motion.div>
            <div>
              <p className="text-sm font-medium text-foreground">AI is perfecting your drawing...</p>
              <p className="text-xs text-muted-foreground">Will auto-apply when ready</p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AiPerfectOverlay;
