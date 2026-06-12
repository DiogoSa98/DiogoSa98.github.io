import { WebGLRenderer, Scene, OrthographicCamera, PerspectiveCamera, Vector2 } from 'three';
const THREE = { WebGLRenderer, Scene, OrthographicCamera, PerspectiveCamera };
import { createBackground } from './bgRenderer.js';
import { createLoading } from './loadingRenderer.js';
import { createImage } from './imageRenderer.js';
// import { createBoxRaytracer } from './box-raytracer.js';
import { createBreakerGame } from './game/game-manager.js';

//  explicit url imports cause Vite packing stuff, static asset handling
const meImgUrl = new URL('../assets/me.png', import.meta.url).href;
const meBlurImgUrl = new URL('../assets/me-blur.png', import.meta.url).href;
const cyberloadImgUrl = new URL('../assets/cyberload.png', import.meta.url).href;
const cyberloadBlurImgUrl = new URL('../assets/cyberload-blur.png', import.meta.url).href;
const devilsPurgeImgUrl = new URL('../assets/devilspurge.png', import.meta.url).href;
const devilsPurgeBlurImgUrl = new URL('../assets/devilspurge-blur.png', import.meta.url).href;
const newFantasyImgUrl = new URL('../assets/new-fantasy.png', import.meta.url).href;
const newFantasyBlurImgUrl = new URL('../assets/new-fantasy-blur.png', import.meta.url).href;

// config
const MAX_DPR = 1.5;
const MAX_FPS = 60; // TODO change cap dynamically if targetFps not consistently hit!! DOESNT GO HIGHER THAN MONITOR REFRESH RATE, which is fine for me
const TARGET_FRAME_MS = 1000 / MAX_FPS;

// get canvas
const canvas = document.getElementById('bg');
if (!canvas) throw new Error('#bg canvas not found');

// renderer 
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.autoClear = true;
renderer.setClearColor(0x000000, 0);
renderer.outputEncoding = THREE.sRGBEncoding;

// clamp DPR
function updatePixelRatio() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  renderer.setPixelRatio(dpr);
}
updatePixelRatio();

// ---------------------------
// ------ scene setup  -------
// ---------------------------

const scene = new THREE.Scene();
// TODO use perspective
// const camera = makeOrthoCamera(window.innerWidth, window.innerHeight);
const camera = makePerspectiveCamera(window.innerWidth, window.innerHeight);
// can add bg mesh immediately or wait for bgObject.readyPromise
// const bgObject = createBackground();
// scene.add(bgObject.mesh);
const breakerGame = createBreakerGame(camera, '#raytracer-container');
scene.add(breakerGame.mesh);
const loadingObject = createLoading();
scene.add(loadingObject.mesh);
const profileImage = createImage(camera, 'about', '#profile-pic', meImgUrl, meBlurImgUrl);
scene.add(profileImage.mesh);
const cyberloadVideo = createImage(camera, 'work', '#cyberload-placeholder', cyberloadImgUrl, cyberloadBlurImgUrl, 400, true, 'cyberload-video'); // creating it first puts it behind in z order
const devilsPurgeVideo = createImage(camera, 'work','#devils-purge-placeholder', devilsPurgeImgUrl, devilsPurgeBlurImgUrl, 200, true, 'devils-purge-video');
const newFantasyVideo = createImage(camera, 'work', '#new-fantasy-placeholder', newFantasyImgUrl, newFantasyBlurImgUrl, 0, true, 'new-fantasy-video');
scene.add(cyberloadVideo.mesh);
scene.add(devilsPurgeVideo.mesh);
scene.add(newFantasyVideo.mesh);

let needResize = false;

//////////////////
// SWITCH COLOR PALETTE
//////////////////
const palleteToggle = document.getElementById('palette-toggle');
if (palleteToggle) {
  palleteToggle.addEventListener('click', () => {
    palleteToggle.htmlContent = palleteToggle.textContent === '◐' ? '◑' : '◐';
    console.log('toggle pallete');
    const isLight = document.body.classList.toggle('light');
    if (isLight) {
      // bgObject.setUniform('uBgMultiplier', 1.);
      loadingObject.setUniform('uLoadingColor', 0.);
    } else {
      // bgObject.setUniform('uBgMultiplier', 0.08);
      loadingObject.setUniform('uLoadingColor', 1.);
    }
  });
}


// initial resize
function onResize(isFirstResize = false) {
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  renderer.setPixelRatio();
  renderer.setSize(cssW, cssH, false); // use CSS size, DPR handled via setPixelRatio
  // update camera extents to match CSS pixels (optional; full-screen triangle doesn't require it,
  // but other scene items might)
  // camera.left = 0;
  // camera.right = cssW;
  // camera.top = cssH;
  // camera.bottom = 0;
  // camera.updateProjectionMatrix();
  camera.aspect = cssW / cssH;
  camera.updateProjectionMatrix();

  // inform background about new resolution (background handles uResolution update)
  // bgObject.onResize(cssW, cssH);
  profileImage.onResize(cssW, cssH);
  newFantasyVideo.onResize(cssW, cssH);
  devilsPurgeVideo.onResize(cssW, cssH);
  cyberloadVideo.onResize(cssW, cssH);

  // if (!isFirstResize) breakerGame.onResize(cssW * dpr, cssH * dpr);
  breakerGame.onResize(cssW * dpr, cssH * dpr);
}
window.addEventListener('resize', () => {needResize = true}, { passive: true });
onResize(true);


// mouse position tracking
  // const mousePosWorld = new Vector3();
  const mousePosScreen = new Vector2();
  document.addEventListener('mousemove', function(event) {
    // mousePosWorld.copy(screenToWorld(renderWidth, renderHeight, event.clientX, event.clientY));
    // mousePosWorld.z = 10;
    mousePosScreen.set(event.clientX, event.clientY);
    // console.log(`Mouse position: x=${event.clientX}, y=${event.clientY} mesh pos: ${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z}`);
  });

// -------------------------
// ------ main loop  -------
// -------------------------

document.addEventListener('visibilitychange', ()=> {
  running = document.visibilityState === 'visible';
  if (running && raf == null) raf = requestAnimationFrame(loop);
});

let running = true;
let raf = null;
let lastFrameTime = 0;
let deltaTime = 0;
let fpsFrames = 0;
let fpsLastSample = 0;
let lastFrameRenderTime = 0;

function loop(t) { // t is timestamp in milliseconds of the previous frame rendered
  if (!running) 
  {
    raf = null;
    return;
  }

  // always request a new frame
  raf = requestAnimationFrame(loop);

  const elapsedTime = t - lastFrameTime; 

  if (elapsedTime < TARGET_FRAME_MS) {
    return; // skip this frame, not enough time has passed
  }

  // not really a fan of this setup but oh well
  deltaTime = (t - lastFrameRenderTime) * 0.001; // deltaTime in seconds
      // console.log(`${deltaTime.toFixed(3)}s`);
  deltaTime = Math.min(deltaTime, 0.05); // cap just to be safe
  
  lastFrameTime = t - (elapsedTime % TARGET_FRAME_MS); // adjust lastFrameTime to account for any extra time elapsed beyond the target frame time
  lastFrameRenderTime = t;

  const time = t * 0.001; // total time since start in seconds

  fpsFrames++;
  if (t - fpsLastSample >= 1000) {
    const fps = fpsFrames * 1000 / (t - fpsLastSample);
    // console.log(`FPS: ${fps.toFixed(1)} ${fpsFrames} ${deltaTime.toFixed(3)}s ${(1/deltaTime).toFixed(1)}fps`);
    fpsFrames = 0;
    fpsLastSample = t;
  }

  // resize
  if (needResize) {
    onResize();
    needResize = false;
  }

  // update background uniforms
  // bgObject.update(time);
  loadingObject.update(deltaTime);
  profileImage.update(deltaTime, mousePosScreen);
  breakerGame.update(deltaTime);
  newFantasyVideo.update(deltaTime, mousePosScreen);
  devilsPurgeVideo.update(deltaTime, mousePosScreen);
    cyberloadVideo.update(deltaTime, mousePosScreen);
  // render scene (bg mesh will render because it's in the scene)
  renderer.render(scene, camera);
}
raf = requestAnimationFrame(loop);


// -----------------------
// ------ helpers --------
// -----------------------

// camera (orthographic so CSS pixels map straightforwardly)
function makeOrthoCamera(w, h) {
  // left, right, top, bottom in "pixel" units
  // Note: we'll position meshes using pixel coordinates (center)
  const left = 0;
  const right = w;
  const top = 0;
  const bottom = h;
  const cam = new THREE.OrthographicCamera(left, right, top, bottom, -1000, 1000);
  return cam;
}
function makePerspectiveCamera(w, h) {
    const fov = 60;                  
    const aspect = w / h;             // CSS width/height ratio
    const near = 0.1;
    const far  = 100;
    const cam = new THREE.PerspectiveCamera(fov, aspect, near, far);
    cam.position.set(0, 0, 10);       // back a little on +z
    cam.lookAt(0, 0, 0);
    return cam;
}

// // TODO WAIT FOR EVERYTHING IN LOADING SCREEN BEFORE RUNNING
// // Example: if you want to check readiness externally
// bgObject.readyPromise.then((ok) => {
//   console.log('background ready:', ok);
//   // e.g. only then add other objects or enable UI toggles; but main controls that, not bgRenderer
// });

// Expose for debugging
// window.__BG = bgObject;
window.__APP = { renderer, scene, camera };