/**
 * ShapeBlurLogo — Animated Chromatic Aberration ShapeBlur Emblem for DocExpo
 * Adapted from ReactBits (https://reactbits.dev/animations/shape-blur)
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
out vec4 fragColor;

const float PI = 3.14159265359;

// Hexagon distance function
float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  
  // Smooth slow rotation
  float angle = uTime * 0.45;
  float c = cos(angle);
  float s = sin(angle);
  mat2 rot = mat2(c, -s, s, c);
  vec2 p = rot * uv;

  // Gentle pulse
  float pulse = 0.32 + 0.03 * sin(uTime * 1.8);
  
  // Chromatic split along radial direction
  float chroma = 0.045;
  vec2 dir = length(p) > 0.001 ? normalize(p) : vec2(0.0, 1.0);
  
  float dR = sdHexagon(p - dir * chroma, pulse);
  float dG = sdHexagon(p, pulse);
  float dB = sdHexagon(p + dir * chroma, pulse);

  // Soft Gaussian-like blur falloff
  float blurEdge = 0.14;
  float aR = smoothstep(blurEdge, -blurEdge, dR);
  float aG = smoothstep(blurEdge, -blurEdge, dG);
  float aB = smoothstep(blurEdge, -blurEdge, dB);

  // Luminous chromatic colors: Red-Orange / Vibrant Violet / Deep Cyan-Blue
  vec3 col = vec3(0.0);
  col += vec3(1.0, 0.35, 0.85) * aR * 0.85;
  col += vec3(0.65, 0.45, 1.0) * aG * 0.95;
  col += vec3(0.4, 0.8, 1.0) * aB * 0.85;

  // High intensity inner glow core
  float innerGlow = exp(-max(dG, 0.0) * 18.0) * 0.6;
  col += vec3(0.9, 0.85, 1.0) * innerGlow;

  float totalAlpha = max(max(aR, aG), aB) * 0.95 + innerGlow;
  fragColor = vec4(col, clamp(totalAlpha, 0.0, 1.0));
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  function initShapeBlur() {
    document.querySelectorAll('.shape-blur-logo-canvas').forEach((canvas) => {
      if (canvas.dataset.init) return;
      canvas.dataset.init = 'true';

      const gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: true
      });
      if (!gl) return;

      const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'aPosition');
      gl.linkProgram(prog);

      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, 'uResolution');
      const uTime = gl.getUniformLocation(prog, 'uTime');

      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth || 44;
        const h = canvas.clientHeight || 44;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      window.addEventListener('resize', resize, { passive: true });
      resize();

      let time = 0;
      let last = performance.now();

      function render(now) {
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
        time += dt;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(prog);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, time);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        requestAnimationFrame(render);
      }

      window.addEventListener('docexpo:intro-dismissed', () => {
        resize();
        last = performance.now();
        requestAnimationFrame(render);
      });

      requestAnimationFrame(render);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShapeBlur);
  } else {
    initShapeBlur();
  }
  window.initShapeBlurLogos = initShapeBlur;
})();
