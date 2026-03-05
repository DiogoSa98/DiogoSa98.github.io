import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Mesh,
  Vector2,
  MathUtils,
} from 'three';

import vertexSource from '../shaders/loading-vert.glsl?raw';
import fragmentSource from '../shaders/loading-frag.glsl?raw';

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

export function createLoading() {
    // --- geometry: small quad with UVs ---
    const geometry = new BufferGeometry();
    const vertices = new Float32Array([
        -0.5, -0.5, 0.0,
         0.5, -0.5, 0.0,
         0.5,  0.5, 0.0,
        -0.5,  0.5, 0.0
    ]);
    const uvs = new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
    ]);
    const indices = new Uint16Array([
        0, 1, 2,
        0, 2, 3
    ]);
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));

    // --- shader material ---
    const material = new ShaderMaterial({
        vertexShader: vertexSource,
        fragmentShader: fragmentSource,
        uniforms: {
            uOffset: { value: new Float32Array([0.0, 0.0]) },
            uScale: { value: new Float32Array([1.0, 1.0]) },
            uNoise: { value: createFBMNoise(0, 0) }, 
            uNoise2: { value: createFBMNoise(0, 100) }, 
        },
        depthWrite: false,
        depthTest: false,
        transparent: true
    });

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;

    let ready = true;
    const readyPromise = Promise.resolve(true);

    let isHovering = false;
    const brand = document.querySelector('.brand');
    // --- methods ---
    // detect hover on the brand element
    brand.addEventListener('mouseenter', () => { isHovering = true; });
    brand.addEventListener('mouseleave', () => { isHovering = false; });

    // update position and scale on window resize
    function onResize() {
        const r = brand.getBoundingClientRect();
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
        setUniform('uNoise', createFBMNoise(t)); // TODO FIND A WAY TO PASS TIME TO ANIMATE
        setUniform('uNoise2', createFBMNoise(t, 20)); // TODO FIND A WAY TO PASS TIME TO ANIMATE
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
