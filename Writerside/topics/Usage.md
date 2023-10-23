# Usage

## 如何播放视频

DashPlayer 支持常见的视频格式，以及 srt 字幕格式。

点击右下角的 “+”，选择一个视频文件以及对应的 srt 字幕文件，即可开始播放。

### 想播放在线视频？

目前 DashPlayer 只支持本地视频文件，但市面上有很多好用的视频下载工具，你可以通过它们将视频下载下来。

- Windows 平台：[Internet Download Manager (IDM)](https://www.internetdownloadmanager.com/)
- macOS 平台：[Downie](https://software.charliemonroe.net/downie/)

### 没有字幕文件怎么办?

可以使用 AI 生成字幕，OpenAI 家的 [Whisper](https://openai.com/research/whisper) 模型生成字幕的效果很好，有很多软件支持通过这个模型生成字幕。

- [Memo](https://memo.ac/) Windows/macOS
- [MacWhisper](https://goodsnooze.gumroad.com/l/macwhisper) macOS


## 如何控制播放
### 通过鼠标/键盘快捷键控制播放

DashPlayer 默认快捷键如下

- 上一句：“←” 或 “a”
- 下一句：“→” 或 “d”
- 重复当前句：“↓” 或 “s”
- 暂停/播放：“上” 或 “w” 或 “space”
- 单句重复：“r”（repeat）
- 展示/隐藏英文字幕：“e”（english）
- 展示/隐藏中文字幕：“c”（chinese）
- 展示/隐藏中英文字幕：“b”（both）
- 切换主题：“t”（theme）

具体快捷键可在设置界面查看

<img width="912" alt="image" src="https://github.com/solidSpoon/DashPlayer/assets/39454841/2b869c73-000d-45cb-9914-2bf2e7147e8f"/>

### 使用蓝牙手柄控制播放

#### 蓝牙手柄控制的原理

八位堂家的 [Zero2](https://www.8bitdo.cn/zero2/) 蓝牙手柄可当做蓝牙键盘使用，单手握持非常舒服，所以可以用它来操控 DashPlayer。

- 将手柄通过键盘模式链接到电脑
- 打开 DashPlayer 设置界面，进入快捷键设置，设置手柄对应按键为快捷键

<p align="center">
    <img width="384" alt="image" src="https://github.com/solidSpoon/DashPlayer/assets/39454841/15daaa68-4444-4fc7-b941-29545f8bce61"/>
</p>


## 机器翻译

DashPlayer 目前支持使用：

- 腾讯云翻译字幕
- 有道云翻译单词（鼠标**放置**在视频下方字幕行的单词上）
- 点击单词播放发音


要启用翻译功能，需要申请[腾讯云](https://console.cloud.tencent.com/cam/capi)和[有道云](https://ai.youdao.com/console/#/service-singleton/text-translation)的密钥，并在设置中填入

<img width="912" alt="image" src="https://github.com/solidSpoon/DashPlayer/assets/39454841/fdc4dc49-066b-482b-ac2d-f961e7dcdc77"/>

> 腾讯云翻译每月有一定的免费额度，足够个人使用，DashPlayer 会采用缓存和懒加载等技术尽可能节省您的额度。
>
{style="tip"}
