import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import ParticleBackground from "@/components/ParticleBackground";
import { Hand, Sparkles, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      <ParticleBackground />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-8 px-6 text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex items-center gap-3"
        >
          <div className="relative">
            <Hand className="h-12 w-12 text-primary" />
            <div className="absolute -inset-2 rounded-full bg-primary/20 blur-xl animate-pulse-glow" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            <span className="neon-text-cyan">Air</span>
            <span className="text-foreground">Draw</span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="max-w-md text-lg text-muted-foreground"
        >
          Draw in the air using your finger. Your camera tracks your hand and
          turns movement into art — in real time.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex flex-col items-center gap-4 sm:flex-row"
        >
          <button
            onClick={() => navigate("/draw")}
            className="group relative rounded-xl px-8 py-4 font-semibold text-primary-foreground gradient-neon transition-all hover:scale-105 neon-glow-cyan"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Start Drawing
            </span>
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-8 flex gap-8 text-sm text-muted-foreground"
        >
          {[
            { icon: Hand, label: "Hand Tracking" },
            { icon: Zap, label: "Real-time" },
            { icon: Sparkles, label: "Gesture Controls" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Index;
