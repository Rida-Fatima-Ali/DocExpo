/**
 * Light Tunnel — Interactive WebGL 2 Canvas Background
 * Scoped strictly to the Hero section
 */

(function () {
  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uScale;
uniform float uRatio;
uniform float uTime;
uniform float uDrift;
uniform vec2 uSteer;
uniform float uBend;
uniform float uCount;
uniform float uSwing;
uniform float uWave;
uniform float uWidth;
uniform float uPulseWidth;
uniform float uHead;
uniform float uTail;
uniform float uChance;
uniform float uSpacing;
uniform float uPulseSpeed;
uniform float uFlow;
uniform float uHalo;
uniform float uGlow;
uniform float uBrightness;
uniform float uVariance;
uniform float uBody;
uniform float uFadeNear;
uniform float uFadeFar;
uniform vec3 uCable;
uniform vec3 uPulse;
uniform vec3 uTunnel;
uniform vec3 uSurge;
uniform float uReveal;
uniform float uGrain;
uniform float uSeed;
uniform float uLight;
uniform float uOpacity;
out vec4 outColor;

const float TAU = 6.2831853;

vec3 inkOf(vec3 color, float depthOfInk) {
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float peak = max(color.r, max(color.g, color.b));
  float chroma = (peak - min(color.r, min(color.g, color.b))) / max(peak, 0.001);
  return color * min(1.0, mix(depthOfInk, depthOfInk * 1.7, chroma) / max(luma, 0.001));
}

float hash(float n) {
  return fract(sin(n * 127.1 + uSeed * 311.7) * 43758.5453);
}

vec2 bendAt(float depth) {
  float reach = 1.0 - exp(-max(depth, 0.0) * 0.55);
  vec2 wobble = vec2(sin(uDrift * 0.37 + depth * 0.31), cos(uDrift * 0.29 + depth * 0.23)) * uBend;
  return (wobble + uSteer) * reach;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution - uCenter) / uScale;
  float depth = -log(max(length(p), 1e-5));
  vec2 q = p;
  for (int i = 0; i < 4; i++) {
    q = p - bendAt(depth);
    depth = -log(max(length(q), 1e-5));
  }
  float r = length(q);
  float px = r * uScale;
  float turn = atan(q.y, q.x) / TAU;
  float s = turn - uSwing - uWave * sin(depth * 1.2 + uDrift * 0.5);
  float cell = floor(s * uCount);
  float spacing = TAU * px / uCount;
  float near = smoothstep(0.55, 1.25, r);
  float width = uWidth * (1.0 + near * 1.2);
  float soft = uRatio * (0.55 + near * 0.9);
  float tight = uRatio * uHalo * (1.0 + near);
  float wide = tight * 4.5;

  float lines = 0.0;
  float body = 0.0;
  vec3 glow = vec3(0.0);
  float strokes = 0.0;
  for (int k = -3; k <= 3; k++) {
    float i = cell + float(k);
    float id = mod(i, uCount);
    float h1 = hash(id);
    float h2 = hash(id + 17.0);
    float h3 = hash(id + 41.0);
    float h4 = hash(id + 73.0);
    float center = (i + 0.5 + (h1 - 0.5) * 0.55) / uCount;
    center += 0.12 * sin(depth * (0.8 + h2 * 0.9) + uDrift * (0.4 + h3 * 0.5) + h4 * TAU) / uCount;
    float d = abs(s - center) * TAU * px;
    float shade = 1.0 + uVariance * (h3 - 0.5) * 0.9;
    float reach = smoothstep(spacing * 2.4, spacing * 1.4, d);

    lines += smoothstep(width + soft, width - soft, d) * shade;
    body += exp(-d / max(spacing * 0.22, 0.001)) * shade * reach;

    float x = depth * uSpacing + uTime * uPulseSpeed * (0.55 + h2 * 0.6) * uFlow + h4 * 7.0;
    float lead = (fract(x) - 0.5) / uSpacing * uFlow;
    float lit = step(hash(id * 3.7 + floor(x) * 13.1), uChance);
    float limit = 0.5 / uSpacing;
    float head = exp(-pow(max(-lead, 0.0) / uHead, 2.0)) * smoothstep(-limit, -limit * 0.8, lead);
    float tail = exp(-max(lead, 0.0) / uTail) * smoothstep(limit, limit * 0.55, lead);
    float pulse = (lead < 0.0 ? head : tail) * lit;
    float ring = uSurge.y * exp(-pow((depth - uSurge.x) / uSurge.z, 2.0));
    pulse = max(pulse, ring);
    float hot = pulse * (lead < 0.0 ? 1.0 : exp(-max(lead, 0.0) / (uTail * 0.35)));

    float core = uPulseWidth * width + 0.35 * uRatio;
    float stroke = smoothstep(core + soft, core - soft, d);
    float bloom = (exp(-d / tight) * 0.7 + exp(-d / wide) * 0.18) * uGlow * reach;
    vec3 tint = mix(uPulse, vec3(1.0), hot * 0.55 * (1.0 - uLight));
    glow += tint * pulse * (stroke * 1.5 + bloom) * shade;
    strokes += pulse * stroke * shade;
  }

  float lod = smoothstep(4.0, 1.2, spacing);
  float average = min(2.0 * uWidth / max(spacing, 0.001), 1.0);
  lines = mix(lines, average, lod);
  glow = mix(glow, uPulse * average * 0.6 * uChance, lod);
  strokes = mix(strokes, average * 0.6 * uChance, lod);
  body = mix(body, 1.0, lod) * uBody;

  float rr = r * 0.25;
  float fade = smoothstep(0.0, uFadeNear, rr) * smoothstep(uFadeFar, uFadeFar * 0.55, rr);
  fade *= smoothstep(uReveal - 0.6, uReveal, depth);

  float grain = 1.0;
  if (uGrain > 0.0) {
    grain += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime * 7.0) * 43758.5453) - 0.5) * uGrain * 4.0;
  }

  if (uLight > 0.5) {
    float hairline = clamp(lines * 0.26 + body * 0.2, 0.0, 1.0);
    float stroke = clamp(strokes * 1.6, 0.0, 1.0);
    float haze = clamp(length(glow) * 0.12, 0.0, 0.25);
    float ink = clamp(hairline + stroke + haze, 0.0, 1.0) * fade * uOpacity * grain;
    vec3 tone = mix(inkOf(uCable, 0.3), inkOf(uPulse, 0.16), clamp(stroke + haze * 2.0, 0.0, 1.0));
    tone = mix(tone, inkOf(uTunnel, 0.3), clamp(body * uBody, 0.0, 1.0) * 0.5);
    outColor = vec4(tone * ink, ink);
    return;
  }

  vec3 light = (uCable * lines * 0.12 + uTunnel * body * 0.35 + glow) * uBrightness * fade * grain;
  vec3 mapped = (1.0 - exp(-light * 1.4)) * uOpacity;
  outColor = vec4(mapped, max(mapped.r, max(mapped.g, mapped.b)));
}`;

  const INTRO_SECONDS = 1.8;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  };

  const link = (gl) => {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    return { program, uniforms };
  };

  function initLightTunnel() {
    const canvas = document.getElementById('hero-tunnel-canvas') || document.getElementById('light-tunnel-canvas');
    const container = document.getElementById('hero-tunnel-container') || document.getElementById('light-tunnel-bg');
    if (!canvas || !container) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return;

    const program = link(gl);
    if (!program) return;
    const u = program.uniforms;

    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const cableRgb = [0.42, 0.35, 0.7]; // Vibrant optical fibers
    const pulseRgb = [0.88, 0.8, 1.0]; // Brilliant gleaming comets (#E2DAFF)
    const tunnelRgb = [0.12, 0.08, 0.22];

    const settings = {
      speed: 0.2,
      flow: -1,
      pulseSpeed: 2.4,
      pulseLength: 0.32,
      pulseBlend: 0.6,
      pulseWidth: 1.15,
      pulseDensity: 0.6,
      cableCount: 52,
      thickness: 0.32,
      rimWidth: 0.16,
      waviness: 0.28,
      sway: 0.45,
      bend: 0.4,
      size: 1.05,
      centerX: 0,
      centerY: 0,
      glow: 1.6,
      fadeNear: 0.4,
      fadeFar: 2.2,
      brightness: 1.45,
      colorVariance: true,
      grain: true,
      grainIntensity: 0.04,
      opacity: 0.95,
      mouseStrength: 0.14,
      clickSurge: true,
      intro: true,
      variation: 42,
    };

    const pointer = { x: 0, y: 0, inside: true };
    const steer = { x: 0, y: 0 };
    const surge = { age: 10 };
    let time = 0;
    let drift = 0;
    let reveal = 0;
    let raf = 0;
    let last = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const ratio = width / Math.max(1, container.clientWidth);
      const minSide = Math.min(width, height);
      const flow = settings.flow;
      const span = 3.4;
      const travel = surge.age * 2.6;
      const surgeDepth = flow > 0 ? span - travel : -0.6 + travel;
      const surgeLevel = surge.age < 2.4 ? Math.min(1, surge.age / 0.12) * Math.exp(-surge.age * 1.1) : 0;
      const eased = reveal * reveal * (3 - 2 * reveal);

      gl.viewport(0, 0, width, height);
      gl.useProgram(program.program);
      gl.bindVertexArray(vao);

      gl.uniform2f(u.uResolution, width, height);
      gl.uniform2f(u.uCenter, settings.centerX * minSide, settings.centerY * minSide);
      gl.uniform1f(u.uScale, minSide * 0.5 * settings.size);
      gl.uniform1f(u.uRatio, ratio);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uDrift, drift);
      gl.uniform2f(u.uSteer, steer.x, steer.y);
      gl.uniform1f(u.uBend, settings.bend * 0.45);
      gl.uniform1f(u.uCount, settings.cableCount);
      gl.uniform1f(u.uSwing, (Math.sin(drift * 0.9) * settings.sway * 0.5) / (Math.PI * 2));
      gl.uniform1f(u.uWave, settings.waviness * 0.15);
      gl.uniform1f(u.uWidth, (0.25 + settings.thickness * 1.5) * ratio);
      gl.uniform1f(u.uPulseWidth, 0.6 + settings.pulseWidth * 0.9);

      const length = settings.pulseLength * 1.2;
      gl.uniform1f(u.uHead, length * (0.08 + settings.pulseBlend * 0.22));
      gl.uniform1f(u.uTail, length * (0.5 + settings.pulseBlend * 0.7));
      gl.uniform1f(u.uChance, settings.pulseDensity);
      gl.uniform1f(u.uSpacing, 0.4);
      gl.uniform1f(u.uPulseSpeed, settings.pulseSpeed * 4);
      gl.uniform1f(u.uFlow, flow);
      gl.uniform1f(u.uHalo, 1.2 + settings.rimWidth * 8);
      gl.uniform1f(u.uGlow, settings.glow);
      gl.uniform1f(u.uBrightness, settings.brightness);
      gl.uniform1f(u.uVariance, settings.colorVariance ? 1 : 0);
      gl.uniform1f(u.uBody, 0.15);
      gl.uniform1f(u.uFadeNear, settings.fadeNear);
      gl.uniform1f(u.uFadeFar, settings.fadeFar);

      gl.uniform3fv(u.uCable, cableRgb);
      gl.uniform3fv(u.uPulse, pulseRgb);
      gl.uniform3fv(u.uTunnel, tunnelRgb);

      gl.uniform3f(u.uSurge, surgeDepth, surgeLevel, 0.22);
      gl.uniform1f(u.uReveal, 1.7 - eased * 3.6);
      gl.uniform1f(u.uGrain, settings.grain ? settings.grainIntensity : 0);
      gl.uniform1f(u.uSeed, settings.variation);
      gl.uniform1f(u.uLight, 0);
      gl.uniform1f(u.uOpacity, settings.opacity);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now) => {
      raf = 0;
      if (document.hidden) {
        raf = requestAnimationFrame(frame);
        return;
      }
      if (window.__DOCEXPO_INTRO_ACTIVE__) {
        last = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;

      time += dt * settings.speed;
      drift += dt * (settings.speed + 0.2);
      surge.age += dt;

      if (reveal < 1) {
        reveal = Math.min(1, reveal + dt / INTRO_SECONDS);
      } else {
        reveal = 1;
      }

      const reach = settings.mouseStrength * 2.5;
      const target = [pointer.x * reach, pointer.y * reach];
      const follow = 1 - Math.exp(-dt / 0.6);
      steer.x += (target[0] - steer.x) * follow;
      steer.y += (target[1] - steer.y) * follow;

      render();
      raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      render();
    };

    window.addEventListener('resize', resize, { passive: true });

    window.addEventListener('docexpo:intro-dismissed', () => {
      resize();
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    });

    window.addEventListener('pointermove', (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const scale = Math.min(rect.width, rect.height) * 0.5;
      pointer.x = (x - rect.width / 2) / Math.max(1, scale);
      pointer.y = (rect.height / 2 - y) / Math.max(1, scale);
    }, { passive: true });

    container.addEventListener('pointerdown', () => {
      surge.age = 0;
    }, { passive: true });

    resize();
    raf = requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightTunnel);
  } else {
    initLightTunnel();
  }
})();
