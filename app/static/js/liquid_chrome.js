/**
 * LiquidChrome — Fluid Metallic Surface WebGL 2 Background
 * Adapted from ReactBits (https://reactbits.dev/backgrounds/liquid-chrome?color=251414)
 * Dark, cinematic, silky organic chrome ripples over pure deep black.
 */
(function() {
  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uTint; // #251414
out vec4 fragColor;

// ACES Tone Mapping
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  vec2 p = uv * 3.2;

  // Ultra-silky slow organic motion
  float t = uTime * 0.18;

  for (float i = 1.0; i < 5.0; i++) {
    float a = 0.42 / i;
    p.x += a * cos(i * 1.8 * p.y + t + i * 1.4);
    p.y += a * sin(i * 1.8 * p.x + t + i * 1.2);
  }

  // Wave slope normal
  float phase = t * 0.8 - p.x - p.y;
  float sn = sin(phase);
  float cs = cos(phase);
  
  vec2 slope = vec2(cs * 0.35, -sn * 0.35);
  vec3 n = normalize(vec3(-slope, 1.0));
  vec3 view = normalize(vec3(uv * 0.1, -1.0));
  vec3 r = reflect(view, n);

  // Deep dark studio environment (subtle metallic rims, NO blown out white)
  float radius = length(r.xy);
  float rim = exp(-abs(radius - 0.85) * 6.0) * 0.45;
  float lobe = smoothstep(-0.4, 0.8, r.y) * 0.35;
  
  // Base dark metal tone
  vec3 darkBase = vec3(0.015, 0.008, 0.008);
  vec3 tintColor = uTint * 1.6;
  
  vec3 col = mix(darkBase, tintColor, smoothstep(0.2, 0.9, radius));
  col += vec3(0.85, 0.75, 0.7) * rim * 0.35;
  col += tintColor * lobe;

  // Smooth gamma and contrast curve
  col = pow(aces(col * 1.2), vec3(1.0 / 2.2));
  
  // Dithering grain
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.015;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }

  function initLiquidChrome() {
    const canvas = document.getElementById('liquid-chrome-canvas');
    const container = document.getElementById('liquid-chrome-container');
    if (!canvas || !container) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance'
    });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPosition');
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uResolution');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uTint = gl.getUniformLocation(prog, 'uTint');

    // color=251414
    const tintRgb = hexToRgb('251414');

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };

    let time = 0;
    let last = performance.now();

    const render = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      time += dt;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform3fv(uTint, tintRgb);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize, { passive: true });
    resize();
    requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLiquidChrome);
  } else {
    initLiquidChrome();
  }
})();
