import { Vector2, Vector3, MathUtils } from 'three';

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

export function createFBMNoise(time = 0, offSeed = 0, xSize, ySize, patternScale ) {
    let activeCount = 0;
    const data = new Uint8Array(xSize * ySize);
    const tmp = new Vector2();
    const offset = new Vector2(offSeed + time, offSeed + time);
    for (let i = 0; i < data.length; i++) {
        const x = (i % xSize) - Math.floor(xSize / 2);
        const y = ((i / xSize) | 0) - Math.floor(ySize / 2);
        tmp.set(x, y).divideScalar(xSize).multiplyScalar(patternScale);
        foldVec(tmp);
        const v = fbmVec(new Vector2(tmp.x + offset.x, tmp.y + offset.y));

        if (v > 0.5) {
            activeCount++;
            data[i] = 1;
        } else {
            data[i] = 0;
        }
    }
    return { data, activeCount };
}

export function createGameFBMNoise(time = 0, offSeed = 0, xSize, ySize, patternScale, minActive, maxActive) {
    let i = 0;
    while (i < 10) {
        const fbm = createFBMNoise(time, offSeed, xSize, ySize, patternScale);
        if (fbm.activeCount >= minActive && fbm.activeCount <= maxActive) {
            // console.log(`Generated FBM noise with active count ${fbm.activeCount} after ${i+1} attempts. offSeed ${offSeed}`);
            return { fbm: fbm.data, offSeed };
        }
        i++;
        offSeed = Math.random() * 55.; // TODO likely should use deterministic seed... but this should be ok for now
    }

    offSeed = 0;
    const fbm = createFBMNoise(0, offSeed, xSize, ySize, patternScale);  // fallback to seed that works
    if (fbm.activeCount < minActive || fbm.activeCount > maxActive) {
        console.warn(`Could not generate FBM noise with active count in range [${minActive}, ${maxActive}] after 10 attempts. Generated pattern has ${fbm.activeCount} active points.`);
        return fbm.data;
    }
    // console.log(`Generated FBM noise with active count ${fbm.activeCount} after 10 attempts, using fallback seed.`);
    return { fbm: fbm.data, offSeed };
}