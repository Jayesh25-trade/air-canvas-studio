import { motion, AnimatePresence } from "framer-motion";
import { Wand2 } from "lucide-react";

interface AiPerfectOverlayProps {
  stage: "idle" | "processing" | "applying";
}

const stageCopy = {
  processing: {
    title: "AI is refining your sketch",
    subtitle: "Cropping, smoothing, and rebuilding clean lines",
  },
  applying: {
    title: "Applying the polished version",
    subtitle: "Blending the enhanced drawing back onto your canvas",
  },
};

const AiPerfectOverlay = ({ stage }: AiPerfectOverlayProps) => {
  const isVisible = stage !== "idle";
  const copy = stage === "idle" ? stageCopy.processing : stageCopy[stage];

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={stage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
        >
          <motion.div
            className="absolute inset-y-0 left-[-25%] w-1/2 bg-gradient-to-r from-transparent via-primary/15 to-transparent"
            animate={{ x: ["0%", "240%"] }}
            transition={{ duration: stage === "processing" ? 1.8 : 0.8, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="absolute top-20 left-1/2 z-50 -translate-x-1/2">
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.94 }}
              className="glass flex items-center gap-4 rounded-3xl border border-primary/20 px-5 py-3 shadow-2xl"
            >
              <motion.div
                className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10"
                animate={{ rotate: 360, scale: stage === "applying" ? [1, 1.08, 1] : 1 }}
                transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 0.7, repeat: Infinity } }}
              >
                <Wand2 className="h-5 w-5 text-primary" />
              </motion.div>

              <div>
                <p className="text-sm font-semibold text-foreground">{copy.title}</p>
                <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
              </div>

              <div className="flex gap-1.5">
                {[0, 1, 2].map((index) => (
                  <motion.div
                    key={index}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                    animate={{ opacity: [0.25, 1, 0.25], y: [0, -4, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: index * 0.14 }}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative flex h-32 w-32 items-center justify-center"
            >
              <motion.div
                className="absolute inset-0 rounded-full border border-primary/20 bg-primary/5"
                animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.12, 0.35] }}
                transition={{ duration: stage === "processing" ? 2.4 : 1, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-3 rounded-full border border-accent/25"
                animate={{ scale: [1, 0.92, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="glass relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/25">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: stage === "processing" ? 3 : 1.2, repeat: Infinity, ease: "linear" }}
                >
                  <Wand2 className="h-8 w-8 text-primary" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AiPerfectOverlay;
