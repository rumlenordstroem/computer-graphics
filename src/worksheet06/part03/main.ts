"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { mat4, vec3 } from 'wgpu-matrix';
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

  const M_SQRT2 = Math.sqrt(2.0);
  const M_SQRT6 = Math.sqrt(6.0);

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

  const maxSubdivisions = 6;
  var subdivisions = 0;
  const startSubdivisions = 6;
  let calculatedSubdivisions = subdivisions;

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

  const response = await fetch('../../textures/earth.jpg');
  const blob = await response.blob();
  const img : ImageBitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

  const positionBuffer : GPUBuffer = device.createBuffer({
    label: "Positions",
    size: positions[0].byteLength * 4 ** (maxSubdivisions + 1), // TODO check
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
    size: 4 * 4 * 4 ** (maxSubdivisions + 1), // TODO check,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  // matrix
  const uniformBufferSize : number = 16 * 4;
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const projections : Float32Array[] = [
    new Float32Array(16),
  ];

  const views : Float32Array[] = [
    new Float32Array(16),
  ];

  const models : Float32Array[] = [
    new Float32Array(16),
  ];

  const mvp : Float32Array[] = [
    new Float32Array(16),
  ];

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

  // Create a render pass in a command buffer and submit it
  var orbit : number = 0.0;
  mat4.perspective(degToRad(45),aspect,0.1,10,projections[0]);
  mat4.identity(models[0])
  mat4.translate(models[0], [0.0, 0.0, 0.0], models[0]);

  const texture : GPUTexture = device.createTexture({
    size: [img.width, img.height, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: img },
    { texture: texture },
    { width: img.width, height: img.height }
  );

  const sampler : GPUSampler = device.createSampler({
    addressModeU: "repeat",
    addressModeV: "repeat",
    minFilter: "linear",
    magFilter: "nearest",
    mipmapFilter: "nearest"
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

  function render (){
    mat4.lookAt([Math.sin(orbit) * 3.0, 0.0, Math.cos(orbit) * 3.0],[0.0, 0.0, 0.0],[0.0, 1.0, 0.0], views[0]);
    mat4.multiply(projections[0],views[0],mvp[0]);
    mat4.multiply(mvp[0],models[0],mvp[0]);

    for (let i = 0; i < mvp.length; i++) {
      device.queue.writeBuffer(uniformBuffer, i * 16 * 4, new Float32Array(mvp[i]));
    }

    orbit += 0.01;

    device.queue.writeBuffer(positionBuffer, 0, new Float32Array(positions.map(p => [...p]).flat()));
    device.queue.writeBuffer(indicesBuffer, 0, new Uint32Array(indices));

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

    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length, mvp.length);
    pass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
