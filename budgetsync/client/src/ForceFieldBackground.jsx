import React, { useEffect, useRef } from 'react';

/**
 * ForceFieldBackground — Ultra-Light Pure Canvas
 * No image loading, no arc(), just raw fillRect particles.
 */
export default function ForceFieldBackground({
  hue = 210,
  saturation = 100,
  spacing = 14,
  density = 1.5,
  magnifierRadius = 180,
  forceStrength = 10,
  friction = 0.93,
  restoreSpeed = 0.03,
  minStroke = 1.5,
  maxStroke = 4,
  transparent = false
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let alive = true;
    let animId = 0;
    let w = 0, h = 0;

    // Flat SoA particle arrays
    let px, py, ox, oy, vx, vy, brightness;
    let count = 0;

    // Mouse state
    let mouseX = -9999, mouseY = -9999;
    let magX = -9999, magY = -9999;
    let canvasRect = { left: 0, top: 0 };

    // Pre-built color strings
    let colors = [];

    function buildColors() {
      colors = [];
      for (let i = 0; i < 16; i++) {
        const l = 90 - (i / 15) * 80;
        colors.push(`hsl(${hue},${saturation}%,${l}%)`);
      }
    }

    function resize() {
      const p = canvas.parentElement;
      if (!p) return;
      w = p.clientWidth;
      h = p.clientHeight;
      canvas.width = w;
      canvas.height = h;
      const r = canvas.getBoundingClientRect();
      canvasRect = { left: r.left, top: r.top };
    }

    function generate() {
      const s = Math.max(5, spacing);
      const cols = Math.ceil(w / s);
      const rows = Math.ceil(h / s);
      const max = cols * rows;

      px = new Float32Array(max);
      py = new Float32Array(max);
      ox = new Float32Array(max);
      oy = new Float32Array(max);
      vx = new Float32Array(max);
      vy = new Float32Array(max);
      brightness = new Uint8Array(max);
      count = 0;

      // Simple seeded PRNG
      let seed = 12345;
      const rand = () => { seed = (seed * 16807 + 7) % 2147483647; return seed / 2147483647; };

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rand() > density) continue;
          const x = c * s + (rand() - 0.5) * s * 0.4;
          const y = r * s + (rand() - 0.5) * s * 0.4;
          px[count] = x;
          py[count] = y;
          ox[count] = x;
          oy[count] = y;
          // Procedural brightness based on position
          const nx = Math.sin(x * 0.008 + y * 0.006) * 0.5 + 0.5;
          const ny = Math.cos(y * 0.01 - x * 0.004) * 0.5 + 0.5;
          brightness[count] = Math.floor((nx * 0.6 + ny * 0.4) * 255);
          count++;
        }
      }
    }

    function onMouse(e) {
      mouseX = e.clientX - canvasRect.left;
      mouseY = e.clientY - canvasRect.top;
    }
    function onScroll() {
      const r = canvas.getBoundingClientRect();
      canvasRect = { left: r.left, top: r.top };
    }

    function frame() {
      if (!alive) return;

      // Clear
      if (!transparent) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }

      if (count === 0) { animId = requestAnimationFrame(frame); return; }

      // Smooth magnifier
      magX += (mouseX - magX) * 0.08;
      magY += (mouseY - magY) * 0.08;

      const radSq = magnifierRadius * magnifierRadius;
      const rad = magnifierRadius;
      const cLen = colors.length;

      // Physics + batch by color
      const batches = new Array(cLen);
      for (let c = 0; c < cLen; c++) batches[c] = [];

      for (let i = 0; i < count; i++) {
        // Physics
        const dx = px[i] - magX;
        const dy = py[i] - magY;
        const dSq = dx * dx + dy * dy;

        if (dSq < radSq && dSq > 1) {
          const invD = 1 / Math.sqrt(dSq);
          const f = forceStrength * invD;
          vx[i] += dx * invD * f;
          vy[i] += dy * invD * f;
        }

        vx[i] = vx[i] * friction + (ox[i] - px[i]) * restoreSpeed;
        vy[i] = vy[i] * friction + (oy[i] - py[i]) * restoreSpeed;
        px[i] += vx[i];
        py[i] += vy[i];

        // Cull offscreen
        if (px[i] < -20 || px[i] > w + 20 || py[i] < -20 || py[i] > h + 20) continue;

        // Color index from brightness
        const b = brightness[i];
        let ci = (b / 255 * (cLen - 1)) | 0;
        if (ci >= cLen) ci = cLen - 1;

        // Size
        let size = minStroke + (b / 255) * (maxStroke - minStroke);
        if (dSq < radSq) {
          size *= 1.3 + 0.7 * (1 - Math.sqrt(dSq) / rad);
        }

        batches[ci].push(px[i], py[i], size);
      }

      // Render — one fillStyle change per color, fillRect is faster than arc
      for (let c = 0; c < cLen; c++) {
        const b = batches[c];
        if (b.length === 0) continue;
        ctx.fillStyle = colors[c];
        for (let j = 0; j < b.length; j += 3) {
          const s = b[j + 2];
          ctx.fillRect(b[j] - s * 0.5, b[j + 1] - s * 0.5, s, s);
        }
      }

      animId = requestAnimationFrame(frame);
    }

    // Init
    buildColors();
    resize();
    generate();
    magX = w / 2; magY = h / 2;
    mouseX = w / 2; mouseY = h / 2;

    // Window-level listeners
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('scroll', onScroll, true);
    const onResize = () => { resize(); generate(); };
    window.addEventListener('resize', onResize);

    animId = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [hue, saturation, spacing, density, forceStrength, magnifierRadius, friction, restoreSpeed, minStroke, maxStroke, transparent]);

  return (
    <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
  );
}
