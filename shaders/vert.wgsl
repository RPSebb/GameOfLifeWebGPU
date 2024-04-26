struct VertexInput {
    @location(0) pos: vec2f,
    @builtin(instance_index) instance: u32
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) color: vec3f
};

@group(0) @binding(0) var<uniform> grid: vec2f;
@group(0) @binding(1) var<storage> cellState: array<u32>;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    let i = f32(input.instance);
    let state = f32(cellState[input.instance]);
    let cellOffset = 2 * vec2f(i % grid.x, floor(i / grid.x));

    var output: VertexOutput;
    output.pos = vec4f((input.pos * state + 1 + cellOffset) / grid - 1, 0, 1);
    output.color = vec3f(cellOffset.x / grid.x * 0.5, cellOffset.y / grid.y * 0.7, 1 - cellOffset.x / grid.x);
    return output;
}