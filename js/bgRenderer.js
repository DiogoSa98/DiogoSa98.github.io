import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Mesh,
  TextureLoader,
  RepeatWrapping,
} from 'three';

const BG_TEXTURE = './assets/blue-noise.png';
// const BG_TEXTURE = './legacy/VideosAndImages/pathtrace.png';
import vertexSource from '../shaders/bg-vertex.glsl?raw';
import fragmentSource from '../shaders/bg-fragment.glsl?raw';

export function createBackground() {
    // --- geometry: full-screen triangle in clip-space ---
    const geometry = new BufferGeometry();
    const vertices = new Float32Array([
        -1.0, -1.0, 0.0,
        3.0, -1.0, 0.0,
        -1.0,  3.0, 0.0
    ]);
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));

    // --- shader material ---
    const material = new ShaderMaterial({
        vertexShader: vertexSource,
        fragmentShader: fragmentSource,
        uniforms: {
        uNoise: { value: null },                            // texture (DataTexture or normal Texture)
        uResolution: { value: new Float32Array([window.innerWidth, window.innerHeight]) }, // [w, h]
        uBgMultiplier: { value: 0.08 },
        },
        depthWrite: false,
        depthTest: false,
        transparent: false
    });

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;

    // --- asset loading ---
    let ready = false;
    let resolveReady;
    const readyPromise = new Promise((res) => { resolveReady = res; });

    if (BG_TEXTURE) {
        const loader = new TextureLoader();
        loader.load(
        BG_TEXTURE,
        (tex) => {
            tex.wrapS = tex.wrapT = RepeatWrapping;
            tex.needsUpdate = true;
            
            material.uniforms.uNoise.value = tex;

            ready = true;
            resolveReady(true);
        },
        undefined,
        (err) => {
            console.warn('bgRenderer: texture failed to load:', err);
            // still resolve (fallback to null texture)
            ready = true;
            resolveReady(false);
        }
        );
    } else {
        // no texture to load; mark ready
        ready = true;
        resolveReady(true);
        console.warn('bgRenderer: no texture to load');
    }

        // --- methods ---
    function onResize(width, height) {
        const ures = material.uniforms.uResolution.value;
        ures[0] = width;
        ures[1] = height;
        // no need to mark uniforms.needsUpdate — three handles uniform updates automatically 
    }

    function update(time) {
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
        const tex = material.uniforms.uNoise && material.uniforms.uNoise.value;
        if (tex && tex.dispose) tex.dispose();
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