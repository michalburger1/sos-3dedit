'use strict';

const vertexShader = `
  precision mediump float;

  uniform vec2 u_Resolution;
  uniform vec3 u_Position;
  uniform vec2 u_Rotation;
  uniform float u_Distance;
  attribute vec2 a_Position;
  varying vec3 v_Origin;
  varying vec3 v_Direction;
  varying vec3 v_Light;

  void main() {
    gl_Position = vec4(a_Position, 0.0, 1.0);
    float a = u_Rotation.x;
    float b = u_Rotation.y;
    vec3 dir = vec3(sin(a) * cos(b), cos(a) * cos(b), sin(b));
    v_Origin = u_Position - u_Distance * dir;
    float fov = 0.3;
    v_Direction = dir + fov * a_Position.x * vec3(cos(a), -sin(a), 0.0) + fov * a_Position.y * vec3(-sin(a) * sin(b), -cos(a) * sin(b), cos(b)) * u_Resolution.y / u_Resolution.x;
    a += 0.5;
    b -= 0.5;
    v_Light = -vec3(sin(a) * cos(b), cos(a) * cos(b), sin(b));
  }
`;

const fragmentShader = `
  precision mediump float;

  varying vec3 v_Origin;
  varying vec3 v_Direction;
  varying vec3 v_Light;

  float de(vec3 pos);
  float he(vec3 pos);

  bool ray(inout vec3 pos, vec3 dir) {
    dir = normalize(dir);
    for (int i = 0; i < 200; i++) {
      float d = de(pos);
      if (d < 1e-4) {
        return true;
      }
      if (d > 1e8) {
        return false;
      }
      pos += d * dir;
    }
    return true;
  }

  vec3 normal(vec3 pos) {
    float d = de(pos);
    float dx = de(pos + vec3(1e-3, 0.0, 0.0));
    float dy = de(pos + vec3(0.0, 1e-3, 0.0));
    float dz = de(pos + vec3(0.0, 0.0, 1e-3));
    return normalize(vec3(dx - d, dy - d, dz - d));
  }

  void main() {
    vec3 pos = v_Origin;
    if (ray(pos, v_Direction)) {
      vec3 nor = normal(pos);
      vec3 refl = v_Direction - 2.0 * dot(v_Direction, nor) * nor;
      float ambient = 1.0;
      float diffuse = clamp(dot(nor, v_Light), 0.0, 1.0);
      float specular = clamp(dot(refl, v_Light) - 0.8, 0.0, 1.0);
      float highlight = 0.0;
      if (he(pos) < 1e-4) {
        highlight = 1.0;
      }
      pos += nor * 1e-3;
      if (ray(pos, v_Light)) {
        diffuse *= 0.3;
      }
      float shade = 0.1 * ambient + 0.9 * diffuse + 0.0 * specular;
      gl_FragColor = vec4(vec3(1.0, 1.0, 1.0) * shade + vec3(0.0, 0.5, 0.0) * highlight, 1.0);
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
  }
`
