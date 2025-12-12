struct Uniforms {
    matrix: array<mat4x4f, 1>,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
};

@vertex
fn main_vs(@location(0) position: vec4f, @builtin(instance_index) instance: u32) -> VSOut
{
    var output: VSOut;

    output.position = uni.matrix[instance] * position;

    let n = normalize(position.xyz);
    const l_e = vec3f(0.0, 0.0, -1.0);
    const omega_i = - l_e;
    const L_e = vec3f(1.0, 1.0, 1.0);
    let kd = 1.0;
    let L_d = kd * L_e * max(dot(n, omega_i), 0.0);
    output.color = vec4f(L_d, 1.0);

    return output;
}

@fragment
fn main_fs(@location(0) color: vec4f) -> @location(0) vec4f
{
    return color;
} 
