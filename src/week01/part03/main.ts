"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { vec2, flatten, sizeof } from "../../common/mv";

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

  const vertices = new Float32Array([
    //X,   Y,
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
  ]);

  const vertexBuffer = device.createBuffer({
    label: "Cell vertices",
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/0, vertices);

  const vertexBufferLayout = {
    arrayStride: 8,
    attributes: [{
      format: "float32x2",
      offset: 0,
      shaderLocation: 0, // Position, see vertex shader
    }],
  };

  const colors = new Float32Array([
    //R,   G,   B,
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0,
  ]);

  const colorsBuffer = device.createBuffer({
    label: "Cell colors",
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(colorsBuffer, /*bufferOffset=*/0, colors);

  const colorsBufferLayout = {
    arrayStride: 12,
    attributes: [{
      format: "float32x3",
      offset: 0,
      shaderLocation: 1, // Position, see vertex shader
    }],
  };

  const wgsl = device.createShaderModule({
    label: "Cell shader",
    code: shader
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: wgsl,
      entryPoint: 'main_vs',
      buffers: [vertexBufferLayout, colorsBufferLayout],
    },
    fragment: {
      module: wgsl,
      entryPoint: 'main_fs',
      buffers: [colorsBufferLayout],
      targets: [{
        format: format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  })

  // Create a render pass in a command buffer and submit it
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
    }],
  });

  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.setVertexBuffer(1, colorsBuffer);
  pass.draw(vertices.length / 2);
  pass.end();
  device.queue.submit([encoder.finish()]);
}
