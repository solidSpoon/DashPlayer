# Parakeet 转录方案基准：sherpa-onnx（CPU）vs whisper.cpp（ggml/GPU）

## 背景

视频转字幕使用 NVIDIA Parakeet TDT 0.6b v3（int8）+ sherpa-onnx CLI。sherpa-onnx 基于
ONNX Runtime，其 release 静态构建不含任何 GPU 执行后端，因此**所有平台都是纯 CPU 推理**；
CUDA 后端仅存在于 Win/Linux 非静态构建，macOS 没有可用 GPU 后端（无 Metal/CoreML EP）。

whisper.cpp 自 v1.9.x 起（PR ggml-org/whisper.cpp#3735，2026-06 合入）原生支持 Parakeet：
`ggml-org/parakeet-GGUF` 提供**同一个模型**的 GGML 格式（f16/q8_0/q4_k/q4_0），通过
`examples/parakeet-cli` 运行，走 ggml 后端 —— macOS 上即 Metal，Win/Linux 官方还发布
cublas（CUDA）构建。`--print-segments` 可输出逐 token 时间轴（t0/t1），与现有字幕
管线所需的 `tokens/timestamps` 结构对齐。

## M1 Max 实测（2026-09，音频 384s / 约 6.4 分钟，同一模型）

| 方案 | 耗时 | RTF | 相对现状 |
|---|---|---|---|
| sherpa-onnx 2 线程（项目现状） | 89.4s | 0.233 | — |
| sherpa-onnx 4 线程 | 51.0s | 0.133 | 1.8x |
| sherpa-onnx 8 线程 | 34.9s | 0.091 | 2.6x |
| parakeet-cli GPU（Metal，首跑含 shader 编译） | 14.9s | — | 6.0x |
| parakeet-cli GPU（Metal，稳态） | 10.2s | 0.027 | 8.8x |
| parakeet-cli CPU（对照组） | 35.8s | 0.093 | 2.5x |

（其他平台结果请在对应机器上复测后追加到此表：Windows / Linux x64，各自记录
sherpa 现状、sherpa 8 线程、parakeet-cli GPU（cublas）三行即可。）

## 结论与候选路线

1. **零成本优化**：`SherpaOnnxGatewayImpl` 的 `--num-threads` 从写死 2 提高（如 8），
   现有方案即可提速约 2.6 倍。
2. **GPU 路线**：新增 `WhisperCppGateway`（子进程 CLI 模式同 `SherpaOnnxCli`），
   模型分发复用 `ModelArchiveInstaller`（下载 GGUF 文件），mac 二进制在 CI 用 cmake
   编译（whisper.cpp 官方不发 macOS CLI 预编译包）。同模型同质量，Mac 提速约 9 倍。
3. sherpa-onnx 官方对 Parakeet 的近期投入集中在移动端 QNN（骁龙 NPU）与流式，
   无 macOS GPU 计划，留在 sherpa 体系内无法获得 Mac 加速。

## 复现方式

```console
$ yarn run download   # 确保本机 lib/ 下有 sherpa-onnx 与 ffmpeg
$ ./scripts/benchmark-parakeet.sh <parakeet-tdt-0.6b-v3-int8 模型目录>
```

模型目录即应用运行时下载的 `parakeet-tdt-0.6b-v3-int8`（含四个 int8 onnx 与
tokens.txt）。脚本会自动克隆/编译 whisper.cpp、下载 q8_0 模型（约 668MB）、拼接
约 6 分钟测试音频并输出对比表。

## 已知边界

- parakeet-cli 为 example 级成熟度（合并约三个月，TDT 解码 bug 仍在修复中），
  落地前需验证长音频分块与时间戳稳定性。
- Metal 首次运行有 shader 编译开销（数十秒），ggml 缓存到磁盘后仅首次受影响。
- whisper.cpp 官方 release 不含 macOS CLI 二进制，需要自建 CI 编译产物。
