precision highp float;

#define GRID_W uint(5)    // must match the size in JS !!
#define GRID_H uint(5)

uniform uint uNoise[GRID_W * GRID_H];
uniform uint uNoise2[GRID_W * GRID_H];

varying vec2 vUv;   
const float PI = 3.14159265359;

uniform float uLoadingColor;

mat2 m(float a) {
    float c = cos(a);
    float s = sin(a);
    return  mat2(c, -s, s, c);
}

float smin( float a, float b, float k )
{
    k *= 4.0;
    float h = max( k-abs(a-b), 0.0 )/k;
    return min(a,b) - h*h*k*(1.0/4.0);
}

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

// https://iquilezles.org/articles/sdfrepetition/
float repeated( vec2 p, float s )
{
    vec2 id = round(p/s);
    vec2  o = sign(p-s*id); // neighbor offset direction
    
    float d = 1e20;
    for( int j=0; j<2; j++ )
    for( int i=0; i<2; i++ )
    {
        vec2 rid = id + vec2(i,j)*o;
        vec2 r = p - s*rid;
        if (uNoise2[uint(rid.y) * GRID_W + uint(rid.x)] == 1u) d = smin( d, sdBox(r, vec2(0.5)), 1.1 );
    }
    return d;
}

void main() {
    vec2 grid = vec2(GRID_W, GRID_H);
    vec2 h = 0.5 / grid;            // half‑cell in UV space

    // // --- rotated layer ---
    // vec2 ru = vUv - 0.5;               // centre at origin
    // ru *= m(PI * 0.25);
    // // keep the rotated square entirely inside [0,1]
    // ru = clamp(ru, -0.5 + h, 0.5 - h);
    // ru += 0.5;
    // vec2 id = floor(ru * grid);  // already centred by `half`
    // uint idx = uint(id.y) * GRID_W + uint(id.x);
    // float m1 = float(uNoise[idx]);

    // --- straight layer ---
    vec2 su = vUv;              // shift to cell centres
    vec2 id2 = floor(su * grid);
    uint idx2 = uint(id2.y) * GRID_W + uint(id2.x);
    float m2 = float(uNoise2[idx2]);

    // float finalM = m1 * m2;            // or m1+m2>0.5 etc.
    // finalM = m1+m2>0.5 ? 1.0 : 0.0; // try different combinations

    // // TESTING
    // m2 = repeated((vUv-0.5) * 5., 1.);
    // m2 = 1. - smoothstep(0., 0.02, m2);
    // gl_FragColor = vec4(vec3(m2), 1.0);
    // return;
    vec3 col = uLoadingColor * vec3(m2);
    gl_FragColor = vec4(col, 0.99 * m2);
}