varying vec2 vUv;   
uniform vec2 uOffset;
uniform vec2 uScale; 

void main() {
    vUv = uv;
    vec2 p = position.xy * uScale + uOffset;
    gl_Position = vec4(p, 0.0, 1.0);
}