"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { colorRectangle, drawRectangle } from "../../common/utils";

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

  const bufferEntries : number = 2048;
  const bytesPerVerticeEntry : number = 8;
  const bytesPerColorEntry : number = 12;
  var bufferIndex : number = 0;
  let vertices: number[] = [];
  let colors: number[] = [];
  const colorSelect : HTMLInputElement = <HTMLInputElement> document.getElementById("color-select");
  const clearSelect: HTMLInputElement = <HTMLInputElement> document.getElementById("clear-select");
  const colorLookup : number[][] = [
    [1.0, 1.0, 1.0, 1.0], // White
    [0.0, 0.0, 0.0, 1.0], // Black
    [1.0, 0.0, 0.0, 1.0], // Red
    [0.0, 1.0, 0.0, 1.0], // Green
    [0.0, 0.0, 1.0, 1.0], // Blue
    [1.0, 1.0, 0.0, 1.0], // Yellow
    [1.0, 0.647, 0.0, 1.0], // Orange
    [0.3921, 0.5843, 0.9294, 1.0] // Cornflower
  ];

  <HTMLInputElement> document.getElementById("clear-button").onclick = function () {
    vertices = [];
    colors = [];
    bufferIndex = 0;
    requestAnimationFrame(clear);
  };

  const vertexBuffer : GPUBuffer = device.createBuffer({
    label: "Cell vertices",
    size: bytesPerVerticeEntry * bufferEntries,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const vertexBufferLayout : GPUVertexBufferLayout = {
    arrayStride: 8,
    attributes: [{
      format: "float32x2",
      offset: 0,
      shaderLocation: 0,
    }],
  };

  const colorsBuffer : GPUBuffer = device.createBuffer({
    label: "Cell colors",
    size: bytesPerColorEntry * bufferEntries,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const colorsBufferLayout : GPUVertexBufferLayout = {
    arrayStride: 12,
    attributes: [{
      format: "float32x3",
      offset: 0,
      shaderLocation: 1,
    }],
  };

  const wgsl : GPUShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: shader
  });

  const vertex : GPUVertexState = {
    module: wgsl,
    entryPoint: 'main_vs',
    buffers: [vertexBufferLayout, colorsBufferLayout],
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
    },
  })

  canvas.addEventListener("click", function (ev : PointerEvent) {
    var rect = ev.target.getBoundingClientRect();
    const x : number = 2 * (ev.clientX - rect.left) / canvas.width - 1;
    const y : number = 2 * (canvas.height - ev.clientY + rect.top - 1) / canvas.height - 1;
    vertices.push(...drawRectangle(x, y, x + 0.020, y + 0.020));
    colors.push(...colorRectangle(colorLookup[colorSelect.value][0], colorLookup[colorSelect.value][1], colorLookup[colorSelect.value][2]))
    requestAnimationFrame(render);
    bufferIndex = bufferIndex + 6;
  });

  function clear () {
    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: colorLookup[clearSelect.value],
      }],
    }
    const encoder : GPUCommandEncoder = device.createCommandEncoder();
    const pass : GPURenderPassEncoder = encoder.beginRenderPass(descriptor);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Create a render pass in a command buffer and submit it
  function render (){

    if (vertices.length > 0) {
      device.queue.writeBuffer(vertexBuffer, 0, new Float32Array(vertices));
      device.queue.writeBuffer(colorsBuffer, 0, new Float32Array(colors));
    }

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: colorLookup[clearSelect.value],
      }],
    }
    const encoder : GPUCommandEncoder = device.createCommandEncoder();
    const pass : GPURenderPassEncoder = encoder.beginRenderPass(descriptor);

    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, colorsBuffer);
    pass.draw(bufferIndex);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  clear();
}
