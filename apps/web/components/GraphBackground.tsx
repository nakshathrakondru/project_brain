"use client";

import { useEffect, useRef } from "react";

interface GNode {
  x: number; y: number;
  vx: number; vy: number;
  pulseTimer: number;
  pulsePhase: number;
  r: number;
}

interface GEdge {
  a: number; b: number;
  drawProgress: number; // 0→1 as line draws in
  opacity: number;      // fades to permanent
  permanent: boolean;
}

const NODE_COUNT = 38;
const MAX_EDGES = 55;
const CONNECT_DIST = 220;
const NODE_SPEED = 0.12;
const EDGE_DRAW_SPEED = 0.008; // ~1.5s to draw
const PULSE_INTERVAL_MIN = 4000;
const PULSE_INTERVAL_MAX = 12000;
const NEW_EDGE_INTERVAL = 2800;

export default function GraphBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let nodes: GNode[] = [];
    let edges: GEdge[] = [];
    let lastEdgeTime = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = document.documentElement.scrollHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Init nodes scattered across viewport
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * NODE_SPEED,
      vy: (Math.random() - 0.5) * NODE_SPEED,
      r: Math.random() * 1.8 + 1.2,
      pulseTimer: Math.random() * PULSE_INTERVAL_MAX,
      pulsePhase: 0,
    }));

    // Seed some initial permanent edges
    const seedEdge = (a: number, b: number) => {
      if (edges.length >= MAX_EDGES) return;
      const already = edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
      if (!already) edges.push({ a, b, drawProgress: 1, opacity: 0.12, permanent: true });
    };
    for (let i = 0; i < 20; i++) {
      const a = Math.floor(Math.random() * NODE_COUNT);
      const b = Math.floor(Math.random() * NODE_COUNT);
      if (a !== b) seedEdge(a, b);
    }

    const addEdge = (now: number) => {
      if (now - lastEdgeTime < NEW_EDGE_INTERVAL) return;
      if (edges.length >= MAX_EDGES) return;
      lastEdgeTime = now;

      // Find two nearby nodes not already connected
      const candidates: [number, number, number][] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const connected = edges.some(e => (e.a === i && e.b === j) || (e.a === j && e.b === i));
            if (!connected) candidates.push([i, j, dist]);
          }
        }
      }
      if (candidates.length === 0) return;
      const [a, b] = candidates[Math.floor(Math.random() * candidates.length)];
      edges.push({ a, b, drawProgress: 0, opacity: 0, permanent: false });
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!reducedMotion) {
        // Move nodes
        nodes.forEach(n => {
          n.x += n.vx;
          n.y += n.vy;
          // Soft bounce at edges
          if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
          if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

          // Pulse countdown
          n.pulseTimer -= 16;
          if (n.pulseTimer <= 0) {
            n.pulsePhase = 1;
            n.pulseTimer = PULSE_INTERVAL_MIN + Math.random() * (PULSE_INTERVAL_MAX - PULSE_INTERVAL_MIN);
          }
          if (n.pulsePhase > 0) n.pulsePhase = Math.max(0, n.pulsePhase - 0.025);
        });

        // Advance drawing edges
        edges.forEach(e => {
          if (!e.permanent) {
            if (e.drawProgress < 1) {
              e.drawProgress = Math.min(1, e.drawProgress + EDGE_DRAW_SPEED);
              e.opacity = e.drawProgress * 0.2;
            } else {
              // Settle to permanent faint line
              e.opacity = Math.max(0.1, e.opacity - 0.0005);
              if (e.opacity <= 0.1) e.permanent = true;
            }
          }
        });

        addEdge(now);
      }

      // Draw edges
      edges.forEach(e => {
        const na = nodes[e.a], nb = nodes[e.b];
        if (!na || !nb) return;

        const dx = nb.x - na.x, dy = nb.y - na.y;
        const tx = na.x + dx * e.drawProgress;
        const ty = na.y + dy * e.drawProgress;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(99,130,220,${e.opacity})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw nodes
      nodes.forEach(n => {
        const pulse = n.pulsePhase;

        // Pulse glow ring
        if (pulse > 0 && !reducedMotion) {
          const glowR = n.r + 6 * pulse;
          const grd = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, glowR);
          grd.addColorStop(0, `rgba(99,130,220,${0.3 * pulse})`);
          grd.addColorStop(1, "rgba(99,130,220,0)");
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }

        // Node dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + (pulse > 0 ? 1 * pulse : 0), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120,150,230,${0.18 + 0.12 * pulse})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 1 }}
      aria-hidden="true"
    />
  );
}
