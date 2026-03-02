
//-------------------------------------------------
#define TAU 6.2831855
const float PI = 3.14159265359;
const float s3 = sin(PI / 3.);

//---------------------------------

uint baseHash(uvec2 p)
{
    p = 1103515245U * ((p >> 1U) ^ (p.yx));
    uint h32 = 1103515245U * ((p.x) ^ (p.y>>3U));
    return h32 ^ (h32 >> 16);
}

vec3 hash3(float seed)
{
    uint n = baseHash(floatBitsToUint(vec2(seed += 0.1, seed += 0.1)));
    uvec3 rz = uvec3(n, n * 16807U, n * 48271U);
    return vec3(rz & uvec3(0x7fffffffU)) / float(0x7fffffff);
}

// https://www.shadertoy.com/view/4djSRW
float hash11(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

vec3 hash3( vec3 p )
{
    // procedural white noise	
	return fract(sin(vec3(dot(p,vec3(127.1,311.7,47.12)),
                        dot(p,vec3(269.5,183.3,452.8)), 
                        dot(p,vec3(789.1,456.1,10.23))))*43758.5453);
}
vec3 hash33(vec3 p){ 
    
    float n = sin(dot(p, vec3(7, 157, 113)));    
    return fract(vec3(2097152, 262144, 32768)*n); 
}

vec2 random2( vec2 p ) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

int MOD = 1;  // type of Perlin noise
    
// fbm https://www.shadertoy.com/view/Xs3fR4
#define hash21(p) fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123)
float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p); f = f*f*(3.-2.*f); // smoothstep

    float v= mix( mix(hash21(i+vec2(0,0)),hash21(i+vec2(1,0)),f.x),
                  mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y);
	return   MOD==0 ? v
	       : MOD==1 ? 2.*v-1.
           : MOD==2 ? abs(2.*v-1.)
                    : 1.-abs(2.*v-1.);
}
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define noise22(p) vec2(noise2(p),noise2(p+17.7))
vec2 fbm22(vec2 p) {
    vec2 v = vec2(0);
    float a = .15;
    mat2 R = rot(.37);

    for (int i = 0; i < 4; i++, p*=2.,a/=2.) 
        p *= R,
        v += a * noise22(p);

    return v;
}

vec2 fbm22_2(vec2 p) {
    vec2 v = vec2(0);
    float a = .5533615;
    mat2 R = rot(0.);

    for (int i = 0; i < 3; i++, p*=1.85,a/=1.25) 
        p *= R,
        v += a * noise22(p);

    return v;
}

vec3 map( vec2 p )
{   
    p *= .72;
    
    // float f = dot( fbm22_2( 1.0*(0.05*iTime + p + fbm22_2(-0.05*iTime+2.0*(p + fbm22_2(.5*p)))) ), vec2(1.0,-1.0) );
    float f = dot( fbm22_2( 1.0*(0.05*iTime + p + fbm22_2(-0.05*iTime+0.2*(p + fbm22_2(0.50*p)))) ), vec2(1.0,-1.0) );
    // float f = dot( fbm22_2( 1.0*( p + fbm22_2(0.2*(p + fbm22_2(0.50*p)))) ), vec2(1.0,-1.0) );

    float bl = smoothstep( -0.8, 0.8, f );

    float ti = smoothstep( -1.0, 1.0, fbm22_2(p).y );

    return mix( mix( vec3(0.611, 0.829, 0.621), 
                     vec3(0.529, 0.83, 0.536), ti ), 
                     vec3(.00,.100,.10), bl );
}

float hash(vec3 p) { return fract(sin(dot(p,vec3(17, 59.4, 15))) * 43758.5453); }

float noise(vec3 p){ 
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
    
    return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm3(vec3 p){
    float f = 0.0;
    float amp = 0.5;
    for(int i=0;i<4;i++){
        f += amp * noise(p);
        p *= 3.0;
        amp *= 0.5;
    }
    return f;
}
//---------------------------------
// from an old pathtracer... weighted emisphere sampling i guess
vec3 randomInUnitSphere(float seed, vec2 seed2)
{
    // vec3 rand = hash3(seed);
    vec3 rand = texture(iChannel1, seed2).rgb;
    vec3 h = rand * vec3(2.0, 6.28318530718, 1.0) - vec3(1.0, 0.0, 0.0);
    float phi = h.y;
    float r = pow(h.z, 1.0/3.0);
	return r * vec3(sqrt(1.0 - h.x * h.x) * vec2(sin(phi), cos(phi)), h.x);
}

vec3 randomUnitVector(float seed, vec2 seed2) //to be used in diffuse reflections with distribution cosine
{
    return(normalize(randomInUnitSphere(seed, seed2)));
}

//---------------------------------

vec3 sdTriEdges(vec2 p) {
    return vec3(
        dot(p, vec2(0,-1)),
        dot(p, vec2(s3, .5)),
        dot(p, vec2(-s3, .5))
    );
}

float sdTri(vec2 p) {
    vec3 t = sdTriEdges(p);
    return max(t.x, max(t.y, t.z));
}
//---------------------------------
#define ZERO (min(iFrame,0))

vec3 voronoiH( in vec2 x )
{
    vec2 n = floor(x);
    vec2 f = fract(x);

	float id, le;

    float md = 10.0;
    
    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec2 g1 = n + vec2(float(i),float(j));
        vec3 rr = hash33( g1.xyy );
		vec2 o = g1 + rr.xy;
        vec2 r = x - o;
        float d = dot(r,r);
        float z = rr.z;
        
        if( z<0.75 )
        {
            if( d<md )
            {
                md = d;
                id = z + g1.x + g1.y*7.0;
                le = 0.0;
            }
        }
        else
        {
            for( int l=ZERO; l<2; l++ )
            for( int k=ZERO; k<2; k++ )
            {
                vec2 g2 = g1 + vec2(float(k),float(l))/2.0;
                rr = hash33( g2.xyy );
                o = g2 + rr.xy/2.0;
                r = x - o;
                d = dot(r,r);
                z = rr.z;
                if( z<0.8 )
                {
                    if( d<md )
                    {
                        md = d;
                        id = z + g2.x + g2.y*7.0;
                        le = 1.0;
                    }
                }
                else
                {
                    for( int n=ZERO; n<2; n++ )
                    for( int m=ZERO; m<2; m++ )
                    {
                        vec2 g3 = g2 + vec2(float(m),float(n))/4.0;
                        rr = hash33( g3.xyy );
                        o = g3 + rr.xy/4.0;
                        r = x - o;
                        d = dot(r,r);
                        z = rr.z;

                        if( z<0.8 )
                        {
                            if( d<md )
                            {
                                md = d;
                                id = z + g3.x + g3.y*7.0;
                                le = 2.0;
                            }
                        }
                        else
                        {
                            for( int t=ZERO; t<2; t++ )
                            for( int s=ZERO; s<2; s++ )
                            {
                                vec2 g4 = g3 + vec2(float(s),float(t))/8.0;
                                rr = hash33( g4.xyy );
                                o = g4 + rr.xy/8.0;
                                r = x - o;
                                d = dot(r,r);
                                z = rr.z;

                                if( d<md )
                                {
                                    md = d;
                                    id = z + g4.x + g4.y*7.0;
                                    le = 3.0;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return vec3( md, le, id );
}

//iq voronoihttps://www.shadertoy.com/view/ldl3W8
vec4 voronoi( in vec2 x )
{
    vec2 ip = floor(x);
    vec2 fp = fract(x);

    //----------------------------------
    // first pass: regular voronoi
    //----------------------------------
	vec2 mg, mr;
    float ms = .0;
    float md = 8.0;
    float mi = 0.;

    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec2 g = vec2(float(i),float(j));
		vec2 o = random2( ip + g );
                   
        // absolute cell center in p-space
        vec2 cellPos = ip + g + o;
        // skip cells whose center lies inside the circle centered at origin
        bool skipCell = cellPos.x > -1.0 && cellPos.x < 1.0; // length(cellPos) < 1.2;
        vec2 r = g + o - fp; // vector to cell rand point from pixel pos 
        float d = dot(r,r);

        if( d<md )
        {
            md = d;
            mr = r;
            mg = g;
            ms = skipCell ? 1.0 : 0.; // store 0 or per cell hash
            mi = hash21(o); // per cell hash
        }
    }

    //----------------------------------
    // second pass: distance to borders
    //----------------------------------
    md = 8.0;
    for( int j=-2; j<=2; j++ )
    for( int i=-2; i<=2; i++ )
    {
        vec2 g = mg + vec2(float(i),float(j));
		vec2 o = random2( ip + g );
        vec2 r = g + o - fp;

        // vec2 cellPos = ip + g + o;
        // bool skipCell = cellPos.x > -1.0 && cellPos.x < 1.0;//length(cellPos) < 1.2;
        // if (skipCell && ms > 0.) 
        // {
        //     continue;
        // }

        if( dot(mr-r,mr-r)>0.00001 )
        md = min( md, dot( 0.5*(mr+r), normalize(r-mr) ) );
    }

    mr.x = mi; // pack cell hash in mr.x, really hacky...
    return vec4( md, mr, ms );
}

// iq color palette generator
vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}
vec3 jadePalette(float t)
{
    t = clamp(t, 0.0, 1.0);

    vec3 c0 = vec3(0.11, 0.29, 0.21); // very dark green
    vec3 c1 = vec3(0.18, 0.39, 0.26); // dark green
    vec3 c2 = vec3(0.29, 0.53, 0.36); // saturated mid green
    vec3 c3 = vec3(0.51, 0.76, 0.6); // light jade green
    vec3 c4 = vec3(0.56, 0.73, 0.68); // milky highlight

    if (t < 0.25)
        return mix(c0, c1, smoothstep(0.0, 0.25, t));
    else if (t < 0.5)
        return mix(c1, c2, smoothstep(0.25, 0.5, t));
    else if (t < 0.75)
        return mix(c2, c3, smoothstep(0.5, 0.75, t));
    else
        return mix(c3, c4, smoothstep(0.75, 1.0, t));
    //     if (t < 0.25)
    //     return mix(c0, c1, t);
    // else if (t < 0.5)
    //     return mix(c1, c2, t);
    // else if (t < 0.75)
    //     return mix(c2, c3, t);
    // else
    //     return mix(c3, c4, t);
}
// iq smooth vornoi for coloring
vec4 voronoiSmooth( in vec2 x, float w )
{
    vec2 n = floor( x );
    vec2 f = fract( x );

	vec4 m = vec4( 8.0, 0.0, 0.0, 0.0 );
    for( int j=-2; j<=2; j++ )
    for( int i=-2; i<=2; i++ )
    {
        vec2 g = vec2( float(i),float(j) );
        vec2 o = random2( n + g );

        // distance to cell		
		float d = length(g - f + o);
		
        // cell color
        // vec3 col = pal( hash11(dot(n+g,vec2(7.0,113.0))), vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,0.7,0.4),vec3(0.0,0.15,0.20) );
		// vec3 col = 0.5 + 0.5*sin( hash11(dot(n+g,vec2(7.0,113.0)))*2.5 + 3.5 + vec3(2.0,3.0,0.0));
        vec3 col = jadePalette( hash11(dot(n+g,vec2(7.0,113.0))) );
        // in linear space
        col = col*col;
        
        // do the smooth min for colors and distances		
		float h = smoothstep( -1.0, 1.0, (m.x-d)/w );
	    m.x   = mix( m.x,     d, h ) - h*(1.0-h)*w/(1.0+3.0*w); // distance
		m.yzw = mix( m.yzw, col, h ) - h*(1.0-h)*w/(1.0+3.0*w); // color
    }
	
	return m;
}

float heightMap(vec2 p)
{
    
    //     vec3 vh = voronoiH(fbm22(p*0.5)*1.25+p);
    // return pow(1.-smoothstep(-0.4, 0.5, vh.x)+0.2, 2.0)*2.;
    // vec4 vc = voronoi(p);
    // return smoothstep(-0.2, 0.620, vc.x)+0.2;

    // v2 use voronoi fbm
    // vec4 vc = voronoi(fbm22(p*0.5)*1.25+p);
    // return smoothstep(-0.2, 0.620, vc.x)+0.2;
    vec4 vc = voronoi(fbm22(p*0.5)*1.25+p);
    return (smoothstep(-0.2, 0.620, vc.x)+0.2)*(1.-vc.w);
    // vec4 vc = voronoi((fbm22(p*0.5)*1.25+p)*0.5);
    // vc += voronoi(fbm22(p*0.425)*1.25+p*1.5+vec2(432.,890.))*.12;
    // return smoothstep(-0.2, 0.620, vc.x)+0.2;

}

#iChannel0 "file://VideosAndImages/pathtrace.png"
#iChannel1 "file://VideosAndImages/LDR_RGBA_0.png"

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // pixel coordinates
    vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;


    // scene setup
    vec3 viewDir = vec3(0.0, 0.0, 1.0); // assume orthographic view
    vec3 planNormal = vec3(0.0, 0.0, -1.0); // plane normal
    vec2 texUV = fragCoord.xy/iResolution.xy; // plane background sample uv

        


    vec3 color = vec3(.0);
    // vec2 u = 20.+p*2.5+fbm22(20.+p*2.5);
    vec2 u = p*3.;

    // vec4 vc = voronoiSmooth( 20.+p*2.5+fbm22(20.+p*2.5), 0.251); // "base" color
    float h = heightMap(u);
    //  estimate normals
    vec2 e = 1. / vec2(max(iResolution.x, iResolution.y));
    float r = heightMap(u + vec2(e.x, 0.));
    float l = heightMap(u - vec2(e.x, 0.));
    float b = heightMap(u + vec2(0., e.y));
    float t = heightMap(u - vec2(0., e.y));
    vec3 n = normalize(vec3(r - l, t - b, .01));
    //  lighting
    vec3 lDir = normalize(vec3(1.));
    float diff = max(dot(n, lDir), 0.0);
    color = vec3(n);
    // fragColor = vec4( color , 1.0);
    // return;
    color = vec3(diff);

    vec3 h0 = vec3(texUV, h); // hit point on surface

// Refraction setup
float n1 = 1.0; // air
float n2 = 1.3; //1.3 crystal
// Refracted ray
vec3 refr = refract(-viewDir, n, n1/n2);
// rough refraction // TODO use blue noise, random hash based on quantized voronoized normals for stability
// TODO blue noise has mostly same effect has white noise for random unit vector, likely need to apply gaussian blur to background or something
// refr = normalize(mix(refr, normalize(-n + randomUnitVector(random2(p).x, p.xy)), 0.1*0.21));

// Sample “background” through crystal
// float thickness = 0.15;
// vec2 refrUV = texUV + refr.xy * thickness;
float refrLen = h / -refr.z; // distance to plane along refracted ray
vec3 refrHitPoint = h0 + refr * refrLen;
vec3 bg = texture(iChannel0, refrHitPoint.xy).rgb;

color = bg;
// color = map(p*0.5*rot(10.1));
color = mix(vec3(0.11, 0.29, 0.21), vec3(0.18, 0.39, 0.26), fbm22(refrHitPoint.xy).x);
// color = refr;

    // beers law
    // vec3 refractionColor = vec3(0.51, 0.76, 0.6);
    // this should really be 3d fbm and 3d voronoi to make it have depth
    // TESTING 3D FBM color
    vec3 refractionColor = vec3(0.0);
    float absorption = 1.0;
    int steps = 32;
    float d = 0.0;      
    for (int i = 0; i < steps; i++) {
        float t = float(i) / float(steps);
        vec3 p = h0 + refr * (refrLen * t);

        vec3 p2 = vec3(p.x * 4.0, p.y * 4.0, p.z * 0.5);

        // d = fbm3(p2 * 8.0)*0.5; 
        float warp = fbm3(p * 1.5 + iTime * 0.02) * 4.2;
        d = fbm3(p2 + warp);
        // d = fbm3(vec3(p.xz, 0.0));

        // integrate emission/absorption
        vec3 sampleCol = vec3(d*d, d, d*d); // artistic choice
        refractionColor += sampleCol * absorption * (refrLen / float(steps));

        // exponential absorption
        absorption *= exp(-d * 0.5 * (refrLen / float(steps)));
    }
    refractionColor *= absorption *2.;
    // fragColor = vec4( vec3(refractionColor) , 1.0);
    // return;
    // vec3 refractionColor = map(p);
    vec4 vc = voronoi(fbm22(u*3.5)*1.25+u*3.5);
    refractionColor += smoothstep(0.9920, 1.0, 1.-vec3(vc.x))*0.25;
    vec4 vc2 = voronoi(fbm22(u*3.5)*1.25+u*1.5);
    refractionColor += smoothstep(0.9910, 1.0, 1.-vec3(vc2.x))*0.25;
    // vec3 transmittedColor = 1.-exp((1.-refractionColor) * -(refrLen));
    vec3 transmittedColor = exp((1.-refractionColor) * -(refrLen)); // this is correct but makes edges look super bright, inverting makes it look like ao
    // color *= transmittedColor;
    // color *= transmittedColor*2.;
    // color = vec3(h);
    // color = map(p)*transmittedColor;

    // fresnel schlick approximation
    vec3 reflectionColor = vec3(1.0); // white highlights
    float R0 = pow((n1 - n2) / (n1 + n2), 2.0);
    vec3 H = normalize(viewDir + lDir);
    float cosTheta = max(dot(n, lDir), 0.0); // TODO WHAT VECTORS TO USE???
    float fresnel = R0 + (1.0 - R0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.);
    float reflection = mix(0.08, 1.0, fresnel); // minimum reflectance to max reflectance
    color *= mix(transmittedColor, reflectionColor, fresnel);
    // color *= mix(transmittedColor, reflectionColor, fresnel)*2.0;
    // color += reflection*0.5;
    // color = vec3(H);
    // color = vec3(reflection);
    // color = vec3(dot(n, H));


    float forwardScatter = pow(clamp(dot(n, vec3(0.,0.,1.)), 0.0, 1.0), 8.0);
    vec3 glow = refractionColor * forwardScatter * h * 1.2; // using transmitted color rather than refraction color kinda makes it look more transparent i guess, though looses a lot of saturation
    // vec3 glow = transmittedColor * forwardScatter * h * 1.2; // using transmitted color rather than refraction color kinda makes it look more transparent i guess, though looses a lot of saturation
    color += glow;
    float ao = smoothstep(-0.8, 1., h);
    color *= ao; // darkens deep interior
    
    // color = pow(color, vec3(1.8));

    // color = vec3(diff);

    // vec4 vc = voronoi(fbm22(u*2.5)*1.25+u*2.5);
    // color = smoothstep(0.980, 1.0, 1.-vec3(vc.x))*4.5*reflection*ao;
    // color = smoothstep(0.990, 1.0, 1.-vec3(vc.x))*4.5*reflection*ao;
    fragColor = vec4( color , 1.0);
}

// ✔ Absorption (done)

// ✔ Fresnel reflection (do now)

// background fbm 

// Rough refraction (microfacet scattering) NEED BLUR/MULTIPLE SAMPLES/SMALLER RANDOM PERTURBATION SAMPLING CODE

// Chromatic effects (optional) (chromatic aberration inside crystal i guess)

// Multi-layer thickness (optional fancy step)


// need different background (sharper features on fbm) for better refraction visibility though it doesnt really matter
// draw veins?
// 3d fbm use xyz for refraction color

// ONLY AFTER SHADING
// fbm based voronoi for natural looking lines; make it flatter

// layer fbm voronoi lines for veigns, color veins 

// hierarchical voronoi for big and small features
