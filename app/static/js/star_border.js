/**
 * StarBorder — Animated Border Effect
 * Adapted from ReactBits (https://reactbits.dev/animations/star-border)
 */
(function() {
  const BLEED = 48;
  const TAU = Math.PI * 2;
  const WHITE = [255, 255, 255];

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const wrap = (v, total) => ((v % total) + total) % total;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (rgb, a) => `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${clamp(a, 0, 1).toFixed(3)})`;

  let colorCtx = null;
  const toRgb = (color) => {
    if (!colorCtx) colorCtx = document.createElement('canvas').getContext('2d');
    if (!colorCtx) return WHITE;
    colorCtx.fillStyle = color;
    const val = String(colorCtx.fillStyle);
    if (val.startsWith('#')) {
      const hex = parseInt(val.slice(1, 7), 16);
      return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
    }
    const parts = val.match(/[\d.]+/g)?.map(Number) ?? WHITE;
    return [parts[0], parts[1], parts[2]];
  };

  const outline = (w, h, r) => {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    const arc = (Math.PI * radius) / 2;
    const across = Math.max(0, w - 2 * radius);
    const down = Math.max(0, h - 2 * radius);
    const segments = [
      { length: across, x: radius, y: 0, dx: 1, dy: 0, angle: null },
      { length: arc, x: w - radius, y: radius, dx: 0, dy: 0, angle: -Math.PI / 2 },
      { length: down, x: w, y: radius, dx: 0, dy: 1, angle: null },
      { length: arc, x: w - radius, y: h - radius, dx: 0, dy: 0, angle: 0 },
      { length: across, x: w - radius, y: h, dx: -1, dy: 0, angle: null },
      { length: arc, x: radius, y: h - radius, dx: 0, dy: 0, angle: Math.PI / 2 },
      { length: down, x: 0, y: h - radius, dx: 0, dy: -1, angle: null },
      { length: arc, x: radius, y: radius, dx: 0, dy: 0, angle: Math.PI }
    ];
    return {
      r: radius,
      segments,
      total: Math.max(1, segments.reduce((sum, s) => sum + s.length, 0))
    };
  };

  const pointAt = (shape, dist, pt) => {
    let s = wrap(dist, shape.total);
    for (const seg of shape.segments) {
      if (seg.length > 0 && s <= seg.length) {
        if (seg.angle === null) {
          pt.x = seg.x + seg.dx * s;
          pt.y = seg.y + seg.dy * s;
          pt.nx = seg.dy;
          pt.ny = -seg.dx;
        } else {
          const a = seg.angle + s / shape.r;
          pt.nx = Math.cos(a);
          pt.ny = Math.sin(a);
          pt.x = seg.x + pt.nx * shape.r;
          pt.y = seg.y + pt.ny * shape.r;
        }
        return pt;
      }
      s -= seg.length;
    }
    return pt;
  };

  function initStarBorder(el) {
    if (el.dataset.starBorderInit) return;
    el.dataset.starBorderInit = 'true';

    el.classList.add('star-border');
    let canvas = el.querySelector('.star-border__light');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'star-border__light';
      canvas.setAttribute('aria-hidden', 'true');
      el.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const color = el.dataset.starColor || '#B9A7FF';
    const trailColor = el.dataset.starTrail || '#9580F5';
    const headRgb = toRgb(color);
    const tailRgb = toRgb(trailColor);

    const s = {
      color,
      trailColor,
      duration: 3.5,
      thickness: 1.5,
      radius: 9999, // Pill shape
      trailLength: 0.35,
      stars: 1,
      glow: 0.8,
      direction: 1
    };

    let width = el.offsetWidth;
    let height = el.offsetHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = el.offsetWidth;
      height = el.offsetHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round((width + BLEED * 2) * dpr));
      canvas.height = Math.max(1, Math.round((height + BLEED * 2) * dpr));
    };

    let phase = 0;
    let motion = 1;
    let last = performance.now();
    const pt = { x: 0, y: 0, nx: 0, ny: -1 };

    const stroke = (x1, y1, x2, y2, w, style) => {
      ctx.lineWidth = w;
      ctx.strokeStyle = style;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const drawTrail = (shape, head, len, sign, intensity) => {
      if (len < 0.5 || intensity <= 0) return;
      const steps = clamp(Math.ceil(len / 2), 2, 75);
      pointAt(shape, head, pt);
      let px = pt.x;
      let py = pt.y;
      for (let i = 1; i <= steps; i++) {
        pointAt(shape, head - sign * len * (i / steps), pt);
        const u = 1 - (i - 0.5) / steps;
        const fade = u * u * intensity;
        const tone = mix(tailRgb, headRgb, u);
        stroke(px, py, pt.x, pt.y, 2 + 6 * s.glow, rgba(tone, fade * 0.25 * s.glow));
        stroke(px, py, pt.x, pt.y, s.thickness, rgba(tone, fade));
        px = pt.x;
        py = pt.y;
      }
    };

    const draw = (shape, head) => {
      pointAt(shape, head, pt);
      const glowR = 12 * s.glow;
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowR);
      g.addColorStop(0, rgba(headRgb, 0.7));
      g.addColorStop(0.5, rgba(headRgb, 0.2));
      g.addColorStop(1, rgba(headRgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, glowR, 0, TAU);
      ctx.fill();

      ctx.fillStyle = rgba(WHITE, 0.95);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.8, 0, TAU);
      ctx.fill();
    };

    const render = (now) => {
      if (document.hidden) {
        requestAnimationFrame(render);
        return;
      }
      if (window.__DOCEXPO_INTRO_ACTIVE__) {
        last = now;
        requestAnimationFrame(render);
        return;
      }
      const dt = (now - last) / 1000;
      last = now;

      phase = wrap(phase + (dt / s.duration) * s.direction, 1);

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.translate(BLEED, BLEED);

      const shape = outline(
        Math.max(1, width - s.thickness),
        Math.max(1, height - s.thickness),
        s.radius
      );

      const head = phase * shape.total;
      const len = s.trailLength * shape.total;

      drawTrail(shape, head, len, s.direction, 1);
      draw(shape, head);

      ctx.restore();
      requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize, { passive: true });

    window.addEventListener('docexpo:intro-dismissed', () => {
      resize();
      last = performance.now();
      requestAnimationFrame(render);
    });

    resize();
    requestAnimationFrame(render);
  }

  window.initStarBorders = function() {
    document.querySelectorAll('.btn-star-border, .star-border-btn').forEach(initStarBorder);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initStarBorders);
  } else {
    window.initStarBorders();
  }
})();
