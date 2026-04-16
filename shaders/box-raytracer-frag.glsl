precision highp float;
precision highp int;

//////////////////////////////////////////
// Raytracing a bunch of boxes with fake dispersion
// basically copied from one of the goats https://www.shadertoy.com/user/tdhooper
//////////////////////////////////////////


//////////////////////////////////////////
// VARYINGS & UNIFORMS & STUFF
//////////////////////////////////////////

uniform vec2 uResolution;   
uniform sampler2D uBlueNoiseTexture;
uniform float uTime;

const int CUBES_AMOUNT = 2 * 1; // 2 * number of cubes, each cube is defined by 2 vec3 (min and max corner)
uniform vec3 uCubes[CUBES_AMOUNT];

//////////////////////////////////////////
// UTILS
//////////////////////////////////////////

const float PI = 3.14159265359;

mat2 rotate(float theta) { float c = cos(theta); float s = sin(theta); return mat2( vec2(c, -s), vec2(s, c) ); }

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
    vec3 L = normalize(vec3(-1.6, 0.5, 0.4)); 
    // TESTING
    // L.xz *= rotate(uTime * .51);   
    float d = max(dot(dir, L), 0.0); 
    return vec3(pow(d, 4.)); // sharpen
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
        for (int i = 0; i < CUBES_AMOUNT - 1; i+=2) { 
            vec3 boxMin = uCubes[i]; 
            vec3 boxMax = uCubes[i+1];

            float t = intersectBox(rayOrigin, rayDir, boxMin, boxMax, boxNormal); 
            if (t < outT) { 
                outT = t; 
                outNormal = boxNormal; 
                outHitPoint = rayOrigin + rayDir * t; 
                outHash = hash21(float(i/2)).x;
            } 
        }
    } 

    hitPoint = outHitPoint; 
    normal = outNormal; 
    hash = outHash;
    return outT; 
}

void main() {
    vec2 p = (-uResolution.xy + 2.0*gl_FragCoord.xy) / uResolution.y;

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

    vec3 viewDir = normalize(pixelPos - camPos);


    vec3 hitPos, rayDir, origin, sam, ref, raf, nor, camOrigin, camDir;
    float ior, offset, extinctionDist, maxDist, firstLen, bounceCount, wavelength, hash;

    vec3 col = vec3(0);
    vec3 bgCol = vec3(1.);
    maxDist = 15.;
    camOrigin = camPos;
    camDir = viewDir;

    origin = camOrigin;
    rayDir = camDir;

    bool anyHit = false;
    // bool entering = false;

    float MAX_BOUNCE = 2.0;  // 5
    float MAX_DISPERSE = 2.0; // 3
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
            sam += light(hitPos, ref) * .125;
            sam += pow(max(1. - abs(dot(rayDir, nor)), 0.), 5.) * .1; 
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
    col = pow(col, vec3(1.25)) * 2.5; 
    col = tonemap2(col); 

    gl_FragColor = vec4(col, anyHit ? 1.0 : 0.0);
}