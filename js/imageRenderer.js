import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Mesh,
  Vector2,
  Vector3,
  MathUtils,
  TextureLoader,
  PlaneGeometry,
  Quaternion,
  Camera,
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
    p.x = Math.abs(p.x);
    p.y = Math.abs(p.y);
    return;
    const t = 1;
    const cospin = Math.cos(Math.PI / t);
    const scospin = Math.sqrt(1.0 - cospin * cospin);
    const nc = new Vector2(-cospin, scospin);
    for (let i = 0; i < t; i++) {
        p.x = Math.abs(p.x);
        // p.y = Math.abs(p.y);
        const dot = p.x * nc.x + p.y * nc.y;
        const m = Math.min(0.0, dot);
        p.x -= 2.0 * m * nc.x;
        // p.y -= 2.0 * m * nc.y;
    }
}

function createFBMNoise(time = 0, offSeed = 0) {
    const xSize = 7;
    const ySize = 7;
    const data = new Uint8Array(xSize * ySize);
    const patternScale = 5.0;
    const tmp = new Vector2();
    const offset = new Vector2(offSeed + time, offSeed + time);
    for (let i = 0; i < data.length; i++) {
        const x = (i % xSize) - Math.floor(xSize / 2);
        const y = ((i / xSize) | 0) - Math.floor(ySize / 2);
        tmp.set(x, y).divideScalar(xSize).multiplyScalar(patternScale);
        foldVec(tmp);
        const v = fbmVec(new Vector2(tmp.x + offset.x, tmp.y + offset.y));

        data[i] = v > 0.5 ? 1 : 0;
    }
    return data;
}

export function createImage(cam, elementId, textureUrl) {
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
            uNoise: { value: createFBMNoise(0, 0) }, 
            uTexture: { value: null },
            uLerpT: { value: 0.0 }
        },
        // side: 2, // double-sided REMOVE ME 
        depthWrite: false,
        depthTest: false,
        transparent: true
    });

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;

    // --- asset loading ---
    let ready = false;
    let resolveReady;
    const readyPromise = new Promise((res) => { resolveReady = res; });
    if (textureUrl) {
        const loader = new TextureLoader();
        loader.load(
        textureUrl,
        (tex) => {
            tex.needsUpdate = true;
            
            material.uniforms.uTexture.value = tex;

            ready = true;
            resolveReady(true);
        },
        undefined,
        (err) => {
            console.warn('imageRenderer: texture failed to load:', err);
            // still resolve (fallback to null texture)
            ready = true;
            resolveReady(false);
        }
        );
    } else {
        // no texture to load; mark ready
        ready = true;
        resolveReady(true);
        console.warn('imageRenderer: no texture to load');
    }

    let isHovering = false;
    const elem = document.querySelector(elementId);
    // --- methods ---
    // detect hover on the brand element
    elem.addEventListener('mouseenter', () => { isHovering = true; });
    elem.addEventListener('mouseleave', () => { isHovering = false; });

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
        const topLeft = screenToWorld(width, height, r.left, r.top);
        const bottomRight = screenToWorld(width, height, r.right, r.bottom);
        mesh.position.copy(topLeft.clone().add(bottomRight).multiplyScalar(0.5));
        mesh.scale.set(Math.abs(bottomRight.x - topLeft.x), Math.abs(topLeft.y - bottomRight.y), 1.);
        console.log('cam pos ', cam.position, 'mesh pos ', mesh.position, 'scale ', mesh.scale);
    }

    const mousePosWorld = new Vector3();
    document.addEventListener('mousemove', function(event) {

        mousePosWorld.copy(screenToWorld(renderWidth, renderHeight, event.clientX, event.clientY));
        mousePosWorld.z = 10;
        // console.log(`Mouse position: x=${event.clientX}, y=${event.clientY} mesh pos: ${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z}`);
    })


    let showImage = false;
    let t = { value: 0. };
    const tween = new Tween(t)
        .to({ value: showImage ? 0. : 1. }, 1200)
        // .easing(Easing.Quadratic.InOut)
        .onUpdate(() => {
            material.uniforms.uLerpT.value = t.value;
            console.log('t -> ', t.value);
        });

    window.onkeydown = function(e) {
        if (e.key === 'd') {
            // t = { value:  0. };
            // tween.to({ value: 1. }, 1000);
            tween.start();
            console.log('t after starty', t.value);
            showImage = !showImage;
        }
    };

    let totalTime = 0;
    function update(deltaTime) {
        totalTime += deltaTime;
        setUniform('uNoise', createFBMNoise(0., 20)); // TODO FIND A WAY TO PASS TIME TO ANIMATE

        tween.update();

        // -----------------
        // rotatos fritos
        // -----------------
        // distance to quad (port of GLSL sdBox)
        // p = mouse position relative to box centre
        const p = new Vector2(
            mousePosWorld.x - mesh.position.x,
            mousePosWorld.y - mesh.position.y
        );
        // b = half-extents (from center to edge)
        const b = new Vector2(mesh.scale.x * 0.5, mesh.scale.y * 0.5);
        // d = abs(p) - b  (vector of signed distances)
        const d = new Vector2(Math.abs(p.x), Math.abs(p.y)).sub(b);
        // e = max(d, 0.0)   (positive part for length)
        const e = new Vector2(Math.max(d.x, 0), Math.max(d.y, 0));
        const dist = e.length() + Math.min(Math.max(d.x, d.y), 0);

        const t = (MathUtils.smoothstep(dist+0.001, 0., 0.1) * -1. + 1.);
        const rotIntensity = MathUtils.lerp(16., 10., t);
        const lookAtTarget = new Vector3(mousePosWorld.x, mousePosWorld.y, rotIntensity);

        const meshForward = new Vector3();
        mesh.getWorldDirection(meshForward);
        
        const dirToTarget = lookAtTarget.clone().sub(mesh.position).normalize();
        const targetQuaternion = new Quaternion();
        targetQuaternion.setFromUnitVectors(new Vector3(0, 0, 1), dirToTarget);

        // mesh.quaternion.copy(targetQuaternion);
        mesh.quaternion.rotateTowards(targetQuaternion, deltaTime * 2.);

        // mesh.lookAt(lookAtTarget);
        // console.log('dist ',dist, ' ',t, '  ', rotIntensity); 
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
