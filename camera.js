'use strict';

(function() {
  var cx = 0.0;
  var cy = 0.0;
  var cz = 0.0
  var rx = 0.0;
  var ry = 0.0;
  var dist = 20.0;

  var mx = null;
  var my = null;
  var button = null;

  canvas.addEventListener('contextmenu', contextMenu);
  canvas.addEventListener('mousedown', mouseDown);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mouseup', mouseUp);
  canvas.addEventListener('mouseleave', mouseLeave);

  function updateCamera() {
    gl.uniform3f(uPosition, cx, cy, cz);
    gl.uniform2f(uRotation, rx, ry);    
    gl.uniform1f(uDistance, dist);
  }

  function contextMenu(e) {
    e.preventDefault();
  }

  function mouseDown(e) {
    if (canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
    mx = e.pageX;
    my = e.pageY;
    button = e.button;
    canvas.style.cursor = 'none';
  }

  function mouseMove(e) {
    var dx = null;
    var dy = null;
    if (document.pointerLockElement === canvas) {
        dx = e.movementX;
        dy = e.movementY;
    } else if (mx !== null && my !== null) {
      dx = e.pageX - mx;
      dy = e.pageY - my;
      mx = e.pageX;
      my = e.pageY;
    }
    if (dx !== null && dy !== null) {
      switch (button) {
        case 0:
          cx -= 0.02 * Math.cos(rx) * dx;
          cy += 0.02 * Math.sin(rx) * dx;
          cz += 0.02 * dy;
          break;
        case 2:
          rx += 0.5 * Math.PI * dx / canvas.width;
          ry -= 0.5 * Math.PI * dy / canvas.height;
          ry = Math.min(ry, 0.5 * Math.PI);
          ry = Math.max(ry, -0.5 * Math.PI);
          break;
        default:
          return;
      }
      updateCamera();
    }
  }

  function mouseUp(e) {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
    mx = null;
    my = null;
    button = null;
    canvas.style.cursor = '';
  }

  function mouseLeave(e) {
    mouseMove(e);
    mouseUp(e);
  }

  window.updateCamera = updateCamera;
})();