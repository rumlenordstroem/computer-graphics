struct VertexInput {
  @location(0) position: vec2f,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
};

@vertex
fn main_vs(input: VertexInput) -> VertexOutput
{
    var output: VertexOutput;
    output.position = vec4f(input.position.xy, 0.0, 1.0);
    return output;
}

fn hsv2rgb(c: vec3f) -> vec3f {
    let K = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), c.y);
}

alias Complex = vec2<f32>;

fn mulComplex(a: Complex, b: Complex) -> Complex {
    return Complex(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

fn squareComplex(a: Complex) -> Complex {
    return mulComplex(a, a);
}

struct Parameters {
    width: u32,
    heigth: u32,
    iterations: u32,
    zoom: f32,
    center: Complex,
};

@group(0) @binding(0) var<uniform> params: Parameters;

@fragment
fn main_fs(input: VertexOutput) -> @location(0) vec4f
{
    let zoom = params.zoom;
    let x = params.center.x;
    let y = params.center.y;
    let width = f32(params.width);
    let heigth = f32(params.heigth);
    let iterations = u32(params.iterations);
    let c = Complex((input.position.x / width - 0.5) * zoom + x, (input.position.y / heigth - 0.5) * zoom + y);
    var z = Complex(0.0, 0.0);
    let maxIterations: u32 = 1000;
    var i: u32 = 0;
    for(; i < iterations; i++) {
        z = squareComplex(z) + c;
        if (length(z) > 2.0) {
            break;
        }
    }
    if(i == iterations) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    } else {
        return vec4f(hsv2rgb(vec3(f32(i) / f32(iterations), 1.0, 1.0)), 1.0);
    }
}
