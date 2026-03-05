out vec2 vUv;

void main() {
    vUv = uv;
    // vec2 p = position.xy * uScale + uOffset;
    // vec2 p = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // gl_Position = vec4(position, 1.0);
}