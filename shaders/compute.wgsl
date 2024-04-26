@group(0) @binding(0) var<uniform> size: vec2f;
@group(0) @binding(1) var<storage, read> stateIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> stateOut: array<u32>;

fn getIndex(x: u32, y: u32) -> u32 {
    return (y % u32(size.y)) * u32(size.x) + (x % u32(size.x));
}

fn getCell(x: u32, y: u32) -> u32 {
    return stateIn[getIndex(x, y)];
}

fn countNeighbors(x: u32, y: u32) -> u32 {
    return  getCell(x - 1, y + 1) + getCell(x    , y + 1) +
            getCell(x + 1, y + 1) + getCell(x + 1, y    ) +
            getCell(x + 1, y - 1) + getCell(x    , y - 1) +
            getCell(x - 1, y - 1) + getCell(x - 1, y    );
}

@compute @workgroup_size(16, 16)
fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
    let n = countNeighbors(cell.x, cell.y);
    let i = getIndex(cell.x, cell.y);

    stateOut[i] = u32(n == 3u || (stateIn[i] == 1u && n == 2u));

}