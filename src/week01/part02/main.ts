"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { vec2, flatten, sizeof } from "../../common/mv";

function add_point(array, point, size)
{
 const offset = size/2;
 var point_coords = [ vec2(point[0] - offset, point[1] - offset), vec2(point[0] + offset, point[1] - offset),
 vec2(point[0] - offset, point[1] + offset), vec2(point[0] - offset, point[1] + offset),
 vec2(point[0] + offset, point[1] - offset), vec2(point[0] + offset, point[1] + offset) ];
 array.push.apply(array, point_coords);
}

const main= async() =>
{
  const adapter : GPUAdapter = <GPUAdapter> await navigator.gpu.requestAdapter();
  const device : GPUDevice = await adapter.requestDevice();
  const canvas : HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('gpu-canvas');
  const context : GPUCanvasContext = <GPUCanvasContext> canvas.getContext('webgpu');
  const format : GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: format,
  });

  const point_size : number = 10*(2/canvas.height);
  var positions = [];
  add_point(positions, vec2(0.0, 0.0), point_size);
  add_point(positions, vec2(1.0, 0.0), point_size);
  add_point(positions, vec2(1.0, 1.0), point_size);

  const positionBuffer = device.createBuffer({
    size: flatten(positions).byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(positionBuffer, /*bufferOffset=*/0, flatten(positions));

  const positionBufferLayout = {
    arrayStride: sizeof['vec2'],
    attributes: [{
      format: 'float32x2',
      offset: 0,
      shaderLocation: 0, // Position, see vertex shader
    }],
  };

  const wgsl = device.createShaderModule({
    code: shader
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: wgsl,
      entryPoint: 'main_vs',
      buffers: [positionBufferLayout],
    },
    fragment: {
      module: wgsl,
      entryPoint: 'main_fs',
      targets: [{
        format: format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  })

  const encoder : GPUCommandEncoder = device.createCommandEncoder();
  const pass : GPURenderPassEncoder = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: {
        r: 0.3921,
        g: 0.5843,
        b: 0.9294,
        a: 1.0
      },
      loadOp: "clear",
      storeOp: "store"
    }]
  });

  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, positionBuffer);
  pass.draw(positions.length);

  pass.end();
  device.queue.submit([encoder.finish()]);
}
