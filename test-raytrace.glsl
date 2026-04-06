
// Spectrum palette
// IQ https://www.shadertoy.com/view/ll2GD3
vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
}
vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
}


struct Hit {
    int res; // 0 = no hit, 1 = hit
    vec3 p;
    float len;
    vec3 nor;
};

struct Box {
    vec3 center;
    mat3 rot;
    vec3 radius;
    vec3 invRadius;
};

// for more complete version
// axis aligned, center at the origin, dimensions "boxSize"
vec2 boxIntersection( in vec3 ro, in vec3 rd, vec3 boxSize, out vec3 oNormal ) 
{
    vec3 m = 1.0/rd; // can precompute if traversing a set of aligned boxes
    vec3 n = m*ro;   // can precompute if traversing a set of aligned boxes
    vec3 k = abs(m)*boxSize;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    float tN = max( max( t1.x, t1.y ), t1.z );
    float tF = min( min( t2.x, t2.y ), t2.z );
    if( tN>tF || tF<0.0) return vec2(-1.0); // no intersection
    oNormal = (tN>0.0) ? step(vec3(tN),t1) : // ro ouside the box
                           step(t2,vec3(tF));  // ro inside the box
    oNormal *= -sign(rd);
    return vec2( tN, tF );
}

Hit intersect(vec3 ro, vec3 rd) {
    Box b;
    b.center = vec3(0.);
    // b.rot = 
    b.radius = vec3(1.);
    b.invRadius = 1. / b.radius;

    Hit hit;
    hit.res = 0;

    float t;
    vec3 n;
    vec2 bi = boxIntersection(ro, rd, vec3(0.5), n);
    if ( bi != vec2(-1.)) {
        hit.len = bi.x;
        hit.p = ro + rd * hit.len;
        hit.nor = n;
        hit.res = 1;
    }

    return hit;
}

// TODO test different light setup
vec3 light(vec3 ro, vec3 rd) {
    vec3 lp = vec3(5.);
    vec3 ldir = normalize(lp - ro);
    float diff = max(dot(ldir, rd), 0.);
    return vec3(diff) * (1. / pow(length(lp - ro), 2.)  + 0.01) ;
}

#iChannel0 "file://assets/blue-noise.png"

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = (2. * fragCoord - iResolution.xy) / iResolution.y;

     // camera movement	
	float an = 0.4*iTime;
	vec3 ro = vec3( 4.5*cos(an), 1.0, 4.5*sin(an) );
    vec3 ta = vec3( 0.0, 0., 0.0 );
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
	// create view ray
	vec3 rd = normalize( uv.x*uu + uv.y*vv + 2.0*ww );


    Hit hit, firstHit;
    int res;
    vec3 p, rayDir, origin, sam, ref, raf, nor, camOrigin, camDir;
    float invert, ior, offset, extinctionDist, maxDist, firstLen, bounceCount, wavelength;
    
    vec3 col = vec3(0);
    float focal = 3.8;
    bool refracted;

    vec3 bgCol = vec3(0.1);

    invert = 1.;
    maxDist = 15.; 

    firstHit = intersect(rd, ro);
    firstLen = firstHit.len; // use for fog // TODO if no hit skip everything else???
    // fragColor = vec4(1., 0., 0., 1.); return;

    // diagnostics – uncomment one line at a time to inspect values:
    // fragColor = vec4(uv * 0.5 + 0.5, 0.0, 1.0);  return;   // visualize UV
    //fragColor = vec4(camDir * 0.5 + 0.5, 1.0);      return;   // visualize ray direction
    //fragColor = vec4(vec3(firstHit.len/20.0), 1.0);  return;   // visualize hit distance

    // simple hit marker (re-enable once ray orientation is confirmed)
    /*if(firstHit.res == 1) {
        fragColor = vec4(1,0,0,1);
        return;
    }
    */

    float steps = 0.;
    float MAX_DISPERSE = 4.;
    float MAX_BOUNCE = 5.;
    for (float disperse = 0.; disperse < MAX_DISPERSE; disperse++) {
        invert = 1.;
    	sam = vec3(0);

        // TODO should i jitter the ray for AA or will it make dispersion too noisy?
        origin = ro;
        rayDir = rd;

        extinctionDist = 0.;
        wavelength = disperse / MAX_DISPERSE;
		// float rand = texture(iChannel0, (fragCoord + floor(iTime * 60.) * 10.) / iChannelResolution[0].xy).r;
        // wavelength += (rand * 2. - 1.) * (.5 / MAX_DISPERSE);
        
		bounceCount = 0.;
        for (float bounce = 0.; bounce < MAX_BOUNCE; bounce++) {

            if (bounce == 0.) {
                hit = firstHit;
            } else {
                hit = intersect(origin, rayDir);
            }
            
            res = hit.res;
            p = hit.p;
            
            if (invert < 0.) {
	            extinctionDist += hit.len;
            }

            // hit background
            if ( res == 0) {
                break;
            }

            vec3 nor = hit.nor * invert;            
            ref = reflect(rayDir, nor);
            
            // normal shading (disabled for easier debugging)
            sam += light(p, ref) * .5;
            sam += pow(max(1. - abs(dot(rayDir, nor)), 0.), 5.) * .1;
            sam += vec3(1., 0., 0.);

            // refract
            float ior = mix(1.2, 1.8, wavelength);
            ior = invert < 0. ? ior : 1. / ior;
            raf = refract(rayDir, nor, ior);
            bool tif = raf == vec3(0); // total internal reflection
            rayDir = tif ? ref : raf;
            offset = .01 / abs(dot(rayDir, nor));
            origin = p + offset * rayDir;
            //invert = tif ? invert : invert * -1.;
            // invert *= -1.; // not correct but gives more interesting results

            bounceCount = bounce;
        }

        // TODO accumulate bgCol???
        // #ifndef DARK_MODE
        //     sam += bounceCount == 0. ? bgCol : env(p, rayDir);	
        // #endif

        if (bounceCount == 0.) {
            // didn't bounce, so don't bother calculating dispersion
            col += sam * MAX_DISPERSE / 2.;
            break;
        } else {
            vec3 extinction = vec3(.5,.5,.5) * .0;
            extinction = 1. / (1. + (extinction * extinctionDist));	
            col += sam * extinction * spectrum(-wavelength+.25);
        }
    }

    col /= MAX_DISPERSE;
        
    fragColor = vec4(col, 1.);
}