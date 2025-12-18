"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { mat4, vec3, quat } from 'wgpu-matrix';
import { subdivideIndices, subdivideSphere, coarsenIndices, degToRad } from "../../common/utils";

const main= async() =>
{
  const adapter : GPUAdapter = <GPUAdapter> await navigator.gpu.requestAdapter();
  const device : GPUDevice = await adapter.requestDevice();
  const canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('gpu-canvas');
  const context : GPUCanvasContext = <GPUCanvasContext> canvas.getContext('webgpu');
  const format : GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
  const configuration : GPUCanvasConfiguration = {
    device: device,
    format: format,
  };
  context.configure(configuration);

  const M_SQRT2 : number = Math.sqrt(2.0);
  const M_SQRT6 : number = Math.sqrt(6.0);

  var positions  : Float32Array[] = [
    vec3.create(0.0, 0.0, 1.0),
    vec3.create(0.0, 2.0 * M_SQRT2 / 3.0, -1.0 / 3.0),
    vec3.create(-M_SQRT6 / 3.0, -M_SQRT2 / 3.0, -1.0 / 3.0),
    vec3.create(M_SQRT6 / 3.0, -M_SQRT2 / 3.0, -1.0 / 3.0),
  ];

  let indices : Uint32Array = new Uint32Array([
    0, 1, 2, // front
    0, 3, 1, // right
    1, 3, 2, // left
    0, 2, 3, // bottom
  ]);

  const maxSubdivisions : number = 6;
  var subdivisions : number = 0;
  const startSubdivisions : number = 6;
  let calculatedSubdivisions : number = subdivisions;

  function coarsen() : void {
    if (subdivisions > 0) {
      subdivisions--;
      indices = coarsenIndices(indices);
    }
  };

  function subdivide() : void {
    if (subdivisions < maxSubdivisions) {
      subdivisions++;
      if (subdivisions > calculatedSubdivisions) {
        calculatedSubdivisions++;
        indices = subdivideSphere(positions, indices);
      } else {
        indices = subdivideIndices(indices);
      }
    }
  };

  for (let i : number = 0; i < startSubdivisions; i++) {
    subdivide();
  }

  (document.getElementById("coarsen") as HTMLInputElement).onclick = coarsen;
  (document.getElementById("subdivide") as HTMLInputElement).onclick = subdivide;
  const cameraSelect : HTMLInputElement = <HTMLInputElement> document.getElementById("camera-select");

  const response = await fetch('../../textures/normalmap.png');
  const blob = await response.blob();
  const img : ImageBitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

  const cubemap : string[] = [
    '../../textures/cm_left.png',
    '../../textures/cm_right.png',
    '../../textures/cm_top.png',
    '../../textures/cm_bottom.png',
    '../../textures/cm_back.png',
    '../../textures/cm_front.png',
  ]

  var imgsQuad : ImageBitmap[] = new Array(cubemap.length);
  for (let i : number = 0; i < cubemap.length; i++) {
    const response = await fetch(cubemap[i]);
    const blob = await response.blob();
    imgsQuad[i] = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  }

  const quadPositions : Float32Array = new Float32Array([
    -1.0, -1.0, 0.999,
    -1.0, 1.0, 0.999,
    1.0, -1.0, 0.999,
    1.0, 1.0, 0.999,
  ]);

  const quadIndices : Uint32Array = new Uint32Array([
    0, 2, 1,
    2, 3, 1,
  ]);

  const positionBuffer : GPUBuffer = device.createBuffer({
    label: "Positions",
    size: positions[0].byteLength * 4 ** (maxSubdivisions + 1) + 4 * 3 * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const positionBufferLayout : GPUVertexBufferLayout = {
    arrayStride: positions[0].length * 4,
    attributes: [{
      format: "float32x3",
      offset: 0,
      shaderLocation: 0,
    }],
  };

  const indicesBuffer : GPUBuffer = device.createBuffer({
    label: "Indices",
    size: 4 * 4 * 4 ** (maxSubdivisions + 1) + 4 * 6,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  const uniformBufferSize : number = 16 * 4 * 2 + 4 * 4;
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBufferQuadSize : number = 16 * 4 * 2 + 4 * 4;
  const uniformBufferQuad : GPUBuffer = device.createBuffer({
    label: 'uniforms quad',
    size: uniformBufferQuadSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const projection : Float32Array = new Float32Array(16);
  const view : Float32Array = new Float32Array(16);
  const model : Float32Array = new Float32Array(16);
  const mvp : Float32Array = new Float32Array(16);

  const aspect : number = canvas.clientWidth / canvas.clientHeight;

  const wgsl : GPUShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: shader
  });

  const vertex : GPUVertexState = {
    module: wgsl,
    entryPoint: 'main_vs',
    buffers: [positionBufferLayout],
  };

  const fragment : GPUFragmentState = {
    module: wgsl,
    entryPoint: 'main_fs',
    targets: [{
      format: format
    }],
  };

  const pipeline : GPURenderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: vertex,
    fragment: fragment,
    primitive: {
      topology: 'triangle-list',
      frontFace: 'ccw',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  })

  const depthTexture : GPUTexture = device.createTexture({
    size: { width: canvas.width, height: canvas.height, },
    format: 'depth24plus',
    sampleCount: 1,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  mat4.perspective(degToRad(90),aspect,0.1,100,projection);
  mat4.identity(model)
  mat4.translate(model, [0.0, 0.0, 0.0], model);

  const texture : GPUTexture = device.createTexture({
    dimension: '2d',
    size: [img.width, img.height, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: img, flipY: true },
    { texture: texture },
    { width: img.width, height: img.height }
  );

  const textureQuad : GPUTexture = device.createTexture({
    size: [imgsQuad[0].width, imgsQuad[0].height, imgsQuad.length],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  for (let i : number = 0; i < imgsQuad.length; i++) {
    device.queue.copyExternalImageToTexture(
      { source: imgsQuad[i], flipY: true },
      { texture: textureQuad, origin: [0, 0, i] },
      { width: imgsQuad[i].width, height: imgsQuad[i].height }
    );
  }

  const sampler : GPUSampler = device.createSampler({
    addressModeU: "repeat",
    addressModeV: "repeat",
    minFilter: "linear",
    magFilter: "linear",
    mipmapFilter: "linear"
  });

  const samplerQuad : GPUSampler = device.createSampler({
    addressModeU: "repeat",
    addressModeV: "repeat",
    minFilter: "linear",
    magFilter: "linear",
    mipmapFilter: "linear"
  });

  const bindGroup : GPUBindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer }},
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
      { binding: 3, resource: samplerQuad },
      { binding: 4, resource: textureQuad.createView({ dimension: 'cube' }) },
    ],
  });

  const bindGroupQuad : GPUBindGroup = device.createBindGroup({
    label: 'bind group for quad',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBufferQuad }},
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
      { binding: 3, resource: samplerQuad },
      { binding: 4, resource: textureQuad.createView({ dimension: 'cube' }) },
    ],
  });


  var xPan : number = 0.0;
  var yPan : number = 0.0;
  var zEye : number = 4.0;
  const target : Float32Array = vec3.create(0, 0, 0);
  const up : Float32Array = vec3.create(0, 1, 0);
  const z : Float32Array = vec3.subtract(vec3.create(0, 0, zEye), target);

  let u : Float32Array;
  const quatRot : Float32Array = quat.create();
  quat.rotationTo(vec3.create(0, 0, 1), vec3.normalize(z), quatRot);
  const quatInc : Float32Array = quat.create();

  let mouseDown : boolean = false;

  var x : number;
  var y : number;
  const dollyDelta : number = 0.01;
  const panningDelta : number = 0.01;

  var spinning : boolean = false;
  var mousePressedTime : number = 0;

  function mapEventCoordsToSphere(event : MouseEvent) : Float32Array {
    const rectangle = event.target.getBoundingClientRect();
    return vec3.normalize(orthographicHyperbolicMapping(2 * (event.clientX - rectangle.left) / canvas.width - 1, 2 * (canvas.height - event.clientY + rectangle.top - 1) / canvas.height - 1));
  }

  function orthographicHyperbolicMapping(px : number, py : number) : Float32Array {
    const d : number = Math.sqrt(px * px + py * py);
    return vec3.create(px, py, (d < 1 / Math.SQRT2) ? Math.sqrt(1 - d * d) : 1 / (2 * d));
  }

  canvas.addEventListener("mousedown", function (event) : void {
    event.preventDefault();
    switch(cameraSelect.value) {
      case "orbit": {
        u = mapEventCoordsToSphere(event);
        mousePressedTime = Date.now();
        break;
      }
      case "dolly": {
        y = event.clientY;
        break;
      }
      case "panning": {
        x = event.clientX;
        y = event.clientY;
        break;
      }
      default: {
        break;
      }
    }
    mouseDown = true;
  });

  canvas.addEventListener("mousemove", function (event) : void {
    event.preventDefault();
    if (!mouseDown) return;

    switch(cameraSelect.value) {
      case "orbit": {
        const v : Float32Array = mapEventCoordsToSphere(event);
        quat.rotationTo(v, u, quatInc);
        quat.multiply(quatRot, quatInc, quatRot);
        u = v;
        break;
      }
      case "dolly": {
        const yDelta : number = event.clientY - y;
        y = event.clientY;
        zEye += yDelta * dollyDelta;
        break;
      }
      case "panning": {
        const xDelta : number = event.clientX - x;
        const yDelta : number = (event.clientY - y) * -1;
        xPan += xDelta * panningDelta;
        yPan += yDelta * panningDelta;
        y = event.clientY;
        x = event.clientX;
        break;
      }
      default: {
        break;
      }
    }
    if (!spinning) {
      requestAnimationFrame(render);
    }
  });

  canvas.addEventListener("mouseup", function (event) : void {
    event.preventDefault();
    switch(cameraSelect.value) {
      case "orbit": {
        const dt = Date.now() - mousePressedTime;
        if (dt < 200) {
          spinning = true;
        }
        break;
      }
      default: {
        break;
      }
    }
    mouseDown = false;
  });

  // Create a render pass in a command buffer and submit it
  function render () : void {
    const c : Float32Array = vec3.subtract(target, vec3.add(vec3.scale(vec3.transformQuat(vec3.create(1.0, 0.0, 0.0), quatRot), xPan), vec3.scale(vec3.transformQuat(vec3.create(0.0, 1.0, 0.0), quatRot), yPan)))
    const eye : Float32Array = vec3.add(vec3.transformQuat(vec3.create(0, 0, zEye), quatRot), c);
    mat4.lookAt(eye,c, vec3.transformQuat(up, quatRot), view);
    mat4.multiply(projection,view,mvp);
    mat4.multiply(mvp,model,mvp);

    device.queue.writeBuffer(positionBuffer, 0, new Float32Array(quadPositions));
    device.queue.writeBuffer(indicesBuffer, 0, new Uint32Array(quadIndices));

    device.queue.writeBuffer(positionBuffer, 4 * 3 * 4, new Float32Array(positions.map(p => [...p]).flat()));
    device.queue.writeBuffer(indicesBuffer, 4 * 6, new Uint32Array(indices));

    const textureQuad : Float32Array = new Float32Array(16);
    const inverseProjection : Float32Array = new Float32Array(16);
    const inverseView : Float32Array = new Float32Array(16);
    mat4.inverse(projection, inverseProjection);
    mat4.inverse(view, inverseView);
    view[3] = 0;
    view[3 + 4] = 0;
    view[3 + 8] = 0;
    view[3 + 12] = 0;
    mat4.multiply(inverseView, inverseProjection,textureQuad);

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: {r: 0.0, g: 0.0, b: 0.0, a: 1.0},
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadOp: 'clear',
        depthClearValue: 1.0,
        depthStoreOp: 'store',
      },
    }

    const encoder : GPUCommandEncoder = device.createCommandEncoder();
    const pass : GPURenderPassEncoder = encoder.beginRenderPass(descriptor);

    pass.setPipeline(pipeline);
    pass.setIndexBuffer(indicesBuffer, 'uint32');
    pass.setVertexBuffer(0, positionBuffer);

    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(mvp));
    device.queue.writeBuffer(uniformBuffer, mvp.byteLength, new Float32Array(mat4.identity()));
    device.queue.writeBuffer(uniformBuffer, mvp.byteLength * 2, new Float32Array([0.0, 0.0, zEye]));
    device.queue.writeBuffer(uniformBuffer, mvp.byteLength * 2 + 3 * 4, new Uint32Array([1]));
    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length, 1, 6, 4);

    device.queue.writeBuffer(uniformBufferQuad, 0, new Float32Array(mat4.identity()));
    device.queue.writeBuffer(uniformBufferQuad, 64, new Float32Array(textureQuad));
    device.queue.writeBuffer(uniformBufferQuad, 64 * 2, new Float32Array([0.0, 0.0, zEye]));
    device.queue.writeBuffer(uniformBufferQuad, 64 * 2 + 3 * 4, new Uint32Array([0]));
    pass.setBindGroup(0, bindGroupQuad);
    pass.drawIndexed(quadIndices.length, 1);

    pass.end();
    device.queue.submit([encoder.finish()]);

    if (spinning) {
      quat.multiply(quatRot, quatInc, quatRot);
      requestAnimationFrame(render);
    }
  }
  requestAnimationFrame(render);
}
