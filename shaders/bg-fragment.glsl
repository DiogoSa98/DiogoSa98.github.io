precision highp float;

uniform sampler2D uNoise;
uniform vec2 uResolution;

void main() {
//   vec2 uv = (gl_FragCoord.xy * 0.5 - uResolution) / uResolution.xy;
  vec3 texCol = texture2D(uNoise, gl_FragCoord.xy/(1024. * 0.5)).rgb;
  vec3 bgCol = texCol.r * vec3(.15);
  gl_FragColor = vec4(bgCol, 1.);
}