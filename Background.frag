#version 300 es
precision mediump float;
        
uniform vec2 resolution;
in vec2 fragCoord; // [(-1, -1), (1, 1)]

out vec4 fragColor;

void main(void) {
    fragColor = vec4(fragCoord.xy / 2.0, 0.0, 1.0);
    return;
}