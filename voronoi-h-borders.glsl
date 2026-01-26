
//-------------------------------------------------
#define TAU 6.2831855
const float PI = 3.14159265359;
const float s3 = sin(PI / 3.);
const float MAX_DISPERSE = 5.;
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

vec3 voronoiHBorder( in vec2 x)
{
    vec2 n = floor(x);
    vec2 f = fract(x);

    float id, le;

    float md = 10.0;
	
	vec2 mg = vec2(0.0, 0.0);
    vec2 mr = vec2(0.0, 0.0);

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
                mr = r;
                mg = g1;
                id = z + g1.x + g1.y*7.0;
                le = 0.0;
            }
        }
        else
        {
            for ( int level = 1; level < 4; level++)
            {
                float scale = pow(2.0, float(level));
                for( int l=ZERO; l<2; l++ )
                for( int k=ZERO; k<2; k++ )
                {
                    vec2 g2 = g1 + vec2(float(k),float(l)) / scale;
                    vec3 rr2 = hash33( g2.xyy );
                    vec2 o = g2 + rr2.xy / scale;
                    vec2 r = x - o;
                    float d = dot(r,r);
                    float z = rr2.z;

                    if( z < 0.8 || level == 3 )
                    {
                        if( d < md )
                        {
                            md = d;
                            mr = r;
                            mg = g1; // just keep the first level cell for border calculations                         
                            id = z + g2.x + g2.y*7.0;
                            le = float(level);
                        }
                    }
                }
            }
        }
    }

    //----------------------------------
    // second pass: distance to borders
    //----------------------------------
    md = 8.0;
    for( int j=-2; j<=2; j++ )
    for( int i=-2; i<=2; i++ )
    {
        vec2 g1 = mg + vec2(i,j);
        vec3 rr1 = hash33( g1.xyy );
        vec2 o1 = g1 + rr1.xy;
        vec2 r1 = x - o1;
        float z1 = rr1.z;

        if( z1 < 0.75 )
        {
            if( dot(mr - r1, mr - r1) > 0.00001 )
                md = min( md, dot( 0.5*(mr + r1), normalize(r1 - mr) ) );
        }
        else
        {
            // we have to reconstruct the points per level
            for (int level = 1; level < 4; level++)
            {
                float scale = pow(2.0, float(level));
                for( int l=ZERO; l<2; l++ )
                for( int k=ZERO; k<2; k++ )
                {
                    vec2 g2 = g1 + vec2(float(k),float(l)) / scale;
                    vec3 rr2 = hash33( g2.xyy );
                    vec2 o = g2 + rr2.xy / scale;
                    vec2 r = x - o;
                    float z = rr2.z;

                    if( z < 0.8 || level == 3 )
                    {
                        if( dot(mr - r, mr - r) > 0.00001 )
                            md = min( md, dot( 0.5*(mr + r), normalize(r - mr) ) );
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
    float md = 8.0;
    float mi = 0.;

    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec2 g = vec2(float(i),float(j));
		vec2 o = random2( ip + g );
        vec2 r = g + o - fp;
        float d = dot(r,r);

        if( d<md )
        {
            md = d;
            mr = r;
            mg = g;
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

        if( dot(mr-r,mr-r)>0.00001 )
        md = min( md, dot( 0.5*(mr+r), normalize(r-mr) ) );
    }

    mr.x = mi; // pack cell hash in mr.x, really hacky...
    return vec4( md, mr, 0.0 );
}



float heightMap(vec2 p)
{
    vec3 vh = voronoiHBorder(p);
    return smoothstep(-0.2, 0.620, vh.x)+0.2;
}

// estimate normal from heightmap
vec3 normalFromHeight(vec2 p) {
    vec2 e = 1. / vec2(max(iResolution.x, iResolution.y));
    float r = heightMap(p + vec2(e.x, 0.));
    float l = heightMap(p - vec2(e.x, 0.));
    float b = heightMap(p + vec2(0., e.y));
    float t = heightMap(p - vec2(0., e.y));
    vec3 n = normalize(vec3(r - l, t - b, .01));
    return n;
}
float sdf_heightfield(vec3 p) {
    return p.z - heightMap(p.xy); // negative inside, zero at surface, positive outside
}

struct HitInfo { vec3 p; float len; int hitCode; }; // hitCode: 0=background, 1=surfaceExit
// inside march: start from P (assumed inside, sdf<0), step along dir until sdf>0
HitInfo marchInside(vec3 startP, vec3 dir, int maxSteps, float stepFactor, float maxTravel) {
    vec3 p = startP;
    float traveled = 0.0;
    for (int i=0; i<maxSteps; ++i) {
        float sd = sdf_heightfield(p); // p.z - heightAt(p.xy)
        // since we start inside sd <= 0, we want to advance by some fraction of absolute sd
        float step = max(0.002, -sd * stepFactor); // adapt step size
        p += dir * step;
        traveled += step;
        if (traveled > maxTravel) break;
        float sd2 = sdf_heightfield(p);
        if (sd2 > 0.0) {
            // we exited; return exit point and traveled distance
            return HitInfo(p, traveled, 1);
        }
    }
    return HitInfo(p, traveled, 0); // didn't exit
}

#iChannel0 "file://VideosAndImages/pathtrace.png"
#iChannel1 "file://VideosAndImages/LDR_RGBA_0.png"

vec3 getBackgroundColor(vec2 uv)
{
    return texture(iChannel0, uv).rgb;
    vec3 bn =  texture(iChannel1, uv).rgb;
    return vec3(0.2) * pow(bn, vec3(.8));    
    return vec3(0.2, 0.5, 0.8); 
}

// TODO WTF IS CAUCHY ISH MAPPING
float iorFor(float t) { // t in [0,1]
    // Cauchy-ish simple mapping
    return mix(1.55, 1.68, t); // tweak: higher for shorter wavelengths
}

// Spectrum palette
// IQ https://www.shadertoy.com/view/ll2GD3

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
}

// TODO WTF IS THIS
// Simple spectral->RGB mapping for N discrete samples
vec3 wavelengthRGB(float lambda_nm) {
    return spectrum(lambda_nm);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // pixel coordinates
    vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;

    // scene setup
    vec3 viewDir = vec3(0.0, 0.0, 1.0); // assume orthographic view
    vec3 planNormal = vec3(0.0, 0.0, -1.0); // plane normal
    vec2 texUV = fragCoord.xy/iResolution.xy; // plane background sample uv


    vec3 color = vec3(.0);
    vec2 u = p*3.;


    float h = heightMap(u);
    //  estimate normals
    vec3 n = normalFromHeight(u);
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
    float n2 = 1.3; //1.3 crystal, base ior
    // // Refracted ray
    // vec3 refr = refract(-viewDir, n, n1/n2);
    // Chromatic dispersion
    float d = 0.04; // dispersion amount
    float iorR = n2 * (1. + d);
    float iorG = n2;
    float iorB = n2 * (1. - d);
    // Compute refracted direction for each channel.
    vec3 refrR = refract(-viewDir, n, iorR);
    vec3 refrG = refract(-viewDir, n, iorG);
    vec3 refrB = refract(-viewDir, n, iorB);
    // Sample “background” through crystal
    float refrLen = h / -refrR.z; // distance to plane along refracted ray
    vec3 refrHitPointR = h0 + refrR * refrLen;
    vec3 refrCol = vec3(0.);
    refrCol.r = getBackgroundColor(refrHitPointR.xy).r; // texture(iChannel0, refrHitPointG.xy).g;
    vec3 refrHitPointG = h0 + refrG * refrLen;
    refrCol.g = getBackgroundColor(refrHitPointG.xy).g;
    vec3 refrHitPointB = h0 + refrB * refrLen;
    refrCol.b = getBackgroundColor(refrHitPointB.xy).b;

    color = refrCol;
    fragColor = vec4( color , 1.0);
return;
    // DISPERSION REFRACTION ACCUMULATION THINGY
    // --------------------------------
    float wavelength;
    vec3 accumulate = vec3(0.0);
    for (float disperse=0.; disperse<MAX_DISPERSE; disperse++) {
        float rand = texture(iChannel1, texUV).r;
        float t = (disperse + rand) / MAX_DISPERSE; // jitter
        float ior = iorFor(t);
        vec3 dirIn = refract(-viewDir, n, 1.0/ior); // into medium
        // float eps = 0.0001;
        // vec3 start = h0 + dirIn * eps;
        // HitInfo h = marchInside(start, dirIn, 32, 0.5, 2.0);

        float refrLen = h / -dirIn.z; // distance to plane along refracted ray
            float sigma = 0.25; // absorption coefficient, tweak for effect
            vec3 trans = exp(-sigma * refrLen * vec3(1.0)); // Beer-Lambert law
            vec3 specRGB = wavelengthRGB(t); // simple palette mapping per t
            accumulate += /*sampleCol **/ trans * specRGB;

        // if (h.hitCode == 1) { // exited
        //     //vec3 Nexit = vec3(0.0, 0.0, 1.0); // normalFromHeight(h.p, vec2(1.0/iResolution.x, 1.0/iResolution.y));
        //     vec3 Nexit = normalFromHeight(h.p.xy);
        //     vec3 dirOut = refract(dirIn, Nexit, ior); // exit into air
        //     if (length(dirOut) < 1e-6) { // TIR, reflect
        //         dirOut = reflect(dirIn, Nexit);
        //     }
        //     // vec3 sampleCol = getBackgroundColor(dirOut.xy);
        //     float L = h.len;
        //     float sigma = 0.25; // absorption coefficient, tweak for effect
        //     vec3 trans = exp(-sigma * L * vec3(1.0)); // Beer-Lambert law
        //     vec3 specRGB = wavelengthRGB(t); // simple palette mapping per t
        //     accumulate += /*sampleCol **/ trans * specRGB;
        // } else {
        //     // no exit (ray got stuck) -> treat as black / add env maybe
        // }
    }
    color = accumulate / MAX_DISPERSE;

    fragColor = vec4( color , 1.0);
    // fragColor = vec4( vec3(vh.x)*(vec3(vh.y / 4., 0., 0.)*0.5+0.5), 1.0);
}
