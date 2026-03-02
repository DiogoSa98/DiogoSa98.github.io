// Shadertoy-style (mainImage)
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    // 4 corners
    float a = hash(i + vec2(0.0,0.0));
    float b = hash(i + vec2(1.0,0.0));
    float c = hash(i + vec2(0.0,1.0));
    float d = hash(i + vec2(1.0,1.0));
    // smooth interp
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){
    float v = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    // tweak octaves here
    for(int i = 0; i < 5; i++){
        v += amp * noise(p * freq);
        freq *= 2.0;
        amp *= 0.5;
    }
    return v;
}

const float PI = 3.14159265359;
void fold(inout vec2 p)
{
    int t = 4;
    // float cospin=cos(PI/float(t)), scospin=sqrt(0.75-cospin*cospin);
    float cospin=cos(PI/float(t)), scospin=sqrt(1.-cospin*cospin);
    vec2 nc =vec2(-cospin,scospin);
    for(int i=0;i<t;i++){
		p = abs(p);
		p -= 2. * min(0., dot(p,nc)) * nc;
	}

}
// Rotation matrix 2D
mat2 m(float a) {
    float c = cos(a);
    float s = sin(a);
    return  mat2(c, -s, s, c);
}

// TODO MAKE A FUNCTION THAT RECEIVES AS INPUT UV AND OUTPUTS the black and white col
// call 2 of them, one is rotated by 45 degrees
// instead of simply adding try something like a xor if f2 > f1 subtract from f2 otherwise reverse or whatever, play with it 
// can move fold from 0 to 5
// some times turn off f2

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = (-iResolution.xy + 2.0*(fragCoord))/iResolution.y;
    vec2 uv2 = uv * m(iTime);
    // GRID and pattern parameters
    const int GRID = 5;                // grid dimension
    float gridf = float(GRID);
    float cellSizeX = 1.0 / gridf;
    float cellSizeY = 1.0 / gridf;

    // pick the cell this pixel belongs to
    vec2 cell = floor(uv * gridf);
    // center of that cell in normalized UV coordinates
    vec2 center = (cell + 0.5) / gridf;

    // pattern control
    float patternScale = 4.;           // how many features across the grid (tune this)
    float threshold = .55;              // binary cutoff
    float time = iTime * 0.115;          // animation speed

    // sample fbm once per-cell (at center). add offsets for animation/seed.
    vec2 fbmUV = center * patternScale;
    // fbmUV *= m(iTime*0.1);
    fold(fbmUV);
    float v = fbm(fbmUV + vec2(10.0, 5.0) + time);

    // vec2 fbmUV2 = center * patternScale;
    // fold(fbmUV2);
    // float v2 = fbm(fbmUV2 + vec2(1.0, 2.0) + time);

    // testing 
    // v = v*0.5+v2*0.5;
    // Optional: add low-amplitude cell-specific jitter to increase variety:
    // v += (hash(cell) - 0.5) * 0.12;

    // decide filled/empty
    float mask = step(threshold, v); // 1 = filled, 0 = empty

    // To draw crisp squares: make the entire cell that color.
    // But for nicer visuals we blend edges (anti-alias)
    // compute distance to cell border (in uv space)
    vec2 local = (uv - cell / gridf) * gridf; // local coords 0..1 inside cell
    float edgeDist = min(min(local.x, 1.0-local.x), min(local.y, 1.0-local.y));
    float borderWidth = 0.0; // border smoothing width
    float aa = smoothstep(0.0, borderWidth, edgeDist);

    // combine: filled color vs background
    vec3 filledColor = vec3(0.0); // black 'X'
    vec3 emptyColor  = vec3(1.0); // white '_'
    vec3 col = mix(emptyColor, filledColor, mask);

    // optionally soften the square edges using aa
    // when mask==1, keep col but soften outer edge
    if(mask > 0.5){
        float alpha = aa; // 0..1 neat edge
        col = mix(vec3(1.0), col, alpha); // lighten toward background near border
    }

    fragColor = vec4(col, 1.0);

    // vec2 uv2 = uv*15.;
    // fold(uv2);
    // fragColor = vec4(vec3(fbm(uv2+iTime)), 1.0);
}