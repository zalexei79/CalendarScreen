import { blendPresenterPositions } from './presenterMorphMesh.js';

function webglRenderer(canvas, images, mesh) {
  // Keep framebuffer RGB premultiplied, including feathered/antialiased edges.
  // WebKit composites the canvas into the page using this alpha convention.
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, depth: false, antialias: true });
  if (!gl) return null;
  const shaders = [], buffers = [], textures = [];
  const shader = (type, source) => {
    const value = gl.createShader(type); shaders.push(value);
    gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw Error('Presenter shader unavailable');
    return value;
  };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `
    attribute vec2 position; attribute vec2 smileUV; attribute vec2 sadUV; attribute vec2 angryUV; attribute float feather;
    varying vec2 smile; varying vec2 sad; varying vec2 angry; varying float alpha;
    void main(){gl_Position=vec4(position.x*2.0-1.0,1.0-position.y*2.0,0.0,1.0);smile=smileUV;sad=sadUV;angry=angryUV;alpha=feather;}`));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
    precision mediump float; uniform sampler2D sheet; uniform sampler2D portrait; uniform vec3 weights;
    varying vec2 smile; varying vec2 sad; varying vec2 angry; varying float alpha;
    void main(){vec3 color=texture2D(sheet,smile).rgb*weights.x+texture2D(sheet,sad).rgb*weights.y+texture2D(portrait,angry).rgb*weights.z;float coverage=clamp(alpha,0.0,1.0);gl_FragColor=vec4(color*coverage,coverage);}`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Presenter rendering unavailable');
  gl.useProgram(program);
  const attribute = (name, size, data, dynamic = false) => {
    const buffer = gl.createBuffer(); buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    return buffer;
  };
  const points = new Float32Array(mesh.mask.length * 2);
  const positionBuffer = attribute('position', 2, points, true);
  ['smileUV', 'sadUV', 'angryUV'].forEach((name, i) => attribute(name, 2, new Float32Array(mesh.uv[i].flat())));
  attribute('feather', 1, new Float32Array(mesh.mask));
  const indices = gl.createBuffer(); buffers.push(indices);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.triangles), gl.STATIC_DRAW);
  for (let i = 0; i < images.length; i++) {
    const texture = gl.createTexture(); textures.push(texture);
    gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[i]);
  }
  gl.uniform1i(gl.getUniformLocation(program, 'sheet'), 0); gl.uniform1i(gl.getUniformLocation(program, 'portrait'), 1);
  const weightLocation = gl.getUniformLocation(program, 'weights');
  return {
    mode: 'webgl',
    draw(weights) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, blendPresenterPositions(mesh, weights, points));
      gl.uniform3fv(weightLocation, weights); gl.drawElements(gl.TRIANGLES, mesh.triangles.length, gl.UNSIGNED_SHORT, 0);
    },
    destroy() { buffers.forEach(buffer => gl.deleteBuffer(buffer)); textures.forEach(texture => gl.deleteTexture(texture)); shaders.forEach(value => gl.deleteShader(value)); gl.deleteProgram(program); },
  };
}

function canvasRenderer(canvas, images, mesh) {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const layer = document.createElement('canvas'), mask = document.createElement('canvas');
  const paint = layer.getContext('2d'), feather = mask.getContext('2d');
  const points = new Float32Array(mesh.mask.length * 2);
  const triangle = (source, target, image) => {
    const [p, q, r] = source, [a, b, c] = target;
    const d = p[0] * (q[1] - r[1]) + q[0] * (r[1] - p[1]) + r[0] * (p[1] - q[1]);
    if (Math.abs(d) < .00001) return;
    const coefficient = axis => [
      (a[axis] * (q[1] - r[1]) + b[axis] * (r[1] - p[1]) + c[axis] * (p[1] - q[1])) / d,
      (a[axis] * (r[0] - q[0]) + b[axis] * (p[0] - r[0]) + c[axis] * (q[0] - p[0])) / d,
      (a[axis] * (q[0] * r[1] - r[0] * q[1]) + b[axis] * (r[0] * p[1] - p[0] * r[1]) + c[axis] * (p[0] * q[1] - q[0] * p[1])) / d,
    ];
    const x = coefficient(0), y = coefficient(1);
    paint.save(); paint.beginPath(); paint.moveTo(...a); paint.lineTo(...b); paint.lineTo(...c); paint.closePath(); paint.clip();
    paint.setTransform(x[0], y[0], x[1], y[1], x[2], y[2]); paint.drawImage(image, 0, 0); paint.restore();
  };
  return {
    mode: 'canvas',
    draw(weights) {
      const w = canvas.width, h = canvas.height;
      if (layer.width !== w || layer.height !== h) {
        layer.width = mask.width = w; layer.height = mask.height = h;
        const oval = mesh.oval.map(i => mesh.positions[0][i]);
        const center = oval.reduce((sum, p) => [sum[0] + p[0] / oval.length, sum[1] + p[1] / oval.length], [0, 0]);
        feather.filter = `blur(${Math.max(1, w * .004)}px)`; feather.fillStyle = '#fff'; feather.beginPath();
        oval.forEach((p, i) => feather[i ? 'lineTo' : 'moveTo']((center[0] + (p[0] - center[0]) * .96) * w, (center[1] + (p[1] - center[1]) * .96) * h));
        feather.closePath(); feather.fill();
      }
      context.clearRect(0, 0, w, h); blendPresenterPositions(mesh, weights, points);
      for (let frame = 0; frame < 3; frame++) {
        if (weights[frame] < .0001) continue;
        const image = images[frame === 2 ? 1 : 0]; paint.clearRect(0, 0, w, h);
        for (let i = 0; i < mesh.triangles.length; i += 3) {
          const ids = mesh.triangles.slice(i, i + 3);
          triangle(ids.map(id => [mesh.uv[frame][id][0] * image.width, mesh.uv[frame][id][1] * image.height]), ids.map(id => [points[id * 2] * w, points[id * 2 + 1] * h]), image);
        }
        context.globalCompositeOperation = 'lighter'; context.globalAlpha = weights[frame]; context.drawImage(layer, 0, 0);
      }
      context.globalAlpha = 1; context.globalCompositeOperation = 'destination-in'; context.drawImage(mask, 0, 0); context.globalCompositeOperation = 'source-over';
    },
    destroy() { layer.width = mask.width = 1; },
  };
}

export function createPresenterRenderer(canvas, images, mesh, forceCanvas = false) {
  return (!forceCanvas && webglRenderer(canvas, images, mesh)) || canvasRenderer(canvas, images, mesh);
}
