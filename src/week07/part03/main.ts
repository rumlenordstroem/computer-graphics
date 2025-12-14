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
  const startSubdivisions = 6;
  let calculatedSubdivisions = subdivisions;

  function coarsen() : void {
    if (subdivisions > 0) {
      subdivisions--;
      indices = coarsenIndices(indices);
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
    }
  };

  for (let i : number = 0; i < startSubdivisions; i++) {
    subdivide();
  }

  (document.getElementById("coarsen") as HTMLInputElement).onclick = coarsen;
  (document.getElementById("subdivide") as HTMLInputElement).onclick = subdivide;

  const cubemap : string[] = [
    '../cm_left.png',
    '../cm_right.png',
    '../cm_top.png',
    '../cm_bottom.png',
    '../cm_back.png',
    '../cm_front.png',
  ]

  var imgs : ImageBitmap[] = new Array(cubemap.length);
  for (let i : number = 0; i < cubemap.length; i++) {
    const response = await fetch(cubemap[i]);
    const blob = await response.blob();
    imgs[i] = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  }

  const quadPositions : Float32Array = new Float32Array([
    -1.0, -1.0, 0.999,
    -1.0, 1.0, 0.999,
    1.0, -1.0, 0.999,
    1.0, 1.0, 0.999,
  ]);

  const quadIndices : Uint32Array = new Uint32Array([
    0, 2, 1,
    2, 3, 1,
  ]);

  const positionBuffer : GPUBuffer = device.createBuffer({
    label: "Positions",
    size: positions[0].byteLength * 4 ** (maxSubdivisions + 1) + 4 * 3 * 4,
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
    size: 4 * 4 * 4 ** (maxSubdivisions + 1) + 4 * 6,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  const uniformBufferSize : number = 16 * 4 * 2 + 4 * 4;
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBufferQuadSize : number = 16 * 4 * 2 + 4 * 4;
  const uniformBufferQuad : GPUBuffer = device.createBuffer({
    label: 'uniforms quad',
    size: uniformBufferQuadSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const degToRad  = (d : number) : number => d * Math.PI / 180;

  const projection : Float32Array = new Float32Array(16);
  const view : Float32Array = new Float32Array(16);
  const model : Float32Array = new Float32Array(16);
  const mvp : Float32Array = new Float32Array(16);

  const aspect : number = canvas.clientWidth / canvas.clientHeight;

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

  const depthTexture : GPUTexture = device.createTexture({
    size: { width: canvas.width, height: canvas.height, },
    format: 'depth24plus',
    sampleCount: 1,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  var orbit : number = 0.0;
  mat4.perspective(degToRad(90),aspect,0.1,100,projection);
  mat4.identity(model)
  mat4.translate(model, [0.0, 0.0, 0.0], model);

  const texture : GPUTexture = device.createTexture({
    size: [imgs[0].width, imgs[0].height, imgs.length],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  for (let i : number = 0; i < imgs.length; i++) {
    device.queue.copyExternalImageToTexture(
      { source: imgs[i], flipY: true },
      { texture: texture, origin: [0, 0, i] },
      { width: imgs[i].width, height: imgs[i].height }
    );
  }

  const sampler : GPUSampler = device.createSampler({
    addressModeU: "repeat",
    addressModeV: "repeat",
    minFilter: "linear",
    magFilter: "linear",
    mipmapFilter: "linear"
  });

  const bindGroup : GPUBindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer }},
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView({ dimension: 'cube' }) },
    ],
  });

  const bindGroupQuad : GPUBindGroup = device.createBindGroup({
    label: 'bind group for quad',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBufferQuad }},
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView({ dimension: 'cube' }) },
    ],
  });

  // Create a render pass in a command buffer and submit it
  function render (){
    const eye : number[] = [Math.sin(orbit) * 2.0, 0.0, Math.cos(orbit) * 2.0];

    mat4.lookAt(eye,[0.0, 0.0, 0.0],[0.0, 1.0, 0.0], view);
    mat4.multiply(projection,view,mvp);
    mat4.multiply(mvp,model,mvp);
    orbit += 0.01;

    device.queue.writeBuffer(positionBuffer, 0, new Float32Array(quadPositions));
    device.queue.writeBuffer(indicesBuffer, 0, new Uint32Array(quadIndices));

    device.queue.writeBuffer(positionBuffer, 4 * 3 * 4, new Float32Array(positions.map(p => [...p]).flat()));
    device.queue.writeBuffer(indicesBuffer, 4 * 6, new Uint32Array(indices));


    const textureQuad : Float32Array = new Float32Array(16);
    const inverseProjection : Float32Array = new Float32Array(16);
    const inverseView : Float32Array = new Float32Array(16);
    mat4.inverse(projection, inverseProjection);
    mat4.inverse(view, inverseView);
    view[3] = 0;
    view[3 + 4] = 0;
    view[3 + 8] = 0;
    view[3 + 12] = 0;
    mat4.multiply(inverseView, inverseProjection,textureQuad);

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: {r: 0.0, g: 0.0, b: 0.0, a: 1.0},
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

    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(mvp));
    device.queue.writeBuffer(uniformBuffer, mvp.byteLength, new Float32Array(mat4.identity()));
    device.queue.writeBuffer(uniformBuffer, mvp.byteLength * 2, new Float32Array(eye));
    device.queue.writeBuffer(uniformBuffer, mvp.byteLength * 2 + 3 * 4, new Uint32Array([1]));
    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length, 1, 6, 4);

    device.queue.writeBuffer(uniformBufferQuad, 0, new Float32Array(mat4.identity()));
    device.queue.writeBuffer(uniformBufferQuad, 64, new Float32Array(textureQuad));
    device.queue.writeBuffer(uniformBufferQuad, 64 * 2, new Float32Array(eye));
    device.queue.writeBuffer(uniformBufferQuad, 64 * 2 + 3 * 4, new Uint32Array([0]));
    pass.setBindGroup(0, bindGroupQuad);
    pass.drawIndexed(quadIndices.length, 1);

    pass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
