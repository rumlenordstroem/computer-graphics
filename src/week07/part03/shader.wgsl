struct Uniforms {
    mvp: mat4x4f,
    texture: mat4x4f,
    eye: vec3f,
    reflective: u32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var texture: texture_cube<f32>;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) textureCoordinates: vec4f,
};

@vertex
fn main_vs(@location(0) position: vec4f) -> VSOut
{
    var output: VSOut;

    output.position = uni.mvp * position;
    output.textureCoordinates = uni.texture * position;

    return output;
}

@fragment
fn main_fs(@location(0) textureCoordinates : vec4f) -> @location(0) vec4f
{
    let normal = normalize(textureCoordinates.xyz);
    return textureSample(texture, samp, select(normal, reflect(normalize(textureCoordinates.xyz - uni.eye), normal), uni.reflective == 1));
} 
