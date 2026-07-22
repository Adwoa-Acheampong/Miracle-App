import React, { useRef, useEffect, useState } from "react";
import { playSoundEnter, playSoundConfirm } from "../lib/audio";

interface GameWorldProps {
  onInteract: (hotspot: string) => void;
  sparkleCount: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  isSpark: boolean;
}

interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
  ambientPhase: number;
}

export const GameWorld: React.FC<GameWorldProps> = ({ onInteract, sparkleCount }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Player character (the Pilgrim) coordinates
  const pilgrimRef = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    size: 8,
    speed: 0.08,
    isMoving: false,
  });

  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  // Hotspots definitions
  const hotspotsRef = useRef<Hotspot[]>([
    { id: "well", label: "Well of Whispers", x: 0, y: 0, radius: 55, pulsePhase: 0, ambientPhase: 0 },
    { id: "obelisk", label: "Obelisk of Truth", x: 0, y: 0, radius: 60, pulsePhase: Math.PI / 2, ambientPhase: 1 },
    { id: "portal", label: "Portal of Light", x: 0, y: 0, radius: 55, pulsePhase: Math.PI, ambientPhase: 2 },
    { id: "altar", label: "Sparkle Altar", x: 0, y: 0, radius: 50, pulsePhase: (3 * Math.PI) / 2, ambientPhase: 3 },
  ]);

  const particlesRef = useRef<Particle[]>([]);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Set up resize observer to dynamically size the game container and canvas
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      setWindowSize({ width: w, height: h });
      canvasRef.current.width = w;
      canvasRef.current.height = h;

      // Position the Pilgrim in the center initially if not already initialized
      if (pilgrimRef.current.x === 0 && pilgrimRef.current.y === 0) {
        pilgrimRef.current.x = w / 2;
        pilgrimRef.current.y = h * 0.55;
        pilgrimRef.current.targetX = w / 2;
        pilgrimRef.current.targetY = h * 0.55;
      }

      // Reposition the hotspots based on screen proportions
      hotspotsRef.current = [
        { id: "well", label: "Well of Whispers", x: w * 0.22, y: h * 0.62, radius: 48, pulsePhase: 0, ambientPhase: 0 },
        { id: "obelisk", label: "Obelisk of Truth", x: w * 0.5, y: h * 0.28, radius: 55, pulsePhase: Math.PI / 2, ambientPhase: 1 },
        { id: "portal", label: "Portal of Light", x: w * 0.78, y: h * 0.62, radius: 48, pulsePhase: Math.PI, ambientPhase: 2 },
        { id: "altar", label: "Sparkle Altar", x: w * 0.5, y: h * 0.78, radius: 45, pulsePhase: (3 * Math.PI) / 2, ambientPhase: 3 },
      ];
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Draw World Background: Make it transparent so the HTML mesh-bg is visible
      ctx.clearRect(0, 0, w, h);

      // 1. Draw subtle ambient fog layers at the bottom and center with emerald tones
      const fogGrad = ctx.createRadialGradient(w / 2, h * 0.6, 50, w / 2, h * 0.6, Math.max(w, h) * 0.6);
      fogGrad.addColorStop(0, "rgba(16, 185, 129, 0.1)"); // Emerald fog
      fogGrad.addColorStop(0.5, "rgba(11, 23, 17, 0.03)"); // Black-jade shade
      fogGrad.addColorStop(1, "rgba(5, 8, 6, 0)"); // Transparent end
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Draw procedural pathways with elegant, ultra-thin emerald veins connecting hot spots
      ctx.strokeStyle = "rgba(52, 211, 153, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Well to Obelisk to Portal
      ctx.moveTo(w * 0.22, h * 0.62);
      ctx.quadraticCurveTo(w * 0.35, h * 0.45, w * 0.5, h * 0.28);
      ctx.quadraticCurveTo(w * 0.65, h * 0.45, w * 0.78, h * 0.62);
      // Well to Altar to Portal
      ctx.moveTo(w * 0.22, h * 0.62);
      ctx.quadraticCurveTo(w * 0.35, h * 0.75, w * 0.5, h * 0.78);
      ctx.quadraticCurveTo(w * 0.65, h * 0.75, w * 0.78, h * 0.62);
      ctx.stroke();

      // 3. Update and draw Pilgrim (player)
      const pilgrim = pilgrimRef.current;
      const dx = pilgrim.targetX - pilgrim.x;
      const dy = pilgrim.targetY - pilgrim.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        pilgrim.x += dx * pilgrim.speed;
        pilgrim.y += dy * pilgrim.speed;
        pilgrim.isMoving = true;

        // Spawn movement sparkles
        if (!reducedMotion && Math.random() < 0.28) {
          particlesRef.current.push({
            x: pilgrim.x,
            y: pilgrim.y + (Math.random() * 6 - 3),
            vx: (Math.random() * 1.2 - 0.6),
            vy: (Math.random() * -0.6 - 0.2),
            size: Math.random() * 2 + 1,
            alpha: 1.0,
            decay: 0.015,
            color: "#D7B56D", // Restrained gold spark
            isSpark: true,
          });
        }
      } else {
        pilgrim.x = pilgrim.targetX;
        pilgrim.y = pilgrim.targetY;
        pilgrim.isMoving = false;
      }

      // Draw Pilgrim (glowing bright emerald/jade light orb)
      const pilgrimGrad = ctx.createRadialGradient(
        pilgrim.x,
        pilgrim.y,
        0,
        pilgrim.x,
        pilgrim.y,
        pilgrim.size * 2.8
      );
      pilgrimGrad.addColorStop(0, "#F5F3EA"); // Pure white focus center
      pilgrimGrad.addColorStop(0.3, "#34D399"); // Shimmering emerald body
      pilgrimGrad.addColorStop(0.7, "rgba(16, 185, 129, 0.3)"); // Emerald bloom
      pilgrimGrad.addColorStop(1, "rgba(16, 185, 129, 0)"); // Fade

      ctx.fillStyle = pilgrimGrad;
      ctx.beginPath();
      ctx.arc(pilgrim.x, pilgrim.y, pilgrim.size * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // 4. Draw Hotspots
      hotspotsRef.current.forEach((spot) => {
        // Increment phase for gentle animations
        if (!reducedMotion) {
          spot.pulsePhase += 0.015;
          spot.ambientPhase += 0.006;
        }

        const isHovered = hoveredHotspot === spot.id;
        const pulse = reducedMotion ? 1 : Math.sin(spot.pulsePhase) * 0.06 + 0.94;
        const radius = spot.radius * pulse;

        // Visual design of hotspots:
        // A subtle intermittent halo surrounds the active element
        if (isHovered) {
          ctx.strokeStyle = "rgba(52, 211, 153, 0.45)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, spot.radius + 8 + Math.sin(spot.pulsePhase * 2) * 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Subtle natural intermittent halo
          ctx.strokeStyle = "rgba(16, 185, 129, 0.12)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, spot.radius + 4 + Math.sin(spot.pulsePhase) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw hotspot specific materials
        if (spot.id === "well") {
          // Well of Whispers: Circular emerald pool of concentric light with a cat-eye highlight
          const wellGrad = ctx.createRadialGradient(spot.x, spot.y, 10, spot.x, spot.y, radius);
          wellGrad.addColorStop(0, "#0B1711"); // Black-jade core
          wellGrad.addColorStop(0.6, "rgba(16, 185, 129, 0.4)"); // Emerald body
          wellGrad.addColorStop(0.9, "rgba(52, 211, 153, 0.25)"); // Mint ripple
          wellGrad.addColorStop(1, "rgba(16, 185, 129, 0)");

          ctx.fillStyle = wellGrad;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // Ring border
          ctx.strokeStyle = isHovered ? "rgba(52, 211, 153, 0.6)" : "rgba(16, 185, 129, 0.25)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, radius - 4, 0, Math.PI * 2);
          ctx.stroke();

          // Cat-eye light streak
          ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          const offset = Math.sin(spot.ambientPhase * 3) * (radius * 0.6);
          ctx.arc(spot.x + offset, spot.y, radius * 0.5, 0, Math.PI * 2);
          ctx.stroke();

        } else if (spot.id === "obelisk") {
          // Obelisk of Truth: Monolithic prism with emerald and gold edges
          const heightOb = radius * 1.4;
          const widthOb = radius * 0.45;

          // Drawing monolithic shadow base
          ctx.fillStyle = "rgba(11, 23, 17, 0.85)"; // Black-jade glass
          ctx.strokeStyle = isHovered ? "#D7B56D" : "#34D399"; // Gold / emerald edges
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          // Drawing 3D prism obelisk
          // Base points
          const bx = spot.x;
          const by = spot.y + heightOb * 0.4;
          // Tip
          const tx = spot.x;
          const ty = spot.y - heightOb * 0.8;

          // Left face
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - widthOb, by - 10);
          ctx.lineTo(tx, ty);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Right face
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + widthOb, by - 10);
          ctx.lineTo(tx, ty);
          ctx.closePath();
          ctx.fillStyle = "rgba(5, 8, 6, 0.92)"; // Darker slate side
          ctx.fill();
          ctx.stroke();

          // Float some micro-glyphs or sparkles above the obelisk tip
          if (!reducedMotion && Math.random() < 0.05) {
            particlesRef.current.push({
              x: tx + (Math.random() * 8 - 4),
              y: ty - 4,
              vx: (Math.random() * 0.4 - 0.2),
              vy: (Math.random() * -0.4 - 0.1),
              size: Math.random() * 1.8 + 1,
              alpha: 0.9,
              decay: 0.012,
              color: "#ECFDF5", // Mint white
              isSpark: true,
            });
          }

        } else if (spot.id === "portal") {
          // Portal of Light: Shimmering ellipse with a moving gold highlight
          ctx.save();
          ctx.translate(spot.x, spot.y);
          ctx.rotate(Math.PI / 6); // slanted portal

          const pRadiusX = radius * 0.65;
          const pRadiusY = radius * 1.1;

          // Base dark interior
          ctx.fillStyle = "rgba(5, 8, 6, 0.8)";
          ctx.beginPath();
          ctx.ellipse(0, 0, pRadiusX, pRadiusY, 0, 0, Math.PI * 2);
          ctx.fill();

          // Moving gold highlight gradient portal
          const portalGrad = ctx.createLinearGradient(
            -pRadiusX + Math.sin(spot.ambientPhase * 4) * pRadiusX * 0.4, 
            0, 
            pRadiusX + Math.sin(spot.ambientPhase * 4) * pRadiusX * 0.4, 
            0
          );
          portalGrad.addColorStop(0, "rgba(16, 185, 129, 0.1)");
          portalGrad.addColorStop(0.5, "rgba(215, 181, 109, 0.5)"); // warm gold moving highlight
          portalGrad.addColorStop(1, "rgba(52, 211, 153, 0.1)");

          ctx.fillStyle = portalGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, pRadiusX - 2, pRadiusY - 2, 0, 0, Math.PI * 2);
          ctx.fill();

          // Thin outer ring
          ctx.strokeStyle = isHovered ? "#D7B56D" : "rgba(52, 211, 153, 0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(0, 0, pRadiusX, pRadiusY, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();

        } else if (spot.id === "altar") {
          // Sparkle Altar / Breath Hearth: Obsidian steps with rising sparkles and halo
          const altarW = radius * 1.15;
          const altarH = 16;

          // Draw black-jade altar base
          ctx.fillStyle = "rgba(11, 23, 17, 0.6)"; // Black-jade glass
          ctx.strokeStyle = "rgba(52, 211, 153, 0.25)";
          ctx.lineWidth = 1;

          // Lower step
          ctx.fillRect(spot.x - altarW / 2, spot.y + 4, altarW, altarH);
          ctx.strokeRect(spot.x - altarW / 2, spot.y + 4, altarW, altarH);

          // Upper step
          ctx.fillStyle = "rgba(5, 8, 6, 0.8)"; // Dark slate
          ctx.fillRect(spot.x - altarW * 0.35, spot.y - 10, altarW * 0.7, altarH);
          ctx.strokeRect(spot.x - altarW * 0.35, spot.y - 10, altarW * 0.7, altarH);

          // Soft emerald hearth flame aura
          const auraGrad = ctx.createRadialGradient(spot.x, spot.y - 12, 0, spot.x, spot.y - 12, radius * 0.8);
          auraGrad.addColorStop(0, "rgba(52, 211, 153, 0.2)");
          auraGrad.addColorStop(0.6, "rgba(16, 185, 129, 0.05)");
          auraGrad.addColorStop(1, "rgba(5, 8, 6, 0)");
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y - 12, radius * 0.8, 0, Math.PI * 2);
          ctx.fill();

          // Spawning slow sparkles from hearth
          if (!reducedMotion && Math.random() < 0.04) {
            particlesRef.current.push({
              x: spot.x + (Math.random() * altarW * 0.5 - altarW * 0.25),
              y: spot.y - 12,
              vx: (Math.random() * 0.4 - 0.2),
              vy: (Math.random() * -0.5 - 0.2),
              size: Math.random() * 1.8 + 0.8,
              alpha: 0.9,
              decay: 0.009,
              color: "#ECFDF5",
              isSpark: true,
            });
          }
        }

        // Draw HUD Hotspot Text: elegant micro-labels in JetBrains Mono or DM Sans
        ctx.fillStyle = isHovered ? "#ECFDF5" : "#9AAFA3"; // Mint white vs muted jade
        ctx.font = "11px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(spot.label.toUpperCase(), spot.x, spot.y + spot.radius + 18);
      });

      // 5. Update and Draw Ambient Miracle Sparkles
      if (!reducedMotion && particlesRef.current.length < 45 && Math.random() < 0.015) {
        particlesRef.current.push({
          x: Math.random() * w,
          y: h + 10,
          vx: Math.random() * 0.4 - 0.2,
          vy: -(Math.random() * 0.5 + 0.15),
          size: Math.random() * 1.8 + 0.6,
          alpha: Math.random() * 0.4 + 0.1,
          decay: 0.003 + Math.random() * 0.003,
          color: "#9AAFA3", // Muted slate sparkle
          isSpark: false,
        });
      }

      // Update and draw particles list
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) return false;

        // Draw sparkle
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.isSpark) {
          // Draw four-pointed star for active reward sparks
          ctx.beginPath();
          const r = p.size * 2.2;
          ctx.moveTo(p.x, p.y - r);
          ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
          ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y);
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
          ctx.closePath();
          ctx.fill();
        } else {
          // Draw ambient slow particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });

      // Draw active player interactive helper/feedback indicator
      if (pilgrim.isMoving) {
        ctx.strokeStyle = "rgba(52, 211, 153, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pilgrim.targetX, pilgrim.targetY, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [hoveredHotspot, reducedMotion]);

  // Handle click/tap events on canvas to navigate Pilgrim or open Hotspots
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Support scale difference between canvas attributes and screen coords
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if the user clicked near any hotspot (within interaction boundary)
    let clickedHotspot: Hotspot | null = null;
    hotspotsRef.current.forEach((spot) => {
      const dx = x - spot.x;
      const dy = y - spot.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= spot.radius + 15) {
        clickedHotspot = spot;
      }
    });

    if (clickedHotspot) {
      const spot = clickedHotspot as Hotspot;
      // Target position is set slightly shifted so pilgrim doesn't stand exactly in center of object
      pilgrimRef.current.targetX = spot.x;
      pilgrimRef.current.targetY = spot.y + spot.radius * 0.6;
      playSoundConfirm();

      // Trigger interaction after a tiny walking delay
      setTimeout(() => {
        onInteract(spot.id);
      }, 350);
    } else {
      // Direct navigation tap feedback in under 100ms as demanded
      pilgrimRef.current.targetX = x;
      pilgrimRef.current.targetY = y;
      playSoundEnter();

      // Spawn click ripples particles
      for (let i = 0; i < 6; i++) {
        particlesRef.current.push({
          x: x,
          y: y,
          vx: Math.cos((i * Math.PI) / 3) * 1.5,
          vy: Math.sin((i * Math.PI) / 3) * 1.5,
          size: Math.random() * 2 + 1,
          alpha: 1.0,
          decay: 0.03,
          color: "rgba(52, 211, 153, 0.65)", // Shimmering emerald
          isSpark: true,
        });
      }
    }
  };

  // Move tracker to determine hovered elements
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let foundId: string | null = null;
    hotspotsRef.current.forEach((spot) => {
      const dx = x - spot.x;
      const dy = y - spot.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= spot.radius + 15) {
        foundId = spot.id;
      }
    });

    if (foundId !== hoveredHotspot) {
      if (foundId) {
        playSoundEnter();
      }
      setHoveredHotspot(foundId);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-crosshair select-none"
      id="game-canvas-container"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredHotspot(null)}
        className="block w-full h-full"
        id="game-world-canvas"
        aria-hidden="true"
      />

      {/* Accessible HTML equivalents for screen readers */}
      <div className="sr-only">
        <h2>Interactive Elements of the Miracle Living House</h2>
        <p>The house is styled in dark obsidian pathways and deep glowing emerald lights.</p>
        <ul>
          <li><button onClick={() => onInteract("well")}>Enter the Well of Whispers to offer gratitude and thoughts.</button></li>
          <li><button onClick={() => onInteract("obelisk")}>Read the Obelisk of Truth to discover scriptures and wisdom.</button></li>
          <li><button onClick={() => onInteract("portal")}>Open the Portal of Light to seek daily real-world miracles.</button></li>
          <li><button onClick={() => onInteract("altar")}>Approach the Sparkle Altar to engage in serene deep breathing exercises.</button></li>
        </ul>
      </div>
    </div>
  );
};
