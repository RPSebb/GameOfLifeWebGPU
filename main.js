const vertWGSL    = await fetch("./shaders/vert.wgsl"   ).then((value) => value.text());
const fragWGSL    = await fetch("./shaders/frag.wgsl"   ).then((value) => value.text());
const computeWGSL = await fetch("./shaders/compute.wgsl").then((value) => value.text());

const canvas = document.createElement("canvas");
const context = canvas.getContext("webgpu");
const canvasSize = 2048;
const UPDATE_INTERVAL = 1000 / 144;
const GRID_SIZE = 1024;
const WORKGROUP_SIZE = 16;

canvas.setAttribute("width" , canvasSize);
canvas.setAttribute("height", canvasSize);
document.body.appendChild(canvas);

if(!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
}

const adapter = await navigator.gpu.requestAdapter();

if(!adapter) {
    throw new Error("No appropriate GPUAdpater found.");
}

const device = await adapter.requestDevice();

const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device: device,
    format: canvasFormat
});

const vertices = new Float32Array([
    -0.8, -0.8,
     0.8, -0.8,
     0.8,  0.8,
    -0.8,  0.8
]);

const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3
]);

const uniformArray   = new Float32Array([GRID_SIZE, GRID_SIZE]);
const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);

const vertexBuffer = device.createBuffer({
    label: "Cell vertices",
    size : vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
});

const indexBuffer = device.createBuffer({
    label: "Cell indices",
    size : indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
});

const uniformBuffer = device.createBuffer({
    label: "Grid uniforms",
    size : uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const cellStateStorage = [
    device.createBuffer({
        label: "Cell state A",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    }),
    device.createBuffer({
        label: "Cell state B",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
];

const vertexBufferLayout = {
    arrayStride: 8,
    attributes : [{
        format: "float32x2",
        offset: 0,
        shaderLocation: 0
    }]
};

const cellShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: vertWGSL + fragWGSL
});

const simulationShaderModule = device.createShaderModule({
    label: "Game of life simulation shader",
    code: computeWGSL
});

const bindGroupLayout = device.createBindGroupLayout({
    label: "Cell bind group layout",
    entries: 
    [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: {}
    },
    {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
    },
    {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
    }]
});

const pipelineLayout = device.createPipelineLayout({
    label: "Cell pipeline layout",
    bindGroupLayouts: [ bindGroupLayout ]
});

const cellPipeline = device.createRenderPipeline({
    label: "Cell pipeline",
    layout: pipelineLayout,
    vertex: {
        module: cellShaderModule,
        entryPoint: "vertexMain",
        buffers: [vertexBufferLayout]
    },
    fragment: {
        module: cellShaderModule,
        entryPoint: "fragmentMain",
        targets: [{
            format: canvasFormat
        }]
    },
    primitive: {
        topology: "triangle-list"
    }
});

const simulationPipeline = device.createComputePipeline({
    label: "Simulation pipeline",
    layout: pipelineLayout,
    compute: {
        module: simulationShaderModule,
        entryPoint: "computeMain"
    }
});

const bindGroups = [
    device.createBindGroup({
        label: "Cell renderer bind group A",
        layout: cellPipeline.getBindGroupLayout(0),
        entries: 
        [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        },
        {
            binding: 1,
            resource: { buffer: cellStateStorage[0] }
        },
        {
            binding: 2,
            resource: { buffer: cellStateStorage[1] }
        }]
    }),
    device.createBindGroup({
        label: "Cell renderer bind group B",
        layout: cellPipeline.getBindGroupLayout(0),
        entries: 
        [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        },
        {
            binding: 1,
            resource: { buffer: cellStateStorage[1] }
        },
        {
            binding: 2,
            resource: { buffer: cellStateStorage[0] }
        }]
    })
];

device.queue.writeBuffer(vertexBuffer , 0, vertices    );
device.queue.writeBuffer(indexBuffer  , 0, indices     );
device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

for(let i = 0; i < cellStateArray.length; i++) { cellStateArray[i] = Math.random() < 0.25 ? 1 : 0; }
device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
let step = 0;

function updateGrid() {

    const encoder = device.createCommandEncoder();
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(simulationPipeline);
    computePass.setBindGroup(0, bindGroups[step % 2]);
    computePass.dispatchWorkgroups(workgroupCount, workgroupCount);
    computePass.end();

    step++;

    const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: {r: 0.05, g: 0.1, b: 0.3, a: 1},
            storeOp: "store"
        }]
    });

    renderPass.setPipeline(cellPipeline);
    renderPass.setBindGroup(0, bindGroups[step % 2]);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, "uint16");
    renderPass.drawIndexed(indices.length, GRID_SIZE * GRID_SIZE);
    renderPass.end();
    device.queue.submit([encoder.finish()]);
}

setInterval(updateGrid, UPDATE_INTERVAL);