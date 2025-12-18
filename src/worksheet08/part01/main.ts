"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { mat4, vec3, vec2 } from 'wgpu-matrix';
import { degToRad } from "../../common/utils";

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

  const response = await fetch('../../textures/xamp23.png');
  const blob = await response.blob();
  const img : ImageBitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

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

  const uniformBufferSize : number = 64;
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'Uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

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

  const texture : GPUTexture = device.createTexture({
    size: [1, 1, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.writeTexture(
    { texture: texture },
    new Uint32Array([255, 0, 0, 155]),
    { offset: 0, bytesPerRow: 4, rowsPerImage: 1 },
    [1, 1, 1]
  )

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

  // Create persoective
  const projection : Float32Array = new Float32Array(16);
  const aspect : number = canvas.clientWidth / canvas.clientHeight;
  mat4.perspective(degToRad(90),aspect,0.1,100,projection);

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

  // Create a render pass in a command buffer and submit it
  function render (){
    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: {r: 1.0, g: 1.0, b: 1.0, a: 1.0},
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

    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length - 6, 1, 6);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  requestAnimationFrame(render);
}
