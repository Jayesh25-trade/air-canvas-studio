import { useEffect, useRef, useCallback, useState } from "react";
import { DrawingTool } from "@/pages/DrawingPage";
import { Hands, Results } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { motion } from "framer-motion";
import { Camera as CameraIcon } from "lucide-react";

interface DrawingCanvasProps {
  tool: DrawingTool;
  onCameraReady: (ready: boolean) => void;
  onGestureChange: (gesture: string) => void;
  onActionsReady: (actions: {
    undo?: () => void;
    redo?: () => void;
    clear?: () => void;
    save?: () => void;
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

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
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

      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        onGestureChange("none");
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          if (currentStrokeRef.current.length > 1) {
            const currentTool = toolRef.current;
            const effectiveColor = currentTool.rainbow ? getRainbowColor() : currentTool.color;
            strokesRef.current.push({
              points: [...currentStrokeRef.current],
              color: effectiveColor,
              size: currentTool.size,
              mode: currentTool.mode,
              opacity: currentTool.opacity,
              glow: currentTool.glow,
            });
            // Mirror stroke
            if (currentTool.mirror) {
              strokesRef.current.push({
                points: currentStrokeRef.current.map(p => ({
                  x: cursorCanvas.width - p.x,
                  y: p.y,
                })),
                color: effectiveColor,
                size: currentTool.size,
                mode: currentTool.mode,
                opacity: currentTool.opacity,
                glow: currentTool.glow,
              });
            }
            redoStackRef.current = [];
          }
          currentStrokeRef.current = [];
          filterXRef.current.reset();
          filterYRef.current.reset();
        }
        return;
      }

      const landmarks = results.multiHandLandmarks[0];
      const rawGesture = detectGesture(landmarks);
      
      // Stabilize gesture with buffer
      const buf = gestureBufferRef.current;
      buf.push(rawGesture);
      if (buf.length > 5) buf.shift();
      const counts: Record<string, number> = {};
      buf.forEach(g => counts[g] = (counts[g] || 0) + 1);
      const gesture = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      onGestureChange(gesture);

      const tip = landmarks[8];
      const now = performance.now() / 1000;
      const rawX = (1 - tip.x) * cursorCanvas.width;
      const rawY = tip.y * cursorCanvas.height;
      const x = filterXRef.current.filter(rawX, now);
      const y = filterYRef.current.filter(rawY, now);

      const currentTool = toolRef.current;
      const isErasing = gesture === "erase" || currentTool.mode === "erase";
      const cursorColor = isErasing ? "hsl(330, 100%, 60%)" : (currentTool.rainbow ? `hsl(${rainbowHue}, 100%, 60%)` : currentTool.color);

      // Draw cursor with rings
      cursorCtx.beginPath();
      cursorCtx.arc(x, y, currentTool.size / 2 + 4, 0, Math.PI * 2);
      cursorCtx.strokeStyle = cursorColor;
      cursorCtx.lineWidth = 2;
      cursorCtx.globalAlpha = 0.6;
      cursorCtx.stroke();
      cursorCtx.globalAlpha = 1;

      cursorCtx.beginPath();
      cursorCtx.arc(x, y, 4, 0, Math.PI * 2);
      cursorCtx.fillStyle = cursorColor;
      cursorCtx.shadowColor = cursorColor;
      cursorCtx.shadowBlur = 15;
      cursorCtx.fill();
      cursorCtx.shadowBlur = 0;

      // Mirror cursor
      if (currentTool.mirror) {
        const mx = cursorCanvas.width - x;
        cursorCtx.beginPath();
        cursorCtx.arc(mx, y, 4, 0, Math.PI * 2);
        cursorCtx.fillStyle = cursorColor;
        cursorCtx.globalAlpha = 0.5;
        cursorCtx.fill();
        cursorCtx.globalAlpha = 1;
      }

      const effectiveMode = gesture === "erase" ? "erase" : currentTool.mode;

      if (gesture === "draw" || gesture === "erase") {
        if (!isDrawingRef.current) {
          isDrawingRef.current = true;
          currentStrokeRef.current = [{ x, y }];
        } else {
          currentStrokeRef.current.push({ x, y });

          const pts = currentStrokeRef.current;
          if (pts.length >= 2) {
            const effectiveColor = currentTool.rainbow ? getRainbowColor() : currentTool.color;
            drawCtx.save();
            drawCtx.globalAlpha = currentTool.opacity;
            drawCtx.beginPath();
            drawCtx.strokeStyle = effectiveMode === "erase" ? "rgba(0,0,0,1)" : effectiveColor;
            drawCtx.lineWidth = effectiveMode === "erase" ? currentTool.size * 4 : currentTool.size;
            drawCtx.lineCap = "round";
            drawCtx.lineJoin = "round";
            drawCtx.globalCompositeOperation = effectiveMode === "erase" ? "destination-out" : "source-over";

            if (effectiveMode === "draw" && currentTool.glow) {
              drawCtx.shadowColor = effectiveColor;
              drawCtx.shadowBlur = Math.min(currentTool.size * 2, 20);
            }

            const p1 = pts[pts.length - 2];
            const p2 = pts[pts.length - 1];
            const mx2 = (p1.x + p2.x) / 2;
            const my2 = (p1.y + p2.y) / 2;
            drawCtx.moveTo(p1.x, p1.y);
            drawCtx.quadraticCurveTo(p1.x, p1.y, mx2, my2);
            drawCtx.stroke();

            // Mirror drawing in real-time
            if (currentTool.mirror) {
              drawCtx.beginPath();
              const mp1x = cursorCanvas.width - p1.x;
              const mp2x = cursorCanvas.width - p2.x;
              const mmx = (mp1x + mp2x) / 2;
              drawCtx.moveTo(mp1x, p1.y);
              drawCtx.quadraticCurveTo(mp1x, p1.y, mmx, my2);
              drawCtx.stroke();
            }

            drawCtx.restore();
          }
        }
      } else {
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          if (currentStrokeRef.current.length > 1) {
            const effectiveColor = currentTool.rainbow ? getRainbowColor() : currentTool.color;
            strokesRef.current.push({
              points: [...currentStrokeRef.current],
              color: effectiveColor,
              size: currentTool.size,
              mode: effectiveMode,
              opacity: currentTool.opacity,
              glow: currentTool.glow,
            });
            if (currentTool.mirror) {
              strokesRef.current.push({
                points: currentStrokeRef.current.map(p => ({
                  x: cursorCanvas.width - p.x,
                  y: p.y,
                })),
                color: effectiveColor,
                size: currentTool.size,
                mode: effectiveMode,
                opacity: currentTool.opacity,
                glow: currentTool.glow,
              });
            }
            redoStackRef.current = [];
          }
          currentStrokeRef.current = [];
          filterXRef.current.reset();
          filterYRef.current.reset();
        }

        if (gesture === "clear") {
          strokesRef.current = [];
          redoStackRef.current = [];
          if (currentTool.whiteboard) {
            drawCtx.fillStyle = "#ffffff";
            drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
          } else {
            drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
          }
        }
      }
    });

    let camera: Camera | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      .then(() => {
        camera = new Camera(video, {
          onFrame: async () => { await hands.send({ image: video }); },
          width: 640,
          height: 480,
        });
        camera.start();
        onCameraReady(true);
      })
      .catch(() => {
        setPermissionDenied(true);
        setLoading(false);
      });

    return () => {
      camera?.stop();
      hands.close();
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
