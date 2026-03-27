import { useEffect, useRef, useCallback, useState } from "react";
import { DrawingTool } from "@/pages/DrawingPage";
import { motion } from "framer-motion";
import { Camera as CameraIcon } from "lucide-react";

type Results = any;

// Load MediaPipe from CDN to avoid Vite bundling issues
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadMediaPipe() {
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
  const w = window as any;
  return { Hands: w.Hands, Camera: w.Camera };
}

interface DrawingCanvasProps {
  tool: DrawingTool;
  onCameraReady: (ready: boolean) => void;
  onGestureChange: (gesture: string) => void;
  onActionsReady: (actions: {
    undo?: () => void;
    redo?: () => void;
    clear?: () => void;
    save?: () => void;
    getCanvas?: () => HTMLCanvasElement | null;
  }) => void;
}

interface Point { x: number; y: number; }

type StrokeLine = {
  points: Point[];
  color: string;
  size: number;
  mode: "draw" | "erase";
  opacity: number;
  glow: boolean;
};

// Catmull-Rom spline interpolation for ultra-smooth curves
function catmullRomSpline(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

// One-euro filter for jitter-free, low-latency tracking
class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number) {
    const te = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + te / dt);
  }

  filter(x: number, t: number): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = t;
      return x;
    }
    const dt = t - this.tPrev;
    if (dt <= 0) return this.xPrev;

    const dx = (x - this.xPrev) / dt;
    const adx = this.alpha(this.dCutoff, dt);
    const dxHat = adx * dx + (1 - adx) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const ax = this.alpha(cutoff, dt);
    const xHat = ax * x + (1 - ax) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.tPrev = null;
    this.dxPrev = 0;
  }
}

// Improved gesture detection with stability
function detectGesture(landmarks: { x: number; y: number; z: number }[]): string {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const fingersUp = tips.map((tip, i) => landmarks[tip].y < landmarks[pips[i]].y);
  const thumbTipX = landmarks[4].x;
  const thumbIPX = landmarks[3].x;
  const wristX = landmarks[0].x;
  const isRightHand = wristX < landmarks[9].x;
  const thumbUp = isRightHand ? thumbTipX < thumbIPX : thumbTipX > thumbIPX;

  const [indexUp, middleUp, ringUp, pinkyUp] = fingersUp;

  if (!indexUp && !middleUp && !ringUp && !pinkyUp && !thumbUp) return "clear";
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return "draw";
  if (indexUp && middleUp && !ringUp && !pinkyUp) return "erase";
  if (indexUp && middleUp && ringUp && pinkyUp) return "stop";
  if (indexUp && middleUp && ringUp && !pinkyUp) return "stop";
  return "stop";
}

// Rainbow color generator
let rainbowHue = 0;
function getRainbowColor(): string {
  rainbowHue = (rainbowHue + 2) % 360;
  return `hsl(${rainbowHue}, 100%, 60%)`;
}

const DrawingCanvas = ({ tool, onCameraReady, onGestureChange, onActionsReady }: DrawingCanvasProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<StrokeLine[]>([]);
  const redoStackRef = useRef<StrokeLine[]>([]);
  const currentStrokeRef = useRef<Point[]>([]);
  const isDrawingRef = useRef(false);
  const toolRef = useRef(tool);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const filterXRef = useRef(new OneEuroFilter(1.5, 0.01));
  const filterYRef = useRef(new OneEuroFilter(1.5, 0.01));
  const gestureBufferRef = useRef<string[]>([]);

  toolRef.current = tool;

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: StrokeLine) => {
    if (stroke.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.mode === "erase" ? "rgba(0,0,0,1)" : stroke.color;
    ctx.lineWidth = stroke.mode === "erase" ? stroke.size * 4 : stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";

    if (stroke.mode === "draw" && stroke.glow) {
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = Math.min(stroke.size * 2, 20);
    }

    // Use Catmull-Rom for ultra-smooth rendering
    const pts = stroke.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[Math.min(pts.length - 1, i + 1)];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        for (let t = 0; t <= 1; t += 0.1) {
          const pt = catmullRomSpline(p0, p1, p2, p3, t);
          ctx.lineTo(pt.x, pt.y);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }, []);

  const redrawAll = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (toolRef.current.whiteboard) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke));
  }, [drawStroke]);

  useEffect(() => {
    onActionsReady({
      undo: () => {
        const last = strokesRef.current.pop();
        if (last) { redoStackRef.current.push(last); redrawAll(); }
      },
      redo: () => {
        const item = redoStackRef.current.pop();
        if (item) { strokesRef.current.push(item); redrawAll(); }
      },
      clear: () => {
        strokesRef.current = [];
        redoStackRef.current = [];
        redrawAll();
      },
      getCanvas: () => drawCanvasRef.current,
      save: () => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        // Create a temp canvas with background
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;
        if (toolRef.current.whiteboard) {
          tempCtx.fillStyle = "#ffffff";
        } else {
          tempCtx.fillStyle = "#0d0f17";
        }
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        const link = document.createElement("a");
        link.download = "airdraw.png";
        link.href = tempCanvas.toDataURL("image/png");
        link.click();
      },
    });
  }, [onActionsReady, redrawAll]);

  useEffect(() => {
    const video = videoRef.current;
    const drawCanvas = drawCanvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    if (!video || !drawCanvas || !cursorCanvas) return;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      drawCanvas.width = w;
      drawCanvas.height = h;
      cursorCanvas.width = w;
      cursorCanvas.height = h;
      redrawAll();
    };
    resize();
    window.addEventListener("resize", resize);

    const drawCtx = drawCanvas.getContext("2d");
    const cursorCtx = cursorCanvas.getContext("2d");
    if (!drawCtx || !cursorCtx) return;

    let camera: any = null;
    let hands: any = null;
    let cancelled = false;

    (async () => {
      const mp = await loadMediaPipe();
      if (cancelled) return;

      hands = new mp.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.75,
        minTrackingConfidence: 0.65,
      });

      hands.onResults((results: Results) => {
        setLoading(false);
        cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
...
      });

      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
        if (cancelled) return;
        camera = new mp.Camera(video, {
          onFrame: async () => { await hands.send({ image: video }); },
          width: 640,
          height: 480,
        });
        camera.start();
        onCameraReady(true);
      } catch {
        setPermissionDenied(true);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      camera?.stop();
      hands?.close();
      window.removeEventListener("resize", resize);
    };
  }, [onCameraReady, onGestureChange, redrawAll]);

  if (permissionDenied) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background">
        <CameraIcon className="h-16 w-16 text-destructive" />
        <h2 className="text-xl font-semibold text-foreground">Camera Access Required</h2>
        <p className="max-w-sm text-center text-muted-foreground">
          AirDraw needs access to your camera to track your hand movements.
          Please allow camera access in your browser settings and reload.
        </p>
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        className={
          tool.whiteboard
            ? "absolute bottom-4 right-4 z-30 h-28 w-40 rounded-xl object-cover -scale-x-100 shadow-lg border-2 border-border/30 sm:h-36 sm:w-48"
            : "absolute inset-0 h-full w-full object-cover -scale-x-100 opacity-20"
        }
        playsInline
        muted
      />

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
        >
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading hand tracking model...</p>
        </motion.div>
      )}

      <canvas ref={drawCanvasRef} className="absolute inset-0 z-10" />
      <canvas ref={cursorCanvasRef} className="absolute inset-0 z-20 pointer-events-none" />
    </>
  );
};

export default DrawingCanvas;
