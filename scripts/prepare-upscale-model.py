"""Prepare the browser GPU graph without changing learned weights.

Use Python 3.12 with onnx==1.17.0, onnxruntime==1.22.0 and numpy in an
isolated environment. Pass the pinned upstream ONNX and an output directory.
The CPU file remains byte-for-byte identical; see public/image-upscale/README.md.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
source_bytes = args.source.read_bytes()
expected = "c2abbfe0cc8e685b5e11964970f8ebe3d24072e904fd5545a30ac31ec1e110db"
if hashlib.sha256(source_bytes).hexdigest() != expected:
    raise ValueError("Use the pinned Xenova ONNX model from the asset README.")
args.output.mkdir(parents=True, exist_ok=True)
model = onnx.load(args.source)
for tensor, shape in [(model.graph.input[0], [1, 3, 128, 128]), (model.graph.output[0], [1, 3, 256, 256])]:
    for dimension, value in zip(tensor.type.tensor_type.shape.dim, shape):
        dimension.ClearField("dim_param")
        dimension.dim_value = value
options = ort.SessionOptions()
options.intra_op_num_threads = options.inter_op_num_threads = 1
options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
options.optimized_model_filepath = str(args.output / "model-gpu.onnx")
fixed = ort.InferenceSession(model.SerializeToString(), options, providers=["CPUExecutionProvider"])
options.optimized_model_filepath = ""
optimized = onnx.load(args.output / "model-gpu.onnx")
seen, aliases, keep = {}, {}, []
for tensor in optimized.graph.initializer:
    array = onnx.numpy_helper.to_array(tensor)
    key = (str(array.dtype), array.shape, hashlib.sha256(array.tobytes()).digest())
    if key in seen:
        aliases[tensor.name] = seen[key]
    else:
        seen[key] = tensor.name
        keep.append(tensor)
for node in optimized.graph.node:
    for index, name in enumerate(node.input):
        if name in aliases:
            node.input[index] = aliases[name]
del optimized.graph.initializer[:]
optimized.graph.initializer.extend(keep)
onnx.checker.check_model(optimized)
onnx.save(optimized, args.output / "model-gpu.onnx")
(args.output / "model-cpu.onnx").write_bytes(source_bytes)
original = ort.InferenceSession(source_bytes, options, providers=["CPUExecutionProvider"])
final = ort.InferenceSession(str(args.output / "model-gpu.onnx"), options, providers=["CPUExecutionProvider"])
pixels = np.random.default_rng(123).random((1, 3, 128, 128), dtype=np.float32)
a = original.run(None, {"pixel_values": pixels})[0]
b = fixed.run(None, {"pixel_values": pixels})[0]
c = final.run(None, {"pixel_values": pixels})[0]
assert np.max(np.abs(a - c)) < .00001
assert np.array_equal(b, c)
print(json.dumps({"max_difference": float(np.abs(a - c).max()), "deduplicated_initializers": len(aliases), "nodes": len(optimized.graph.node), "gpu_sha256": hashlib.sha256((args.output / "model-gpu.onnx").read_bytes()).hexdigest()}, indent=2))
