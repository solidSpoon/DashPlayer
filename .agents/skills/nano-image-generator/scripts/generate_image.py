#!/usr/bin/env python3
"""
Nano Image Generator - Generate images using Google's Gemini 3 Pro Preview API.

Requires: project .env with apikey/APIKEY and baseurl/BASEURL

Usage:
    python generate_image.py "A cute robot mascot" --output ./mascot.png
    python generate_image.py "Banner for app launch" --aspect 16:9 --output ./banner.png
    python generate_image.py "High-res logo" --size 4K --output ./logo.png
"""

import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional


# Gemini 3 Pro Preview - the "Nano Banana Pro" model
MODEL_ID = "gemini-3-pro-image-preview"

ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
IMAGE_SIZES = ["1K", "2K", "4K"]

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def find_project_env_file() -> Optional[Path]:
    """
    在当前项目上下文中定位 `.env` 文件。

    返回值：
    - 找到时返回 `.env` 的绝对路径。
    - 未找到时返回 `None`。
    """
    search_roots = [Path.cwd(), Path(__file__).resolve().parent]
    for root in search_roots:
        current = root
        while True:
            env_path = current / '.env'
            if env_path.is_file():
                return env_path
            if current.parent == current:
                break
            current = current.parent
    return None


def load_env_values(env_path: Path) -> dict[str, str]:
    """
    解析 `.env` 文件中的键值对。

    关键行为：
    - 忽略空行与 `#` 注释行。
    - 仅解析 `key=value` 结构。
    - 对包裹的单引号/双引号做简单去壳处理。
    """
    values: dict[str, str] = {}
    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        normalized_key = key.strip()
        normalized_value = value.strip().strip('"').strip("'")
        values[normalized_key] = normalized_value
    return values


def get_api_config() -> tuple[str, str]:
    """
    获取图片生成接口配置（apikey 与 baseurl）。

    配置读取优先级：
    1) 项目 `.env` 中的 `apikey` 与 `baseurl`（兼容大写键名）。
    2) 进程环境变量中的同名键。
    3) 回退到 `GEMINI_API_KEY` 与默认 Gemini 基础地址。

    返回值：
    - `(api_key, api_base)`。
    """
    env_values: dict[str, str] = {}
    env_path = find_project_env_file()
    if env_path:
        env_values = load_env_values(env_path)

    api_key = (
        env_values.get('apikey')
        or env_values.get('APIKEY')
        or os.environ.get('apikey')
        or os.environ.get('APIKEY')
        or os.environ.get('GEMINI_API_KEY')
    )

    api_base = (
        env_values.get('baseurl')
        or env_values.get('BASEURL')
        or os.environ.get('baseurl')
        or os.environ.get('BASEURL')
        or API_BASE
    )

    if not api_key:
        print('Error: missing apikey/APIKEY in project .env', file=sys.stderr)
        print('Fallback GEMINI_API_KEY is also not set', file=sys.stderr)
        sys.exit(1)

    return api_key, api_base.rstrip('/')


def build_candidate_api_bases(api_base: str) -> list[str]:
    """
    构建候选 API 基础路径列表，用于兼容不同网关路由。

    规则：
    - 若已包含 `/v1beta/models`，直接使用。
    - 否则优先尝试追加 `/v1beta/models`，再尝试原始路径。
    """
    normalized = api_base.rstrip('/')
    if normalized.endswith('/v1beta/models'):
        return [normalized]
    return [f'{normalized}/v1beta/models', normalized]


def build_request_attempts(api_key: str, api_base: str) -> list[tuple[str, dict[str, str]]]:
    """
    生成候选请求列表（URL + 请求头），兼容原生 Gemini 与 uniapi。

    关键行为：
    - 对每个候选基础路径，分别尝试 `Bearer`、`x-goog-api-key` 与 `?key=` 三种鉴权方式。
    - 该顺序优先覆盖 `uniapi` 常见配置，再回退到 Gemini 原生 key 查询参数。
    """
    # 部分网关会按请求指纹做拦截，显式设置常见请求头可提高兼容性。
    default_headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; DashPlayer-Skill/1.0)',
    }

    attempts: list[tuple[str, dict[str, str]]] = []
    for candidate_base in build_candidate_api_bases(api_base):
        endpoint = f'{candidate_base}/{MODEL_ID}:generateContent'
        attempts.append(
            (
                endpoint,
                {
                    **default_headers,
                    'Authorization': f'Bearer {api_key}',
                },
            ),
        )
        attempts.append(
            (
                endpoint,
                {
                    **default_headers,
                    'x-goog-api-key': api_key,
                },
            ),
        )
        attempts.append(
            (
                f'{endpoint}?key={api_key}',
                default_headers,
            ),
        )
    return attempts


def request_generate_content(payload: dict, api_key: str, api_base: str) -> dict:
    """
    向图片生成接口发起请求，并在鉴权/路径差异下自动重试。

    返回值：
    - 成功时返回 JSON 响应对象。

    边界行为：
    - 仅在 HTTP 401/403/404 时继续尝试下一组候选配置。
    - 其他 HTTP 错误直接失败，避免掩盖真实问题。
    """
    data = json.dumps(payload).encode('utf-8')
    attempts = build_request_attempts(api_key=api_key, api_base=api_base)
    last_error = ''

    for index, (url, headers) in enumerate(attempts, start=1):
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=180) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as error:
            error_body = error.read().decode('utf-8')
            last_error = f'HTTP {error.code}: {error_body}'
            if error.code in (401, 403, 404):
                print(f'Attempt {index}/{len(attempts)} failed: HTTP {error.code}, retrying...', file=sys.stderr)
                continue
            print(f'API Error ({error.code}): {error_body}', file=sys.stderr)
            sys.exit(1)
        except urllib.error.URLError as error:
            print(f'Network Error: {error.reason}', file=sys.stderr)
            sys.exit(1)

    print('API Error: all auth/path attempts failed', file=sys.stderr)
    print(f'Last error: {last_error}', file=sys.stderr)
    sys.exit(1)


def detect_image_format(image_bytes: bytes) -> tuple[str, str]:
    """
    Detect actual image format from magic bytes.
    Returns: (mime_type, extension)

    Gemini API sometimes reports incorrect mime types, so we verify
    the actual format from the image data itself.
    """
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png", ".png"
    elif image_bytes[:2] == b'\xff\xd8':
        return "image/jpeg", ".jpg"
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        return "image/webp", ".webp"
    elif image_bytes[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif", ".gif"
    else:
        # Default to PNG if unknown
        return "image/png", ".png"


def generate_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    image_size: str = "2K",
) -> tuple[bytes, str]:
    """
    使用 Gemini 兼容接口生成图片。

    返回值：
    - `(image_bytes, mime_type)`。
    """
    api_key, api_base = get_api_config()

    # Build request payload per Gemini 3 Pro Preview spec
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": {
                "aspectRatio": aspect_ratio,
                "imageSize": image_size,
            },
        },
    }

    result = request_generate_content(payload=payload, api_key=api_key, api_base=api_base)

    # Extract image from response
    candidates = result.get("candidates", [])
    if not candidates:
        print("Error: No candidates in response", file=sys.stderr)
        print(f"Response: {json.dumps(result, indent=2)}", file=sys.stderr)
        sys.exit(1)

    parts = candidates[0].get("content", {}).get("parts", [])

    for part in parts:
        if "inlineData" in part:
            inline_data = part["inlineData"]
            image_bytes = base64.b64decode(inline_data["data"])
            # Detect actual format from magic bytes (API mime_type can be wrong)
            actual_mime, _ = detect_image_format(image_bytes)
            reported_mime = inline_data.get("mimeType", "image/png")
            if actual_mime != reported_mime:
                print(f"Note: API reported {reported_mime}, actual format is {actual_mime}", file=sys.stderr)
            return image_bytes, actual_mime

    # No image found - check for text response
    for part in parts:
        if "text" in part:
            print(f"Model response (no image): {part['text']}", file=sys.stderr)

    print("Error: No image data in response", file=sys.stderr)
    sys.exit(1)


def get_extension(mime_type: str) -> str:
    """Get file extension from MIME type."""
    extensions = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    return extensions.get(mime_type, ".png")


def main():
    parser = argparse.ArgumentParser(
        description="Generate images using Gemini 3 Pro Preview (Nano Banana Pro)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "A friendly robot mascot" --output ./robot.png
  %(prog)s "Website banner" --aspect 16:9 --output ./banner.png
  %(prog)s "Detailed landscape" --size 4K --output ./landscape.png
        """,
    )
    parser.add_argument("prompt", help="Image description/prompt")
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output file path (extension auto-added if missing)",
    )
    parser.add_argument(
        "--aspect", "-a",
        choices=ASPECT_RATIOS,
        default="1:1",
        help="Aspect ratio. Default: 1:1",
    )
    parser.add_argument(
        "--size", "-s",
        choices=IMAGE_SIZES,
        default="2K",
        help="Image resolution: 1K, 2K, or 4K. Default: 2K",
    )

    args = parser.parse_args()

    print(f"Generating image with Gemini 3 Pro Preview...", file=sys.stderr)
    print(f"Prompt: {args.prompt}", file=sys.stderr)
    print(f"Aspect: {args.aspect}, Size: {args.size}", file=sys.stderr)

    image_bytes, mime_type = generate_image(
        prompt=args.prompt,
        aspect_ratio=args.aspect,
        image_size=args.size,
    )

    # Determine output path - always use correct extension for actual format
    output_path = Path(args.output)
    correct_ext = get_extension(mime_type)

    # Replace any user-specified extension with the correct one
    output_path = output_path.with_suffix(correct_ext)

    if args.output != str(output_path):
        print(f"Note: Using {correct_ext} extension (actual format: {mime_type})", file=sys.stderr)

    # Create parent directories if needed
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write image
    output_path.write_bytes(image_bytes)

    print(f"Image saved: {output_path}", file=sys.stderr)
    # Print path to stdout for easy capture
    print(output_path)


if __name__ == "__main__":
    main()
