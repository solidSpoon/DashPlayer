#!/usr/bin/env bash
# Parakeet 转录方案基准测试：sherpa-onnx（CPU，现有方案） vs whisper.cpp（ggml 后端，可上 GPU）。
#
# 两者跑的是同一个 NVIDIA Parakeet TDT 0.6b v3 模型（sherpa 侧用官方 int8 导出，
# whisper.cpp 侧用 ggml-org/parakeet-GGUF 的 q8_0 量化），因此对比的是推理运行时开销。
#
# 用法：
#   ./scripts/benchmark-parakeet.sh <sherpa-onnx int8 模型目录> [音频文件]
#
# 参数：
#   $1 sherpa int8 模型目录，须包含 encoder/decoder/joiner 的 int8 onnx 与 tokens.txt
#      （应用运行时下载的 parakeet-tdt-0.6b-v3-int8 目录即可）。
#   $2 可选，wav 音频；缺省用模型目录下 test_wavs/en.wav 循环拼接出约 6 分钟长音频。
#
# 产物：whisper.cpp 源码克隆到 build-parakeet-bench/whisper.cpp，q8_0 模型约 668MB。
# 结果直接打印到 stdout，请记录并回贴到 docs/parakeet-whisper-cpp-benchmark.md。

set -euo pipefail

MODEL_DIR="${1:?用法: $0 <sherpa int8 模型目录> [音频文件]}"
AUDIO="${2:-}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BENCH_DIR="$REPO_ROOT/build-parakeet-bench"
WHISPER_CPP="$BENCH_DIR/whisper.cpp"
WHISPER_REF="v1.9.3"
GGML_MODEL="$WHISPER_CPP/models/ggml-parakeet-tdt-0.6b-v3-q8_0.bin"
GGML_URL="https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin"

# 定位随仓库分发的 ffmpeg（lib/ffmpeg 本身是二进制），缺不了时退回系统 PATH。
if [ -x "$REPO_ROOT/lib/ffmpeg" ]; then
    FFMPEG="$REPO_ROOT/lib/ffmpeg"
elif command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG="$(command -v ffmpeg)"
else
    echo "错误：找不到 ffmpeg（$REPO_ROOT/lib/ffmpeg 或 PATH 中均无）" >&2
    exit 1
fi

# 按当前平台/架构解析 sherpa-onnx CLI 路径，与 scripts/download.mjs 的目录约定一致。
OS_NAME="$(uname -s)"
ARCH="$(uname -m)"
case "$OS_NAME" in
    Darwin) PLATFORM_DIR="darwin" ;;
    Linux) PLATFORM_DIR="linux" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM_DIR="win32" ;;
    *) echo "错误：不支持平台 $OS_NAME" >&2; exit 1 ;;
esac
case "$ARCH" in
    arm64|aarch64) ARCH_DIR="arm64" ;;
    x86_64) ARCH_DIR="x64" ;;
    *) echo "错误：不支持架构 $ARCH" >&2; exit 1 ;;
esac
SHERPA_NAME="sherpa-onnx-offline"
[ "$PLATFORM_DIR" = "win32" ] && SHERPA_NAME="sherpa-onnx-offline.exe"
SHERPA="$REPO_ROOT/lib/sherpa-onnx/$ARCH_DIR/$PLATFORM_DIR/$SHERPA_NAME"
[ -x "$SHERPA" ] || { echo "错误：sherpa-onnx 不存在：$SHERPA（先执行 yarn run download）" >&2; exit 1; }

for f in encoder.int8.onnx decoder.int8.onnx joiner.int8.onnx tokens.txt; do
    [ -f "$MODEL_DIR/$f" ] || { echo "错误：模型文件缺失：$MODEL_DIR/$f" >&2; exit 1; }
done

# 准备测试音频：未指定时用 test_wavs/en.wav 循环拼到 6 分钟左右，模拟真实视频长度。
if [ -z "$AUDIO" ]; then
    SRC_WAV="$MODEL_DIR/test_wavs/en.wav"
    [ -f "$SRC_WAV" ] || { echo "错误：找不到 $SRC_WAV，请显式传入音频路径" >&2; exit 1; }
    mkdir -p "$BENCH_DIR"
    AUDIO="$BENCH_DIR/en-long.wav"
    echo "=> 拼接长音频：$AUDIO"
    "$FFMPEG" -y -loglevel error -stream_loop 99 -i "$SRC_WAV" -ar 16000 "$AUDIO"
fi
if [ "$OS_NAME" = "Darwin" ]; then
    DUR=$("$REPO_ROOT/lib/ffprobe" -v error -show_entries format=duration -of csv=p=0 "$AUDIO" 2>/dev/null || echo "?")
else
    DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$AUDIO" 2>/dev/null || echo "?")
fi
echo "=> 测试音频时长：${DUR}s"

# 获取并编译 whisper.cpp 的 parakeet-cli（已存在则跳过）。
if [ ! -x "$WHISPER_CPP/build/bin/parakeet-cli" ] && [ ! -x "$WHISPER_CPP/build/bin/Release/parakeet-cli.exe" ]; then
    echo "=> 克隆 whisper.cpp ($WHISPER_REF)"
    git clone --depth 1 --branch "$WHISPER_REF" https://github.com/ggml-org/whisper.cpp.git "$WHISPER_CPP"
    echo "=> 编译 parakeet-cli"
    cmake -S "$WHISPER_CPP" -B "$WHISPER_CPP/build" -DCMAKE_BUILD_TYPE=Release \
        -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON -DGGML_NATIVE=ON
    cmake --build "$WHISPER_CPP/build" --target parakeet-cli -j 8
fi
PCLI="$WHISPER_CPP/build/bin/parakeet-cli"
[ -x "$PCLI" ] || PCLI="$WHISPER_CPP/build/bin/Release/parakeet-cli.exe"

# 获取 ggml 量化模型。
if [ ! -f "$GGML_MODEL" ]; then
    echo "=> 下载 ggml parakeet q8_0 模型（约 668MB）"
    mkdir -p "$(dirname "$GGML_MODEL")"
    curl -sL -o "$GGML_MODEL" "$GGML_URL"
fi

sherpa_args() { # 统一 sherpa 参数，$1 = 线程数
    printf -- '--encoder=%s --decoder=%s --joiner=%s --tokens=%s --model-type=nemo_transducer --num-threads=%s' \
        "$MODEL_DIR/encoder.int8.onnx" "$MODEL_DIR/decoder.int8.onnx" \
        "$MODEL_DIR/joiner.int8.onnx" "$MODEL_DIR/tokens.txt" "$1"
}

bench() { # 计时封装：$1 = 标签，其余为命令；首次 GPU 调用含 shader 编译，脚本内跑两遍取稳态
    local label="$1"; shift
    "$@" >/dev/null 2>&1 || { echo "$label  运行失败"; return; }
    local t
    t=$( { /usr/bin/time -p "$@" >/dev/null 2>/dev/null; } 2>&1 | awk '/^real/ {print $2}')
    echo "$label  ${t}s"
}

echo
echo "===== 基准结果（音频 ${DUR}s） ====="
bench "sherpa 2 线程（项目现状）" bash -c "$(sherpa_args 2) '$AUDIO'"
bench "sherpa 4 线程"             bash -c "$(sherpa_args 4) '$AUDIO'"
bench "sherpa 8 线程"             bash -c "$(sherpa_args 8) '$AUDIO'"
bench "parakeet-cli GPU（首跑）"   "$PCLI" -m "$GGML_MODEL" -f "$AUDIO"
bench "parakeet-cli GPU（稳态）"   "$PCLI" -m "$GGML_MODEL" -f "$AUDIO"
bench "parakeet-cli CPU"          "$PCLI" -ng -m "$GGML_MODEL" -f "$AUDIO"
echo
echo "=> 请把本机型号（uname -m / 机型）与以上结果记录到 docs/parakeet-whisper-cpp-benchmark.md"
