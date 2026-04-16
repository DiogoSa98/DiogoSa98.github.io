precision highp float;

uniform sampler2D uNoise;
uniform vec2 uResolution;
uniform float uBgMultiplier;

void main() {
//   vec2 uv = (gl_FragCoord.xy * 0.5 - uResolution) / uResolution.xy;
  vec3 texCol = texture2D(uNoise, gl_FragCoord.xy/(1024. * 0.5)).rgb;
  // vec3 bgCol = texCol.r * vec3(uBgMultiplier);
  vec3 bgCol = texCol.r * vec3(0.08);
  if (uBgMultiplier >= 1.) {
    // bgCol = vec3(1.) * clamp((texCol.r + 0.2) * 2., 0.0, 1.0);
    bgCol = 1. - bgCol;
  }
  gl_FragColor = vec4(bgCol, 1.);
}