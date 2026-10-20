/**
 * MoltenMetal — Interactive Liquid Metal WebGL 2 Background
 * Adapted directly from ReactBits (https://reactbits.dev/backgrounds/molten-metal?colors=19152b,FF9FFC)
 */
(function() {
  const MAX_COLORS = 6;
  const TRAIL = 16;
  const MAX_FLARES = 8;
  const SAMPLE_SECONDS = 0.06;
  const TRAIL_SECONDS = 0.9;
  const FLARE_SECONDS = 1.8;
  const INTRO_SECONDS = 2.4;
  const FLOW_START = 0.4;
  const BALANCE = { molten: 0.5, ember: 0.3, frost: 0.7 };

  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uClock;
uniform float uScale;
uniform float uDetail;
uniform float uGlow;
uniform float uThickness;
uniform float uSwirl;
uniform float uFold;
uniform float uBlackPoint;
uniform float uBrightness;
uniform float uBalance;
uniform float uGrain;
uniform float uOpacity;
uniform vec2 uOffset;
uniform vec2 uRotation;
uniform vec2 uDrift;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform vec3 uBackground;
uniform float uOpaque;
uniform float uLight;
uniform vec3 uReveal;
uniform vec4 uTrail[${TRAIL}];
uniform float uTrailWeight[${TRAIL}];
uniform int uTrailCount;
uniform vec4 uFlares[${MAX_FLARES}];
uniform int uFlareCount;
uniform vec4 uHeat;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 palette(float g) {
  if (uColorCount <= 1) return uColors[0];
  float t = g < uBalance ? 0.5 * g / uBalance : 0.5 + 0.5 * (g - uBalance) / (1.0 - uBalance);
  float scaled = t * float(uColorCount - 1);
  int index = int(min(floor(scaled), float(uColorCount - 2)));
  return mix(uColors[index], uColors[index + 1], smoothstep(0.0, 1.0, scaled - float(index)));
}

float warmth(float age, float weight, vec2 offset) {
  float life = clamp(age / ${TRAIL_SECONDS.toFixed(2)}, 0.0, 1.0);
  vec2 spread = offset / (uHeat.z * (1.0 + 0.8 * life));
  return weight * (1.0 - life) * (1.0 - life) * exp(-dot(spread, spread));
}

float trailHeat(vec2 q) {
  float heat = 0.0;
  for (int k = 0; k < ${TRAIL}; k++) {
    if (k >= uTrailCount) break;
    vec4 a = uTrail[k];
    float weight = uTrailWeight[k];
    heat = max(heat, warmth(a.z, weight, q - a.xy));
    int next = min(k + 1, ${TRAIL - 1});
    if (next == k || next >= uTrailCount) continue;
    vec4 b = uTrail[next];
    float older = uTrailWeight[next];
    vec2 ab = b.xy - a.xy;
    float span = dot(ab, ab);
    float t = span > 1e-10 ? clamp(dot(q - a.xy, ab) / span, 0.0, 1.0) : 0.0;
    float even = smoothstep(0.0, uHeat.z, sqrt(span));
    float age = mix(min(a.w, b.z), mix(a.w, b.z, t), even);
    float strength = mix(max(weight, older), mix(weight, older, t), even);
    heat = max(heat, warmth(age, strength, q - a.xy - ab * t));
  }
  return heat;
}

float flareHeat(vec2 q) {
  float heat = 0.0;
  for (int k = 0; k < ${MAX_FLARES}; k++) {
    if (k >= uFlareCount) break;
    vec4 f = uFlares[k];
    float life = clamp(f.z / ${FLARE_SECONDS.toFixed(2)}, 0.0, 1.0);
    float rise = 1.0 - exp(-f.z / 0.07);
    float fall = exp(-3.0 * life) * (1.0 - life) * (1.0 - life);
    vec2 offset = (q - f.xy) / (uHeat.z * (0.9 + 1.6 * sqrt(life)));
    heat += rise * fall * exp(-dot(offset, offset));
  }
  return heat;
}

void main() {
  float time = uTime;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  vec2 q = uv - uOffset;
  vec2 view = vec2(q.x * uRotation.x - q.y * uRotation.y, q.x * uRotation.y + q.y * uRotation.x);
  vec2 p = uScale * view - 0.5;
  p += uDrift;

  float heat = 0.0;
  float flare = 0.0;
  if (uHeat.w > 0.5) {
    heat = trailHeat(uv) * uHeat.x;
    flare = flareHeat(uv) * uHeat.y;
  }
  float power = uThickness * (1.0 + (heat + flare) * 0.45);

  vec2 i = p;
  float c = 0.0;
  float blurred = 0.0;
  float r = length(p + vec2(sin(time), sin(time * 0.3 + 5.0)) * 0.5);
  float d = length(p);
  float rot = d + time + p.x * uSwirl;
  float cosRot = cos(rot);
  mat2 warp = mat2(cos(rot - sin(time / 5.0)), sin(rot), -sin(cosRot - time), cosRot) * uFold;
  float layers = ceil(uDetail);

  for (float n = 0.0; n < 8.0; n++) {
    if (n >= layers) break;
    p *= warp;
    float t = r - time / (n + 3.0);
    i -= p + vec2(cos(t - i.x - r) + sin(t + i.y), sin(t - i.y) + cos(t + i.x) + r);
    float l = length(vec2(sin(i.x + t), cos(i.y + t)));
    float footprint = 0.5 * length(vec2(dFdx(l), dFdy(l)));
    l = sqrt(l * l + footprint * footprint);
    float weight = clamp(uDetail - n, 0.0, 1.0);
    c += weight * uGlow / (power == 1.0 ? l : pow(max(l, 1e-6), power));
    if (uReveal.y > 0.5) blurred += weight * uGlow / sqrt(l * l + 0.0025);
  }

  c /= 6.0;
  c *= 1.0 + heat * 0.25 + flare * 0.6;

  float reveal = 1.0;
  float front = 0.0;
  if (uReveal.y > 0.5) {
    float level = log(max(blurred / 6.0, 1e-5)) - uReveal.x;
    reveal = smoothstep(-1.0, 1.0, level) * smoothstep(0.0, 0.08, uReveal.z);
    front = 0.2 * exp(-level * level * 1.5) * smoothstep(-2.6, -0.6, uReveal.x);
  }

  float g = clamp(max(c - uBlackPoint, 0.0) * uBrightness + front, 0.0, 1.0);
  vec3 col = palette(g);
  float noise = hash(gl_FragCoord.xy + fract(uClock) * 97.0) - 0.5;
  float a;
  if (uLight < 0.5) {
    a = g + noise * uGrain;
  } else {
    float lift = max(g - 0.03, 0.0) / 0.97;
    a = (1.0 - exp(-6.0 * lift)) / (1.0 - exp(-6.0)) + noise * uGrain * g;
  }
  a = clamp(a + noise / 255.0, 0.0, 1.0) * reveal * uOpacity;

  if (uOpaque > 0.5) {
    outColor = vec4(mix(uBackground, col, a), 1.0);
  } else {
    outColor = vec4(col * a, a);
  }
}`;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const parseColor = (value, fallback) => {
    if (value === 'transparent') return null;
    const text = String(value || '').trim();
    const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex) {
      const full = hex[1].length === 3 ? hex[1].replace(/./g, digit => digit + digit) : hex[1];
      return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255);
    }
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
    if (rgb) return [rgb[1], rgb[2], rgb[3]].map(channel => clamp(parseFloat(channel) / 255, 0, 1));
    return fallback;
  };

  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  function initMoltenMetal() {
    const container = document.getElementById('molten-metal-container');
    const canvas = document.getElementById('molten-metal-canvas');
    if (!container || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    const names = [
      'uResolution', 'uTime', 'uClock', 'uScale', 'uDetail', 'uGlow',
      'uThickness', 'uSwirl', 'uFold', 'uBlackPoint', 'uBrightness', 'uBalance',
      'uGrain', 'uOpacity', 'uOffset', 'uRotation', 'uDrift', 'uColors',
      'uColorCount', 'uBackground', 'uOpaque', 'uLight', 'uReveal', 'uTrail',
      'uTrailWeight', 'uTrailCount', 'uFlares', 'uFlareCount', 'uHeat'
    ];
    const u = {};
    names.forEach(name => { u[name] = gl.getUniformLocation(program, name); });

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    // EXACT colors=19152b,FF9FFC
    const colors = ['#19152b', '#FF9FFC', '#FFFFFF'];
    const palette = colors.map(c => parseColor(c, [1, 1, 1]));

    const s = {
      palette,
      paper: [0, 0, 0],
      lightMode: false,
      speed: 0.35,
      scale: 4,
      detail: 3,
      glow: 1.6,
      thickness: 1,
      swirl: 1,
      fold: -0.2,
      blackPoint: 0.2 * (1 - 0.75),
      brightness: 1.3,
      balance: 0.5,
      rotation: 0,
      offset: [0, 0],
      drift: 0.3,
      grain: 0.05,
      opacity: 1,
      intro: true,
      mouseInteraction: true,
      mouseStrength: 0.5,
      flareOnClick: true,
      dpr: 2
    };

    const colorData = new Float32Array(MAX_COLORS * 3);
    const trailData = new Float32Array(TRAIL * 4);
    const weightData = new Float32Array(TRAIL);
    const flareData = new Float32Array(MAX_FLARES * 4);

    const state = {
      width: 1,
      height: 1,
      time: FLOW_START,
      clock: 0,
      last: 0,
      introAt: 0,
      pointer: [0.5, 0.5],
      inside: false,
      presence: 0,
      drift: [0, 0],
      trail: [],
      flares: []
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, s.dpr);
      const width = Math.max(1, Math.round(container.clientWidth * ratio));
      const height = Math.max(1, Math.round(container.clientHeight * ratio));
      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
    };

    const toView = point => [(point[0] - 0.5) * (state.width / Math.max(state.height, 1)), 0.5 - point[1]];

    const render = (now) => {
      if (document.hidden) {
        requestAnimationFrame(render);
        return;
      }
      if (window.__DOCEXPO_INTRO_ACTIVE__) {
        state.last = now;
        requestAnimationFrame(render);
        return;
      }
      const dt = state.last ? clamp((now - state.last) / 1000, 0.001, 0.05) : 1 / 60;
      state.last = now;
      state.clock += dt;
      state.time += dt * s.speed;

      const aspect = state.width / Math.max(state.height, 1);
      gl.viewport(0, 0, state.width, state.height);
      gl.uniform2f(u.uResolution, state.width, state.height);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform1f(u.uClock, state.clock);
      gl.uniform1f(u.uScale, s.scale);
      gl.uniform1f(u.uDetail, s.detail);
      gl.uniform1f(u.uGlow, s.glow * 0.1);
      gl.uniform1f(u.uThickness, s.thickness);
      gl.uniform1f(u.uSwirl, s.swirl);
      gl.uniform1f(u.uFold, s.fold);
      gl.uniform1f(u.uBlackPoint, s.blackPoint);
      gl.uniform1f(u.uBrightness, s.brightness);
      gl.uniform1f(u.uBalance, s.balance);
      gl.uniform1f(u.uGrain, s.grain);
      gl.uniform1f(u.uOpacity, s.opacity);
      gl.uniform2f(u.uOffset, s.offset[0] * aspect, -s.offset[1]);
      gl.uniform2f(u.uRotation, Math.cos(s.rotation), Math.sin(s.rotation));
      gl.uniform2f(u.uDrift, 0, 0);

      colorData.fill(0);
      s.palette.forEach((rgb, idx) => colorData.set(rgb, idx * 3));
      gl.uniform3fv(u.uColors, colorData);
      gl.uniform1i(u.uColorCount, s.palette.length);

      gl.uniform3f(u.uBackground, 0, 0, 0);
      gl.uniform1f(u.uOpaque, 1);
      gl.uniform1f(u.uLight, 0);
      gl.uniform3f(u.uReveal, 0, 0, 1);

      trailData.fill(0);
      weightData.fill(0);
      gl.uniform4fv(u.uTrail, trailData);
      gl.uniform1fv(u.uTrailWeight, weightData);
      gl.uniform1i(u.uTrailCount, 0);

      flareData.fill(0);
      gl.uniform4fv(u.uFlares, flareData);
      gl.uniform1i(u.uFlareCount, 0);

      gl.uniform4f(u.uHeat, s.mouseStrength * 2, 3.2, 0.2, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize, { passive: true });

    window.addEventListener('docexpo:intro-dismissed', () => {
      resize();
      state.last = performance.now();
      requestAnimationFrame(render);
    });

    resize();
    requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMoltenMetal);
  } else {
    initMoltenMetal();
  }
})();
