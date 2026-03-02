// minimal WebGL init + DPR clamp + visibility handling
const canvas = document.getElementById('bg');

// try WebGL2, otherwise fallback to WebGL1
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
if(!gl){
  // nothing we can do — keep canvas blank
  console.warn('WebGL not available');
} else {
  
  // -----------------------------------------------------
  // ---------- SETUP MESH AND SHADERS ----------  
  // -----------------------------------------------------

  // full‑screen triangle (covers viewport)
  const vertices = new Float32Array([
    -1, -1,
     3, -1,
    -1,  3,
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // Vertex shader
  const vsSource = `#version 100
    attribute vec2 aPos;
    void main() {
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  // Fragment shader – exactly your idea
  const fsSource = `#version 100
    precision highp float;
    uniform sampler2D uNoise;
    uniform vec2 iResolution;
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.x;
      vec3 r = texture2D(uNoise, gl_FragCoord.xy / vec2(512.)).rgb;
      gl_FragColor = vec4(vec3(r.x)*0.2, 1.0);
    }`;

  function compileShader(src, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
  }
  // Set up attributes
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Set a placeholder pixel while image loads
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([128, 128, 128, 255]));

  const image = new Image();
  image.src = 'assets/blue-noise.png';
  // image.src = 'legacy/VideosAndImages/pathtrace.png';
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // flip Y coordinate so image isn't upside down
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Start rendering now that texture is ready
    if (running) startLoop();
  };
  image.onerror = () => console.warn('Blue noise texture failed to load');
  
  // -----------------------------------------------------
  // ---------- RESIZE & DPR -----------------------------
  // -----------------------------------------------------
  let needResize = true;
  let canvasWidth = 0, canvasHeight = 0;

    // TODO FIX RESIZE WAS MAKING SCREEN FLICKER BLACK
  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvasWidth = Math.floor(window.innerWidth * dpr);
    canvasHeight = Math.floor(window.innerHeight * dpr);
  }
  window.addEventListener('resize', () => { resize(); needResize = true; }, { passive: true });
  resize();

  // -----------------------------------------------------
  // ---------- LOOP -----------------------------
  // -----------------------------------------------------

  let loopActive = false;
  let running = true;
  let lastFrameTime = 0;
  const frameInterval = 1000 / 30; // ~33.3(3)ms

  function startLoop() {
    if (!loopActive && running) {
      loopActive = true;
      requestAnimationFrame(loop);
    }
  }

  function loop(now){
    if (!running) {
      loopActive = false;
      return;
    }

    // FPS throttle
    if (now - lastFrameTime < frameInterval) {
      requestAnimationFrame(loop);
      return;
    }
    lastFrameTime = now;

    // Deferred resize, apply only at start of frame
    if (needResize) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      needResize = false;
    }

    // clear frame
    gl.clearColor(0, 1, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // bind and draw
    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program, 'iResolution'), canvas.width, canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform1i(gl.getUniformLocation(program, 'uNoise'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3); // full‑screen triangle

    requestAnimationFrame(loop);
  }

  document.addEventListener('app-visibility', (e)=>{
    running = e.detail.visible;
    // if(running) startLoop();
  });

  // // Start only if texture is already loaded, otherwise onload will start it
  // if (image.complete) {
  //   startLoop();
  // }
}