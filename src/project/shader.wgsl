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

fn squareComplex(z: Complex) -> Complex {
    let x = z.x;
    let y = z.y;
    return Complex(
        x * x - y * y,
        2.0 * x * y
    );
}

fn abs2Complex(z: Complex) -> f32 {
    return z.x * z.x + z.y * z.y;
}

fn divComplex(a: Complex, b: Complex) -> Complex {
    let denom = b.x * b.x + b.y * b.y;
    return Complex(
        (a.x * b.x + a.y * b.y) / denom,
        (a.y * b.x - a.x * b.y) / denom
    );
}

fn divComplexSafe(a: Complex, b: Complex) -> Complex {
    let denom = max(b.x * b.x + b.y * b.y, 1e-8); // Safe from div by 0
    return Complex(
        (a.x * b.x + a.y * b.y) / denom,
        (a.y * b.x - a.x * b.y) / denom
    );
}

fn divComplexFast(a: Complex, b: Complex) -> Complex {
    let inv = 1.0 / (b.x * b.x + b.y * b.y);
    return Complex(
        (a.x * b.x + a.y * b.y) * inv,
        (a.y * b.x - a.x * b.y) * inv
    );
}

fn invComplex(z: Complex) -> Complex {
    let inv = 1.0 / (z.x * z.x + z.y * z.y);
    return Complex(z.x * inv, -z.y * inv);
}

struct Parameters {
    width: u32,
    heigth: u32,
    iterations: u32,
    zoom: f32,
    center: Complex,
};

@group(0) @binding(0) var<uniform> params: Parameters;

fn mandelbrot(z0: Complex) -> u32 {
    let c = z0;
    var z = Complex(0.0, 0.0);
    var iterations: u32 = 0;
    for(; iterations < params.iterations; iterations++) {
        z = squareComplex(z) + c;
        if (abs2Complex(z) > 4.0) {
            break;
        }
    }
    return iterations;
}

fn burning_ship(z0: Complex) -> u32 {
    let c = z0;
    var z = Complex(0.0, 0.0);
    var iterations: u32 = 0;
    for(; iterations < params.iterations; iterations++) {
        z = Complex(abs(z.x), abs(z.y));
        z = squareComplex(z) + c;
        if (abs2Complex(z) > 4.0) {
            break;
        }
    }
    return iterations;
}

fn tricorn(z0: Complex) -> u32 {
    let c = z0;
    var z = Complex(0.0, 0.0);
    var iterations: u32 = 0;
    for(; iterations < params.iterations; iterations++) {
        z = Complex(-z.x, z.y);
        z = squareComplex(z) + c;
        if (abs2Complex(z) > 4.0) {
            break;
        }
    }
    return iterations;
}

fn julia(z0: Complex, c: Complex) -> u32 {
    var z = z0;
    var iterations: u32 = 0;
    for(; iterations < params.iterations; iterations++) {
        z = squareComplex(z) + c;
        if (abs2Complex(z) > 4.0) {
            break;
        }
    }
    return iterations;
}

@fragment
fn mandelbrot_fs(input: VertexOutput) -> @location(0) vec4f {
    let z = Complex((input.position.x / f32(params.width) - 0.5) * params.zoom + params.center.x, (input.position.y / f32(params.heigth) - 0.5) * params.zoom + params.center.y);
    let iterations = mandelbrot(z);
    if(iterations == params.iterations) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    } else {
        return vec4f(hsv2rgb(vec3(f32(iterations) / f32(params.iterations), 1.0, 1.0)), 1.0);
    }
}

@fragment
fn burning_ship_fs(input: VertexOutput) -> @location(0) vec4f {
    let z = Complex((input.position.x / f32(params.width) - 0.5) * params.zoom + params.center.x, (input.position.y / f32(params.heigth) - 0.5) * params.zoom + params.center.y);
    let iterations = burning_ship(z);
    if(iterations == params.iterations) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    } else {
        return vec4f(hsv2rgb(vec3(f32(iterations) / f32(params.iterations), 1.0, 1.0)), 1.0);
    }
}

@fragment
fn tricorn_fs(input: VertexOutput) -> @location(0) vec4f {
    let z = Complex((input.position.x / f32(params.width) - 0.5) * params.zoom + params.center.x, (input.position.y / f32(params.heigth) - 0.5) * params.zoom + params.center.y);
    let iterations = tricorn(z);
    if(iterations == params.iterations) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    } else {
        return vec4f(hsv2rgb(vec3(f32(iterations) / f32(params.iterations), 1.0, 1.0)), 1.0);
    }
}

@fragment
fn julia_fs(input: VertexOutput) -> @location(0) vec4f {
    let z = Complex((input.position.x / f32(params.width) - 0.5) * params.zoom, (input.position.y / f32(params.heigth) - 0.5) * params.zoom);
    let iterations = julia(z, Complex(params.center.x, params.center.y));
    if(iterations == params.iterations) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    } else {
        return vec4f(hsv2rgb(vec3(f32(iterations) / f32(params.iterations), 1.0, 1.0)), 1.0);
    }
}
