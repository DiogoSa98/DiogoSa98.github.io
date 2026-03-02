#version 300 es
precision mediump float;
        
in vec2 coordinates;
out vec2 fragCoord;

void main(void) {
    gl_Position = vec4(coordinates, 0.0, 1.0);
    fragCoord = coordinates;
}