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

interface Point {
  x: number;
  y: number;
}

type StrokeLine = {
  points: Point[];
  color: string;
  size: number;
  mode: "draw" | "erase";
};

// Detect gesture from hand landmarks
function detectGesture(landmarks: { x: number; y: number; z: number }[]): string {
  const tips = [8, 12, 16, 20]; // index, middle, ring, pinky tips
  const pips = [6, 10, 14, 18]; // corresponding PIP joints

  const fingersUp = tips.map((tip, i) => landmarks[tip].y < landmarks[pips[i]].y);
  const thumbUp = landmarks[4].x < landmarks[3].x; // simplified for right hand

  const [indexUp, middleUp, ringUp, pinkyUp] = fingersUp;

  // Closed fist - no fingers up
  if (!indexUp && !middleUp && !ringUp && !pinkyUp && !thumbUp) return "clear";
  // Index only - draw
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return "draw";
  // Two fingers - erase
  if (indexUp && middleUp && !ringUp && !pinkyUp) return "erase";
  // Open hand - stop
  if (indexUp && middleUp && ringUp && pinkyUp) return "stop";

  return "stop";
}

// Smooth point using simple moving average
function smoothPoint(points: Point[], newPoint: Point, window = 3): Point {
  const recent = points.slice(-window);
  recent.push(newPoint);
  return {
    x: recent.reduce((s, p) => s + p.x, 0) / recent.length,
    y: recent.reduce((s, p) => s + p.y, 0) / recent.length,
  };
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

  toolRef.current = tool;

  // Canvas actions
  const redrawAll = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokesRef.current.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.mode === "erase" ? "rgba(0,0,0,1)" : stroke.color;
      ctx.lineWidth = stroke.mode === "erase" ? stroke.size * 4 : stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";

      // Draw with glow for draw mode
      if (stroke.mode === "draw") {
        ctx.shadowColor = stroke.color;
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1];
        const curr = stroke.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
    });
  }, []);

  useEffect(() => {
    onActionsReady({
      undo: () => {
        const last = strokesRef.current.pop();
        if (last) {
          redoStackRef.current.push(last);
          redrawAll();
        }
      },
      redo: () => {
        const item = redoStackRef.current.pop();
        if (item) {
          strokesRef.current.push(item);
          redrawAll();
        }
      },
      clear: () => {
        strokesRef.current = [];
        redoStackRef.current = [];
        redrawAll();
      },
      save: () => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = "airdraw.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      },
    });
  }, [onActionsReady, redrawAll]);

  // Set up MediaPipe + Camera
  useEffect(() => {
    const video = videoRef.current;
    const drawCanvas = drawCanvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    if (!video || !drawCanvas || !cursorCanvas) return;

    const resize = () => {
      drawCanvas.width = window.innerWidth;
      drawCanvas.height = window.innerHeight;
      cursorCanvas.width = window.innerWidth;
      cursorCanvas.height = window.innerHeight;
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
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results: Results) => {
      setLoading(false);
      cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        onGestureChange("none");
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          if (currentStrokeRef.current.length > 1) {
            strokesRef.current.push({
              points: [...currentStrokeRef.current],
              color: toolRef.current.color,
              size: toolRef.current.size,
              mode: toolRef.current.mode,
            });
            redoStackRef.current = [];
          }
          currentStrokeRef.current = [];
        }
        return;
      }

      const landmarks = results.multiHandLandmarks[0];
      const gesture = detectGesture(landmarks);
      onGestureChange(gesture);

      // Index finger tip position (mirrored)
      const tip = landmarks[8];
      const x = (1 - tip.x) * cursorCanvas.width;
      const y = tip.y * cursorCanvas.height;

      // Draw cursor dot
      cursorCtx.beginPath();
      cursorCtx.arc(x, y, 8, 0, Math.PI * 2);
      const currentTool = toolRef.current;
      const cursorColor = gesture === "erase" || currentTool.mode === "erase" ? "#ff3d8b" : currentTool.color;
      cursorCtx.fillStyle = cursorColor;
      cursorCtx.shadowColor = cursorColor;
      cursorCtx.shadowBlur = 15;
      cursorCtx.fill();
      cursorCtx.shadowBlur = 0;

      const effectiveMode = gesture === "erase" ? "erase" : currentTool.mode;

      if (gesture === "draw" || gesture === "erase") {
        const smoothed = smoothPoint(currentStrokeRef.current, { x, y });

        if (!isDrawingRef.current) {
          isDrawingRef.current = true;
          currentStrokeRef.current = [smoothed];
        } else {
          currentStrokeRef.current.push(smoothed);

          // Draw current stroke in real-time
          const pts = currentStrokeRef.current;
          if (pts.length >= 2) {
            drawCtx.beginPath();
            drawCtx.strokeStyle = effectiveMode === "erase" ? "rgba(0,0,0,1)" : currentTool.color;
            drawCtx.lineWidth = effectiveMode === "erase" ? currentTool.size * 4 : currentTool.size;
            drawCtx.lineCap = "round";
            drawCtx.lineJoin = "round";
            drawCtx.globalCompositeOperation = effectiveMode === "erase" ? "destination-out" : "source-over";

            if (effectiveMode === "draw") {
              drawCtx.shadowColor = currentTool.color;
              drawCtx.shadowBlur = 8;
            }

            const p1 = pts[pts.length - 2];
            const p2 = pts[pts.length - 1];
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            drawCtx.moveTo(p1.x, p1.y);
            drawCtx.quadraticCurveTo(p1.x, p1.y, mx, my);
            drawCtx.stroke();
            drawCtx.globalCompositeOperation = "source-over";
            drawCtx.shadowBlur = 0;
          }
        }
      } else {
        // Stop / clear
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          if (currentStrokeRef.current.length > 1) {
            strokesRef.current.push({
              points: [...currentStrokeRef.current],
              color: currentTool.color,
              size: currentTool.size,
              mode: effectiveMode,
            });
            redoStackRef.current = [];
          }
          currentStrokeRef.current = [];
        }

        if (gesture === "clear") {
          strokesRef.current = [];
          redoStackRef.current = [];
          drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        }
      }
    });

    let camera: Camera | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      .then(() => {
        camera = new Camera(video, {
          onFrame: async () => {
            await hands.send({ image: video });
          },
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
        className="absolute inset-0 h-full w-full object-cover opacity-20 -scale-x-100"
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

      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 z-10"
      />
      <canvas
        ref={cursorCanvasRef}
        className="absolute inset-0 z-20 pointer-events-none"
      />
    </>
  );
};

export default DrawingCanvas;
