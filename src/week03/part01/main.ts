"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { mat4 } from "../../common/matrix";

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

  var positions : number[][] = [
    [0.0, 0.0, 1.0],
    [0.0, 1.0, 1.0],
    [1.0, 1.0, 1.0],
    [1.0, 0.0, 1.0],
    [0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [1.0, 1.0, 0.0],
    [1.0, 0.0, 0.0],
  ];

  var wire_indices : Uint32Array = new Uint32Array([
    0, 1, 1, 2, 2, 3, 3, 0, // front
    2, 3, 3, 7, 7, 6, 6, 2, // right
    0, 3, 3, 7, 7, 4, 4, 0, // down
    1, 2, 2, 6, 6, 5, 5, 1, // up
    4, 5, 5, 6, 6, 7, 7, 4, // back
    0, 1, 1, 5, 5, 4, 4, 0 // left
  ]);

  var colors : Float32Array = new Float32Array(positions.length * 4).fill(1.0);

  const positionBuffer : GPUBuffer = device.createBuffer({
    label: "Positions",
    size: positions.length * positions[0].length * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(positionBuffer, 0, new Float32Array(positions.flat()));

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
    size: wire_indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(indicesBuffer, 0, new Uint32Array(wire_indices));

  const colorsBuffer : GPUBuffer = device.createBuffer({
    label: "Cell colors",
    size: positions.length * 16,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(colorsBuffer, 0, new Float32Array(colors));

  const colorsBufferLayout : GPUVertexBufferLayout = {
    arrayStride: 16,
    attributes: [{
      format: "float32x4",
      offset: 0,
      shaderLocation: 1,
    }],
  };

  // matrix
  const uniformBufferSize = 16 * 4;
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // const uniformValues = new Float32Array(uniformBufferSize / 4);
  const uniformValues = new Float32Array(16);
  const view = new Float32Array(16);

  mat4.projection(2,2,2,uniformValues);
  mat4.translate(uniformValues,[1.0, 1.0, 0.0], uniformValues);
  mat4.lookAt([0.0, 0.0 , 0.0],[1.0, 1.0, 1.0],[0.0, 1.0, 0.0], view);
  mat4.multiply(uniformValues,view,uniformValues);

  const wgsl : GPUShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: shader
  });

  const vertex : GPUVertexState = {
    module: wgsl,
    entryPoint: 'main_vs',
    buffers: [positionBufferLayout, colorsBufferLayout],
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
      topology: 'line-list',
    },
  })

  const bindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer }},
    ],
  });

  // Create a render pass in a command buffer and submit it
  function render (){
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(uniformValues));

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: {r: 0.5, g: 0.5, b: 0.5, a: 1.0},
      }],
    }
    const encoder : GPUCommandEncoder = device.createCommandEncoder();
    const pass : GPURenderPassEncoder = encoder.beginRenderPass(descriptor);

    pass.setPipeline(pipeline);
    pass.setIndexBuffer(indicesBuffer, 'uint32');
    pass.setVertexBuffer(0, positionBuffer);
    pass.setVertexBuffer(1, colorsBuffer);

    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(wire_indices.length);
    pass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
