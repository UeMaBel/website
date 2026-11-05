"use client";

import { useEffect, useRef } from "react";

export function PointField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.closest<HTMLElement>(".hero");
    const context = canvas?.getContext("2d");
    if (!canvas || !hero || !context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Circular layers form a volume, viewed at a fixed oblique angle.
    const layers = [5, 8, 10, 8, 5];
    const nodes = layers.flatMap((count, layer) => Array.from({ length: count }, (_, row) => {
      const angle = row / count * Math.PI * 2 + layer * 0.32;
      const spread = layer === 0 || layer === 4 ? 0.5 : 0.72;
      const x = (layer - 2) * 0.47;
      const y = Math.cos(angle) * spread;
      const z = Math.sin(angle) * spread;
      const rotatedX = x * 0.88 + z * 0.48;
      const rotatedZ = z * 0.88 - x * 0.48;
      const rotatedY = y * 0.97 - rotatedZ * 0.24;
      const depth = rotatedZ * 0.97 + y * 0.24;
      const perspective = 3 / (3 + depth * 0.4);
      return { layer, x: rotatedX * perspective, y: rotatedY * perspective, depth, scale: perspective,
        startX: (Math.random() - 0.5) * 2.6, startY: (Math.random() - 0.5) * 2.2 };
    }));
    const edges = nodes.flatMap((from, a) => nodes.flatMap((to, b) => to.layer === from.layer + 1 ? [{
      a, b, phase: Math.random() * 24000, period: 18000 + Math.random() * 12000, pulses: Math.random() < 0.15,
    }] : []));
    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let radius = 0;
    let frame = 0;
    let elapsed = 0;
    let previous = 0;
    let visible = false;

    function draw() {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      const progress = reducedMotion.matches ? 1 : Math.min(elapsed / 3200, 1);
      const assembly = progress * progress * (3 - 2 * progress);
      const positions = nodes.map(node => ({
        x: centerX + (node.startX * (1 - assembly) + node.x * assembly) * radius,
        y: centerY + (node.startY * (1 - assembly) + node.y * assembly) * radius,
      }));
      for (const edge of edges) {
        const from = positions[edge.a];
        const to = positions[edge.b];
        const age = (elapsed + edge.phase) % edge.period;
        const pulse = edge.pulses && progress === 1 && !reducedMotion.matches && age < 3200 ? Math.sin(age / 3200 * Math.PI) ** 2 : 0;
        const depth = (nodes[edge.a].depth + nodes[edge.b].depth) / 2;
        context.globalAlpha = (0.055 + (1 - depth) * 0.025 + pulse * 0.16) * assembly ** 3;
        context.strokeStyle = pulse > 0 ? "#6d8854" : "#385037";
        context.lineWidth = 0.65 + pulse * 0.4;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }
      // After the entrance, neurons stay fixed; only connections change tone.
      const ordered = nodes.map((node, index) => ({ ...node, index })).sort((a, b) => b.depth - a.depth);
      for (const node of ordered) {
        const { x, y } = positions[node.index];
        const size = 3.2 * node.scale;
        context.globalAlpha = 0.48 + (1 - node.depth) * 0.16;
        const shading = context.createRadialGradient(x - size * 0.3, y - size * 0.3, 0, x, y, size);
        shading.addColorStop(0, "#83947a");
        shading.addColorStop(1, "#385037");
        context.fillStyle = shading;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }

    function tick(now: number) {
      elapsed += previous ? Math.min(now - previous, 50) : 0;
      previous = now;
      draw();
      frame = requestAnimationFrame(tick);
    }
    function restart() {
      cancelAnimationFrame(frame);
      previous = 0;
      draw();
      if (visible && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    }
    function resize() {
      if (!canvas || !context || !hero) return;
      width = hero.clientWidth;
      height = hero.clientHeight;
      const slot = canvas.parentElement;
      if (!slot) return;
      const heroBounds = hero.getBoundingClientRect();
      const slotBounds = slot.getBoundingClientRect();
      centerX = slotBounds.left - heroBounds.left + slotBounds.width / 2;
      centerY = slotBounds.top - heroBounds.top + slotBounds.height / 2;
      radius = Math.min(slotBounds.width * 0.4, slotBounds.height * 0.55);
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * scale;
      canvas.height = height * scale;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      restart();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(hero);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      restart();
    }, { threshold: 0.2 });
    visibility.observe(hero);
    reducedMotion.addEventListener("change", restart);
    document.addEventListener("visibilitychange", restart);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      reducedMotion.removeEventListener("change", restart);
      document.removeEventListener("visibilitychange", restart);
    };
  }, []);

  return <div className="particle-slot">
    <canvas ref={canvasRef} className="particle-canvas" aria-hidden="true" tabIndex={-1} />
  </div>;
}
