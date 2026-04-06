#iChannel0 "file://assets/me-grain.png"
#iChannel1 "file://assets/me-blur-grain.png"

uint baseHash(uvec3 p)
{
    p = 1103515245U*((p.xyz >> 1U)^(p.yzx));
    uint h32 = 1103515245U*((p.x^p.z)^(p.y>>3U));
    return h32^(h32 >> 16);
}
vec2 hash23(uvec3 x)
{
    uint n = baseHash(x);
    uvec2 rz = uvec2(n, n*48271U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec2((rz.xy >> 1) & uvec2(0x7fffffffU))/float(0x7fffffff);
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    vec2 uvs = uv * 12.;
    vec2 fuv = fract(uvs);
    vec2 iuv = floor(uvs);

    // // move image with mouse
    // uv *= 0.8; // zoom in to move
    // uv += iMouse.xy/iResolution.xy*0.51;
    // uv = clamp(uv, vec2(0.0), vec2(1.));
    vec4 col = vec4(0.0);
    vec4 col0 = texture(iChannel0, uv);
    col0 = vec4(vec3(dot(col0.rgb, vec3(0.299, 0.587, 0.114))), 1.);
    vec4 col1 = texture(iChannel1, uv);
    col1 = vec4(vec3(dot(col1.rgb, vec3(0.299, 0.587, 0.114))), 1.);

    vec2 rnd = hash23(uvec3(iuv, 0));

    if (((iuv.x < 2. || iuv.x > 9.) ||  (iuv.y < 2. || iuv.y > 9.)))
    {
        if (rnd.x > 0.6 && rnd.x < 0.8)
        {
            col += col1;
        }
        else if (rnd.x > 0.7)
        {
            float s = (sin((rnd.y > 0.5 ? fuv.y : fuv.x) * 50.)*0.5+0.5);
            col += mix(col0, col1, s * 0.8 + 0.4);
        }
        else
        {
            col += col0;
        }
    }
    else
    {
        col += col0;
    }

    fragColor = col;
}
