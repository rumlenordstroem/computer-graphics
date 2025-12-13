"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { mat4, vec3 } from 'wgpu-matrix';
import { readOBJFile } from "../../common/OBJParser";

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

  const rotationSpeedSlider : HTMLInputElement = <HTMLInputElement> document.getElementById('rotationSpeed');
  var rotationSpeed : number = parseFloat(rotationSpeedSlider.value);
  rotationSpeedSlider.oninput = function () {
    rotationSpeed = parseFloat(rotationSpeedSlider.value);
  }

  const obj = await readOBJFile('suzanne.obj', 1.0, false);

  const positions : Float32Array = obj.vertices;
  const indices : Uint32Array = obj.indices;

  const positionBuffer : GPUBuffer = device.createBuffer({
    label: "Positions",
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(positionBuffer, 0, new Float32Array(positions));

  const positionBufferLayout : GPUVertexBufferLayout = {
    arrayStride: 4 * 4,
    attributes: [{
      format: "float32x4",
      offset: 0,
      shaderLocation: 0,
    }],
  };

  const indicesBuffer : GPUBuffer = device.createBuffer({
    label: "Indices",
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(indicesBuffer, 0, new Uint32Array(indices));

  // matrix
  const uniformBufferSize = (16 * 4);
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const degToRad  = (d : number) : number => d * Math.PI / 180;

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

  const aspect = canvas.clientWidth / canvas.clientHeight;

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

  const depthTexture = device.createTexture({
    size: { width: canvas.width, height: canvas.height, },
    format: 'depth24plus',
    sampleCount: 1,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const bindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer }},
    ],
  });

  // Create a render pass in a command buffer and submit it
  var orbit : number = 0.0;
  mat4.perspective(degToRad(45),aspect,0.1,10,projections[0]);
  mat4.identity(models[0])
  mat4.translate(models[0], [0.0, 0.0, 0.0], models[0]);

  function render (){
    const radius = 4;
    const eye : number[] = [Math.sin(orbit) * radius, 0.0, Math.cos(orbit) * radius];
    mat4.lookAt(eye,[0.0, 0.0, 0.0],[0.0, 1.0, 0.0], views[0]);
    mat4.multiply(projections[0],views[0],mvp[0]);
    mat4.multiply(mvp[0],models[0],mvp[0]);

    for (let i = 0; i < mvp.length; i++) {
      device.queue.writeBuffer(uniformBuffer, i * 16 * 4, new Float32Array(mvp[i]));
    }

    orbit += rotationSpeed;

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: {r: 0.5, g: 0.5, b: 0.8, a: 1.0},
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
