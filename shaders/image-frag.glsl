precision highp float;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }

#define GRID_W uint(70)    // must match the size in JS !!
#define GRID_H uint(70)

// uniform uint uNoise[GRID_W * GRID_H];

uniform sampler2D uTexture;

varying vec2 vUv;   

uniform float uLerpT;

void main() {
    vec3 texCol = texture2D(uTexture, vUv).rgb;
    float luminance = dot(texCol, vec3(0.299, 0.587, 0.114));

    // ----- cell index -----
    vec2 nUv = clamp(vUv, 0.0, 1.0 - 1e-6); // if we dont clamp uvs we get artifacts on the borders of cells
    vec2 id = floor(nUv * vec2(GRID_W, GRID_H));
    float boundary = (id.x + 1.0) / float(GRID_W);

    float nn = hash(vec2(abs(id.y - float(GRID_H)*0.5),
                         (id.y+5.) * 5.0) * id.x  * 0.5);
    float nn2 = hash(vec2(abs(id.y - float(GRID_H)*0.5),
                        (id.y+2.) * 32.0) * id.x * 0.5);

    // ----- Reveal progress 1-----
    // first pass left to right, white
    float t1 = mix(0.0, 1.0, clamp(uLerpT * 2., 0., 1.)); // from 0-0.5
    float reveal = clamp(t1 + t1 * nn, 0.0, 1.0);
    float edge = 0.001;
    float alpha = smoothstep(boundary - edge, boundary + edge, reveal);;
    alpha = step(boundary, reveal);
    vec4 finalCol1 = vec4(vec3(1.0), alpha);

    // ----- Reveal progress 2-----
    // second pass left to right, image color
    // float tp2 = (uLerpT - 0.3) * 1.43; // starts earlier and faster 
    float t2 = mix(0.0, 1.0, clamp((uLerpT - 0.25) * 1.34, 0., 1.));  // (uLerpT-0.5)*2. -> from 0.5 to 1.0
    float reveal2 = clamp(t2 + t2 * nn2, 0.0, 1.0);
    float alpha2 = smoothstep(boundary - edge, boundary + edge, reveal2);;
    alpha2 = step(boundary, reveal2);
    vec4 finalCol2 = vec4(vec3(luminance), alpha2);

    // ----- final mix -----
    vec4 finalCol = mix(finalCol2, finalCol1, 1.-step(boundary, reveal2));
    finalCol.a *= 0.8;

    gl_FragColor = finalCol;
}