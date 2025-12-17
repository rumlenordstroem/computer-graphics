struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
};

@vertex
fn main_vs(@location(0) position: vec2f, @location(1) color: vec3f) -> VSOut
{
    var output: VSOut;
    output.position = vec4f(position, 0.0, 1.0);
    output.color = color;
    return output;
}

@fragment
fn main_fs(@location(0) color: vec3f) -> @location(0) vec4f
{
    return vec4f(color, 1.0);
} 
