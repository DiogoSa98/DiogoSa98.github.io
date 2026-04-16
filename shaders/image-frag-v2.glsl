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

uniform float uNoise[GRID_W * GRID_H];

uniform sampler2D uTexture;
uniform sampler2D uTexture1;


varying vec2 vUv;   

uniform float uLerpT;

uniform vec4 uMousePosUV; // xy is uv zw is speed

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

vec2 safeNormalize(in vec2 v) { return v == vec2(0.) ? vec2(0.) : normalize(v); }

vec3 imageGridBlurColors(in vec2 uv) {
    vec2 uvs = uv * 11.;
    vec2 fuv = fract(uvs);
    vec2 iuv = floor(uvs);

    vec3 col = vec3(0.0);
    vec3 col0 = texture2D(uTexture, uv).rgb;
    col0 = vec3(dot(col0.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 col1 = texture2D(uTexture1, uv).rgb;
    col1 = vec3(dot(col1.rgb, vec3(0.299, 0.587, 0.114)));

    vec2 rnd = hash23(uvec3(iuv +1., 0));

    if (((iuv.x < 3. || iuv.x > 8.) ||  (iuv.y < 3. || iuv.y > 8.)))
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

vec3 imageGridBlurColorsReveal(in vec2 uv) {
    vec2 uvs = uv * 11.;
    vec2 fuv = fract(uvs);
    vec2 iuv = floor(uvs);

    vec3 col = vec3(0.0);
    vec3 col0 = texture2D(uTexture, uv).rgb;
    col0 = vec3(dot(col0.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 col1 = texture2D(uTexture1, uv).rgb;
    col1 = vec3(dot(col1.rgb, vec3(0.299, 0.587, 0.114)));

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

    return col;
}


void main() {
    // ----- cell index -----
    vec2 nUv = clamp(vUv, 0.0, 1.0 - 1e-6); // if we dont clamp uvs we get artifacts on the borders of cells
    vec2 id = floor(nUv * vec2(GRID_W, GRID_H));

    uint idx2 = uint(id.y) * GRID_W + uint(id.x);
    float m2 = float(uNoise[idx2]);
    float nn = mix(0.1, 1.0, m2); // add small number to guarantee non 0 otherwise we start seeing that cell

    // ----- Reveal progress 1-----
    float t1 = mix(0.0, 1.0, clamp(uLerpT * 2., 0., 1.)); // from 0-0.5
    float reveal = clamp(t1, 0.0, 1.0);
    float alpha = smoothstep(nn-0.3, nn, reveal);
    vec4 finalCol1 = vec4(imageGridBlurColorsReveal(vUv), alpha);
    // gl_FragColor = finalCol1; return; // TESTING

    // ----- Reveal progress 2-----
    float t2 = mix(0.0, 1.0, clamp((uLerpT - 0.3) * 2., 0., 1.));  // (uLerpT-0.5)*2. -> from 0.5 to 1.0
    float reveal2 = clamp(t2, 0.0, 1.0);
    // float alpha2 = step(nn, reveal2);
    float alpha2 = smoothstep(nn-0.2, nn, reveal2);
    vec4 finalCol2 = vec4(imageGridBlurColors(vUv), alpha2);
    gl_FragColor = finalCol2; return; // TESTING

    // ----- final mix -----
    vec4 finalCol = mix(finalCol1, finalCol2, alpha2); // mix should be 0 until reveal2 starts then go to 1 when reveal1 is complete

    gl_FragColor = finalCol;
    // gl_FragColor = vec4(vec3(nn), 1.0); return; // TESTING
}