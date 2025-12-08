"use strict";
window.onload = function() { main(); }

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
  pass.end();
  device.queue.submit([encoder.finish()]);
}
