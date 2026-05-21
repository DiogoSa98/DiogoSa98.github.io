import { Vector2, Vector3, Vector4, MathUtils, Quaternion, Euler } from 'three';
// import { bus, EV } from './game-eventBus.js'; 
import { gamePhysicsStep } from './game-physics.js';
import { createGameRenderer } from './game-renderer.js';
import { createGameFBMNoise } from './fbm-generator.js';
import {Tween, Easing} from '@tweenjs/tween.js'
import { Const } from 'three/tsl';

export const BRICK_ANIM = {
  HIDDEN:  0,   // not rendered, not in physics
  SPAWN:   1,    // scaling in, not yet in physics
  IDLE:    2,     // fully alive, in physics
  DEATH:   3,    // scaling out, already removed from physics
  DISABLED: 4,  // fully disabled in level, used for level pattern generation
};

export function createBreakerGame(camera, containerElementId) {

  const container = document.querySelector(containerElementId);

  ////////////////////////////////////
  //  Input state
  ////////////////////////////////////
  // Plain object. Listeners write to it, game loop reads from it each frame.
  // Nothing else imports this — only game-manager.js reads it.
  const inputState = {
    pointerX: window.innerWidth / 2,   // screen pixels
    pointerY: window.innerHeight / 2,  // screen pixels
  };

  window.addEventListener('pointermove', e => { inputState.pointerX = e.clientX; inputState.pointerY = e.clientY; });
  window.addEventListener('touchstart', e => { inputState.pointerX = e.touches[0].clientX; inputState.pointerY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', e => { inputState.pointerX = e.touches[0].clientX; inputState.pointerY = e.touches[0].clientY; }, { passive: true });
  // window.addEventListener('touchend', () => { isHovering = false; }); // TODO hover
  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // ignore right click, middle click etc
    
    if (e.target.closest('nav, a, button')) return; // ignore if click was on nav, links, buttons or anything you flag

    // ignore if pointer position is outside game container bounds
    const rect = container.getBoundingClientRect();
    const inBounds = e.clientX >= rect.left && e.clientX <= rect.right
                  && e.clientY >= rect.top  && e.clientY <= rect.bottom;
    if (!inBounds) return;

    // safe to launch
    if (currentGameState === GAME_STATES.IDLE) {
        SwitchState(GAME_STATES.RUNNING);
        // bus.emit(EV.LAUNCH);
        document.dispatchEvent(new CustomEvent('game-launch'));
    }
  });
  
  let hideGameCameraTween = null;
  let prevGameStateOnPause;
  let isTweeningCamera = false;
  document.addEventListener('hide-game', (e) => {
    if (isTweeningCamera)
    {
      console.error('trying to hide/show game but camera is already tweening!! doing nothing instead ', e.detail);
      return;
    } 

    const shouldHide = e.detail.shouldHide;
    const animTime = e.detail.delay;
    if (shouldHide) SwitchState(GAME_STATES.PAUSED); // pause immediately when hiding

    // animate camera down
    const targetRot = new Quaternion();
    targetRot.setFromEuler(new Euler(0, 0, 0, 'XYZ'));
    const startRot = camera.quaternion.clone();
    const targetPos = new Vector3(0., shouldHide ? -gameField.top * 2.2 : 0., 10.);
    const startPos = camera.position.clone();
    let lerpT = { value: 0. };
    hideGameCameraTween = new Tween(lerpT)
      .to({ value: 1. }, animTime)
      .easing(Easing.Quadratic.InOut)
      .onUpdate(() => { 
        // camera.quaternion.slerpQuaternions(startRot, targetRot, t);
        camera.position.lerpVectors(startPos, targetPos, lerpT.value);
        camera.updateMatrix();
        camera.updateWorldMatrix(false, true);
      })
      .onComplete(() => {
        if (!shouldHide) SwitchState(prevGameStateOnPause);
        isTweeningCamera = false;
      });
    
    isTweeningCamera = true;
    hideGameCameraTween.start();
  });

  ////////////////////////////////////
  //  end of Input state
  ////////////////////////////////////

  ////////////////////////////////////
  //  Game Objects, variables and setup functions
  ////////////////////////////////////
  const bricksCols = 15;
  const bricksRows = 7;

  // xy is normal, z is distance along normal
  const walls = [new Vector3(1.0, 0.0, 1.0),
  new Vector3(0.0, -1.0, 1.0),
  new Vector3(-1.0, 0.0, 1.0)];

  // const paddleHalfSize = new Vector2(0.8, 0.15);  // using half dimensions for the collision calculations
  // const ballRadius = 0.12;
  let paddleHalfSize; // size is a percentage of the playfield width
  let ballRadius;

  let gameBall;
  let prevBallPos; // for interpolation in rendering
  let ballSquashNStretch = 0.5; // for hit animation, 0 squash, 0.5 normal, 1 stretch
  let ballSquashNStretchSpeed = 0;
  let ballSquashNStretchTarget = 0.5;
  let ballSquashNStretchAngle = 0.;
  let gamePaddle;
  // let gameBricksData;

  const brickPlaneZ = 0;

  function getPlayfield(camera, brickPlaneZ = 0) {
    const distance = Math.abs(camera.position.z - brickPlaneZ);
    const size = new Vector2();
    camera.getViewSize(distance, size);

    const width = size.x;
    const height = size.y;

    const topMargin = height * 0.1;     // UI / breathing room
    const bottomMargin = height * 0.5;  // paddle + ball space
    const horizontalMargin = width * 0.08; // breathing room on sides

    const top = height * 0.5;
    const bottom = -top;
    const right = width * 0.5;
    const left = -right;

    const paddleW = Math.min(width * 0.05, height * 0.08); // never wider than 80% of height
    paddleHalfSize = new Vector2(paddleW, paddleW/5.3);
    ballRadius = paddleHalfSize.x * 0.15;
    CreateBallSpawnAnim(); // create here cause requires ballRadius set correctly

    return {
      width,
      height,
      top,
      bottom: bottom - (height * 0.02), // a bit lower so ball falls further down
      left,
      right,
      bricksTop: top - topMargin,
      bricksBottom: bottom + bottomMargin,
      bricksLeft: left + horizontalMargin,
      bricksRight: right - horizontalMargin,
    };
    // return {
    //   width: fullWidth,
    //   height: fullHeight,
    //   top: fullHeight / 2 - topMargin,
    //   bricksBottom: -fullHeight / 2 + bottomMargin,
    //   bottom: -fullHeight * 0.5 + (fullHeight * 0.08), // actual field bottom for player paddle
    //   left: -fullWidth / 2 + horizontalMargin,
    //   right: fullWidth / 2 - horizontalMargin,
    // };
  }

  function generateBricks(field, isResize = false) {
    const brickWidth = (field.bricksRight - field.bricksLeft) / bricksCols;
    const brickHeight = (field.bricksTop - field.bricksBottom) / bricksRows;

    const bricks = [];
    let fullBricksMin;
    let fullBricksMax;
    for (let row = 0; row < bricksRows; row++) {
      for (let col = 0; col < bricksCols; col++) {
        const x0 = field.bricksLeft + col * brickWidth;
        const y0 = field.bricksBottom + row * brickHeight;

        let depth;
        if (isResize) // use same depth as before
        {
          depth = templateBricksData.bricks[col+(row*bricksCols)].depth;
        }
        else {
          depth = MathUtils.lerp(0.1, 0.6, Math.random());
        }

        // bricks.push(new Vector3(x0, y0, 0));
        // const depth = MathUtils.lerp(0.1, 0.6, Math.random());
        // bricks.push(new Vector3(x0 + brickWidth, y0 + brickHeight, depth));
        bricks.push({
          minX: x0,
          minY: y0,
          maxX: x0 + brickWidth,
          maxY: y0 + brickHeight,
          depth,
        });

        if (row === 0 && col === 0)
        {
          fullBricksMin = new Vector3(x0, y0, 0);
        }
        if (row === bricksRows-1 && col === bricksCols-1)
        {
          fullBricksMax = new Vector3(x0 + brickWidth, y0 + brickHeight, 0); // depth checked in game-renderer buildCubesUniform
        }
      }
    }

    const aabb = [];
    aabb.push(fullBricksMin); aabb.push(fullBricksMax); // for raytrace optimization

    return { bricks, brickHalfSize: new Vector2(brickWidth * 0.5, brickHeight * 0.5), aabb };
  }
  // TODO likely just have 3 arrays one for brick min,max one for physicsActive and another for animState...
  // i dont need to send all of this for physics, and only need depth in game-renderer...
  function initializeBricksState(bricksAmmount) {
    const bricksState = [];
    let idx = 0;
    for (let bi = 0; bi < bricksAmmount; bi++) {
      bricksState.push({
        id: (idx++),
        physicsActive: false,
        animState: BRICK_ANIM.HIDDEN,
        animT: 0.,
      });
    }

    return bricksState;
  }

  // TODO SHOULD SCALE PADDLE SIZE BY WIDTH OF THE FIELD
  // returns array where first entry is boxMin and second boxMax
  function createPaddle(field) {
    const paddle = [];

    const paddleCenterX = (field.left + field.right) / 2;
    const paddleCenterY = field.bottom + paddleHalfSize.y + 1.;
    const paddleX0 = paddleCenterX - paddleHalfSize.x;
    const paddleY0 = paddleCenterY - paddleHalfSize.y;
    paddle.push(new Vector3(paddleX0, paddleY0, 0));
    paddle.push(new Vector3(paddleX0 + paddleHalfSize.x, paddleY0 + paddleHalfSize.y, 0.1));

    return paddle;
  }


  ////////////////////////////////////
  //  end of Game Objects and setup functions
  ////////////////////////////////////

  ////////////////////////////////////
  //  Game State
  ////////////////////////////////////
  const GAME_STATES = {
    SPAWNING: 0, // spawning level bricks
    IDLE:     1, // game ready, waiting for play, ball sitting on top of paddle, game-over moves straight to this
    RUNNING:  2,
    PAUSED:   3,
  };
  let currentGameState = GAME_STATES.SPAWNING;

  // bus.on(EV.LAUNCH, () => { currentGameState = GAME_STATES.RUNNING; });
  // bus.on(EV.BALL_LOST, () => { ResetGame(); });
  function SwitchState(newGameState)
  {
    switch (newGameState) {
      case GAME_STATES.IDLE:
        break;
      case GAME_STATES.RUNNING:
        if (currentGameState == GAME_STATES.IDLE)
        {
          // game start, launch ball
          gameBall.vel = new Vector2(MathUtils.lerp(-0.5, 0.5, Math.random()), 1.);
          gameRenderer.setUniform('uPaddleHit', new Vector2(0, totalTime));
        }

        break;
      case GAME_STATES.PAUSED:
        prevGameStateOnPause = currentGameState;
        break;
    }

    currentGameState = newGameState;
  }

  let animBallRadius = { value: 0. };
  let ballSpawnAnim;
  function CreateBallSpawnAnim()
  {
    ballSpawnAnim = new Tween(animBallRadius)
        .to({ value: ballRadius}, 250)
        .easing(Easing.Back.Out)
        .onUpdate(() => { gameBall.rad = animBallRadius.value; });
  }

  function ResetGame(useNewLevelSeed = false, isInitialLoad = false) {
    SwitchState(GAME_STATES.SPAWNING);

    // reset bricks, ball position
    gameBall = { pos: new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, gamePaddle[1].y + ballRadius + 0.05),
                vel: new Vector2(0, 0), rad: 0 };
    prevBallPos = gameBall.pos.clone();

    if (useNewLevelSeed) currentLevelSeed = Math.random() * 55.;
    const fbmData = createGameFBMNoise(0,currentLevelSeed,bricksCols,bricksRows,4., 25, 68);
    currentLevelSeed = fbmData.offSeed; // need to update in case first try failed
    const fbm = fbmData.fbm;

    // animate bricks, and ball spawning
    async function spawnBricks() {
      await new Promise(resolve => setTimeout(resolve, isInitialLoad ? 0 : 200));

      for (let i = 0; i < bricksState.length; i++) {
        const brick = bricksState[i];
        if (brick.animState === BRICK_ANIM.HIDDEN || brick.animState === BRICK_ANIM.DISABLED) {
          brick.animState = fbm[i] === 1. ? BRICK_ANIM.SPAWN :  BRICK_ANIM.DISABLED;
          brick.animT = 0;
          brick.physicsActive = false;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      ballSpawnAnim.start();

      let switchIdleDelay = 250.;
      if (isInitialLoad) {
        document.dispatchEvent(new CustomEvent('game-appeared'));
        switchIdleDelay = 2000.; // hate this but whatever
      }
      async function waitSwitchIdle() {
        await new Promise(resolve => setTimeout(resolve, switchIdleDelay));
        SwitchState(GAME_STATES.IDLE);
      }
      waitSwitchIdle();
    }
    spawnBricks();
  }

  // >>>> ENTRY, initialization
  let completedSetupOnResize = false;

  let gameField, templateBricksData, currentLevelSeed;
  
  const bricksState = initializeBricksState(bricksCols*bricksRows); 

  const gameRenderer = createGameRenderer(camera, container)

  function onResize(cssW, cssH)
  {
    gameField = getPlayfield(camera, brickPlaneZ); 
    
    walls[0].z = Math.abs(gameField.left); // abs cause z is just distance along normal, if negative it will go to the opposite side...
    walls[1].z = Math.abs(gameField.top);
    walls[2].z = Math.abs(gameField.right);

    templateBricksData = generateBricks(gameField, completedSetupOnResize);

    gamePaddle = createPaddle(gameField);


    if (!completedSetupOnResize)
    {
      completedSetupOnResize = true;

      ResetGame(true, true); // FIRST INITIALIZATION, game appears
    }

    gameBall.rad = ballRadius;

    gameRenderer.setUniform('uWalls', new Vector3(walls[0].z, walls[1].z, walls[2].z));
    gameRenderer.onResize(cssW, cssH);
  }
  // >>>>>>>>>>>>>>>>>>>>
  // >>>>>>>>>>>>>>>>>>>>

  ////////////////////////////////////
  //  end of Game State
  ////////////////////////////////////

  ////////////////////////////////////
  //  Game Loop
  ////////////////////////////////////

  function screenToWorld(pointerX, pointerY) {
    const normalizedX = pointerX / window.innerWidth;  // 0..1
    const normalizedY = pointerY / window.innerHeight;
    return new Vector2(
      (normalizedX - 0.5) * gameField.width,     // centered world coords
      (normalizedY - 0.5) * gameField.height   
    );
  }
  function checkTouchWithinFieldBounds(gameX) {
    return gameX > gameField.left && gameX < gameField.right;
  }
  function updatePaddlePosition(prevPaddle, newPaddleX, field) {
    const newPaddle = [];

    const clampedPaddleCenterX = Math.max(field.left + paddleHalfSize.x, Math.min(field.right - paddleHalfSize.x, newPaddleX)); 
    newPaddle.push(new Vector3(clampedPaddleCenterX - paddleHalfSize.x, prevPaddle[0].y, 0));
    newPaddle.push(new Vector3(clampedPaddleCenterX + paddleHalfSize.x, prevPaddle[1].y, 0.1));

    return newPaddle;
  }

  const PHYSICS_HZ   = 30;
  const PHYSICS_STEP = 1 / PHYSICS_HZ;
  let   accumulator  = 0;
  let totalTime = 0;
  let ballHitTime = 0;

  function update(deltaTime) {
    if (currentGameState === GAME_STATES.PAUSED) 
    {
      hideGameCameraTween.update();
      // no early return cause need to update game-renderer... whatever dudeee
    }
      
    animateCamera(deltaTime);

    // ── 1.  ──
    if (currentGameState !==  GAME_STATES.PAUSED ) {
      totalTime += deltaTime;

      const mouseGamePos = screenToWorld(inputState.pointerX, inputState.pointerY);
      

      ballSpawnAnim.update();
      
      // convert paddle X position to screen coordinates;
      const paddleCenterX = (gamePaddle[0].x + gamePaddle[1].x) * 0.5;
      // console.log('mouseX', mouseGameX.toFixed(2), 'paddleCenterX', paddleCenterX.toFixed(2));
      // calculate difference and move paddle towards mouse
      const diff = mouseGamePos.x - paddleCenterX;
      const moveSpeed = 5.0;
      const moveAmount = diff * moveSpeed * deltaTime;
      let currentPaddleX = paddleCenterX + moveAmount;
      // update paddle position
      gamePaddle = updatePaddlePosition(gamePaddle, currentPaddleX, gameField);
    }
    if (currentGameState === GAME_STATES.IDLE || currentGameState === GAME_STATES.SPAWNING) // move ball with paddle
    {
      gameBall.pos = new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, gamePaddle[1].y + ballRadius + 0.05);
      prevBallPos = gameBall.pos.clone();
    }

    let ballHit = false;

    // TODO READ THIS https://gafferongames.com/post/fix_your_timestep/
    // ── 2. Fixed physics tick ─────────────────────────────────────────────
    if (currentGameState === GAME_STATES.RUNNING) {
      accumulator += Math.min(deltaTime, 0.05);   // cap to avoid spiral-of-death (running way too many physics updates in the same frame causing more lag causing more physics updates etc)
      while (accumulator >= PHYSICS_STEP) {
        const ballSpeed = 3.0;
        const paddlePos = new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, (gamePaddle[0].y + gamePaddle[1].y) * 0.5);
        
        prevBallPos = gameBall.pos.clone(); // for interpolation in rendering
        // gameBall velocity and position updated internally
        const hitsInfo = gamePhysicsStep(PHYSICS_STEP, ballSpeed, gameBall, paddlePos, paddleHalfSize, templateBricksData, bricksState, walls, gameField.bottom);

        hitsInfo.forEach(hit => {
          const hitType = hit.hitType;  // -1 no hit, 1 wallL, 2 wallR, 3 wallT, 4 paddle, 5 brick
          if (hitType < 0) { } // nothing
          else if (hitType < 4) {// wall hit
            gameRenderer.setUniform('uWallHit', new Vector4(gameBall.pos.x, gameBall.pos.y, totalTime, hitType));
          } 
          else if (hitType < 5) { // paddle hit
            gameRenderer.setUniform('uPaddleHit', new Vector2((gameBall.pos.x - paddlePos.x), totalTime));
          } 
          else if (hitType < 6){ // brick hit
            // destroy brick, animate, add points
            // destroyBrick(hitType.hitBrickId);
            bricksState[hit.hitBrickId].animState = BRICK_ANIM.DEATH;
            bricksState[hit.hitBrickId].physicsActive = false;
            if (bricksState.every(b => b.animState === BRICK_ANIM.HIDDEN || b.animState === BRICK_ANIM.DISABLED || b.animState === BRICK_ANIM.DEATH)) { // TODO track a brick counter, this is stupid
              // level clear, reset with new pattern
              currentLevelSeed = Math.random() * 55.; // TODO should use deterministic seed to guarantee different pattern
              ResetGame(true);
            }
          }
          else { // ball lost
            ResetGame(); // reset using same seed 
          }

          if (hitType > 0 && hitType < 6) {
            ballHit = true;
          }
        });

        accumulator -= PHYSICS_STEP;
      }
    }

    // ── 3. Render — always runs, even when paused (so anim timers tick) ──
    const alpha = accumulator / PHYSICS_STEP;   // interpolation factor
    // interpolate ball position for rendering
    const interpolatedBallPos = prevBallPos.clone().lerp(gameBall.pos, alpha);
    const renderBall = new Vector4(interpolatedBallPos.x, interpolatedBallPos.y, 0.05, gameBall.rad);

    // animate ball hit squash n stretch
    if (ballHit) {
      // ballSquashNStretchSpeed = -8;
      // ballSquashNStretchTarget = 0.; // hit something so squash
      ballSquashNStretch = 0.; // TESTING instant squash
      ballSquashNStretchTarget = 1.;
      ballSquashNStretchSpeed = 4;
      // squashing direction should be normal to hit surface!
      // stretching direction should be the ball movement direction
      //ballSquashNStretchAngle = // surface normal angle
      ballHitTime = totalTime;
    }
    if (ballSquashNStretch <= 0)
    {
      ballSquashNStretchSpeed = 4;
      ballSquashNStretchTarget = 1.; // squashed fully, now stretch
    }
    else if (ballSquashNStretch >= 1.0)
    {
      ballSquashNStretchSpeed = -3; 
      ballSquashNStretchTarget = 0.5; // stretched fully, now back to normal
    }
    if (ballSquashNStretchTarget === 0.5 && ballSquashNStretch <= 0.5) // reached normal state
    {
      ballSquashNStretch = 0.5;
      ballSquashNStretchSpeed = 0;
    }
    ballSquashNStretch += ballSquashNStretchSpeed * deltaTime;
    ballSquashNStretch = Math.max(0, Math.min(1, ballSquashNStretch));
    ballSquashNStretchAngle = gameBall.vel.angle(); // rotatetwords movement direction
    const ballSpeed = gameBall.vel.length();
    const ballVelNorm = ballSpeed > 0.001 ? gameBall.vel.clone().multiplyScalar(1./ballSpeed) : new Vector2(0., 1.);
    const hitT = (totalTime-ballHitTime);
    let deform = Math.exp(-hitT * 8.0) - Math.exp(-hitT * 3.0); // Math.exp(-(totalTime-ballHitTime)*3.)*0.5
    // deform = Math.exp(-hitT*3.)*0.5;
    const ballSquashNStretchData = new Vector3(ballVelNorm.x, ballVelNorm.y, deform);
    
    // // animate paddle hit
    // const decay = exp(-(totalTime-paddleHitTime) * 4.0);
    // gameRenderer.material.uniforms.uPaddleHit = new Vector2();

    gameRenderer.update(deltaTime, totalTime, gamePaddle, renderBall, ballSquashNStretchData, templateBricksData, bricksState);
  }

  function animateCamera(deltaTime) 
  {
    const pitchLerp = 1.-(inputState.pointerY / window.innerHeight); // 0..1 from bottom to top
    const yawLerp = inputState.pointerX / window.innerWidth; // 0..1 from left to right
    const newPitch = MathUtils.lerp(0, 3., MathUtils.smoothstep(pitchLerp, 0.4,1.)); // we want to limit so this only starts working when above 0.3 or so
    const newYaw = MathUtils.lerp(2.2, -2.2, yawLerp);

    const targetRot = new Quaternion();
    targetRot.setFromEuler(new Euler(MathUtils.degToRad(newPitch), MathUtils.degToRad(newYaw), 0., 'XYZ'));
    camera.quaternion.slerp(targetRot, deltaTime * 2.);
  }

  ////////////////////////////////////
  //  connect with three-main.js
  ////////////////////////////////////
  return {
    mesh: gameRenderer.mesh,
    readyPromise: gameRenderer.readyPromise,
    onResize,
    update,
    setUniform: gameRenderer.setUniform,
    dispose: gameRenderer.dispose,
  }
}