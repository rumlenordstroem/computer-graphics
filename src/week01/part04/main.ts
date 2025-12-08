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

  let vertices : Float32Array = new Float32Array([
    //X,   Y,
    -0.5, 0.5,
    0.5, 0.5,
    0.5, -0.5,

    //X,   Y,
    -0.5, 0.5,
    -0.5, -0.5,
    0.5, -0.5,
  ]);

  const vertexBuffer : GPUBuffer = device.createBuffer({
    label: "Cell vertices",
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const vertexBufferLayout = {
    arrayStride: 8,
    attributes: [{
      format: "float32x2",
      offset: 0,
      shaderLocation: 0, // Position, see vertex shader
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
      buffers: [vertexBufferLayout],
    },
    fragment: {
      module: wgsl,
      entryPoint: 'main_fs',
      targets: [{
        format: format}],
    },
    primitive: {
      topology: 'triangle-list',
    },
  })

  function rotateVertices(vertices, angleRadians) {
    const cos : number = Math.cos(angleRadians);
    const sin : number = Math.sin(angleRadians);

    // Create a new Float32Array to store rotated vertices
    const rotated = new Float32Array(vertices.length);

    for (let i : number = 0; i < vertices.length; i += 2) {
      const x : number = vertices[i];
      const y : number = vertices[i + 1];

      rotated[i] = x * cos - y * sin;
      rotated[i + 1] = x * sin + y * cos;
    }

    return rotated;
  }

  // Create a render pass in a command buffer and submit it
  function render (){
    const angle = Math.PI / 64;
    vertices = rotateVertices(vertices, angle);

    device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/0, vertices);

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
      }],
    }
    const encoder : GPUCommandEncoder = device.createCommandEncoder();
    const pass : GPURenderPassEncoder = encoder.beginRenderPass(descriptor);

    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertices.length / 2);
    pass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}
