struct Uniforms {
    mvp: mat4x4f,
    texture: mat4x4f,
    eye: vec3f,
    reflective: u32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var texture: texture_2d<f32>;
@group(0) @binding(3) var sampQuad: sampler;
@group(0) @binding(4) var textureQuad: texture_cube<f32>;

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

fn rotate_to_normal(n: vec3f, v: vec3f) -> vec3f {
    let sgn_nz = sign(n.z + 1.0e-16);
    let a = - 1.0 / (1.0 + abs(n.z));
    let b = n.x * n.y * a;
    return vec3f(1.0 + n.x * n.x * a, b, - sgn_nz * n.x) * v.x + vec3f(sgn_nz * b, sgn_nz * (1.0 + n.y * n.y * a), - n.y) * v.y + n * v.z;
}

@fragment
fn main_fs(@location(0) textureCoordinates : vec4f) -> @location(0) vec4f
{
    const pi = radians(180.0);
    var sphere = normalize(rotate_to_normal(normalize(textureCoordinates.xyz), (textureSample(texture, samp, vec2f(1 / 2 - atan2(textureCoordinates.z, textureCoordinates.x) / (2 * pi), 1 / 2 + acos(textureCoordinates.y) / pi)).xyz * 2 - 1).xyz));
    return textureSample(textureQuad, sampQuad, select(normalize(textureCoordinates.xyz), reflect(normalize(textureCoordinates.xyz - uni.eye), sphere), uni.reflective == 1));
} 
