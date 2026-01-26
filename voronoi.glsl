
//-------------------------------------------------
#define TAU 6.2831855
const float PI = 3.14159265359;
const float s3 = sin(PI / 3.);

//---------------------------------

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
    float a = 0.615;
    mat2 R = rot(.37);

    for (int i = 0; i < 3; i++, p*=1.2,a/=1.5) 
        p *= R,
        v += a * noise22(p);

    return v;
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
        vec2 r = g + o - fp;
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

        vec2 cellPos = ip + g + o;
        bool skipCell = cellPos.x > -1.0 && cellPos.x < 1.0;//length(cellPos) < 1.2;
        if (skipCell && ms > 0.) 
        {
            continue;
        }

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

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // pixel coordinates
    vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;

    vec3 color = vec3(.0);

    vec2 pv = p * 3.; // scale 
    pv += fbm22(pv); // distort space
    vec4 vor = voronoi( pv );
    /*// Tile the space
    vec2 ip = floor(p);
    vec2 fp = fract(p);

    float m_dist = 1.;  // minimum distance

    for (int y= -1; y <= 1; y++) {
        for (int x= -1; x <= 1; x++) {
            // Neighbor place in the grid
            vec2 neighbor = vec2(float(x),float(y));

            // Random position from current + neighbor place in the grid
            vec2 point = random2(ip + neighbor);
    
			// Animate the point
            // point = 0.5 + 0.5*sin(iTime + 6.2831*point);
        // point = vec2(0.5);
           // absolute cell center in p-space
            vec2 cellPos = ip + neighbor + point;

            // skip cells whose center lies inside the circle centered at origin
            if (length(cellPos) < 1.5) 
            {
                continue;
            }

			// Vector between the pixel and the point
            vec2 diff = neighbor + point - fp;

            // Distance to the point
            float dist = length(diff);

            // Keep the closer distance
            m_dist = min(m_dist, dist);
        }
    }
*/
    // m_dist = min(m_dist, length(p)-1.5);
    // Draw the min distance (distance field)
    // color += m_dist;

    // Draw cell center
    // color += 1.-step(.02, m_dist);

    // Draw voronoi
    float inside = smoothstep(0.0, 0.015, vor.x); // inside cells color
    float centerMask = 1.-smoothstep(0.0, 0.02, vor.x * vor.w);
    float border = (1.-inside)*centerMask;

    color = vec3(0.98, 1.0, 0.99)*border; // cells border color
    color += vec3(0.02, 0.045, 0.03)*(1.-centerMask); // background color
    float insideCells = inside * centerMask;
    
    vec4 vc = voronoiSmooth( 20.+p*2.5+fbm22(20.+p*2.5), 0.251); // "base" color
    // vec3 baseCol = vc.yzw;
    vec2 f = fbm22_2(20.+p*1.5)*0.5+0.5;
    vec3 baseCol = jadePalette(f.x); // "base" color
    // float thickness = smoothstep(0.01, 0.8, vc.x);
    // baseCol = mix(baseCol, vec3(0.02, 0.045, 0.03), thickness * 0.4);
    // fragColor = vec4(vec3(f.x), 1.0);
    // fragColor = vec4(vec3(baseCol), 1.0);
    // return;
// vec2 L = normalize(vec2(-0.4, 0.8));
// float lightTerm = clamp(dot(normalize(gradNoise(pos)), L), 0.0, 1.0);
// float sss = lightTerm * thickness;
// col += sss * vec3(0.2, 0.35, 0.25);

    color += insideCells * baseCol;



    fragColor = vec4( color , 1.0);
}

// hierarchical voronoi (more detailed towards edges)
// define edges
// shade green jade (sss?) and white edges
// noisy edges wtf??? https://www.shadertoy.com/view/Xs3fR4
// use polar coords?
// animate circle radius
