"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { mat4, vec3, vec2 } from 'wgpu-matrix';

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

  var positions  : Float32Array[] = [
    vec3.create(-2.0, -1.0, -1.0),
    vec3.create(2.0, -1.0, -1.0),
    vec3.create(2.0, -1.0, -5.0),
    vec3.create(-2.0, -1.0, -5.0),

    vec3.create(0.25, -0.5, -1.25),
    vec3.create(0.75, -0.5, -1.25),
    vec3.create(0.75, -0.5, -1.75),
    vec3.create(0.25, -0.5, -1.75),

    vec3.create(-1.0, -1.0, -2.5),
    vec3.create(-1.0, -1.0, -3.0),
    vec3.create(-1.0, 0.0, -3.0),
    vec3.create(-1.0, 0.0, -2.5),
  ];

  let indices : Uint32Array = new Uint32Array([
    0, 1, 2,
    0, 2, 3,

    4, 5, 6,
    4, 6, 7,

    8, 9, 10,
    8, 10, 11,
  ]);

  const positionBuffer : GPUBuffer = device.createBuffer({
    label: "Positions",
    size: positions[0].byteLength * positions.length,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const positionBufferLayout : GPUVertexBufferLayout = {
    arrayStride: positions[0].byteLength,
    attributes: [{
      format: "float32x3",
      offset: 0,
      shaderLocation: 0,
    }],
  };

  const indicesBuffer : GPUBuffer = device.createBuffer({
    label: "Indices",
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  const textureCoordinates : Float32Array[] = [
    vec2.create(0.0, 0.0),
    vec2.create(1.0, 0.0),
    vec2.create(1.0, 1.0),
    vec2.create(0.0, 1.0),

    vec2.create(0.0, 0.0),
    vec2.create(1.0, 0.0),
    vec2.create(1.0, 1.0),
    vec2.create(0.0, 1.0),

    vec2.create(0.0, 0.0),
    vec2.create(1.0, 0.0),
    vec2.create(1.0, 1.0),
    vec2.create(0.0, 1.0),
  ];

  const textureCoordinateBuffer : GPUBuffer = device.createBuffer({
    size: textureCoordinates[0].byteLength * textureCoordinates.length,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const textureCoordinateBufferLayout : GPUVertexBufferLayout = {
    arrayStride: textureCoordinates[0].byteLength,
    attributes: [{
      format: 'float32x2',
      offset: 0,
      shaderLocation: 1,
    }],
  };

  const uniformBufferSize : number = 64 + 4 * 4;
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'Uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBufferShadow : GPUBuffer = device.createBuffer({
    label: 'Uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const degToRad  = (d : number) : number => d * Math.PI / 180;

  const wgsl : GPUShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: shader
  });

  const vertex : GPUVertexState = {
    module: wgsl,
    entryPoint: 'main_vs',
    buffers: [positionBufferLayout, textureCoordinateBufferLayout],
  };

  const fragment : GPUFragmentState = {
    module: wgsl,
    entryPoint: 'main_fs',
    targets: [{
      format: format
    }],
  };

  const msaaCount = 4;

  const pipeline : GPURenderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: vertex,
    fragment: fragment,
    primitive: {
      topology: 'triangle-list',
      frontFace: 'ccw',
      cullMode: 'none',
    },
    multisample: { count: msaaCount },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  })

  const msaaTexture = device.createTexture({
      size: { width: canvas.width, height: canvas.height },
      format: format,
      sampleCount: msaaCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTexture : GPUTexture = device.createTexture({
    size: { width: canvas.width, height: canvas.height, },
    format: 'depth24plus',
    sampleCount: msaaCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const texture : GPUTexture = device.createTexture({
    size: [1, 1, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });

  device.queue.writeTexture(
    { texture: texture },
    new Uint32Array([255, 0, 0, 255]),
    { offset: 0, bytesPerRow: 4, rowsPerImage: 1 },
    [1, 1, 1]
  )

  const response = await fetch('../../textures/xamp23.png');
  const blob = await response.blob();
  const img : ImageBitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

  const textureGround : GPUTexture = device.createTexture({
    dimension: '2d',
    size: [img.width, img.height, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: img, flipY: true },
    { texture: textureGround },
    { width: img.width, height: img.height }
  );

  const sampler : GPUSampler = device.createSampler({
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    minFilter: 'nearest',
    magFilter: 'linear',
  });

  const bindGroup : GPUBindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer }},
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
    ],
  });

  const bindGroupGround : GPUBindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer }},
      { binding: 1, resource: sampler },
      { binding: 2, resource: textureGround.createView() },
    ],
  });

  const bindGroupShadow : GPUBindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBufferShadow }},
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
    ],
  });

  // Create persoective
  const projection : Float32Array = new Float32Array(16);
  const aspect : number = canvas.clientWidth / canvas.clientHeight;
  mat4.perspective(degToRad(90),aspect,1,20,projection);

  // Transform model
  const model : Float32Array = new Float32Array(16);
  mat4.identity(model)

  // Set camera
  const view : Float32Array = new Float32Array(16);
  mat4.identity(view);

  // Create mvp matrix
  const mvp : Float32Array = new Float32Array(16);
  mat4.multiply(projection,view,mvp);
  mat4.multiply(mvp,model,mvp);

  // Write to GPU buffers
  device.queue.writeBuffer(positionBuffer, 0, new Float32Array(positions.map(p => [...p]).flat()));
  device.queue.writeBuffer(indicesBuffer, 0, new Uint32Array(indices));
  device.queue.writeBuffer(textureCoordinateBuffer, 0, new Float32Array(textureCoordinates.map(t => [...t]).flat()));
  device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(mvp));
  device.queue.writeBuffer(uniformBuffer, mvp.byteLength, new Float32Array([1.0]));

  let angle = 0;
  // Create a render pass in a command buffer and submit it
  function render (){
    // Shadow uniform buffer
    const epsilon = 0.001;
    const r = 2.0;
    const l : Float32Array = vec3.create(r * Math.sin(angle), 2, -2 + r * Math.cos(angle));
    const n : Float32Array = vec3.create(0, 1, 0);
    const d : number = 1.0 - epsilon;

    const a : number = d + vec3.dot(n, l);
    const modelShadow = mat4.create(
      a - l[0] * n[0], -l[0] * n[1], -l[0] * n[2], -l[0] * d,
      -l[1] * n[0], a - l[1] * n[1], -l[1] * n[2], -l[1] * d,
      -l[2] * n[0], -l[2] * n[1], a - l[2] * n[2], -l[2] * d,
      -n[0], -n[1], -n[2], a - d
    );

    const mvpShadow = mat4.mul(projection, mat4.mul(view, modelShadow));

    device.queue.writeBuffer(uniformBufferShadow, 0, new Float32Array(mvpShadow));
    device.queue.writeBuffer(uniformBufferShadow, 64, new Float32Array([0.0, 0.0, 0.0, 0.0]));

    angle += 0.01;

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: msaaTexture.createView(),
        resolveTarget: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: {r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0},
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
    pass.setVertexBuffer(1, textureCoordinateBuffer);

    pass.setBindGroup(0, bindGroupGround);
    pass.drawIndexed(6);

    pass.setBindGroup(0, bindGroupShadow);
    pass.drawIndexed(indices.length - 6, 1, 6);

    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length - 6, 1, 6);

    pass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
