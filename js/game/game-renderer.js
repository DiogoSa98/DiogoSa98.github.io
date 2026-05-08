import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  TextureLoader,
  Mesh,
  Vector2,
  Vector4,
  MathUtils,
  RepeatWrapping,
  Camera,
  Matrix4,
  Vector3,
} from 'three';

import vertexSource from '../../shaders/box-raytracer-vert.glsl?raw';
import fragmentSource from '../../shaders/box-raytracer-frag.glsl?raw';

export function createGameRenderer(camera, containerElementId, gameBricks, gameBall, gamePaddle)
{
    const container = document.querySelector(containerElementId);

    ////////////////////////////////////
    // --- geometry, quad ---
    ////////////////////////////////////
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

    ////////////////////////////////////
    // --- shader material ---
    ////////////////////////////////////
    const material = new ShaderMaterial({
        vertexShader: vertexSource,
        fragmentShader: fragmentSource,
        uniforms: {
            uOffset: { value: new Float32Array([0.0, 0.0]) },
            uScale: { value: new Float32Array([1.0, 1.0]) },
            uBlueNoiseTexture: { value: null },
            uTime: { value: 0 },
            uProjectionMatrixInverse: { value: new Matrix4() },
            uViewMatrixInverse: { value: new Matrix4() },
            uResolution: { value: new Float32Array([window.innerWidth, window.innerHeight]) },
            uCubes: { value: gameBricks },
            uPaddle: { value: gamePaddle },
            uBall: { value: new Vector4(
                gameBall.pos.x, gameBall.pos.y, (gamePaddle[0].z + gamePaddle[1].z) * 0.5,
                gameBall.rad
            ) }
        },
        depthWrite: false,
        depthTest: false,
        transparent: true
    });

    material.uniforms.uProjectionMatrixInverse.value.copy(camera.projectionMatrix).invert();
    material.uniforms.uViewMatrixInverse.value.copy(camera.matrixWorld); 

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;

    ////////////////////////////////////
    // --- asset loading: texture ---
    ////////////////////////////////////
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
            console.warn('game-renderer: texture failed to load:', err);
            // still resolve (fallback to null texture)
            ready = true;
            resolveReady(false);
        }
        );
    } else {
        // no texture to load; mark ready
        ready = true;
        resolveReady(true);
        console.warn('game-renderer: no texture to load');
    }

    // --- methods ---

    // TODO this is not really working with canvas and div stuff, just window i believe
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
    function update(deltaTime, alpha, gamePaddle, gameBall, gameBricks) {
        totalTime += deltaTime;
        material.uniforms.uTime.value = totalTime;

        material.uniforms.uPaddle.value = gamePaddle;
        material.uniforms.uBall.value = new Vector4(
            gameBall.pos.x, gameBall.pos.y, (gamePaddle[0].z + gamePaddle[1].z) * 0.5,
            gameBall.rad
        );
        material.uniforms.uCubes.value = gameBricks;
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
        readyPromise,
        update,
        setUniform,
        dispose,
    }
}