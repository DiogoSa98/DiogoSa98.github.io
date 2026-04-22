import { WebGLRenderer, Scene, OrthographicCamera, PerspectiveCamera, Vector2 } from 'three';
const THREE = { WebGLRenderer, Scene, OrthographicCamera, PerspectiveCamera };
import { createBackground } from './bgRenderer.js';
import { createLoading } from './loadingRenderer.js';
import { createImage } from './imageRenderer.js';
import { createBoxRaytracer } from './box-raytracer.js';

// config
const MAX_DPR = 1.5;
const FPS = 60;

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
const bgObject = createBackground();
scene.add(bgObject.mesh);
const loadingObject = createLoading();
scene.add(loadingObject.mesh);
const profileImage = createImage(camera, 'about', '#profile-pic', './assets/me.png');
scene.add(profileImage.mesh);
const raytracerObject = createBoxRaytracer();
scene.add(raytracerObject.mesh);
const devilsPurgeVideo = createImage(camera, 'work','#devils-purge-placeholder', './assets/videos/DevilsPurge_trailer.mp4', true, 'devils-purge-video');
const newFantasyVideo = createImage(camera, 'work', '#new-fantasy-placeholder', './assets/videos/NewFantasy_trailer.mp4', true, 'new-fantasy-video');
scene.add(devilsPurgeVideo.mesh);
scene.add(newFantasyVideo.mesh);

let needResize = false;

//////////////////
// SWITCH COLOR PALETTE
//////////////////
const palleteToggle = document.getElementById('palette-toggle');
palleteToggle.addEventListener('click', () => {
  palleteToggle.htmlContent = palleteToggle.textContent === '◐' ? '◑' : '◐';
  console.log('toggle pallete');
  const isLight = document.body.classList.toggle('light');
  if (isLight) {
    bgObject.setUniform('uBgMultiplier', 1.);
    loadingObject.setUniform('uLoadingColor', 0.);
  } else {
    bgObject.setUniform('uBgMultiplier', 0.08);
    loadingObject.setUniform('uLoadingColor', 1.);
  }
});

// initial resize
function onResize() {
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
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
  bgObject.onResize(cssW, cssH);
  profileImage.onResize(cssW, cssH);
  newFantasyVideo.onResize(cssW, cssH);
  devilsPurgeVideo.onResize(cssW, cssH);
}
window.addEventListener('resize', () => {needResize = true}, { passive: true });
onResize();


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

let raf = null;
let running = true;
let lastFrameTime = 0;
const frameInterval = 1000 / FPS;
let deltaTime = 0;

function loop(t) {
  if (!running) return;

  // FPS throttle
  if (t - lastFrameTime < frameInterval) {
    raf = requestAnimationFrame(loop);
    return;
  }
  deltaTime = (t - lastFrameTime) * 0.001;
  lastFrameTime = t;

  // resize
  if (needResize) {
    onResize();
    needResize = false;
  }

  raf = requestAnimationFrame(loop);

  const time = t * 0.001;

  // update background uniforms
  bgObject.update(time);
  loadingObject.update(deltaTime);
  profileImage.update(deltaTime, mousePosScreen);
  raytracerObject.update(deltaTime);
  newFantasyVideo.update(deltaTime, mousePosScreen);
  devilsPurgeVideo.update(deltaTime, mousePosScreen);
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
    const far  = 1000;
    const cam = new THREE.PerspectiveCamera(fov, aspect, near, far);
    cam.position.set(0, 0, 10);       // back a little on +z
    cam.lookAt(0, 0, 0);
    return cam;
}

// TODO WAIT FOR EVERYTHING IN LOADING SCREEN BEFORE RUNNING
// Example: if you want to check readiness externally
bgObject.readyPromise.then((ok) => {
  console.log('background ready:', ok);
  // e.g. only then add other objects or enable UI toggles; but main controls that, not bgRenderer
});

// Expose for debugging
window.__BG = bgObject;
window.__APP = { renderer, scene, camera };