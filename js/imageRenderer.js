import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Mesh,
  Vector2,
  Vector3,
  Vector4,
  MathUtils,
  TextureLoader,
  PlaneGeometry,
  Quaternion,
  Camera,
  Raycaster,
  RepeatWrapping,
} from 'three';

import {Tween, Easing} from '@tweenjs/tween.js'

import vertexSource from '../shaders/image-vert.glsl?raw';
import fragmentSource from '../shaders/image-frag.glsl?raw';

// Fast integer-based hash returning float in [0,1)
function hashInt(ix, iy) {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return n / 4294967296;
}
function noiseVec(p) {
    const ix = Math.floor(p.x) | 0;
    const iy = Math.floor(p.y) | 0;
    const fx = p.x - ix;
    const fy = p.y - iy;
    const a = hashInt(ix, iy);
    const b = hashInt(ix + 1, iy);
    const c = hashInt(ix, iy + 1);
    const d = hashInt(ix + 1, iy + 1);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const ab = a + (b - a) * ux;
    const cd = c + (d - c) * ux;
    return ab + (cd - ab) * uy;
}

function fbmVec(p) {
    let v = 0.0;
    let amp = 0.5;
    let freq = 1.0;
    for (let i = 0; i < 5; i++) {
        const pp = new Vector2(p.x * freq, p.y * freq);
        v += amp * noiseVec(pp);
        freq *= 2.0;
        amp *= 0.5;
    }
    return v;
}

function foldVec(p) {
    // p.x = Math.abs(p.x);
    // p.y = Math.abs(p.y);
    // return;
    const t = 1;
    const cospin = Math.cos(Math.PI / t);
    const scospin = Math.sqrt(1.0 - cospin * cospin);
    const nc = new Vector2(-cospin, scospin);
    for (let i = 0; i < t; i++) {
        p.x = Math.abs(p.x);
        p.y = Math.abs(p.y);
        const dot = p.x * nc.x + p.y * nc.y;
        const m = Math.min(0.0, dot);
        p.x -= 2.0 * m * nc.x;
        // p.y -= 2.0 * m * nc.y;
    }
}

function createFBMNoise(time = 0, offSeed = 0) {
    const xSize = 11;
    const ySize = 11;
    const data = new Float16Array(xSize * ySize);
    const patternScale = 10.0;
    const tmp = new Vector2();
    const offset = new Vector2(offSeed + time, offSeed + time);
    for (let i = 0; i < data.length; i++) {
        const x = (i % xSize) - Math.floor(xSize / 2);
        const y = ((i / xSize) | 0) - Math.floor(ySize / 2);
        tmp.set(x, y).divideScalar(xSize).multiplyScalar(patternScale);
        foldVec(tmp);
        const v = fbmVec(new Vector2(tmp.x + offset.x, tmp.y + offset.y));

        // data[i] = v > 0.5 ? 1 : 0;
        data[i] = v;
        // console.log('i: ' + i + ', v: ' + v);
    }
    return data;
}

export function createImage(cam, panelId, elementId, textureUrl, textureBlurUrl, showDelay = 0, isVideo = false, videoElementId = null) {
    // --- geometry: small quad with UVs ---
    // const geometry = new BufferGeometry();
    // const vertices = new Float32Array([
    //     -0.5, -0.5, 0.0,
    //      0.5, -0.5, 0.0,
    //      0.5,  0.5, 0.0,
    //     -0.5,  0.5, 0.0
    // ]);
    // const uvs = new Float32Array([
    //     0.0, 0.0,
    //     1.0, 0.0,
    //     1.0, 1.0,
    //     0.0, 1.0
    // ]);
    // const indices = new Uint16Array([
    //     0, 1, 2,
    //     0, 2, 3
    // ]);
    // geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    // geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    // geometry.setIndex(new BufferAttribute(indices, 1));
    const geometry = new PlaneGeometry( 1, 1 );
    // --- shader material ---
    const material = new ShaderMaterial({
        vertexShader: vertexSource,
        fragmentShader: fragmentSource,
        uniforms: {
            // uOffset: { value: new Float32Array([0.0, 0.0]) },
            // uScale: { value: new Float32Array([1.0, 1.0]) },
            uNoise: { value: createFBMNoise(0, 20) }, 
            uTexture: { value: null },
            uTexture1: { value: null },
            uLerpT: { value: 0.0 },
            uMouseHoverData: { value: new Vector3(0.,0.,1.) }, // x,y = uvoffset, z = zoom ammount,
            uHash: { value: 0. }
        },
        // side: 2, // double-sided REMOVE ME 
        depthWrite: false,
        depthTest: false,
        transparent: true
    });

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;

    // --- asset loading ---
    let readyPromise;
    const loader = new TextureLoader();
    let ready = false;
    let resolveReady;
    readyPromise = new Promise((resolve) => { resolveReady = resolve; });

    function loadTexture(url, uniformName) {
        return new Promise((resolve, reject) => {
        if (!url) return resolve(null);
        loader.load(
            url,
            tex => {
            tex.wrapS = tex.wrapT = RepeatWrapping;
            tex.needsUpdate = true;
            material.uniforms[uniformName].value = tex;
            resolve(tex);
            },
            undefined,
            reject
        );
        });
    }

    if (isVideo) {
        // // --- video texture setup ---
        // const videoElement = document.getElementById(videoElementId);
        // if (!videoElement) {
        //     console.error(`Video element with id "${videoElementId}" not found.`);
        //     return null;
        // }
        // const texture = new VideoTexture(videoElement);
        // texture.wrapS = texture.wrapT = RepeatWrapping;
        // texture.needsUpdate = true;
        // material.uniforms.uTexture.value = texture;

        Promise.all([
            loadTexture(textureUrl, 'uTexture'),
            loadTexture(textureBlurUrl, 'uTexture1')
        ]).then(() => { ready = true; resolveReady(true); })
            .catch(err => { console.warn(err); ready = true; resolveReady(false); });
    }
    else { 
        Promise.all([
            loadTexture(textureUrl, 'uTexture'),
            loadTexture(textureBlurUrl, 'uTexture1')
        ]).then(() => { ready = true; resolveReady(true); })
            .catch(err => { console.warn(err); ready = true; resolveReady(false); });
    }


    let isHovering = false;
    const elem = document.querySelector(elementId);
    // console.log('elem:', elem); // Debug: check if element is found
    // --- methods ---
    // detect hover on the element
    elem.addEventListener('mouseenter', () => { isHovering = true; if (isVideo) elem.style.cursor = 'pointer'; });
    elem.addEventListener('mouseleave', () => { isHovering = false; if (isVideo) elem.style.cursor = 'default'; });

    function screenToWorld(width, height, x, y, z = 0) {
        // x,y are pixel coords relative to the canvas top‑left
        const ndc = new Vector3(
            (x / width)  * 2 - 1,
            -(y / height) * 2 + 1, 
            z
        );
        ndc.unproject(cam);                
        return ndc;
    }
    let renderWidth;
    let renderHeight;
    // update position and scale on window resize
    function onResize(width, height) {
        renderWidth = width;
        renderHeight = height;

        const r = elem.getBoundingClientRect();


        // this is for orthographic camera
        // // convert to canvas-relative coordinates
        // const px = r.left + r.width * 0.5;
        // let py = r.top + r.height * 0.5;
        
        // mesh.position.set(px, py, 2.);
        // mesh.scale.set(r.width, r.height, 1);

        // console.log('cam pos ', cam.position);
        
        // for perspective camera
        const topLeft = screenToWorld(width, height, r.left, r.top, showDelay*0.001);
        const bottomRight = screenToWorld(width, height, r.right, r.bottom,  showDelay*0.001);
        mesh.position.copy(topLeft.clone().add(bottomRight).multiplyScalar(0.5));
        mesh.scale.set(Math.abs(bottomRight.x - topLeft.x), Math.abs(topLeft.y - bottomRight.y), 1.);
        // console.log('onResize, topLeft: ', topLeft, ' bottomRight: ', bottomRight, ' mesh.position: ', mesh.position, ' mesh.scale: ', mesh.scale);
    }

    let showImage = false;
    let t = { value: 0. };
    const tween = new Tween(t)
        .to({ value: showImage ? 0. : 1. }, 1200)
        .easing(Easing.Quartic.InOut)
        .onUpdate(() => {
            material.uniforms.uLerpT.value = t.value;
            // material.uniforms.uNoise.value = createFBMNoise(t.value, 20);
        });
    function toggleImage(show) {
        // if (show === showImage) return; // no change
        showImage = show;
        if (showImage) {
            tween.start();
        }   
        else {
            tween.stop();
            material.uniforms.uLerpT.value = 0.;
        }
    }
    // window.onkeydown = function(e) {
    //     if (e.key === 'd') {
    //         tween.start();
    //         showImage = !showImage;
    //         console.log('toggled image show to ', showImage);
    //     }
    // };
    // Listen for panel changes to show image
    let showImageTimeout = null;
    document.addEventListener('panelShown', (e) => {
        // meh~
        const canvas = document.getElementById('bg');
        const cssW = canvas.clientWidth || window.innerWidth;
        const cssH = canvas.clientHeight || window.innerHeight;
        onResize(cssW, cssH);
        
        // console.log('panel shown event received:', e.detail);
        // wait delay before showing, reset stuff
        clearTimeout(showImageTimeout); 
        material.uniforms.uLerpT.value = 0.;
        const isGonnaShowImage = panelId === e.detail;
        showImageTimeout = setTimeout(() => {
            toggleImage(isGonnaShowImage);
        }, isGonnaShowImage ? showDelay : 0);
    });

    let prevMouseUV = new Vector2(0., 0.);
    let currentMouseHoverData = new Vector3(0., 0., 1.);
    let totalTime = 0;
    function update(deltaTime, mousePosScreen) {
        if (!showImage) return; // skip if not visible

        totalTime += deltaTime;

        tween.update();

        // -----------------
        // compute mouse uv in elem 
        // send data to shader
        // -----------------
        if (isHovering) {
            const rect = elem.getBoundingClientRect();
            // make it so center is (0,0) bot left is (-0.5,-0.5) top right is (0.5,0.5)
            const uvx = (mousePosScreen.x - rect.left) / rect.width - 0.5;
            const uvy = (mousePosScreen.y - rect.top) / rect.height - 0.5;
            const currentMouseUV = new Vector2(uvx, -1.*uvy);
            if (!prevMouseUV.equals(currentMouseUV)) {  // TODO Optional: only update if UV changed

            }
            
            const offsetDirection = currentMouseUV.clone().normalize();
            const offsetMagnitude = currentMouseUV.length() * 0.03; // TODO tweak cause depends on zoom
            const zoomAmount = 0.96;
            const moveVector = offsetDirection.multiplyScalar(offsetMagnitude);
            const targetMouseHoverData = new Vector3(moveVector.x, moveVector.y, zoomAmount);

            const newMouseHoverData = new Vector3().lerpVectors(currentMouseHoverData, targetMouseHoverData, 8. * deltaTime);

            material.uniforms.uMouseHoverData.value = newMouseHoverData;
            prevMouseUV = currentMouseUV;
            currentMouseHoverData = newMouseHoverData;

            material.uniforms.uHash.value += deltaTime * 0.5; // TODO meh.. would look a lot better if it was flowy rather than stepped, likely using proper noise would help
        }
        else 
        {
            // smoothly return to center when not hovering
            const targetMouseHoverData = new Vector3(0., 0., 1.);
            const newMouseHoverData = new Vector3().lerpVectors(currentMouseHoverData, targetMouseHoverData, 10. * deltaTime);
            material.uniforms.uMouseHoverData.value = newMouseHoverData;
            currentMouseHoverData = newMouseHoverData;
        }
    }

    function setUniform(name, value) {
        const u = material.uniforms[name];
        if (u === undefined) {
            // create a new uniform if needed
            material.uniforms[name] = { value };
        } else {
            u.value = value;
        }
    }

    function dispose() {
        try {
            geometry.dispose();
            material.dispose();
            texture.dispose();
        } catch (e) {
            // ignore dispose errors
        }
    }

    return {
        mesh,
        material,
        geometry,
        // readiness helpers
        get ready() { return ready; },
        readyPromise,
        // API
        onResize,
        update,
        setUniform,
        dispose
    };
}
