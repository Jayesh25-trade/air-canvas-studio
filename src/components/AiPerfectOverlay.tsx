import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Check, X } from "lucide-react";

interface AiPerfectOverlayProps {
  show: boolean;
  perfectedImage: string | null;
  isProcessing: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

const AiPerfectOverlay = ({ show, perfectedImage, isProcessing, onApply, onDismiss }: AiPerfectOverlayProps) => {
  return (
    <>
      {/* Processing indicator */}
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
                <p className="text-xs text-muted-foreground">Analyzing shapes and creating a polished version</p>
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

      {/* Perfected image overlay */}
      <AnimatePresence>
        {show && perfectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 z-35 pointer-events-auto"
          >
            {/* Glowing border effect */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0.3] }}
              transition={{ duration: 2, ease: "easeOut" }}
              style={{
                boxShadow: "inset 0 0 100px hsla(170, 100%, 50%, 0.15), inset 0 0 200px hsla(260, 100%, 65%, 0.1)",
              }}
            />

            {/* The perfected image with morph animation */}
            <motion.img
              src={perfectedImage}
              alt="AI Perfected Drawing"
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.02, filter: "blur(20px)" }}
              animate={{ opacity: 0.85, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(10px)" }}
              transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Sparkle particles */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-primary"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 80}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                  y: [0, -30],
                }}
                transition={{
                  duration: 2,
                  delay: 0.5 + i * 0.15,
                  ease: "easeOut",
                }}
              />
            ))}

            {/* Action buttons */}
            <motion.div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              <button
                onClick={onApply}
                className="glass rounded-xl px-5 py-2.5 flex items-center gap-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors neon-glow-cyan"
              >
                <Check className="h-4 w-4" />
                Apply
              </button>
              <button
                onClick={onDismiss}
                className="glass rounded-xl px-5 py-2.5 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
                Dismiss
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AiPerfectOverlay;
