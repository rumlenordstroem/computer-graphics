struct Uniforms {
    matrix: array<mat4x4f, 3>,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
};

@vertex
fn main_vs(@location(0) position: vec4f, @location(1) color: vec4f, @builtin(instance_index) instance: u32) -> VSOut
{
    var output: VSOut;
    output.position = uni.matrix[instance] * position;
    output.color = color;
    return output;
}

@fragment
fn main_fs(@location(0) color: vec4f) -> @location(0) vec4f
{
    return color;
} 
