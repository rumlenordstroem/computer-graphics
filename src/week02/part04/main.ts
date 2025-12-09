"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { colorRectangle, drawRectangle, drawCircle, colorCircle } from "../../common/utils";

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
  const colorSelect : HTMLInputElement = <HTMLInputElement> document.getElementById("color-select");
  const clearSelect: HTMLInputElement = <HTMLInputElement> document.getElementById("clear-select");
  const drawMode: HTMLInputElement = <HTMLInputElement> document.getElementById("draw-mode");
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

  let triangleBufferIndex : number = 0;
  let triangleBuffer : number[] = Array(6);

  let circleOriginBuffer : number[] = [];

  <HTMLInputElement> document.getElementById("clear-button").onclick = function () {
    bufferIndex = 0;
    triangleBufferIndex = 0;
    circleOriginBuffer = [];
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
    arrayStride: 16,
    attributes: [{
      format: "float32x4",
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
    const rgb : number [] = colorLookup[parseInt(colorSelect.value)];
    switch(drawMode.value) { 
      // Point
      case '0': { 
        const point : number[] = drawRectangle(x, y, x + 0.020, y + 0.020);
        const colors : number[] = colorRectangle(rgb[0],rgb[1],rgb[2],rgb[3]);
        device.queue.writeBuffer(vertexBuffer, bufferIndex * 8, new Float32Array(point));
        device.queue.writeBuffer(colorsBuffer, bufferIndex * 16, new Float32Array(colors));
        bufferIndex += 6;
        requestAnimationFrame(render);
        break; 
      }

      // Triangle
      case '1': { 
        triangleBuffer[triangleBufferIndex] = x;
        triangleBuffer[triangleBufferIndex + 1] = y;
        if (triangleBufferIndex == 4) {
          const colors : number[] = Array(3).fill(rgb).flat();
          device.queue.writeBuffer(vertexBuffer, bufferIndex * 8, new Float32Array(triangleBuffer));
          device.queue.writeBuffer(colorsBuffer, bufferIndex * 16, new Float32Array(colors));
          bufferIndex += 3;
          triangleBufferIndex = 0;
          requestAnimationFrame(render);
        } else {
          triangleBufferIndex += 2;
        }
        break; 
      }

      // Circle
      case '2': {
        if (circleOriginBuffer.length == 2) {
          const n = 20;
          const radius : number = Math.sqrt(((circleOriginBuffer[0] - x)*(circleOriginBuffer[0] - x)) + ((circleOriginBuffer[1] - y)*(circleOriginBuffer[1] - y)));
          const circle: number[] = drawCircle(radius, circleOriginBuffer[0], circleOriginBuffer[1], n);
          const colors : number[] = colorCircle(rgb[0],rgb[1],rgb[2],rgb[3], n);
          device.queue.writeBuffer(vertexBuffer, bufferIndex * 8, new Float32Array(circle));
          device.queue.writeBuffer(colorsBuffer, bufferIndex * 16, new Float32Array(colors));
          bufferIndex += 3 * (n + 1);
          circleOriginBuffer = [];
          requestAnimationFrame(render);
        } else {
          circleOriginBuffer.push(x);
          circleOriginBuffer.push(y);
        }
        break; 
        
      }

      default: { 
        break; 
      } 
    }
  });

  function clear () {
    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: colorLookup[parseInt(clearSelect.value)],
      }],
    }
    const encoder : GPUCommandEncoder = device.createCommandEncoder();
    const pass : GPURenderPassEncoder = encoder.beginRenderPass(descriptor);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Create a render pass in a command buffer and submit it
  function render (){

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: colorLookup[parseInt(clearSelect.value)],
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
