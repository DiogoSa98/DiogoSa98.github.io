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
import { vec3 } from 'three/tsl';

// Fast integer-based hash returning float in [0,1)
function hashInt(ix, iy) {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return n / 4294967296;
}
function baseHash(p)
{
    p = 1103515245*((p >> 1)^(p));
    let h32 = 1103515245*((p)^(p>>3));
    return h32^(h32 >> 16);
}
function hash31(x)
{
    let n = baseHash(x);
    let rz = new Vector3(n, n * 16807, n * 48271); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return new Vector3((rz.x >> 1) & 0x7fffffff, (rz.y >> 1) & 0x7fffffff, (rz.z >> 1) & 0x7fffffff).divideScalar(0x7fffffff);
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

/*
function step(edge, x) {
    return x < edge ? 0 : 1;
}

// hierarchical growth of boxes on the faces of a parent box, with random jitter in position and scale
function generateCubes() {
    const cubes = [];
    // start with a single box in the center
    cubes.push(new Vector3(-0.5, -0.5, -0.5));
    cubes.push(new Vector3(0.5, 0.5, 0.5));
    let parentMin = cubes[0]; 
    let parentMax = cubes[1];
    let parentSize = parentMax.clone().sub(parentMin);
    console.log('cubes ammount ' + (Math.pow(3.0, 1) + Math.pow(3.0, 2)  + 1 )+ ' (for 2 levels of subdivision)');
    console.log('cubes ammount ' + (Math.pow(3.0, 1) + 1 )+ ' (for 1 levels of subdivision)');
    console.log('parent size', parentSize.x.toFixed(2), parentSize.y.toFixed(2), parentSize.z.toFixed(2));
    for (let level = 0; level < 1; level++) { 
    
        let cubesAmmount = Math.pow(3.0, level + 1); 
    
        for (let i = 0; i < cubesAmmount; i++) { 
            const r1 = hash31(i*13 + level*27 + 12); 
            const a1 = step(r1.x, 0.4); 
            const a2 = step(r1.x, 0.8); 
            const axisDir = (step(0.5, r1.y)*2. - 1.);  // random prob of being -1 or 1, flip axis direction
            const faceAxis = new Vector3( a1, a2 - a1, 1.0 - a2).multiplyScalar(axisDir); // choose a random face axis (x, y or z) and direction (positive or negative)
            const freeAxis = new Vector3(1., 1., 1.).sub(faceAxis.clone().multiplyScalar(axisDir)); // two free axis that we can jitter position and scale on, perpendicular to the face axis
            // put box on face
            let pmin = parentMin.clone().add(faceAxis.clone().multiply(parentSize));
            let pmax = parentMax.clone().add(faceAxis.clone().multiply(parentSize));
            // jitter position and scale on face plane 
            const r2 = hash31(i*146 + level*123 + 4132);
            r2.x = r2.x * 2 - 1; // so we can go all the way from bottom corner to top corner
            r2.y = r2.y * 2 - 1;
            const pMinJitter = parentSize.clone().multiplyScalar(0.1).lerp(parentSize.clone().multiplyScalar(0.8), r2.x);
            pmin = pmin.add(freeAxis.clone().multiply(pMinJitter));
            const newSize = new Vector3(0,0,0).lerp(parentSize.clone().multiplyScalar(0.5), r2.x * r1.x);
            pmax = pmax.add(freeAxis.clone().multiply(newSize));
            // shrink "depth"
            const depth = Math.abs(parentSize.dot(faceAxis));
            const shrink = MathUtils.lerp(depth * 0.6, depth * 0.2, r2.z);
            const sideToShrink = axisDir * 0.5 + 0.5;
            pmax.sub(faceAxis.clone().multiplyScalar(shrink * sideToShrink));
            pmin.sub(faceAxis.clone().multiplyScalar(shrink * (1 - sideToShrink)));


            cubes.push(pmin);
            cubes.push(pmax);
        }
    }

    cubes.forEach(c => {
        console.log(c.x.toFixed(2), c.y.toFixed(2), c.z.toFixed(2));
    });
    return cubes;
}

const FACES = [
  new Vector3( 1, 0, 0), // +X
  new Vector3(-1, 0, 0), // -X
  new Vector3( 0, 1, 0), // +Y
  new Vector3( 0,-1, 0), // -Y
  new Vector3( 0, 0, 1), // +Z
  new Vector3( 0, 0,-1)  // -Z
];
function shuffle(array) {
  let currentIndex = array.length;
  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

function randSignedVec3(seed) {
  const r = hash31(seed);
  return new Vector3(
    r.x * 2 - 1,
    r.y * 2 - 1,
    r.z * 2 - 1
  );
}

function mix(a, b, t) {
  return a * (1 - t) + b * t;
}

function mixVec3(a, b, t) {
  return new Vector3(
    mix(a.x, b.x, t.x),
    mix(a.y, b.y, t.y),
    mix(a.z, b.z, t.z)
  );
}

function generateChildBoxes(parent, level, seed) {
    const children = [];

    const parentMin = parent.min;
    const parentMax = parent.max;
    const parentSize = parentMax.clone().sub(parentMin);

    // shuffle faces so no duplicates
    let faces = FACES;
    shuffle(faces);
    const childCount = Math.min(3, faces.length); // tweak

    for (let i = 0; i < childCount; i++) {
        const rPos = randSignedVec3(seed + i * 10 + level * 100);
        const rSize = hash31(seed + i * 20 + level * 200);

        // axes
        const faceAxis = faces[i]; // guaranteed unique
        const freeAxis = new Vector3(1,1,1).sub( // two free axis that we can jitter position and scale on, perpendicular to the face axis
            faceAxis.clone() // TODO confirm
        );

        // base placement (attach to face)
        let pmin = parentMin.clone().add(
            faceAxis.clone().multiply(parentSize)
        );
        let pmax = parentMax.clone().add(
            faceAxis.clone().multiply(parentSize)
        );

        // ---- POSITION JITTER (per-axis) ----
        const jitterMin = parentSize.clone().multiplyScalar(0.1);
        const jitterMax = parentSize.clone().multiplyScalar(0.8);

        const jitter = mixVec3(jitterMin, jitterMax, rPos.clone().addScalar(1).multiplyScalar(0.5));

        pmin.add(freeAxis.clone().multiply(jitter));

        // ---- SIZE (per-axis) ----
        const sizeMax = parentSize.clone().multiplyScalar(0.5);
        const newSize = mixVec3(new Vector3(0,0,0), sizeMax, rSize);

        pmax.add(freeAxis.clone().multiply(newSize));

        // ---- DEPTH SHRINK ----
        const depth = Math.abs(parentSize.dot(faceAxis));
        const shrink = mix(depth * 0.6, depth * 0.2, rSize.z);

        const side = faceAxis.clone().addScalar(1).multiplyScalar(0.5); // 0 or 1

        pmax.sub(faceAxis.clone().multiplyScalar(shrink * side.length()));
        pmin.sub(faceAxis.clone().multiplyScalar(shrink * (1 - side.length())));

        children.push({ min: pmin, max: pmax });
    }

    return children;
}

function generateBoxTree() {
    const root = {
        min: new Vector3(-0.3, -0.5, -0.3),
        max: new Vector3(0.3, 0.5, 0.3)
    }
    const levels = 1;
    const seed = 42;

    let current = [root]; // boxes we are expanding at the current level
    const all = [root]; // all generated boxes

    for (let level = 0; level < levels; level++) {
        const next = [];

        for (let i = 0; i < current.length; i++) {
        const children = generateChildBoxes(
            current[i],
            level,
            seed + i * 1000
        );

        next.push(...children);
        all.push(...children);
        }

        current = next;
    }

    // flatten array for shader uniform
    for (let i = 0; i < all.length; i++) {
        const box = all[i];
        all[i] = box.min;
        all.splice(i + 1, 0, box.max);
        i++;
    }

    return all;
}

*/
function generateWallRects(min, max, maxLevel, time = 0) {
    const finalRects = [];
    const candidateRects = [];
    candidateRects.push({ min: min.clone(), max: max.clone(), level: 0 });

    while (candidateRects.length > 0) {
        const baseRect = candidateRects.pop();
        const level = baseRect.level;

        const v1 = noiseVec(new Vector2(baseRect.min.x, baseRect.min.y).multiplyScalar(1.10).addScalar(time * 1.1));
        const v2 = noiseVec(new Vector2(baseRect.max.x, baseRect.max.y).multiplyScalar(1.10).addScalar(time * 1.1));

        // const newX = MathUtils.lerp(baseRect.min.x, baseRect.max.x, MathUtils.lerp(0.3, 0.8, Math.random()));
        const newX = MathUtils.lerp(baseRect.min.x, baseRect.max.x, MathUtils.lerp(0.4, 0.6, v1));
        // const newY = MathUtils.lerp(baseRect.min.y, baseRect.max.y, MathUtils.lerp(0.3, 0.8, Math.random()));
        const newY = MathUtils.lerp(baseRect.min.y, baseRect.max.y, MathUtils.lerp(0.4, 0.6, v2));
        const newLevel = level + 1;

        if (newLevel == maxLevel) {
            finalRects.push({
                min: new Vector2(baseRect.min.x, newY),
                max: new Vector2(newX, baseRect.max.y),
            });
            finalRects.push({
                min: new Vector2(newX, newY),
                max: new Vector2(baseRect.max.x, baseRect.max.y),
            });
            finalRects.push({
                min: new Vector2(baseRect.min.x, baseRect.min.y),
                max: new Vector2(newX, newY),
            });
            finalRects.push({
                min: new Vector2(newX, baseRect.min.y),
                max: new Vector2(baseRect.max.x, newY),
            });
        }
        else {
            candidateRects.push({ // top-left
                min: new Vector2(baseRect.min.x, newY),
                max: new Vector2(newX, baseRect.max.y),
                level: newLevel
            });
            candidateRects.push({ // top-right
                min: new Vector2(newX, newY),
                max: new Vector2(baseRect.max.x, baseRect.max.y),
                level: newLevel
            });
            candidateRects.push({ // bottom-left
                min: new Vector2(baseRect.min.x, baseRect.min.y),
                max: new Vector2(newX, newY),
                level: newLevel
            });
            candidateRects.push({ // bottom-right
                min: new Vector2(newX, baseRect.min.y),
                max: new Vector2(baseRect.max.x, newY),
                level: newLevel
            });
        }
    }

    return finalRects;
}

function generateWallBoxes(time = 0) {
    const rects = generateWallRects(
        new Vector2(-2, -1.2),
        new Vector2(2, 1.2),
        3,
        time
    );
    
    const cubes = [];

    for (const r of rects) {
        // const depth = MathUtils.lerp(0.1, 0.6, Math.random());
        const depth = 0.1; // TESTING
        const min = new Vector3(r.min.x, r.min.y, 0);
        const max = new Vector3(r.max.x, r.max.y, depth);

        cubes.push(min);
        cubes.push(max);
    }
    console.log('generated ' + rects.length + ' wall boxes');
    // testing
    const testCubes = [];
    testCubes.push(new Vector3(0, 0, 0));
    testCubes.push(new Vector3(1, 1, 0.1));
    return testCubes;

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

    // const cubesArray = generateBoxTree();
    const cubesArray = generateWallBoxes();

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
        material.uniforms.uTime.value = totalTime;

        material.uniforms.uCubes.value = generateWallBoxes(totalTime);
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
