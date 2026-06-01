precision highp float;
precision highp int;

//////////////////////////////////////////
// Raytracing a bunch of boxes with fake dispersion
// basically copied from one of the goats https://www.shadertoy.com/user/tdhooper
//////////////////////////////////////////


//////////////////////////////////////////
// VARYINGS & UNIFORMS & STUFF
//////////////////////////////////////////

uniform mat4 uProjectionMatrixInverse;
uniform mat4 uViewMatrixInverse;
uniform vec2 uResolution;   
uniform sampler2D uBlueNoiseTexture;
uniform float uTime;

const int MAX_CUBES_AMOUNT = (2 * 7*15) + 2; // 2 * number of cubes, each cube is defined by 2 vec3 (min and max corner)
uniform vec3 uCubes[MAX_CUBES_AMOUNT];
const int MAX_CUBES_AMOUNT_LOOP = (7*15) + 1;
// uniform uint uCubesAmmount;

uniform vec3 uPaddle[2]; // min and max corner of paddle box
uniform vec2 uPaddleHit; // x is ballPos.x - paddlePos.x y is latest hit timestamp
uniform vec4 uBall; // position and radius of ball
uniform vec3 uBallSquashNStretch; // xy normalized ball velocity, z is squish ammount
uniform vec3 uWalls; // left, right, top dist from center
uniform vec4 uWallHit;
//////////////////////////////////////////
// UTILS
//////////////////////////////////////////

const float PI = 3.14159265359;

mat2 rotate(float theta) { float c = cos(theta); float s = sin(theta); return mat2( vec2(c, -s), vec2(s, c) ); }

float smin(float a, float b, float k) {
    float r = exp2(-a/k) + exp2(-b/k);
    return -k*log2(r);
}

//////////////////////////////////////////
// 2D SDF
//////////////////////////////////////////

// https://iquilezles.org/articles/distgradfunctions2d/
vec3 sdgBox( in vec2 p, in vec2 b, vec4 ra )
{
    ra.xy   = (p.x>0.0)?ra.xy : ra.zw;
    float r = (p.y>0.0)?ra.x  : ra.y;
    
    vec2 w = abs(p)-(b-r);
    vec2 s = sign(p);//vec2(p.x<0.0?-1:1,p.y<0.0?-1:1);
    
    float g = max(w.x,w.y);
	vec2  q = max(w,0.0);
    float l = length(q);
    
    return vec3(   (g>0.0)?l-r: g-r,
                s*((g>0.0)?q/l : ((w.x>w.y)?vec2(1,0):vec2(0,1))));
}
vec3 sdgSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 ba = b-a;
    vec2 pa = p-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    vec2  q = pa-h*ba;
    float d = length(q);
    
    return vec3(d,q/d);
}
vec3 sdgCircle( in vec2 p, in float r ) 
{
    float d = length(p);
    return vec3( d-r, p/d );
}

//////////////////////////////////////////
// HASH FUNCTIONS
//////////////////////////////////////////

vec2 hash2( vec2 p ) { 
    return texture2D(uBlueNoiseTexture, (p+0.5)/256.0).rg; // TODO confirm sampling 
    // texture based white noise 
    // return textureLod( iChannel0, (p+0.5)/256.0, 0.0 ).xy; 
    // procedural white noise 
    // return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); 
}
vec2 hash21(float p) { vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx+p3.yz)*p3.zy); }

// https://www.shadertoy.com/view/Xt3cDn
uint baseHash(uint p)
{
    p = 1103515245U*((p >> 1U)^(p));
    uint h32 = 1103515245U*((p)^(p>>3U));
    return h32^(h32 >> 16);
}
vec3 hash31(uint x)
{
    uint n = baseHash(x);
    uvec3 rz = uvec3(n, n*16807U, n*48271U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec3((rz >> 1) & uvec3(0x7fffffffU))/float(0x7fffffff);
}

//////////////////////////////////////////
// POST PROCESSING
//////////////////////////////////////////

// http://filmicworlds.com/blog/filmic-tonemapping-operators/ 
vec3 tonemap2(vec3 texColor) {
    texColor /= 2.;
    texColor *= 16.;
    // Hardcoded Exposure Adjustment 
    vec3 x = max(vec3(0),texColor-0.004);
    return (x*(6.2*x+.5))/(x*(6.2*x+1.7)+0.06);
} 

//////////////////////////////////////////
// PALLETES
//////////////////////////////////////////

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) { return a + b*cos( 6.28318*(c*t+d) ); } 
vec3 spectrum(float n) { return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) ); } 

//////////////////////////////////////////
// SHADING
//////////////////////////////////////////
vec3 light(vec3 p, vec3 dir) { 
    // light coming from top-right-forward 
    vec3 L = normalize(vec3(0.2, 0.2, 1.)); 
    // TESTING
    float d = max(dot(dir, L), 0.0); 
    return vec3(pow(d, 3.)); // sharpen
} 
float fresnelShlick(float n1, float n2, vec3 viewDir, vec3 lDir, vec3 n) { 
    float R0 = pow((n1 - n2) / (n1 + n2), 2.0);
    // vec3 H = normalize(viewDir + lDir); 
    float cosTheta = max(dot(n, viewDir), 0.0);
    float fresnel = R0 + (1.0 - R0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.);
    float reflection = mix(0.08, 1.0, fresnel); // minimum reflectance to max reflectance return reflection; 
    return reflection;
}

// outputs fogFactor
// float sampleBackground(vec3 rd, float dist, vec3 ro) {
//     float n = texture2D(uBlueNoiseTexture, rd.xy * .01 + uTime * 0.0002).r;
//     float density = mix(0.6, 1., n);
//     // density = 0.1;
//     return clamp(exp(-(dist-18.) * density), 0., 1.); // 1 near, 0 far
// }
vec3 sampleBackground(vec3 rd) {
    // return vec3(0.002);

    float horizon = 1.-exp(-(dot(rd.xy, rd.xy)) * 1.3);
    
    vec3 baseColor    = vec3(1.02, 0.02, 0.05);  // near-black with slight blue
    vec3 horizonColor = vec3(0.06, 0.06, 0.12);  // slightly lighter at horizon
    
    // return vec3(1., 0.2, 0.2) * horizon;
    return clamp(vec3(0.008) * horizon, 0., 1.);
    // return mix(baseColor, horizonColor, horizon * 0.5) * fog;
}
float getFogFactor(float dist, float fogStartDepth, float fallOff) {
    return clamp(exp(-(dist-fogStartDepth) * fallOff), 0., 1.);
}
//////////////////////////////////////////
// RAY-TRACING INTERSECTIONS
//////////////////////////////////////////
// https://iquilezles.org/articles/intersectors/
float sphIntersect( in vec3 ro, in vec3 rd, in vec3 ce, float ra, out vec3 normal )
{
    vec3 oc = ro - ce;
    float b = dot( oc, rd );
    float c = dot( oc, oc ) - ra*ra;
    float h = b*b - c;
    if( h<0.0 ) return 1e10; // no intersection
    h = sqrt( h );
    if (-b+h < 0.0) return 1e10; // no intersection
    else if ( -b-h < 0.0) { // ro inside the sphere
        float hitDist = -b+h;
        normal = (ro + rd * hitDist - ce) / ra; // normal at hit point
        return hitDist;
    }
    else { // ro outside the sphere
        float hitDist = -b-h;
        normal = (ro + rd * hitDist - ce) / ra; // normal at hit point
        return hitDist;
    }

    return 1e10;
}

float intersectBox(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax, out vec3 boxNormal) { 
    vec3 invDir = 1.0 / rayDir;
    vec3 tMinTemp = (boxMin - rayOrigin) * invDir; 
    vec3 tMaxTemp = (boxMax - rayOrigin) * invDir; 
    vec3 tMin = min(tMinTemp, tMaxTemp); 
    vec3 tMax = max(tMinTemp, tMaxTemp); 
    float t0 = max(max(tMin.x, tMin.y), tMin.z); 
    // largest entering t 
    float t1 = min(min(tMax.x, tMax.y), tMax.z); 
    // smallest exiting t
    if (t1 >= max(t0, 0.0)) { 
        if (t0 < 0.0) { 
            // Ray starts inside the box 
            vec3 normal = vec3(0); 
            if (t1 == tMax.x) normal.x = sign(rayDir.x); 
            else if (t1 == tMax.y) normal.y = sign(rayDir.y); 
            else normal.z = sign(rayDir.z); 
            boxNormal = normal; 
            return t1; 
        } 
        // Determine which face was hit 
        vec3 normal = vec3(0); 
        if (t0 == tMin.x) normal.x = -sign(rayDir.x); 
        else if (t0 == tMin.y) normal.y = -sign(rayDir.y); 
        else normal.z = -sign(rayDir.z); 
        boxNormal = normal; 
        return t0; 
    } 
    
    return  1e10; 
}

float bounceWave(float distFromHit, float wallHalfLength, float timeSinceHit) {
    float decay = exp(-timeSinceHit * 4.);
    float wave = sin((distFromHit*1.)+PI*0.5) * 0.2 * smoothstep( uWalls.x * 0.4, 0., abs(distFromHit));
    wave *= smoothstep(1., 0., abs(distFromHit)-wallHalfLength+1.); // TODO FIXME NOT WORKING make sure wave is 0 in tips so it doesnt get to fucked up **  smoothstep( uWalls.x * 0.4, 0., abs(distFromHit)); cause uWalls.x here very likely you dumb fuck
    wave *= sin((timeSinceHit*25.)+PI) * decay; // move up and down with time and decay wiht time
    return wave;
}

#define HIT_NONE    -1.0
#define HIT_BRICK    0.0
#define HIT_WALL     1.0

vec2 map(vec3 rayOrigin, vec3 rayDir, out vec3 hitPoint, out vec3 normal, out float hash, inout int brickId) { 
    float outT = 1e10; 
    float matId = HIT_NONE;
    vec3 outNormal, outHitPoint; 
    int outBrickId = -1;
    float outHash = 0.;

    if (brickId != -1) {
        vec3 boxNormal;
        float t = intersectBox(rayOrigin, rayDir, uCubes[brickId*2], uCubes[brickId*2+1], boxNormal); 
        if (t < outT) { 
            outT = t; 
            outNormal = boxNormal; 
            outHitPoint = rayOrigin + rayDir * t; 
            outHash = hash21(float(brickId/2)).x;
            matId = HIT_BRICK;
            outBrickId = brickId;

            hitPoint = outHitPoint; 
            normal = outNormal; 
            hash = outHash;
            brickId = outBrickId;
            return vec2(outT, matId); 
        }
        else { 
            // THIS SHOULD NEVER HAPPEN
            brickId = -1; // if we miss the brick we were previously hitting, reset brickId to -1 so we check all bricks again next time
        }
    }
        
    { // check walls
        float xWave = 0.; // need to otherwise will see both walls waving when hits close to corners
        float yWave = 0.;
        float tz = -rayOrigin.z / rayDir.z; // distance to hit z=0 plane
        vec2 q = rayOrigin.xy + rayDir.xy * tz; // hit point on z=0 plane
        if (uWallHit.w == 2.) {
            yWave = bounceWave(q.x - uWallHit.x, uWalls.x , uTime - uWallHit.z);
        }
        else if (uWallHit.w == 1. || uWallHit.w == 3.)
        {
            xWave = bounceWave(q.y - uWallHit.y, uWalls.y , uTime - uWallHit.z);
            xWave *= step(0.0, q.x * uWallHit.x); // 1 if same side as hit, 0 if opposite, so it doesnt mirror
        }

        float tWall = ((uWalls.x + xWave) -rayOrigin.x) / abs(rayDir.x); // distance to left/right wall plane
        if (tWall > 0.0 && tWall < outT) {
            vec3 wallHit = rayOrigin + rayDir * tWall;
            if (wallHit.y < uWalls.y && wallHit.z <= 0.05) {
                outT = tWall; 
                outNormal = vec3(-sign(rayDir.x), 0., 0.); 
                outHitPoint = wallHit; 
                outHash = hash21(6565.).x;
                matId = HIT_WALL;
            }
        }


        float tCeil = ((uWalls.y+yWave) - rayOrigin.y) / rayDir.y; // distance to ceiling plane
        if (tCeil > 0.0 && tCeil < outT) {
            vec3 ceilHit = rayOrigin + rayDir * tCeil;
            if (ceilHit.x > -uWalls.x && ceilHit.x < uWalls.x && ceilHit.z <= 0.05) {
                outT = tCeil; 
                outNormal = vec3(0., -sign(rayDir.y), 0.); 
                outHitPoint = ceilHit; 
                outHash = hash21(6565.).x;
                matId = HIT_WALL;
            }
        }
    }
    {
        vec3 boxNormal;
        vec3 aabbMin = uCubes[MAX_CUBES_AMOUNT_LOOP*2-2]; // second to last entry is aabb min
        vec3 aabbMax = uCubes[MAX_CUBES_AMOUNT_LOOP*2-1]; // last entry is aabb max
        if (intersectBox(rayOrigin, rayDir, aabbMin, aabbMax, boxNormal) < outT) { // TODO, faster aabb function first check intersection with big aabb containing all bricks for early out optimization
            // TODO rather than checking every cube, use aabb intersection point and only check nearby cubes
            for (int i = 0; i < MAX_CUBES_AMOUNT_LOOP - 1; i++) { 
                vec3 boxMin = uCubes[i*2];
                if (boxMin.z == -100.) continue; 
                vec3 boxMax = uCubes[i*2+1];

                float t = intersectBox(rayOrigin, rayDir, boxMin, boxMax, boxNormal); 
                if (t < outT) { 
                    outT = t; 
                    outNormal = boxNormal; 
                    outHitPoint = rayOrigin + rayDir * t; 
                    outHash = hash21(float(i/2)).x;
                    matId = HIT_BRICK;
                    outBrickId = i;
                    // break; // if i sorted bricks by depth maybe this works??
                } 
            }
        }
    } 

    hitPoint = outHitPoint; 
    normal = outNormal; 
    hash = outHash;
    brickId = outBrickId;
    return vec2(outT, matId); 
}

//https://www.shadertoy.com/view/3s3GDn
float getGlow(float dist, float radius, float intensity){
	return pow(radius / max(dist, 0.01), intensity);	
}

void main() {
    /*vec2 p = (-uResolution.xy + 2.0*gl_FragCoord.xy) / uResolution.y;

    float focalLength = 2.0; // distance to image plane

    // camera setup
    // vec3 camPos = vec3(-3.0, 2.0, -2.0);
    vec3 camPos = vec3(0., -.0, 3.40);
    // camPos.xz *= rotate(uTime * .51);   
    // camPos.xz *= rotate(PI * 0.);   
    vec3 camForward = normalize(vec3(0. , -.0, 0.) - camPos);
    vec3 camRight = normalize(cross(camForward, vec3(0.0,1.0,0.0)));
    vec3 camUp = cross(camRight, camForward);
    mat3 camMat = mat3(camRight, camUp, camForward); // use this to build pixel rays
    vec3 pixelPos = camPos + camMat * vec3(p, focalLength);
*/
    // Convert gl_FragCoord to normalized device coords (NDC), range [-1,1]
    vec2 uv = gl_FragCoord.xy / uResolution.xy; 
    uv = uv * 2.0 - 1.0;  // now uv in [-1,1] range
    // Construct a clip-space position at the near plane (z = -1) or far plane (z = 1)
    vec4 clipPos = vec4(uv, -1.0, 1.0);
    // Transform to camera/view space by inverse projection
    vec4 viewPos = uProjectionMatrixInverse * clipPos;
    viewPos /= viewPos.w;
    // Transform to world space by inverse view matrix
    vec4 worldPos = uViewMatrixInverse * viewPos;
    worldPos /= worldPos.w;

    vec3 camOrigin = cameraPosition; // from THREE shader uniforms
    vec3 camDir = normalize(worldPos.xyz - cameraPosition);

    vec3 hitPos, rayDir, origin, sam, ref, raf, nor;
    float ior, offset, extinctionDist, maxDist, firstLen, bounceCount, wavelength, hash;

    vec3 col = vec3(0);
    vec3 bgCol = vec3(1.);
    maxDist = 15.;


    origin = camOrigin;
    rayDir = camDir;

    bool anyHit = false;
    // bool entering = false;
    int hitBrickId = -1; // major optimization, once a ray hits a brick it never goes out due to the fakery refraction code

    float MAX_BOUNCE = 5.0;  // 5
    float MAX_DISPERSE = 5.0; // 3
    for (float disperse = 0.; disperse < MAX_DISPERSE; ++disperse) { 
        sam = vec3(0);
        origin = camOrigin; 
        rayDir = camDir; 
        extinctionDist = 0.; 

        wavelength = disperse / MAX_DISPERSE; // evenly spaced: 0.0, 0.2, 0.4, 0.6, 0.8
        vec2 sampleUv = (gl_FragCoord.xy + floor(uTime * 60.) * 10.) / 1024.;
        float rand = texture2D(uBlueNoiseTexture, sampleUv).r; 
        wavelength += (rand * 2. - 1.) * (.5 / MAX_DISPERSE); // remap rand [0,1] to [-1,1] and then scale by half the spacing between samples, wavelength goes [-0.1, 0.1] [0.1, 0.3] ...
        
        bool hitAnyBrick = false;
            
        bounceCount = -1.; 
        for (float bounce = 0.; bounce < MAX_BOUNCE; bounce++) { 
            vec2 hit = map(origin, rayDir, hitPos, nor, hash, hitBrickId); 
            float hitDist = hit.x;
            float matId = hit.y;

            if (matId == HIT_NONE) {// (hitDist < 0. || hitDist >=  1e10) { 
                // environment
                // sam += mix(vec3(0.), vec3(0.1), sampleBackground(rayDir, 2.)); // supose fogColor = vec3(0.1), bgCol = vec3(0.)
                // sam += mix(vec3(0.0), vec3(0.1), sampleBackground(rayDir, 22.0, origin));
                // float fogFactor = sampleBackground(rayDir, 35.0);
                // sam += mix(vec3(0.0), vec3(0.01), fogFactor);
                sam += sampleBackground(rayDir);
                break; 
            }
            if (matId == HIT_WALL){
                vec3 refractedDir = refract(rayDir, nor, 1. / 1.5);
                // wall coloring:
                float distToFront = abs(hitPos.z - 0.1); // front sits at z=0 - 0.1 slight offset, take abs for distance, in practice will always be negative cause camera is on +z facing -z
                float distToYEdges = uWalls.y - hitPos.y; // ceil only
                float edgeDist = smin(distToFront, distToYEdges, 0.4);
                float wallOpacity = mix(0.02, 0.1, exp(-edgeDist * 5.));
                // vec3 environmentColor =  sampleBackground(refractedDir); // color of environment behind wall, with fog
                // vec3 actualWallColor = mix(environmentColor, vec3(.5), wallOpacity); // actual wall final color
                vec3 actualWallColor = vec3(0.5) * wallOpacity; // TESTING
                // actualWallColor = abs(hitPos.z - camOrigin.z) > 20. ? vec3(0.1,0.2,0.1) : vec3(0.21,0.1,0.1); // TESTING
                // vec3 actualWallColor = vec3(0.1, 0.2, 0.1); // TESTING
                vec3 fogColor = sampleBackground(rayDir);
                sam +=  mix(fogColor, actualWallColor, getFogFactor(abs(hitPos.z - camOrigin.z), 10.0, .6));
                break; // background is last thing beyond wall so we dont need to keep raytracing
            }

            hitAnyBrick = true;
            anyHit = true;
            // update ior 
            float ior = mix(1.2, 1.8, wavelength);
            bool entering = dot(rayDir, nor) < 0.; // if true we are entering the surface, if false we are exiting
            entering = !entering;
            float eta = entering ? 1. / ior : ior;
            // nor = entering ? nor : -nor; // !!! skipping this keeps the ray inside geometry creating cool weird patterns...
            
            extinctionDist += hitDist;
            
            ref = reflect(rayDir, nor); 

            // shade
            sam += light(hitPos, ref) * .125; // .125
            sam += pow(max(1. - abs(dot(rayDir, nor)), 0.), 5.) * .1 ;  // .1
            // sam *= spectrum(-wavelength+.125); 

            raf = refract(rayDir, nor, eta); 
            bool tif = raf == vec3(0); // total internal reflection 
            rayDir = tif ? ref : raf; 
            origin = hitPos + 1e-4 * -nor; 

            // update bounce count
            bounceCount = bounce; 
        } 

        bool stopDispersion = (bounceCount <= 0.) || (!hitAnyBrick);
        if (stopDispersion) { // first no hit or first bounce no hit didn't bounce, so don't bother calculating dispersion 
            col += sam * MAX_DISPERSE / 2.; 
            // col += sam; 
            break;
        } else { 
            vec3 extinction = vec3(1.) * 1.; 
            // vec3 extinction =  vec3(1.) - spectrum(hash); 
            // vec3 extinction = vec3(1.) - spectrum(-extinctionDist*.1+0.2); 
            // vec3 extinction = vec3(1.); 
            // extinctionDist += 0.1;
            extinction = 1. / (1. + (extinction * extinctionDist)); 
            col += sam * extinction * spectrum(-wavelength+.125); 
            // col += sam * extinction ; 
            // col += sam * extinction;
            // col += sam * spectrum(-wavelength+.0025);
        }
    }
    // if (bounceCount == -1.) col += vec3(1., 0., 0.); // TESTING
    col /= MAX_DISPERSE; 
    // col = pow(col, vec3(1.25)) * 2.5; 
    // col = tonemap2(col); 

    { // 2D STUFF WALLS BALL PADDLE TESTING
        float t = -camOrigin.z / camDir.z; // distance to hit z=0 plane
        vec2 p = camOrigin.xy + camDir.xy * t; // hit point on z=0 plane
        {
            vec2 paddlePos = (uPaddle[0].xy + uPaddle[1].xy) * 0.5;
            vec2 q = p - paddlePos; // center on paddle 
            float r = 0.1;
            vec2 paddleHalfSize = (vec2(uPaddle[1] - uPaddle[0]) * 0.5);

            float timeSinceHit = uTime - uPaddleHit.y;
            float decay        = exp(-timeSinceHit * 4.);
            float distFromHit  = q.x - uPaddleHit.x;
            float wave = sin((distFromHit*paddleHalfSize.x*1.8)+PI*0.5) * 0.2; // * exp(-abs(distFromHit)*1.4); // wave around hit point, and decay with distance
            wave *= sin((timeSinceHit*25.)+PI) * decay; // move up and down with time and decay wiht time
            q.y  -= wave;

            vec3 dnor = sdgBox(q, paddleHalfSize, vec4(r));
            float paddleDist = dnor.x;
            vec3 fakePaddleNormal = normalize(vec3(dnor.yz, -1.));
            vec3 bodyColor = vec3(0.12, 0.13, 0.14) * ( vec3(0.1) + pow(clamp(1.0 - max(dot(fakePaddleNormal, camDir), 0.0), 0.0, 1.0), 5.) ) * 0.4;
            float aa = fwidth(paddleDist);
            float body = 1.0 - smoothstep(0.0, aa * 1.5, paddleDist);
            vec2 glowRI = mix(vec2(0.0004, 0.45), vec2(0.01, 0.6), decay); // TODO tweak, i like the effect but the values not so much
            float halo = getGlow(abs(paddleDist), glowRI.x, glowRI.y );

            vec3 rimColor  = bodyColor * 1.5;
            vec3 glowColor = vec3(0.12, 0.13, 0.14) *0.5;
            col += body *  bodyColor;
            col += halo * glowColor;
        }
        {
            if (uBall.w != 0.) // make sure ball doesnt show before spawn animation
            {
                vec2 ballPos = uBall.xy;
                vec2 q = p - ballPos; // center on ball
                
                // float squashNStretch = uBallSquashNStretch.x; // squach n stretch, 0 squash, 0.5 normal, 1 stretch
                // squashNStretch = 1.;// TESTING
                // float squashNStretchDirection = uBallSquashNStretch.y;
                // q *= rotate(-squashNStretchDirection);
                // q *= vec2(-0.4*squashNStretch + 1.2, 0.4*squashNStretch + 0.8);
                // q.y += uBall.w * 0.5 * (1. - (clamp(squashNStretch*2., 0., 1.))); // need to move slightly down so bottom of ball matches hit pos when squashed
                // stretch along vel direction, squash perpendicular
                // q+=ballPos;
                vec2 velDir        = uBallSquashNStretch.xy;
                vec2 perpDir       = vec2(-velDir.y, velDir.x);
                float alongVel     = dot(q, velDir);
                float alongPerp    = dot(q, perpDir);
                float squeeze = uBallSquashNStretch.z;
                // squeeze =  0.5; // at hit time
                // squeeze = 0.; // falls off to this, is the default scalling
                // scale the SDF space — stretch one axis, squash the other
                q = velDir * alongVel * (1.0 - squeeze) + perpDir * alongPerp * (1.0 + squeeze);
                // q = perpDir * alongPerp * (1.0 + squeeze);

                vec3 dnor = sdgCircle(q, uBall.w);  
                vec3 bodyColor = vec3(0.15, 0.14, 0.13) * ( vec3(0.1) + pow(clamp(1.0 - max(dot(normalize(vec3(dnor.yz, -1.)), camDir), 0.0), 0.0, 1.0), 7.) );
                float aa = fwidth(dnor.x);
                float body = 1.0 - smoothstep(0.0, aa * 1.5, dnor.x);
                float rim  = 1.0 - smoothstep(0.0, aa * 0.8, abs(dnor.x));
                float halo = getGlow(dnor.x, 0.01, 1. );
                
                vec3 rimColor  = bodyColor * 2.;
                vec3 glowColor = vec3(0.15, 0.14, 0.13) *0.3; // spectralTint * 0.15;// vec3(0.12, 0.14, 0.16) *0.5;
                col += body *  bodyColor;
                col += rim * rimColor;
                col += halo * glowColor;
            }
        }

        {
            float timeSinceHit = uTime - uWallHit.z;
            // walls
            vec2 q = p;
            q.x = abs(q.x) - uWalls.x;
            vec2 wallHalfSize = vec2(0.01, uWalls.y); 

            if (uWallHit.w == 1. || uWallHit.w == 3.) {
                float distFromHit = q.y - uWallHit.y;
                float wave = bounceWave(distFromHit, wallHalfSize.y , timeSinceHit);
                float s = step(0.0, p.x * uWallHit.x);
                wave *= s;
                q.x  -= wave;
            }

            q.y += uWalls.y * 1.5;  // hacky way to make bottom further down...
            wallHalfSize = vec2(0.01, uWalls.y * 2.5); 
            vec2 d = abs(q)-wallHalfSize;
            float wallDist = (length(max(d,0.0)) + min(max(d.x,d.y),0.0));

            // ceil
            q = p;       
            q.y = q.y - uWalls.y;
            wallHalfSize = vec2(uWalls.x, 0.01);

            if (uWallHit.w == 2.) {
                float distFromHit = q.x - uWallHit.x;
                q.y -= bounceWave(distFromHit, wallHalfSize.x , timeSinceHit);
            }

            float glowMix = exp(-timeSinceHit * 4.) * smoothstep( uWalls.y * 0.45, 0., abs(length(p-uWallHit.xy)));

            d = abs(q)-wallHalfSize;
            // wallDist = smin(wallDist, (length(max(d,0.0)) + min(max(d.x,d.y),0.0)), 0.001);
            wallDist = min(wallDist, length(max(d,0.0)) + min(max(d.x,d.y),0.0));

            vec2 glowRI = mix( vec2(0.01, 1.3), vec2(0.03, 1.), glowMix);
            col += getGlow(wallDist, glowRI.x, glowRI.y ) * vec3(0.15, 0.14, 0.13);
        }
    }

    col = pow(col, vec3(1.25)) * 2.5; 
    col = tonemap2(col); 

    // col *= mix(vec3(0.0, 0., 0.), vec3(1., 0.0, 0.), bounceCount / MAX_BOUNCE);
    // gl_FragColor = vec4(col, anyHit ? 1.0 : 0.0);
    gl_FragColor = vec4(col, 1.);
}