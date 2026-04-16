precision highp float;

vec2 hash2( vec2 p ) { 
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); 
}

// float smin( float a, float b, float k )
// {
//     k *= 4.0;
//     float h = max( k-abs(a-b), 0.0 )/k;
//     return min(a,b) - h*h*k*(1.0/4.0);
// }
float smin( float a, float b, float k )
{
    k *= 6.0;
    float h = max( k-abs(a-b), 0.0 )/k;
    return min(a,b) - h*h*h*k*(1.0/6.0);
}

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

// https://iquilezles.org/articles/sdfrepetition/
float repeated( vec2 p, float s )
{
    vec2 id = round(p/s);
    vec2  o = sign(p-s*id); // neighbor offset direction
    o.x = (o.x == 0.0) ? 1.0 : o.x;
o.y = (o.y == 0.0) ? 1.0 : o.y;

    float d = 1e20;
    for( int j=-2; j<2; j++ )
    for( int i=-2; i<2; i++ )
    {
        vec2 rid = id + vec2(i,j)*o;
        vec2 r = p - s*rid;
        if (hash2(rid).x > 0.5) d = smin( d, sdBox(r, vec2(0.45)), .02 );
        //  d = smin( d, sdBox(r, vec2(0.45)  * step(0.3, hash2(rid).y)), .082 );
    }
    return d;
}
float repeated2(vec2 p, float s)
{
    float d = 1e20;
    for ( int j=-10; j<10; j++ )
    for ( int i=-10; i<10; i++ )
    {
        vec2 id = vec2(i,j);
        vec2 r = p - s*id;
        if (hash2(id).x > 0.5) d = smin( d, sdBox(r, vec2(0.5)), 0.05 );
    }
    return d;
}
vec2 smoothrepeat_asin_sin(vec2 p,float smooth_size,float size){
    p/=size;
    p=asin(sin(p)*(1.0-smooth_size));
    return p*size;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 p = (-iResolution.xy + 2.0*fragCoord) / iResolution.y;

    float m2 = repeated2((p-0.5) * 5., 1.) - 0.03;
    m2 = 1.-smoothstep(0., 0.02, m2);
    
    vec3 col = vec3(m2);
    fragColor = vec4(col, 1.0);
}