import { Vector2, Vector3, MathUtils, Quaternion, Euler } from 'three';
// import { bus, EV } from './game-eventBus.js'; // TODO this is not required cause very few components in the game, can just call directly from here i think
import { gamePhysicsStep } from './game-physics.js';
import { createGameRenderer } from './game-renderer.js';
import { createFBMNoise } from './fbm-generator.js';

export const BRICK_ANIM = {
  HIDDEN:  0,   // not rendered, not in physics
  SPAWN:   1,    // scaling in, not yet in physics
  IDLE:    2,     // fully alive, in physics
  DEATH:   3,    // scaling out, already removed from physics
  DISABLED: 4,  // fully disabled in level, used for level pattern generation
};

export function createBreakerGame(camera, containerElementId) {

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
  window.addEventListener('touchend', () => { isHovering = false; }); // TODO hover
  window.addEventListener('pointerdown', () => {
    if (currentGameState == GAME_STATES.IDLE) {
      // bus.emit(EV.LAUNCH);
      SwitchState(GAME_STATES.RUNNING);
    }
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

  const paddleHalfSize = new Vector2(0.8, 0.15);  // using half dimensions for the collision calculations
  const ballRadius = 0.12;

  let gameBall;
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

  function generateBricks(field) {
    const brickWidth = (field.bricksRight - field.bricksLeft) / bricksCols;
    const brickHeight = (field.bricksTop - field.bricksBottom) / bricksRows;

    const bricks = [];
    for (let row = 0; row < bricksRows; row++) {
      for (let col = 0; col < bricksCols; col++) {
        const x0 = field.bricksLeft + col * brickWidth;
        const y0 = field.bricksBottom + row * brickHeight;

        // bricks.push(new Vector3(x0, y0, 0));
        // const depth = MathUtils.lerp(0.1, 0.6, Math.random());
        // bricks.push(new Vector3(x0 + brickWidth, y0 + brickHeight, depth));
        bricks.push({
          minX: x0,
          minY: y0,
          maxX: x0 + brickWidth,
          maxY: y0 + brickHeight,
          depth: MathUtils.lerp(0.1, 0.6, Math.random())
        });
      }
    }

    return { bricks, brickHalfSize: new Vector2(brickWidth * 0.5, brickHeight * 0.5) };
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
    IDLE:     0, // game ready, waiting for play, ball sitting on top of paddle, game-over moves straight to this
    RUNNING:  1,
    PAUSED:   2,
  };
  let currentGameState = GAME_STATES.PAUSED;

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
        }

        break;
      case GAME_STATES.PAUSED:
        break;
    }

    currentGameState = newGameState;
  }

  function ResetGame() {

    // reset bricks, ball paddle position
    gamePaddle = createPaddle(gameField);
    gameBall = { pos: new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, gamePaddle[1].y + ballRadius + 0.05),
                vel: new Vector2(0, 0), rad: ballRadius };

    const fbm = createFBMNoise(0,Math.random()*55.,bricksCols,bricksRows,4.);// testing
    
    // animate bricks, and ball spawning
    async function spawnBricks() {
      console.log('start spawning bricks');
      await new Promise(resolve => setTimeout(resolve, 500));

      for (let i = 0; i < bricksState.length; i++) {
        const brick = bricksState[i];
        // if (brick.animState !== BRICK_ANIM.HIDDEN) continue; // only respawn hidden bricks
        brick.animState = fbm[i] === 1. ? BRICK_ANIM.SPAWN :  BRICK_ANIM.DISABLED;
        brick.animT = 0;
        brick.physicsActive = false;
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // TODO animate ball spawn scaling, wait a bit then start
      SwitchState(GAME_STATES.IDLE);
    }
    console.log('finish spawning bricks!');
    spawnBricks();
  }

  // >>>> ENTRY, initialization
  const gameField = getPlayfield(camera, brickPlaneZ); // TODO might need to be recomputed onResize???
  walls[0].z = Math.abs(gameField.left); // abs cause z is just distance along normal, if negative it will go to the opposite side...
  walls[1].z = Math.abs(gameField.top);
  walls[2].z = Math.abs(gameField.right);
  const templateBricksData = generateBricks(gameField);
  const bricksState = initializeBricksState(templateBricksData.bricks.length);

  ResetGame();
  
  const gameRenderer = createGameRenderer(camera, containerElementId, 
    templateBricksData, bricksState, gameBall, gamePaddle, new Vector3(walls[0].z, walls[1].z, walls[2].z));
  // >>>> 

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

  const PHYSICS_HZ   = 30; // for now... same has three render loop refresh rate
  const PHYSICS_STEP = 1 / PHYSICS_HZ;
  let   accumulator  = 0;

  function update(deltaTime) {
    const mouseGamePos = screenToWorld(inputState.pointerX, inputState.pointerY);
    animateCamera(deltaTime); // minor polish
    // ── 1. Handle inputs, move paddle ──
    if (currentGameState === GAME_STATES.RUNNING || currentGameState === GAME_STATES.IDLE) {
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
    if (currentGameState === GAME_STATES.IDLE) // move ball with paddle
    {
      gameBall.pos = new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, gamePaddle[1].y + ballRadius + 0.05);
    }

    // ── 2. Fixed physics tick ─────────────────────────────────────────────
    if (currentGameState === GAME_STATES.RUNNING) {
      accumulator += Math.min(deltaTime, 0.05);   // cap to avoid spiral-of-death (running way too many physics updates in the same frame causing more lag causing more physics updates etc)
      while (accumulator >= PHYSICS_STEP) {
        const ballSpeed = 3.0;
        const paddlePos = new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, (gamePaddle[0].y + gamePaddle[1].y) * 0.5);
        
        // gameBall velocity and position updated internally
        const hitsInfo = gamePhysicsStep(PHYSICS_STEP, ballSpeed, gameBall, paddlePos, paddleHalfSize, templateBricksData, bricksState, walls, gameField.bottom);

        hitsInfo.forEach(hit => {
          const hitType = hit.hitType;  // -1 no hit, 1 wallL, 2 wallR, 3 wallT, 4 paddle, 5 brick
          if (hitType < 0) { } // nothing
          else if (hitType < 4) {} // TODO animate wall hit
          else if (hitType < 5) {} // TODO animate paddle hit
          else if (hitType < 6){ // brick hit
            // destroy brick, animate, add points
            // destroyBrick(hitType.hitBrickId);
            bricksState[hit.hitBrickId].animState = BRICK_ANIM.DEATH;
            bricksState[hit.hitBrickId].physicsActive = false;
          }
          else { // ball lost
            // TODO animate before reset game
            ResetGame();
          }
        });

        accumulator -= PHYSICS_STEP;
      }
    }

    // ── 3. Render — always runs, even when paused (so anim timers tick) ──
    const alpha = accumulator / PHYSICS_STEP;   // interpolation factor
    // gameRenderer.update(deltaTime, alpha, gamePaddle, gameBall, gameBricksData.bricks); // likely also render gameField??? 
    gameRenderer.update(deltaTime, alpha, gamePaddle, gameBall, templateBricksData, bricksState); // likely also render gameField??? 
  }

  function animateCamera(deltaTime) 
  {
    const pitchLerp = 1.-(inputState.pointerY / window.innerHeight); // 0..1 from bottom to top
    const yawLerp = inputState.pointerX / window.innerWidth; // 0..1 from left to right
    const newPitch = MathUtils.lerp(0, 2.2, MathUtils.smoothstep(pitchLerp, 0.4,1.)); // we want to limit so this only starts working when above 0.3 or so
    const newYaw = MathUtils.lerp(2., -2., yawLerp);

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
    update,
    setUniform: gameRenderer.setUniform,
    dispose: gameRenderer.dispose,
  }
}