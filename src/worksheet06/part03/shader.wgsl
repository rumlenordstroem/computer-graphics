struct Uniforms {
    matrix: array<mat4x4f, 1>,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var texture: texture_2d<f32>;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) pos: vec4f,
    @location(1) normal: vec3f,
};

@vertex
fn main_vs(@location(0) position: vec4f, @builtin(instance_index) instance: u32) -> VSOut
{
    var output: VSOut;

    output.position = uni.matrix[instance] * position;
    output.normal = normalize(position.xyz);
    output.pos = position;

    return output;
}

@fragment
fn main_fs(@location(0) position: vec4f, @location(1) normal: vec3f) -> @location(0) vec4f
{
    const PI = radians(180.0);
    let uv = vec2f(0.5 - atan2(normal.z, normal.x) / (2.0 * PI), acos(normal.y) / PI);

    let textureColor = textureSample(texture, samp, uv);

    let lightDir = vec3f(0.0, 0.0, 1.0);
    let omegaI = - lightDir;
    let lightEmission = vec3f(1.0, 1.0, 1.0);

    return vec4f(textureColor.xyz * lightEmission * max(dot(normal, omegaI), 0.0) + 0.3 * textureColor.xyz, 1.0);
} 
