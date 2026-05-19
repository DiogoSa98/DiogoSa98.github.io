// https://www.shadertoy.com/view/MddGzf

import {
  Vector2,
  MathUtils,
  Vector3,
} from 'three';
import { BRICK_ANIM } from './game-manager.js';

function step(edge, x) { return x < edge ? 0 : 1; }

function reflect(I, N) { return I.clone().sub(N.clone().multiplyScalar(2. * N.clone().dot(I.clone()))); } // glsl reflect I - 2.0 * dot(N, I) * N.

// intersect a disk sweept in a linear segment with a line/plane. 
function iPlane( ro, rd, rad, pla )
{
    const a = rd.dot( new Vector2(pla.x, pla.y) );
    if( a>0.0 ) return -1.0;
    let t = (rad - pla.z - ro.dot( new Vector2(pla.x, pla.y) ) ) / a;
    if( t>=1.0 ) t=-1.0;
    return t;
}

// intersect a disk sweept in a linear segment with a box 
function iBox( ro, rd, rad, bce, bwi ) 
{
    const m = new Vector2(1.0/rd.x, 1./rd.y);
    const n = m.clone().multiply(ro.clone().sub(bce.clone())); // m*(ro - bce)
    const k = new Vector2(Math.abs(m.x), Math.abs(m.y)).multiply(bwi.clone().addScalar(rad));; // abs(m)*(bwi+rad)
    const t1 = new Vector2(-n.x, -n.y).sub(k);
    const t2 = new Vector2(-n.x, -n.y).add(k);
	const tN = Math.max( t1.x, t1.y );
	const tF = Math.min( t2.x, t2.y );
	if( tN > tF || tF < 0.0) return new Vector3(-1., -1., -1.);
    if( tN>=1.0 ) return new Vector3(-1., -1., -1.);
    const nor = new Vector2(step(t1.y, t1.x), step(t1.x, t1.y)).multiply(new Vector2(-Math.sign(rd.x), -Math.sign(rd.y))); // -sign(rd)*step(t1.yx,t1.xy);
	return new Vector3( tN, nor.x, nor.y );
}

// perform sweep test collision checks with bricks, walls and paddle,
// updates ball position and velocity
// also outputs collision objects
export function gamePhysicsStep(fixedDeltaTime, ballSpeed, gameBall, paddlePos, paddleHalfSize, gameBricksData, bricksState, walls, bottom)
{
    const ballPos = gameBall.pos;
    const ballVel = gameBall.vel;
    const ballRadius = gameBall.rad;
    const bricksPosArray = gameBricksData.bricks;
    const brickHalfSize = gameBricksData.brickHalfSize;
    // float dis = 0.01*gameSpeed*(iTimeDelta*60.0); // the ball moves 0.01*gameSpeed units per second??
    let dis = ballSpeed * fixedDeltaTime; // ball movement displacement size per physics update
        
    // let hitType = -1; // 0 no hit, 1 wallL, 2 wallR, 3 wallT, 4 paddle, 5 brick
    // let hitBrickId = -1;
    const hitData = []; // store all hit data across sweep iterations
    

    // do up to 3 sweep collision detections (usually 0 or 1 will happen only)
    for( let j=0; j<3; j++ )
    {
        let hitType = -1; // 0 no hit, 1 wallL, 2 wallR, 3 wallT, 4 paddle, 5 brick
        let hitBrickId = -1;
        let nor;
        let t = 1000.0; // actual percentage of displacement (dis) travelled from 0 to 1

        // test walls
        const wl = walls[0];
        const wt = walls[1];
        const wr = walls[2];
        const t1 = iPlane( ballPos, ballVel.clone().multiplyScalar(dis), ballRadius, wl ); if( t1>0.0         ) { t=t1; nor = new Vector2(wl.x, wl.y); hitType=1; }
        const t2 = iPlane( ballPos, ballVel.clone().multiplyScalar(dis), ballRadius, wt ); if( t2>0.0 && t2<t ) { t=t2; nor = new Vector2(wt.x, wt.y); hitType=2; }
        const t3 = iPlane( ballPos, ballVel.clone().multiplyScalar(dis), ballRadius, wr ); if( t3>0.0 && t3<t ) { t=t3; nor = new Vector2(wr.x, wr.y); hitType=3; }
        
        // test paddle
        const t4 = iBox( ballPos, ballVel.clone().multiplyScalar(dis), ballRadius, paddlePos, paddleHalfSize );
        if( t4.x>0.0 && t4.x<t ) { t=t4.x; nor = new Vector2(t4.y, t4.z); hitType=4;  }
        
        // test bricks
        // check it bricks big aabb
        const aabbPos =  new Vector2((gameBricksData.aabb[0].x + gameBricksData.aabb[1].x) * 0.5,
                                        (gameBricksData.aabb[0].y + gameBricksData.aabb[1].y) * 0.5);
        const aabbHalfSize = new Vector2((gameBricksData.aabb[1].x - gameBricksData.aabb[0].x) * 0.5,
                                        (gameBricksData.aabb[1].y - gameBricksData.aabb[0].y) * 0.5);
        const tAABB = iBox( ballPos, ballVel.clone().multiplyScalar(dis), ballRadius, aabbPos, aabbHalfSize );

        if( tAABB.x>0.0 || tAABB.x <-1. && tAABB.x<t )
        {
            for (let bi = 0; bi < bricksPosArray.length; bi++) {
                if (bricksState[bi].animState !== BRICK_ANIM.IDLE) continue;
                if (hitData.some(e => e.hitBrickId === bi)) continue; // skip already hit bricks (cause destroyed)

                const brickPos = new Vector2(bricksPosArray[bi].minX + brickHalfSize.x,
                                            bricksPosArray[bi].minY + brickHalfSize.y);
                
                const t5 = iBox( ballPos, ballVel.clone().multiplyScalar(dis), ballRadius, brickPos, brickHalfSize );
                if( t5.x>0.0 && t5.x<t )
                {
                    hitType = 5;
                    hitBrickId = bi;
                    t = t5.x;
                    nor = new Vector2(t5.y, t5.z);
                }
            }
        }

        // no collisions
        if( hitType<0 ) break;

        hitData.push({hitType, hitBrickId});

        // bounce
        ballPos.add(ballVel.clone().multiplyScalar(t*dis)); // update ball position, move until collision position balPosVel.xy += t*dis*balPosVel.zw; 
        dis *= 1.0-t; // the remainder of the distance is moved by the reflected velocity if a collision happened
        
        // did hit walls
        if( hitType<4 )
        {
            const ref = reflect( ballVel, nor );
            ballVel.x = ref.x;
            ballVel.y = ref.y;
        }
        // did hit paddle
        else if( hitType<5 )
        {
            // console.log('vel length, reflected length', ballVel.length, (reflect(ballVel, nor)).length());
            const velLength = ballVel.length();
            // new velocity angle based on hit pos 
            const sD = (paddlePos.x - ballPos.x) / paddleHalfSize.x; // [-1,1]
            const angle = (Math.PI*0.4*sD) + Math.PI*0.5;
            ballVel.x = Math.cos(angle);
            ballVel.y = Math.sin(angle);
            // console.log('angle ', angle, ' sd ', sD, 'vel', ballVel);
            ballVel.multiplyScalar(velLength);
            // const ref = reflect( ballVel, nor );
            // ballVel.x = ref.x;
            // ballVel.y = ref.y;
            // // borders bounce back
            // if( ballPos.x > (paddlePos.x+paddleHalfSize.x) ) ballVel.x =  Math.abs(ballVel.x);
            // else if( ballPos.x < (paddlePos.x-paddleHalfSize.x) ) ballVel.x = -Math.abs(ballVel.x);
            // //balPosVel.z += 0.37*moveTotal; // account for paddle movement direction for fun TODO TWEAK
            // //balPosVel.z += 0.11*hash1( float(iFrame)*7.1 ); // add some randomness for fun TODO TWEAK
            // ballVel.x = MathUtils.clamp( ballVel.x, -0.9, 0.9 );
            // ballVel.normalize();
        }
        // did hit a brick
        else if( hitType<6 )
        {
            const ref = reflect( ballVel, nor );
            ballVel.x = ref.x;
            ballVel.y = ref.y;
        }
    }
    
    ballPos.add(ballVel.clone().multiplyScalar(dis)); // update ball position according to bounce reflected velocity balPosVel.xy += dis*balPosVel.zw;
    
    // detect miss, ball beyond bottom "wall"
    if (ballPos.y < bottom) hitData.push({hitType: 6, hitBrickId: -1});
    
    return hitData; // { hitType, hitBrickId, ballLost };
}