precision highp float;

uint baseHash(uvec3 p)
{
    p = 1103515245U*((p.xyz >> 1U)^(p.yzx));
    uint h32 = 1103515245U*((p.x^p.z)^(p.y>>3U));
    return h32^(h32 >> 16);
}
vec2 hash23(uvec3 x)
{
    uint n = baseHash(x);
    uvec2 rz = uvec2(n, n*48271U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec2((rz.xy >> 1) & uvec2(0x7fffffffU))/float(0x7fffffff);
}
uint baseHash(uvec2 p)
{
    p = 1103515245U*((p >> 1U)^(p.yx));
    uint h32 = 1103515245U*((p.x)^(p.y>>3U));
    return h32^(h32 >> 16);
}
float hash12(uvec2 x)
{
    uint n = baseHash(x);
    return float(n)*(1.0/float(0xffffffffU));
}



#define GRID_W uint(11)    // must match the size in JS !!
#define GRID_H uint(11)
#define OFF_GRID_W uint(11)
#define OFF_GRID_H uint(11)

// uniform uint uNoise[GRID_W * GRID_H];

uniform sampler2D uTexture;
uniform sampler2D uTexture1;

varying vec2 vUv;   

uniform float uLerpT;

uniform float uHash;

uniform vec3 uMouseHoverData;  // x,y = uvoffset, z = zoom ammount,

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

vec2 safeNormalize(in vec2 v) { return v == vec2(0.) ? vec2(0.) : normalize(v); }

vec3 imageGridBlurColors(in vec2 uv, in vec2 uvSample) {
    vec2 uvs = uv * 11.;
    vec2 fuv = fract(uvs);
    vec2 iuv = floor(uvs);

    vec3 col = vec3(0.0);
    vec3 col0 = texture2D(uTexture, uvSample).rgb;
    // col0 = vec3(dot(col0.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 col1 = texture2D(uTexture1, uvSample).rgb;
    // col1 = vec3(dot(col1.rgb, vec3(0.299, 0.587, 0.114)));

    vec2 rnd = hash23(uvec3(iuv, uHash));

    if (((iuv.x < 2. || iuv.x > 9.) ||  (iuv.y < 2. || iuv.y > 9.)))
    {
        if (rnd.x > 0.6 && rnd.x < 0.8)
        {
            col += col1;
        }
        else if (rnd.x > 0.7)
        {
            float s = (sin((rnd.y > 0.5 ? fuv.y : fuv.x) * 50.)*0.5+0.5);
            col += mix(col0, col1, s * 0.8 + 0.4);
        }
        else
        {
            col += col0;
        }
    }
    else
    {
        col += col0;
    }
    return col;
}

vec3 imageGridBlurColorsReveal(in vec2 uv, in vec2 uvSample) {
    vec2 uvs = uv * 11.;
    vec2 fuv = fract(uvs);
    vec2 iuv = floor(uvs);

    vec3 col = vec3(0.0);
    vec3 col0 = texture2D(uTexture, uvSample).rgb;
    // col0 = vec3(dot(col0.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 col1 = texture2D(uTexture1, uvSample).rgb;
    // col1 = vec3(dot(col1.rgb, vec3(0.299, 0.587, 0.114)));

    vec2 rnd = hash23(uvec3(iuv, 0));

    if (rnd.x > 0.4 )
    {
        col += col1;
    }
    else
    {
        float s = (sin((rnd.y > 0.5 ? fuv.y : fuv.x) * 50.)*0.5+0.5);
        col += mix(col0, col1, s * 0.8 + 0.4);
    }
            // col += col1;

    return col;
}


void main() {
        // gl_FragColor = vec4(1., 0., 0., 1.); return;
        // gl_FragColor = vec4(texture2D(uTexture, vUv).rgb, 1.); return;

    // ----- scale and offset texture sampling uvs from mouse hover -----
    // vec2 finalUV = vUv - uMouseHoverData.xy;
    // finalUV *= uMouseHoverData.z;
    // center uv so we can zoom from the center of the image
    vec2 finalUV = (vUv - vec2(0.5)) * uMouseHoverData.z + vec2(0.5);
    finalUV -= uMouseHoverData.xy;
    // vec2 finalUV = vUv * uMouseHoverData.z - uMouseHoverData.xy;

    // ----- cell index -----
    vec2 nUv = clamp(vUv, 0.0, 1.0 - 1e-6); // if we dont clamp uvs we get artifacts on the borders of cells
    vec2 id = floor(nUv * vec2(GRID_W, GRID_H));
    float boundary = (id.y + 1.0) / float(GRID_H);
    boundary = (float(GRID_H) - id.y) / float(GRID_H); // from bottom to top

    float nn = hash12(uvec2(vec2(abs(float(GRID_H)*0.5 - id.y), (id.y+5.) * 5.0) * id.x * 0.5));
    float nn2 = hash12(uvec2(vec2(abs(float(GRID_H)*0.5 - id.y),(id.y+2.) * 32.0) * id.x * 0.5));

    // ----- Reveal progress 1-----
    // first pass top to bottom, white
    float t1 = mix(0.0, 1.0, clamp(uLerpT * 2., 0., 1.)); // from 0-0.5
    float reveal = clamp(t1 + t1 * nn, 0.0, 1.0);
    float edge = 0.001;
    float alpha = step(boundary, reveal);
    vec4 finalCol1 = vec4(imageGridBlurColorsReveal(vUv,finalUV), alpha);

    // ----- Reveal progress 2-----
    // second pass top to bot, image color
    float t2 = mix(0.0, 1.0, clamp((uLerpT - 0.1) * 2., 0., 1.));  // (uLerpT-0.5)*2. -> from 0.5 to 1.0
    float reveal2 = clamp(t2 + t2 * nn2, 0.0, 1.0);
    float alpha2 = step(boundary, reveal2);
    vec4 finalCol2 = vec4(imageGridBlurColors(vUv, finalUV), alpha2);

    // ----- final mix -----
    vec4 finalCol = mix(finalCol2, finalCol1, 1.-step(boundary, reveal2));

    gl_FragColor = finalCol;

        // gl_FragColor = vec4(vec3((1.-smoothstep(0., 0.01, boxDist))), 1.0);
        // gl_FragColor = vec4(vec3(smoothstep(0., 0.01, boxDist)), 1.0);
}