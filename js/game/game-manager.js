import { Vector2, Vector3, MathUtils } from 'three';
// import { bus, EV } from './game-eventBus.js'; // TODO this is not required cause very few components in the game, can just call directly from here i think
import { gamePhysicsStep } from './game-physics.js';
import { createGameRenderer } from './game-renderer.js';

export function createBreakerGame(camera, containerElementId) {

  ////////////////////////////////////
  //  Input state
  ////////////////////////////////////
  // Plain object. Listeners write to it, game loop reads from it each frame.
  // Nothing else imports this — only game-manager.js reads it.
  const inputState = {
    pointerX: window.innerWidth / 2,   // screen pixels
  };

  window.addEventListener('pointermove', e => { inputState.pointerX = e.clientX; });
  window.addEventListener('touchstart', e => { inputState.pointerX = e.touches[0].clientX; }, { passive: true });
  window.addEventListener('touchmove', e => { inputState.pointerX = e.touches[0].clientX; }, { passive: true });
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

  // xy is normal, z is distance along normal
  const walls = [new Vector3(1.0, 0.0, 1.0),
  new Vector3(0.0, -1.0, 1.0),
  new Vector3(-1.0, 0.0, 1.0)];

  const paddleHalfSize = new Vector2(0.8, 0.15);  // using half dimensions for the collision calculations
  
  let gameBall;
  let gamePaddle;
  let gameBricksData;

  const brickPlaneZ = 0;

  function getPlayfield(camera, brickPlaneZ = 0) {
    const distance = Math.abs(camera.position.z - brickPlaneZ);
    const size = new Vector2();
    camera.getViewSize(distance, size);

    const fullWidth = size.x;
    const fullHeight = size.y;

    const topMargin = fullHeight * 0.08;     // UI / breathing room
    const bottomMargin = fullHeight * 0.5;  // paddle + ball space
    const horizontalMargin = fullWidth * 0.04; // breathing room on sides

    return {
      width: fullWidth,
      height: fullHeight,
      top: fullHeight / 2 - topMargin,
      bricksBottom: -fullHeight / 2 + bottomMargin,
      bottom: -fullHeight * 0.5 + (fullHeight * 0.08), // actual field bottom for player paddle
      left: -fullWidth / 2 + horizontalMargin,
      right: fullWidth / 2 - horizontalMargin,
    };
  }

  function generateBricks(field) {
    const cols = 15;
    const rows = 7;

    const brickWidth = (field.right - field.left) / cols;
    const brickHeight = (field.top - field.bricksBottom) / rows;

    const bricks = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x0 = field.left + col * brickWidth;
        const y0 = field.bricksBottom + row * brickHeight;

        bricks.push(new Vector3(x0, y0, 0));
        const depth = MathUtils.lerp(0.1, 0.6, Math.random());
        bricks.push(new Vector3(x0 + brickWidth, y0 + brickHeight, depth));
      }
    }

    return { bricks, brickHalfSize: new Vector2(brickWidth * 0.5, brickHeight * 0.5) };
  }

  // returns array where first entry is boxMin and second boxMax
  function createPaddle(field) {
    const paddle = [];

    const paddleCenterX = (field.left + field.right) / 2;
    const paddleCenterY = field.bottom + paddleHalfSize.y;
    const paddleX0 = paddleCenterX - paddleHalfSize.x;
    const paddleY0 = paddleCenterY - paddleHalfSize.y;
    paddle.push(new Vector3(paddleX0, paddleY0, 0));
    paddle.push(new Vector3(paddleX0 + paddleHalfSize.x * 2., paddleY0 + paddleHalfSize.y, 0.1));

    return paddle;
  }


  ////////////////////////////////////
  //  end of Game Objects and setup functions
  ////////////////////////////////////

  ////////////////////////////////////
  //  Game State
  ////////////////////////////////////
  const GAME_STATES = {
    IDLE: 'IDLE', // game ready, waiting for play, ball sitting on top of paddle, game-over moves straight to this
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
  };
  let currentGameState;

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
    SwitchState(GAME_STATES.IDLE);

    // reset bricks, ball paddle position
    gamePaddle = createPaddle(gameField);
    gameBall = { pos: new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, gamePaddle[1].y + 0.15 + 0.05),
       vel: new Vector2(0, 0), rad: 0.15 };
    gameBricksData = generateBricks(gameField);
  }

  // >>>> ENTRY, initialization
  const gameField = getPlayfield(camera, brickPlaneZ); // TODO might need to be recomputed onResize???
  walls[0].z = Math.abs(gameField.left); // abs cause z is just distance along normal, if negative it will go to the opposite side...
  walls[1].z = Math.abs(gameField.top);
  walls[2].z = Math.abs(gameField.right);
  ResetGame();
  const gameRenderer = createGameRenderer(camera, containerElementId, gameBricksData.bricks, gameBall, gamePaddle);
  // >>>> 

  ////////////////////////////////////
  //  end of Game State
  ////////////////////////////////////

  ////////////////////////////////////
  //  Game Loop
  ////////////////////////////////////

  function screenXtoWorldX(pointerX) {
    const normalized = pointerX / window.innerWidth; // 0..1
    return (normalized - 0.5) * gameField.width;     // centered world coords
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
    // ── 1. Handle inputs, move paddle ──
    if (currentGameState === GAME_STATES.RUNNING || currentGameState === GAME_STATES.IDLE) {
      const mouseGameX = screenXtoWorldX(inputState.pointerX);
      // convert paddle X position to screen coordinates;
      const paddleCenterX = (gamePaddle[0].x + gamePaddle[1].x) * 0.5;
      // console.log('mouseX', mouseGameX.toFixed(2), 'paddleCenterX', paddleCenterX.toFixed(2));
      // calculate difference and move paddle towards mouse
      const diff = mouseGameX - paddleCenterX;
      const moveSpeed = 5.0;
      const moveAmount = diff * moveSpeed * deltaTime;
      let currentPaddleX = paddleCenterX + moveAmount;
      // update paddle position
      gamePaddle = updatePaddlePosition(gamePaddle, currentPaddleX, gameField);
    }
    if (currentGameState === GAME_STATES.IDLE) // move ball with paddle
    {
      gameBall.pos = new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, gamePaddle[1].y + 0.15 + 0.05);
    }

    // ── 2. Fixed physics tick ─────────────────────────────────────────────
    if (currentGameState === GAME_STATES.RUNNING) {
      accumulator += Math.min(deltaTime, 0.05);   // cap to avoid spiral-of-death (running way too many physics updates in the same frame causing more lag causing more physics updates etc)
      while (accumulator >= PHYSICS_STEP) {
        const ballSpeed = 3.0;
        const paddlePos = new Vector2((gamePaddle[0].x + gamePaddle[1].x) * 0.5, (gamePaddle[0].y + gamePaddle[1].y) * 0.5);
        
        // gameBall velocity and position updated internally
        const hitsInfo = gamePhysicsStep(PHYSICS_STEP, ballSpeed, gameBall, paddlePos, paddleHalfSize, gameBricksData, walls, gameField.bottom);

        hitsInfo.forEach(hit => {
          const hitType = hit.hitType;  // -1 no hit, 1 wallL, 2 wallR, 3 wallT, 4 paddle, 5 brick
          if (hitType < 0) { } // nothing
          else if (hitType < 4) {} // TODO animate wall hit
          else if (hitType < 5) {} // TODO animate paddle hit
          else if (hitType < 6){ // brick hit
            // destroy brick, animate, add points
            // destroyBrick(hitType.hitBrickId);
          }
          else { // ball lost
            // TODO animate before reset game

          }
        });

        accumulator -= PHYSICS_STEP;
      }
    }

    // ── 3. Render — always runs, even when paused (so anim timers tick) ──
    const alpha = accumulator / PHYSICS_STEP;   // interpolation factor
    // gameRenderer.update(gameBricksData.bricks, gameBall, gamePaddle, deltaTime, alpha); // likely also render gameField??? 
    gameRenderer.update(deltaTime, alpha, gamePaddle, gameBall, gameBricksData.bricks); // likely also render gameField??? 
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