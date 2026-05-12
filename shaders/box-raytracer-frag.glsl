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

const int MAX_CUBES_AMOUNT = 2 * 7*15; // 2 * number of cubes, each cube is defined by 2 vec3 (min and max corner)
uniform vec3 uCubes[MAX_CUBES_AMOUNT];
const int MAX_CUBES_AMOUNT_LOOP = 7*15;
// uniform uint uCubesAmmount;

uniform vec3 uPaddle[2]; // min and max corner of paddle box
uniform vec4 uBall; // position and radius of ball
uniform vec3 uWalls; // left, right, top dist from center
//////////////////////////////////////////
// UTILS
//////////////////////////////////////////

const float PI = 3.14159265359;

mat2 rotate(float theta) { float c = cos(theta); float s = sin(theta); return mat2( vec2(c, -s), vec2(s, c) ); }

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

float map(vec3 rayOrigin, vec3 rayDir, out vec3 hitPoint, out vec3 normal, out float hash) { 
    float outT = 1e10; 
    vec3 outNormal, outHitPoint; 
    float outHash = 0.;
    {
        vec3 boxNormal;
        for (int i = 0; i < MAX_CUBES_AMOUNT_LOOP; i++) { 
            vec3 boxMin = uCubes[i*2];
            if (boxMin.z == -100.) continue; 
            vec3 boxMax = uCubes[i*2+1];

            float t = intersectBox(rayOrigin, rayDir, boxMin, boxMax, boxNormal); 
            if (t < outT) { 
                outT = t; 
                outNormal = boxNormal; 
                outHitPoint = rayOrigin + rayDir * t; 
                outHash = hash21(float(i/2)).x;
            } 
        }
        // // check paddle separately
        // float t2 = intersectBox(rayOrigin, rayDir, uPaddle[0], uPaddle[1], boxNormal);
        // if (t2 < outT) { 
        //     outT = t2; 
        //     outNormal = boxNormal; 
        //     outHitPoint = rayOrigin + rayDir * t2; 
        //     outHash = 1.0; // special hash for paddle
        // }
        // check ball separately
        // float t3 = sphIntersect(rayOrigin, rayDir, uBall.xyz, uBall.w, boxNormal);
        // if (t3 < outT) { 
        //     outT = t3; 
        //     outNormal = boxNormal; 
        //     outHitPoint = rayOrigin + rayDir * t3; 
        //     outHash = 0.5; // special hash for ball
        // }
    } 

    hitPoint = outHitPoint; 
    normal = outNormal; 
    hash = outHash;
    return outT; 
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

    float MAX_BOUNCE = 4.0;  // 5
    float MAX_DISPERSE = 4.0; // 3
    for (float disperse = 0.; disperse < MAX_DISPERSE; ++disperse) { 
        sam = vec3(0);
        origin = camOrigin; 
        rayDir = camDir; 
        extinctionDist = 0.; 

        wavelength = disperse / MAX_DISPERSE; // evenly spaced: 0.0, 0.2, 0.4, 0.6, 0.8
        vec2 sampleUv = (gl_FragCoord.xy + floor(uTime * 60.) * 10.) / 1024.;
        float rand = texture2D(uBlueNoiseTexture, sampleUv).r; 
        wavelength += (rand * 2. - 1.) * (.5 / MAX_DISPERSE); // remap rand [0,1] to [-1,1] and then scale by half the spacing between samples, wavelength goes [-0.1, 0.1] [0.1, 0.3] ...
        
        bounceCount = -1.; 
        for (float bounce = 0.; bounce < MAX_BOUNCE; bounce++) { 
            float hitDist = map(origin, rayDir, hitPos, nor, hash); 
            if (hitDist < 0. || hitDist >=  1e10) { 
                // environment
                break; 
            } 
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
            sam += pow(max(1. - abs(dot(rayDir, nor)), 0.), 5.) * .1;  // .1
            // sam += spectrum(hash + uTime * 0.1) * .01;
            // refract 
            raf = refract(rayDir, nor, eta); 
            bool tif = raf == vec3(0); // total internal reflection 
            rayDir = tif ? ref : raf; 
            origin = hitPos + 1e-4 * -nor; 

            // update bounce count
            bounceCount = bounce; 
        } 

        if (bounceCount <= 0.) { // first no hit or first bounce no hit didn't bounce, so don't bother calculating dispersion 
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
            float r = 0.05;
            vec2 paddleHalfSize = (vec2(uPaddle[1] - uPaddle[0]) * 0.5) - r; 
            vec2 d = abs(q)-paddleHalfSize;
            float paddleDist = (length(max(d,0.0)) + min(max(d.x,d.y),0.0)) - r;
            // // // vec3 paddleGlow = getGlow(paddleDist, 0.0015, 1.2 ) * vec3(.12, 0.25, .35); // vec3(.2, 0.5, .95)
            // // // col += paddleGlow; // paddle
            // this looks much much better!!!
            /*float aa = fwidth(paddleDist);
            float body = 1.0 - smoothstep(0.0, aa * 1.5, paddleDist);
            float rim  = 1.0 - smoothstep(0.0, aa * 2., abs(paddleDist));
            // float halo = exp(-max(paddleDist, 0.0) * 20.0);
            float halo = getGlow(abs(paddleDist), 0.0051, 1. );

            vec3 bodyColor = vec3(0.10, 0.12, 0.14) * 0.1;
            vec3 rimColor  = bodyColor * 2.;
            vec3 glowColor = vec3(0.12, 0.14, 0.16) *0.5;

            col += body * bodyColor;
            col += rim * rimColor;
            col += halo * glowColor;*/
            // vec3 dnor = sdgBox(q, paddleHalfSize + r, vec4(r));
            vec3 dnor = sdgSegment(p, vec2(uPaddle[0].x, uPaddle[0].y+paddleHalfSize.y), vec2(uPaddle[1].x, uPaddle[0].y+paddleHalfSize.y));
            paddleDist = dnor.x - paddleHalfSize.y * 5.;
            vec3 fakePaddleNormal = normalize(vec3(dnor.yz, -1.));
            vec3 bodyColor = vec3(0.12, 0.13, 0.14) * ( vec3(0.1) + pow(clamp(1.0 - max(dot(fakePaddleNormal, camDir), 0.0), 0.0, 1.0), 5.) ) * 0.4;
            float aa = fwidth(paddleDist);
            float body = 1.0 - smoothstep(0.0, aa * 1.5, paddleDist);
            float rim  = 1.0 - smoothstep(0.0, aa * 0.8, abs(paddleDist));
            float halo = getGlow(abs(paddleDist), 0.0004, 0.45 );
            // float halo = getGlow((paddleDist), 0.014, 0.9 );

            // vec2 fn = fakePaddleNormal.xy * rotate(uTime * 2.1);
            // float spectralT =  fn.x * 0.25 * fn.y * 0.25;
            // spectralT += clamp(halo, 0., 1.);
            // vec3 spectralTint = spectrum(spectralT * 0.1 + uTime * 0.1);
            // spectralTint = spectrum(fakePaddleNormal.x * fakePaddleNormal.y);
            
            vec3 rimColor  = bodyColor * 1.5;
            vec3 glowColor = vec3(0.12, 0.13, 0.14) *0.5; // spectralTint * 0.15;// vec3(0.12, 0.14, 0.16) *0.5;
            col += body *  bodyColor;
            // col += rim * rimColor;
            col += halo * glowColor;
        }
        {
            vec2 ballPos = uBall.xy;
            vec2 q = p - ballPos; // center on ball
            vec3 dnor = sdgCircle(q, uBall.w);
            vec3 bodyColor = vec3(0.16, 0.14, 0.12) * ( vec3(0.1) + pow(clamp(1.0 - max(dot(normalize(vec3(dnor.yz, -1.)), camDir), 0.0), 0.0, 1.0), 7.) ) * 2.4;
            float aa = fwidth(dnor.x);
            float body = 1.0 - smoothstep(0.0, aa * 1.5, dnor.x);
            float rim  = 1.0 - smoothstep(0.0, aa * 0.8, abs(dnor.x));
            float halo = getGlow(dnor.x, 0.01, 1. );

            
            vec3 rimColor  = bodyColor * 2.5;
            vec3 glowColor = vec3(0.16, 0.14, 0.12) *0.5; // spectralTint * 0.15;// vec3(0.12, 0.14, 0.16) *0.5;
            col += body *  bodyColor;
            col += rim * rimColor;
            col += halo * glowColor;
        }

        {
            // walls
            vec2 q = p;
            q.x = abs(q.x) - uWalls.x - 0.1; // - 0.1 is paddle radius i think...
            vec2 wallHalfSize = vec2(0.01, 7.); 
            vec2 d = abs(q)-wallHalfSize;
            float wallDist = (length(max(d,0.0)) + min(max(d.x,d.y),0.0));

            vec3 wallGlow = vec3(1.)*smoothstep(0.01, 0., wallDist);
            col += getGlow(wallDist, 0.01, 1.85 ) * vec3(.5, 0.5, .52) * 0.8;

            // draw an actual wall 
            float tWall = (uWalls.x -camOrigin.x) / abs(camDir.x); // distance to left wall plane
            if (tWall > 0.0) {
                vec3 wallHit = camOrigin + camDir * tWall;
                if (wallHit.y > -uWalls.y && wallHit.y < uWalls.y && wallHit.z <= 0.1) {
                    float alpha = 0.08;
                    col = mix(col, vec3(0.15, 0.15, 0.2), alpha);
                    // // distance to the field boundary edges in the wall plane
                    // float edgeDist = min(
                    //     abs(wallHit.y - uWalls.y),
                    //     abs(wallHit.y - -uWalls.y)
                    // );
                    // float glow = exp(-edgeDist * 8.0); // soft glow toward top/bottom edges
                    // col += vec3(0.1, 0.15, 0.3) * glow * 0.4;
                }
            }            
        }
    }


    col = pow(col, vec3(1.25)) * 2.5; 
    col = tonemap2(col); 

    // gl_FragColor = vec4(col, anyHit ? 1.0 : 0.0);
    gl_FragColor = vec4(col, 1.);
}