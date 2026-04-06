import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  TextureLoader,
  Mesh,
  Vector2,
  MathUtils,
  RepeatWrapping,
  Vector3,
} from 'three';

import vertexSource from '../shaders/box-raytracer-vert.glsl?raw';
import fragmentSource from '../shaders/box-raytracer-frag.glsl?raw';

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

function generateCubes() {
    const cubes = [];
    cubes[0] = new Vector3(-0.5, -0.5, 0.5);
    cubes[1] = new Vector3(0, 0, 0);
    cubes[2] = new Vector3(0., 0., 0);
    cubes[3] = new Vector3(.5, 1.5, 1);
    return cubes;
}

export function createBoxRaytracer() {
    // --- geometry: small quad ---
    const geometry = new BufferGeometry();
    const vertices = new Float32Array([
        -0.5, -0.5, 0.0,
         0.5, -0.5, 0.0,
         0.5,  0.5, 0.0,
        -0.5,  0.5, 0.0
    ]);
    const indices = new Uint16Array([
        0, 1, 2,
        0, 2, 3
    ]);
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));

    const cubesArray = generateCubes();
    // --- shader material ---
    const material = new ShaderMaterial({
        vertexShader: vertexSource,
        fragmentShader: fragmentSource,
        uniforms: {
            uOffset: { value: new Float32Array([0.0, 0.0]) },
            uScale: { value: new Float32Array([1.0, 1.0]) },
            uBlueNoiseTexture: { value: null },
            uTime: { value: 0 },
            uResolution: { value: new Float32Array([window.innerWidth, window.innerHeight]) },
            uCubes: { value: cubesArray }
        },
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
    const textureUrl = './assets/blue-noise.png';
    if (textureUrl) {
        const loader = new TextureLoader();
        loader.load(
        textureUrl,
        (tex) => {
            tex.wrapS = tex.wrapT = RepeatWrapping;
            
            tex.needsUpdate = true;
            
            material.uniforms.uBlueNoiseTexture.value = tex;

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
    const container = document.querySelector('#raytracer-container');
    // --- methods ---
    // detect hover on the container element
    container.addEventListener('mouseenter', () => { isHovering = true; });
    container.addEventListener('mouseleave', () => { isHovering = false; });

    // update position and scale on window resize
    function onResize() {
        const r = container.getBoundingClientRect();
        // update offset position
        const px = r.left + r.width / 2;
        const py = r.top + r.height / 2;
        material.uniforms.uOffset.value[0] = px / window.innerWidth * 2 - 1;
        material.uniforms.uOffset.value[1] = - (py / window.innerHeight * 2 - 1);
        // update scale 
        const widthPx = r.width; // fixed width in pixels
        const heightPx = r.height; // fixed height in pixels
        material.uniforms.uScale.value[0] = widthPx  / window.innerWidth  * 2;
        material.uniforms.uScale.value[1] = heightPx / window.innerHeight * 2;

        // update resolution
        material.uniforms.uResolution.value[0] = window.innerWidth;
        material.uniforms.uResolution.value[1] = window.innerHeight;
    }
    window.addEventListener('resize', onResize);
    onResize();

    let totalTime = 0;
    let t = 0;
    function update(deltaTime) {
        let speed = MathUtils.smoothstep(Math.sin(totalTime * 0.8) * 0.5 + 0.5, 0.96, 1.01) * 0.8;
        totalTime += deltaTime;
        if (isHovering) speed = 0.8;
        t += deltaTime * speed;
        // setUniform('uNoise', createFBMNoise(t)); // TODO FIND A WAY TO PASS TIME TO ANIMATE
        // setUniform('uNoise2', createFBMNoise(t, 20)); // TODO FIND A WAY TO PASS TIME TO ANIMATE
        material.uniforms.uTime.value = totalTime;
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
        update,
        setUniform,
        dispose
    };
}
