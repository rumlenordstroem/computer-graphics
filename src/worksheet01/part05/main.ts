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

  const r = 0.5;
  const N = 50;

  let circle : Array<number> = [0.0, 0.0];
  let circleColors : Array<number> = [0.0, 0.0, 0.0];

  for (let i : number = 0; i <= N; i++) {
      const angle : number = (i / N) * 2 * Math.PI;
      circle.push(r * Math.cos(angle));
      circle.push(r * Math.sin(angle));
      circle.push(0.0);
      circle.push(0.0);
      circle.push(r * Math.cos(angle));
      circle.push(r * Math.sin(angle));
      circleColors.push(1.0);
      circleColors.push(1.0);
      circleColors.push(0.0);

      circleColors.push(1.0);
      circleColors.push(0.0);
      circleColors.push(1.0);

      circleColors.push(0.0);
      circleColors.push(1.0);
      circleColors.push(1.0);
  }

  // Pop last position
  circle.pop();
  circle.pop();
  circleColors.pop();
  circleColors.pop();
  circleColors.pop();

  let vertices : Float32Array = new Float32Array(circle);

  const vertexBuffer : GPUBuffer = device.createBuffer({
    label: "Cell vertices",
    size: vertices.byteLength,
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

  const colors = new Float32Array(circleColors);

  const colorsBuffer : GPUBuffer = device.createBuffer({
    label: "Cell colors",
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(colorsBuffer, 0, colors);

  const colorsBufferLayout : GPUVertexBufferLayout = {
    arrayStride: 12,
    attributes: [{
      format: "float32x3",
      offset: 0,
      shaderLocation: 1,
    }],
  };

  let bytelength : number = 32;
  let uniforms : ArrayBuffer = new ArrayBuffer(bytelength);
  const uniformBuffer : GPUBuffer = device.createBuffer({
    size: uniforms.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(uniformBuffer, 0, uniforms);

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

  const bindGroup : GPUBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{
      binding: 0,
      resource: { buffer: uniformBuffer }
    }]
  });

  let offset = 0.0;

  // Create a render pass in a command buffer and submit it
  function render (){
    offset = offset + 0.02;

    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([Math.cos(offset), 0.0, 0.0, 0.0]))
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

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

    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, colorsBuffer);
    pass.draw(vertices.length / 2);
    pass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}
