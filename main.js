'use strict';

const canvasWrapper = document.getElementById('canvasWrapper');
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl', {alpha: false});
const textarea = document.getElementById('textarea');
const worker = new Worker('worker.js');

textarea.value =
`scale(r=2) {
  intersection {
    box
    trans(z=-0.2) {
      sphere(d=1.4)
    }
  }
  cylinder(d=0.1, h=1.5) {
    diff {
      sphere(d=0.8)
      trans(x=0.2, y=-0.2) {
        sphere(d=0.9)
      }
    }
  }
}`

var vertexBuffer = null;
var deCode = null;
var program = null;
var uResolution = null;
var uPosition = null;
var uRotation = null;
var uDistance = null;
initGl();

window.addEventListener('resize', resize);
resize();
draw();

worker.addEventListener('message', updated);
setInterval(update, 1000);

function resize() {
  canvas.width = canvasWrapper.clientWidth;
  canvas.height = canvasWrapper.clientHeight;
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  updateResolution();
}

function updateResolution() {
  gl.uniform2f(uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
}

function update() {
  worker.postMessage([textarea.value, textarea.selectionStart]);
}

function updated(e) {
  setDEFunctions(e.data);
  updateResolution();
  updateCamera();
}

function initGl() {
  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  setDEFunctions('float de(vec3 pos){return 1e9;}float he(vec3 pos){return 1e9;}');
}

function setDEFunctions(code) {
  if (deCode === code) {
    return;
  }
  deCode = code;
  gl.deleteProgram(program);
  program = gl.createProgram();
  gl.attachShader(program, loadShader(vertexShader, gl.VERTEX_SHADER));
  gl.attachShader(program, loadShader(fragmentShader + deCode, gl.FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw "Failed to initialize the shader program: " + gl.getProgramInfoLog(program);
  }
  gl.useProgram(program);
  uResolution = gl.getUniformLocation(program, "u_Resolution");
  uPosition = gl.getUniformLocation(program, "u_Position");
  uRotation = gl.getUniformLocation(program, "u_Rotation");
  uDistance = gl.getUniformLocation(program, "u_Distance");
  var aPosition = gl.getAttribLocation(program, "a_Position");
  gl.enableVertexAttribArray(aPosition);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
}

function loadShader(source, type) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw "Failed to compile a shader: " + gl.getShaderInfoLog(shader);
  }
  return shader;
}

function draw() {
  requestAnimationFrame(draw);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}