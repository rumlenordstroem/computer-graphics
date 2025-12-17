struct Uniforms {
    value: f32,
    _pad: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
};

@vertex
fn main_vs(@location(0) pos: vec2f, @location(1) color: vec3f) -> VSOut
{
    var vsOut: VSOut;
    vsOut.color = color;
    vsOut.position = vec4f(
        pos[0],
        pos[1] + uniforms.value,
        0.0,
        1.0
    );
    return vsOut;
}

@fragment
fn main_fs(@location(0) inColor: vec3f) -> @location(0) vec4f
{
    return vec4f(inColor, 1.0);
}
