function setupContext(canvas, gl) {
    canvas = document.getElementById('my_Canvas');
    gl = canvas.getContext('experimental-webgl');
}

// TODO add other buffers
function setupGeometry(vertices, vertex_buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); // Bind an empty array buffer to it
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW); // Pass the vertices data to the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind the buffer
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
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

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

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

// TODO add other buffers
function BindShaderToObjectBuffer(vertex_buffer, shader_program) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); //Bind vertex buffer object

    var coord = gl.getAttribLocation(shader_program, "coordinates"); //Get the attribute location

    gl.vertexAttribPointer(coord, 2, gl.FLOAT, false, 0, 0); //point an attribute to the currently bound VBO

    gl.enableVertexAttribArray(coord); //Enable the attribute
}

export { setupContext, setupGeometry, initShaderProgram, BindShaderToObjectBuffer }
