struct Uniforms {
    matrix: array<mat4x4f, 1>,
    eye: vec3f,
    L_e: f32,
    L_a: f32,
    k_d: f32,
    k_s: f32,
    shininess: f32,
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

    let normal = normalize(position.xyz);

    // Light
    let lightDir = vec3f(0.0, 0.0, - 1.0);
    let omega_i = - lightDir;
    let viewDir = normalize(uni.eye - position.xyz);

    let reflectDir = reflect(- omega_i, normal);

    let diffuseColor = vec3f(0.8, 0.2, 0.2);
    let specularColor = vec3f(1.0, 1.0, 1.0);
    let k_d = diffuseColor * uni.k_d;
    let k_a = k_d;
    let k_s = specularColor * uni.k_s;

    let L_e = vec3f(1.0, 1.0, 1.0) * uni.L_e;
    let L_i = L_e;
    let L_a = vec3f(1.0, 1.0, 1.0) * uni.L_a;

    // Phong reflection model
    let L_ra = k_a * L_a;
    let L_rd = k_d * L_e * max(dot(normal, omega_i), 0.0);
    let L_rs = k_s * L_e * pow(max(dot(viewDir, reflectDir), 0.0), uni.shininess);

    let L_o = L_ra + L_rd + L_rs;

    output.color = vec4f(L_o, 1.0);

    return output;
}

@fragment
fn main_fs(@location(0) color: vec4f) -> @location(0) vec4f
{
    return color;
} 
