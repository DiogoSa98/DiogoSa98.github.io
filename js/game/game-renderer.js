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

import { BRICK_ANIM } from './game-manager.js';
import vertexSource from '../../shaders/box-raytracer-vert.glsl?raw';
import fragmentSource from '../../shaders/box-raytracer-frag.glsl?raw';

export function createGameRenderer(camera, containerElementId, gameBricks, bricksState, gameBall, gamePaddle, walls)
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
    let bricksUniforms = buildCubesUniform(gameBricks, bricksState, 0, 0);
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
            uCubes: { value: bricksUniforms },
            // uCubesAmmount: { value: bricksUniforms.uCubesAmmount },
            uPaddle: { value: gamePaddle },
            uBall: { value: new Vector4(
                gameBall.pos.x, gameBall.pos.y, (gamePaddle[0].z + gamePaddle[1].z) * 0.5,
                gameBall.rad
            ) },
            uWalls: { value: walls },
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

    function easeOutBack(x) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    // takes game bricks min/max pos, adds depth and animates depending on anim state
    function buildCubesUniform(templateBricks, bricksState, deltaTime, totalTime) {
        const uCubes = [];
        // let uCubesAmmount = 0;
        for (let i = 0; i < templateBricks.bricks.length; i++) {
            const tmpl = templateBricks.bricks[i];
            const brick = bricksState[i];
            
            if (brick.animState === BRICK_ANIM.HIDDEN ||
                brick.animState === BRICK_ANIM.DISABLED) 
            {
                uCubes.push(new Vector3(0,0,-100.0)); // we need to pad the array cause glsl/three.js expects always the same size array
                uCubes.push(new Vector3(0,0,0));
                // console.log('hidden brick i', i, brick.id);
                continue;
            }
            
            // TODO likely should be somewhere else, cause rendering shouldn't decide whether something is physics active nor set state but whatever
            let scaleLerp = 0.; // from 0 to 1
            let extraDepth = 0.;
            if (brick.animT < 1. && brick.animState === BRICK_ANIM.SPAWN)
            {
                // spawn animation tween
                brick.animT += deltaTime * 5.;
                if (brick.animT >= 1.)
                {
                    brick.animState = BRICK_ANIM.IDLE;
                    brick.animT = 1.;
                    brick.physicsActive = true;
                }

                scaleLerp = easeOutBack(brick.animT);
            }
            else if (brick.animT === 1. && brick.animState === BRICK_ANIM.IDLE)
            {
                // console.log('brick idle ', i, bricksState[i].id);
                // idle animation
                scaleLerp = 1.;
                extraDepth = Math.sin(totalTime + (i*55.+42)) * tmpl.depth * 0.5;
            }
            else if (brick.animT <= 1. && brick.animState === BRICK_ANIM.DEATH)
            {
                // death animation
                brick.animT -= deltaTime * 5.;
                if (brick.animT <= 0)
                {
                    brick.animT = 0.;
                    brick.animState = BRICK_ANIM.HIDDEN;
                    brick.physicsActive = false;
                }

                scaleLerp = easeOutBack(brick.animT);
                // extraDepth = MathUtils.lerp(0, extraDepth, brick.animT);
            }
            
            // compute animated min/max from template center + scaled half-size
            const cx = (tmpl.minX + tmpl.maxX) * 0.5;
            const cy = (tmpl.minY + tmpl.maxY) * 0.5;
            const hw = templateBricks.brickHalfSize.x * scaleLerp;
            const hh = templateBricks.brickHalfSize.y * scaleLerp;
            
            uCubes.push(new Vector3(cx - hw, cy - hh, 0));
            uCubes.push(new Vector3(cx + hw, cy + hh, tmpl.depth * scaleLerp + extraDepth));
            // uCubesAmmount++;
        }
        
        // return { uCubes, uCubesAmmount };
        return uCubes;
    }

    let totalTime = 0;
    function update(deltaTime, alpha, gamePaddle, gameBall, gameBricks, bricksState) {
        totalTime += deltaTime;
        material.uniforms.uTime.value = totalTime;

        material.uniforms.uPaddle.value = gamePaddle;
        material.uniforms.uBall.value = new Vector4(
            gameBall.pos.x, gameBall.pos.y, (gamePaddle[0].z + gamePaddle[1].z) * 0.5,
            gameBall.rad
        );
        let bricksUniforms = buildCubesUniform(gameBricks, bricksState, deltaTime, totalTime);
        material.uniforms.uCubes.value = bricksUniforms;
        // material.uniforms.uCubesAmmount.value = bricksUniforms.uCubesAmmount;

        // update camera uniforms, cause camera movement in game-manager
        material.uniforms.uProjectionMatrixInverse.value.copy(camera.projectionMatrix).invert();
        material.uniforms.uViewMatrixInverse.value.copy(camera.matrixWorld); 
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