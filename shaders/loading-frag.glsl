precision highp float;

#define GRID_W uint(7)    // must match the size in JS !!
#define GRID_H uint(7)

uniform uint uNoise[GRID_W * GRID_H];
uniform uint uNoise2[GRID_W * GRID_H];

varying vec2 vUv;   
const float PI = 3.14159265359;

mat2 m(float a) {
    float c = cos(a);
    float s = sin(a);
    return  mat2(c, -s, s, c);
}

void main() {
    vec2 grid = vec2(GRID_W, GRID_H);
    vec2 h = 0.5 / grid;            // half‑cell in UV space

    // --- rotated layer ---
    vec2 ru = vUv - 0.5;               // centre at origin
    ru *= m(PI * 0.25);
    // keep the rotated square entirely inside [0,1]
    ru = clamp(ru, -0.5 + h, 0.5 - h);
    ru += 0.5;
    vec2 id = floor(ru * grid);  // already centred by `half`
    uint idx = uint(id.y) * GRID_W + uint(id.x);
    float m1 = float(uNoise[idx]);

    // --- straight layer ---
    vec2 su = vUv;              // shift to cell centres
    vec2 id2 = floor(su * grid);
    uint idx2 = uint(id2.y) * GRID_W + uint(id2.x);
    float m2 = float(uNoise2[idx2]);

    float finalM = m1 * m2;            // or m1+m2>0.5 etc.
    finalM = m1+m2>0.5 ? 1.0 : 0.0; // try different combinations
    vec3 col = vec3(m2);
    gl_FragColor = vec4(col, 0.8 * m2);
}