//import * as utilWGl from './UtilWebGL.js';
var canvas;
var gl;

var bgVertexBuffer;
var backgroundShader;

var navBarShader;
var navBarVertexBuffer;

/**
 * Creates a shader from the content of a script tag.
 *
 * @param {!WebGLRenderingContext} gl The WebGL Context.
 * @param {string} scriptId The id of the script tag.
 * @param {string} opt_shaderType. The type of shader to create.
 *     If not passed in will use the type attribute from the
 *     script tag.
 * @return {!WebGLShader} A shader.
 */
function createShaderFromScript(gl, scriptId, opt_shaderType) {
    // look up the script tag by id.
    var shaderScript = document.getElementById(scriptId);
    if (!shaderScript) {
        throw ("*** Error: unknown script element" + scriptId);
    }

    console.log(shaderScript.innerText);
    var shaderSource = shaderScript.textContent;
    var type = shaderScript.getAttribute("type");
    // If we didn't pass in a type, use the 'type' from
    // the script tag.
    if (!opt_shaderType) {
        if (type == "x-shader/x-vertex") {
            opt_shaderType = gl.VERTEX_SHADER;
        } else if (type == "x-shader/x-fragment") {
            opt_shaderType = gl.FRAGMENT_SHADER;
        } else if (!opt_shaderType) {
            throw ("*** Error: shader type not set");
        }
    }

    return loadShader(gl, opt_shaderType, shaderSource);
};

function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Check if the canvas is not the same size.
    const needResize = canvas.width !== displayWidth ||
        canvas.height !== displayHeight;

    if (needResize) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }

    // send resolution to shaders
    var res = gl.getUniformLocation(backgroundShader, "resolution");
    gl.uniform2fv(res, [canvas.width, canvas.height]);
    res = gl.getUniformLocation(navBarShader, "resolution");
    gl.uniform2fv(res, [canvas.width, canvas.height]);
}

function setupContext() {
    canvas = document.getElementById('my_Canvas');

    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;

    gl = canvas.getContext('webgl2');
}

function setupGeometry(vertices, vertex_buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); // Bind an empty array buffer to it
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW); // Pass the vertices data to the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind the buffer
}

/**
 * Creates and compiles a shader.
 *
 * @param {!WebGLRenderingContext} gl The WebGL Context.
 * @param {string} source The GLSL source code for the shader.
 * @param {number} type The type of shader, VERTEX_SHADER or
 *     FRAGMENT_SHADER.
 * @return {!WebGLShader} The shader.
 */
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    // Send the source to the shader object
    gl.shaderSource(shader, source);

    // Compile the shader program
    gl.compileShader(shader);

    // See if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initShaderProgram(gl, vsSourceId, fsSourceId) {
    var vertexShader = createShaderFromScript(gl, vsSourceId);
    var fragmentShader = createShaderFromScript(gl, fsSourceId);

    //const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    //const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    // Create the shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram); // Link both programs

    // If creating the shader program failed, alert
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function BindShaderToObjectBuffer(shaderProgram, vertex_buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); //Bind vertex buffer object

    var coord = gl.getAttribLocation(shaderProgram, "coordinates"); //Get the attribute location
    gl.vertexAttribPointer(coord, 2, gl.FLOAT, false, 0, 0); //point an attribute to the currently bound VBO
    gl.enableVertexAttribArray(coord); //Enable the attribute


}

function lerp(a, b, x) {
    if (x>1) return b;
    if (x<0) return a;
    return a + (b - a) * x;
}

let oldNavPos = 0.0;
let navLerpT = 1.0;
let navPos = 0.0;

let frameTime = 0.0;
let prevFrameTime = 0.0;
//TODO proper loop, fix canvas size
function drawScene(elapsedTime) {
    frameTime = elapsedTime - prevFrameTime;
    prevFrameTime = elapsedTime;

    // resize canvas
    resizeCanvasToDisplaySize(gl.canvas);

    // clear canvas color, enable depth test clear color buffer
    gl.clearColor(0.5, 0.5, 0.5, 0.9);
    // gl.enable(gl.DEPTH_TEST);
    // gl.depthFunc(gl.ALWAYS);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.viewport(0, 0, canvas.width, canvas.height); // set view port
    // gl.drawArrays(gl.TRIANGLES, 0, 3); // drawTriangle

    // render background triangle
    gl.useProgram(backgroundShader);
    let time = gl.getUniformLocation(backgroundShader, "time");
    gl.uniform1f(time, elapsedTime * 0.001);  // elapsedTime is time in microseconds since page load
    BindShaderToObjectBuffer(backgroundShader, bgVertexBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // render nav bar
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); 
    gl.useProgram(navBarShader);

    if ( oldNavPos != newNavPos && navLerpT >= 1.0)
    {
        navLerpT = 0.0;
    }
    if (navLerpT < 1)
    {
        navLerpT += frameTime * 0.001 * 2.5; 
        navPos = lerp(oldNavPos, newNavPos, navLerpT);
    }
    if (navLerpT >= 1)
    {
        oldNavPos = newNavPos;
    }

    let navPosUniform = gl.getUniformLocation(navBarShader, "navPos");
    gl.uniform1f(navPosUniform, navPos);


    BindShaderToObjectBuffer(navBarShader, navBarVertexBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);

    requestAnimationFrame(drawScene);
}

function setupAndDraw() {
    /* 1. Prepare the canvas and get WebGL context */
    setupContext();

    /* 2. Define the geometry and store it in buffer objects */
    var vertices = [-1.0, -1.0, -1.0, 3.0, 3.0, -1.0]; // 2D triangle coords
    bgVertexBuffer = gl.createBuffer();
    setupGeometry(vertices, bgVertexBuffer);

    /* 3. Create and compile Shader programs */
    backgroundShader = initShaderProgram(gl, "background-vert-shader", "background-frag-shader");

    // navBar
    // var navBarQuadVertices = [-1.0, -1.0, -1.0, -0.8, 1.0, -1.0, 
    //                           -1.0, -0.8, 1.0, -0.8, 1.0, -1.0];
    var navBarQuadVertices = [-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 
                            -1.0, 1.0, 1.0,  1.0, 1.0, -1.0];
    navBarVertexBuffer = gl.createBuffer();
    setupGeometry(navBarQuadVertices, navBarVertexBuffer);
    navBarShader = initShaderProgram(gl, "navBar-vert-shader", "navBar-frag-shader");


    /* 4, render loop */
    drawScene();
}

function main() {
    window.addEventListener("load", function() {
        setupAndDraw();
    });
}

main();