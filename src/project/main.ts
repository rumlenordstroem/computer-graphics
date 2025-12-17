"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";

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

  const vertexData = new Float32Array([
    -1.0, -1.0,
    -1.0, 3.0,
    3.0, -1.0,
  ]);
 
  const vertexBuffer : GPUBuffer = device.createBuffer({
    label: 'vertex buffer vertices',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const vertexBufferLayout : GPUVertexBufferLayout = {
    arrayStride: vertexData.BYTES_PER_ELEMENT * 2,
    attributes: [{
      format: "float32x2",
      offset: 0,
      shaderLocation: 0,
    }],
  };

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const uniformBufferSize : number = (16 * 4);
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'uniforms',
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
    buffers: [vertexBufferLayout],
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

  const bindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer }},
    ],
  });

  let dragging : boolean = false;
  let lastX : number = 0;
  let lastY : number = 0;
  let centerX : number = 0.0;
  let centerY : number = 0.0;
  let zoom : number = 4.0;

  canvas.addEventListener("mousedown", e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("mouseup", () => dragging = false);
  canvas.addEventListener("mouseleave", () => dragging = false);

  canvas.addEventListener("mousemove", e => {
    if (!dragging) return;

    const dx : number = e.clientX - lastX;
    const dy : number = e.clientY - lastY;

    centerX -= dx / canvas.width * zoom;
    centerY -= dy / canvas.height * zoom;

    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("wheel", e => {
    e.preventDefault();

    const zoomFactor : number = e.deltaY < 0 ? 0.9 : 1.1;

    const rect : DOMRect = canvas.getBoundingClientRect();
    const mouseX : number = e.clientX - rect.left;
    const mouseY : number = e.clientY - rect.top;

    const cxBefore : number = (mouseX / canvas.width - 0.5) * zoom + centerX;
    const cyBefore : number = (mouseY / canvas.height - 0.5) * zoom + centerY;

    zoom *= zoomFactor;

    const cxAfter : number = (mouseX / canvas.width - 0.5) * zoom + centerX;
    const cyAfter : number = (mouseY / canvas.height - 0.5) * zoom + centerY;

    centerX += cxBefore - cxAfter;
    centerY += cyBefore - cyAfter;
  });

  const iterationsSlider : HTMLInputElement = <HTMLInputElement> document.getElementById('iterations');
  let iterations : number;

  // Create a render pass in a command buffer and submit it
  function render (){
    iterations = parseInt(iterationsSlider.value);
    device.queue.writeBuffer(uniformBuffer, 0, new Uint32Array([canvas.width, canvas.height, iterations]));
    device.queue.writeBuffer(uniformBuffer, 12, new Float32Array([zoom, centerX, centerY]));

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: {r: 0.0, g: 0.0, b: 0.0, a: 1.0},
      }],
    }
    const encoder : GPUCommandEncoder = device.createCommandEncoder();
    const pass : GPURenderPassEncoder = encoder.beginRenderPass(descriptor);

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertexData.length / 2);
    pass.end();
    device.queue.submit([encoder.finish()]);
    let fps : number = 10;
    setTimeout(() => {
      requestAnimationFrame(render);
    }, 1000 / fps);
  }
  requestAnimationFrame(render);
}
