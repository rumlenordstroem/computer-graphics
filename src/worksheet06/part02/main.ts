"use strict";
window.onload = function() { main(); }

import shader from "./shader.wgsl?raw";
import { mat4 } from 'wgpu-matrix';
import { degToRad } from "../../common/utils";
import { generateMipmap, numMipLevels } from "../../common/genmipmap";

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

  const textureWrappingModeMenu : HTMLInputElement = <HTMLInputElement> document.getElementById('texture-wrapping-mode');
  const minFilteringModeMenu : HTMLInputElement = <HTMLInputElement> document.getElementById('min-filtering-mode');
  const magFilteringModeMenu : HTMLInputElement = <HTMLInputElement> document.getElementById('mag-filtering-mode');
  const mipmapFilteringModeMenu : HTMLInputElement = <HTMLInputElement> document.getElementById('mipmap-filtering-mode');
  const mipmappingCheckbox : HTMLInputElement = <HTMLInputElement> document.getElementById('mipmapping-enabled');

  var textureWrappingMode : string =  textureWrappingModeMenu.value;
  var minFilteringMode : string =  minFilteringModeMenu.value;
  var magFilteringMode : string =  magFilteringModeMenu.value;
  var mipmapFilteringMode : string =  mipmapFilteringModeMenu.value;
  var mipmapping : boolean = mipmappingCheckbox.checked;

  textureWrappingModeMenu.oninput = function () {
    textureWrappingMode = textureWrappingModeMenu.value;
    requestAnimationFrame(render);
  }
  minFilteringModeMenu.oninput = function () {
    minFilteringMode = minFilteringModeMenu.value;
    requestAnimationFrame(render);
  }
  magFilteringModeMenu.oninput = function () {
    magFilteringMode = magFilteringModeMenu.value;
    requestAnimationFrame(render);
  }
  mipmapFilteringModeMenu.oninput = function () {
    mipmapFilteringMode = mipmapFilteringModeMenu.value;
    requestAnimationFrame(render);
  }
  mipmappingCheckbox.oninput = function () {
    mipmapping = mipmappingCheckbox.checked;
    requestAnimationFrame(render);
  }

  const positions : Float32Array = new Float32Array([
    -4.0, -1.0, -1.0,
    4.0, -1.0, -1.0,
    4.0, -1.0, -21.0,
    -4.0, -1.0, -21.0,
  ]);

  const indices : Uint32Array = new Uint32Array([
    0, 1, 2,
    0, 2, 3,
  ])

  const textureCoordinates : Float32Array = new Float32Array([
    -1.5, 0.0,
    2.5, 0.0,
    2.5, 10.0,
    -1.5, 10.0,
  ]);

  const texSize = 64;
  const numRows = 8;
  const numCols = 8;
  const texels : Uint8Array = new Uint8Array(4 * texSize * texSize);
  for (var i = 0; i < texSize; i++) {
    for (var j = 0; j < texSize; j++) {
      const patchx = Math.floor(i/(texSize/numRows));
      const patchy = Math.floor(j/(texSize/numCols));
      const c = (patchx % 2 !== patchy % 2 ? 255 : 0);
      const idx = 4 * (i * texSize + j);
      texels[idx] = texels[idx + 1] = texels[idx + 2] = c;
      texels[idx + 3] = 255;
    }
  }

  const positionBuffer : GPUBuffer = device.createBuffer({
    label: "Positions",
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(positionBuffer, 0, new Float32Array(positions));

  const positionBufferLayout : GPUVertexBufferLayout = {
    arrayStride: 3 * 4,
    attributes: [{
      format: "float32x3",
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

  const textureCoordinatesBuffer : GPUBuffer = device.createBuffer({
    label: "Texture coordinates",
    size: textureCoordinates.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(textureCoordinatesBuffer, 0, new Float32Array(textureCoordinates));

  const textureCoordinatesBufferLayout : GPUVertexBufferLayout = {
    arrayStride: 2 * 4,
    attributes: [{
      format: "float32x2",
      offset: 0,
      shaderLocation: 1,
    }],
  };

  // matrix
  const uniformBufferSize : number = (16 * 4);
  const uniformBuffer : GPUBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

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

  const aspect : number = canvas.clientWidth / canvas.clientHeight;

  const wgsl : GPUShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: shader
  });

  const vertex : GPUVertexState = {
    module: wgsl,
    entryPoint: 'main_vs',
    buffers: [positionBufferLayout, textureCoordinatesBufferLayout],
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

  const eye    = [0.0, 0.0, 0.0];
  const target = [0.0, 0.0, -1.0];
  const up     = [0.0, 1.0, 0.0];

  mat4.perspective(degToRad(90),aspect,0.1,100,projections[0]);
  mat4.identity(models[0])
  mat4.translate(models[0], [0.0, 0.0, 0.0], models[0]);
  // mat4.identity(views[0]);
  mat4.lookAt(eye, target, up, views[0]);
  mat4.multiply(projections[0],views[0],mvp[0]);
  mat4.multiply(mvp[0],models[0],mvp[0]);

  for (let i = 0; i < mvp.length; i++) {
    device.queue.writeBuffer(uniformBuffer, i * 16 * 4, new Float32Array(mvp[i]));
  }

  // Create a render pass in a command buffer and submit it
  function render (){
    var texture : GPUTexture = device.createTexture({
      format: 'rgba8unorm',
      size: [texSize, texSize, 1],
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount: mipmapping ? numMipLevels(texSize, texSize) : 1,
    })

    device.queue.writeTexture(
      { texture },
      new Uint8Array(texels),
       {
         offset: 0,
         bytesPerRow: texSize * 4,
         rowsPerImage: texSize, 
       },
       [texSize, texSize, 1]
    );

    if (mipmapping) {
      generateMipmap(device, texture);
    }

    const sampler : GPUSampler = device.createSampler({
      addressModeU: <GPUAddressMode> textureWrappingMode,
      addressModeV: <GPUAddressMode> textureWrappingMode,
      minFilter: <GPUFilterMode> minFilteringMode,
      magFilter: <GPUFilterMode> magFilteringMode,
      mipmapFilter: <GPUFilterMode> mipmapFilteringMode,
    });

    const bindGroup : GPUBindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer }},
        { binding: 1, resource: sampler },
        { binding: 2, resource: texture.createView() },
      ],
    });

    const descriptor : GPURenderPassDescriptor = {
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: {r: 0.5, g: 0.5, b: 1.0, a: 1.0},
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
    pass.setVertexBuffer(1, textureCoordinatesBuffer);

    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length, mvp.length);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  requestAnimationFrame(render);
}
