struct Uniforms {
    matrix: array<mat4x4f, 1>,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var texture: texture_2d<f32>;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) textureCoordinates: vec2f,
};

@vertex
fn main_vs(@location(0) position: vec4f, @location(1) textureCoordinate: vec2f, @builtin(instance_index) instance: u32) -> VSOut
{
    var output: VSOut;

    output.position = uni.matrix[instance] * position;
    output.textureCoordinates = textureCoordinate;

    return output;
}

@fragment
fn main_fs(@location(0) textureCoordinates: vec2f) -> @location(0) vec4f
{
    return textureSample(texture, samp, textureCoordinates);
}
