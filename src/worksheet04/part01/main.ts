"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { mat4, vec3 } from 'wgpu-matrix';

function subdivideSphere(positions : Float32Array[], indices : Uint32Array) : Uint32Array {
  const triangles : number = indices.length / 3;
  let newIndices : number[] = [];
  for (let i : number = 0; i < triangles; i++) {
    const i0 : number = indices[i * 3 + 0]
    const i1 : number = indices[i * 3 + 1]
    const i2 : number = indices[i * 3 + 2]
    const c01 : number = positions.length;
    const c12 : number = positions.length + 1;
    const c20 : number = positions.length + 2;
    positions.push(vec3.normalize(vec3.add(positions[i0], positions[i1])))
    positions.push(vec3.normalize(vec3.add(positions[i1], positions[i2])))
    positions.push(vec3.normalize(vec3.add(positions[i2], positions[i0])))
    newIndices.push(i0, c01, c20, c20, c01, c12, c12, c01, i1, c20, c12, i2);
  }
  return new Uint32Array(newIndices);
}

function subdivideIndices(indices : Uint32Array) : Uint32Array {
  const triangles : number = indices.length / 3;
  let newIndices : number[] = [];
  for (let i : number = 0; i < triangles; i++) {
    const c01 : number = triangles + i * 3 + 0;
    const c12 : number = triangles + i * 3 + 1;
    const c20 : number = triangles + i * 3 + 2;
    newIndices.push(indices[i * 3 + 0], c01, c20, c20, c01, c12, c12, c01, indices[i * 3 + 1], c20, c12, indices[i * 3 + 2]);
  }
  return new Uint32Array(newIndices);
}

function coarsenIndices(indices : Uint32Array) : Uint32Array {
  let newIndices : number[] = [];
  for (let i : number = 0; i < indices.length / 12; i++) {
    newIndices.push(indices[i * 12 + 0], indices[i * 12 + 8], indices[i * 12 + 11]);
  }
  return new Uint32Array(newIndices);
}

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

  const M_SQRT2 = Math.sqrt(2.0);
  const M_SQRT6 = Math.sqrt(6.0);

  var positions  : Float32Array[] = [
    vec3.create(0.0, 0.0, 1.0),
    vec3.create(0.0, 2.0 * M_SQRT2 / 3.0, -1.0 / 3.0),
    vec3.create(-M_SQRT6 / 3.0, -M_SQRT2 / 3.0, -1.0 / 3.0),
    vec3.create(M_SQRT6 / 3.0, -M_SQRT2 / 3.0, -1.0 / 3.0),
  ];

  let indices : Uint32Array = new Uint32Array([
    0, 1, 2, // front
    0, 3, 1, // right
    1, 3, 2, // left
    0, 2, 3, // bottom
  ]);

  const maxSubdivisions = 6;
  var subdivisions = 0;
  let calculatedSubdivisions = subdivisions;

  function coarsen() : void {
    if (subdivisions > 0) {
      subdivisions--;
      indices = coarsenIndices(indices);
      requestAnimationFrame(render);
    }
  };

  function subdivide() : void {
    if (subdivisions < maxSubdivisions) {
      subdivisions++;
      if (subdivisions > calculatedSubdivisions) {
        calculatedSubdivisions++;
        indices = subdivideSphere(positions, indices);
      } else {
        indices = subdivideIndices(indices);
      }
      requestAnimationFrame(render);
    }
  };

  (document.getElementById("coarsen") as HTMLInputElement).onclick = coarsen;
  (document.getElementById("subdivide") as HTMLInputElement).onclick = subdivide;

  const positionBuffer : GPUBuffer = device.createBuffer({
    label: "Positions",
    size: positions[0].byteLength * 4 ** (maxSubdivisions + 1), // TODO check
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

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
    size: 4 * 4 * 4 ** (maxSubdivisions + 1), // TODO check,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  // matrix
  const uniformBufferSize = 16 * 4;
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  const degToRad = d => d * Math.PI / 180;

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

  mat4.perspective(degToRad(45),aspect,0.1,10,projections[0]);
  mat4.lookAt([0.0, 0.0, 6.0],[0.0, 0.0, 0.0],[0.0, 1.0, 0.0], views[0]);
  mat4.identity(models[0])
  mat4.translate(models[0], [0.0, 0.0, 0.0], models[0]);
  // mat4.rotateX(models[0], degToRad(45), models[0]);
  mat4.multiply(projections[0],views[0],mvp[0]);
  mat4.multiply(mvp[0],models[0],mvp[0]);

  for (let i = 0; i < mvp.length; i++) {
    device.queue.writeBuffer(uniformBuffer, i * 16 * 4, new Float32Array(mvp[i]));
  }
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
    device.queue.writeBuffer(positionBuffer, 0, new Float32Array(positions.map(p => [...p]).flat()));
    device.queue.writeBuffer(indicesBuffer, 0, new Uint32Array(indices));
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

    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length, mvp.length);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  render();
}
