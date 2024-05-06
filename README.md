<p align="center">
<img src="https://user-images.githubusercontent.com/39454841/226364979-9c96a838-aa43-4b70-89d8-8ea83d59fc0f.png" width="40%" />
</p>

<p align="center">
  <a href="LICENSE" target="_blank">
    <img alt="MIT License" src="https://img.shields.io/github/license/solidSpoon/DashPlayer.svg" />
  </a>

  <img alt="React" src="https://img.shields.io/badge/React-rgb(8%2C126%2C164)?logo=react&logoColor=white" />

  <img alt="Electron" src="https://img.shields.io/badge/Electron-rgb(54%2C155%2C176)?style=flat&logo=electron&logoColor=white" />


  <!-- TypeScript Badge -->
  <img alt="TypeScript" src="https://img.shields.io/badge/-TypeScript-blue?logo=typescript&logoColor=white" />

  <a href="https://github.com/solidSpoon/DashPlayer/releases" target="_blank">
    <img alt="macOS" src="https://img.shields.io/badge/-macOS-black?logo=apple&logoColor=white" />
  </a>

  <a href="https://github.com/solidSpoon/DashPlayer/releases" target="_blank">
    <img alt="Windows" src="https://img.shields.io/badge/-Windows-blue?logo=windows&logoColor=white" />
  </a>

  <a href="https://github.com/solidSpoon/DashPlayer/releases" target="_blank">
    <img alt="Linux" src="https://img.shields.io/badge/-Linux-yellow?logo=linux&logoColor=white" />
  </a>
</p>

> 安装与使用指南详见 [Wiki](https://solidspoon.xyz/DashPlayer/home.html)，[官网](https://dash-player.solidspoon.xyz)

# DashPlayer

> 一款专为英语学习打造的视频播放器

<p align="center">
    <img width="70%" alt="image" src="https://github.com/solidSpoon/DashPlayer/assets/39454841/80a356ab-a018-4af7-a99a-ce430b5aada7">
</p>

## 为什么需要 DashPlayer ？

简而言之，我想用英文来学习感兴趣的知识。

在课堂里我一直是面向考试学习英语，不断记忆那些永远也记不住的单词，阅读那些即使翻译成中文也很枯燥的文章。

后来我完成了学校的所有英文课程以后，就开始寻找一些可以让英语学习和娱乐、技能学习相结合的方法。比如阅读感兴趣的英文书籍就是个很好的方法。

但后来通过 [Tinyfool](https://www.youtube.com/@tinyEnglish)、[Steve Kaufmann](https://www.youtube.com/@Thelinguist) 等博主的启发，我意识到观看大量母语人士录制的视频可能是更好的英语学习方式。因此我开发了这个英语视频播放器，到现在我已经通过它观看了几千个小时的视频。在它的帮助下，我的英语水平已经能够自如地通过英语学习各种知识了。为了让更多像我一样想提高英语水平的朋友也能受益，我决定把这个播放器开源出来。

希望这个播放器也能帮助到你！

## 主要特性

DashPlayer  的目标就是方便你观看英文视频。无论你是想泛听，还是想一句句精听，亦或是想要查询生词，DashPlayer  精心打磨的手感让您始终心情愉悦。

- **双语字幕**：支持机器翻译字幕。只展示中文/英文，或者全部隐藏都可以。
- **按字幕跳转：** 重复当前句，或者跳到上一句，怎么跳都可以。
- **查词查询**：鼠标悬停生词可快速查询，不打断学习进程。
- **可调整界面尺寸：** 界面尺寸可调，适应不同屏幕和学习场景。
- **记录播放位置：** 自动记录上次播放位置，方便下次接着学习。
- **蓝牙遥控操作：** 支持蓝牙遥控，让你随时调整音量、跳转视频，学习更轻松！
- **夜间模式**：内置暗色/亮色主题，适配您的学习环境。
- **AI 字幕**：可以使用 AI 为视频生成字幕。
- **长视频切分**：看一段删一段，没有压力。
- **视频下载**：粘贴视频链接，下载视频。

## 屏幕截图

主页展示播放历史：

![image](https://github.com/solidSpoon/DashPlayer/assets/39454841/1fccf3be-1384-4d6e-9af5-96f78f5da688)

内置下载视频，切割视频，生成字幕等诸多功能：

![image](https://github.com/solidSpoon/DashPlayer/assets/39454841/96476645-317e-424b-8952-3eac0b4dd7aa)

AI 整句学习功能：

![image](https://github.com/solidSpoon/DashPlayer/assets/39454841/2597f6a1-2903-4652-9431-8327acdbe9be)

---

# 安装指南

DashPlayer 目前并没有进行应用签名，因此在安装过程中可能会遭到操作系统的警告，当您遇到安装问题时请阅读下面的指南

## Windows

1. 在 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载以 `.exe` 结尾的安装包
2. 下载完成后双击安装包进行安装
3. 如果提示不安全，可以点击 `更多信息` -> `仍要运行` 进行安装
4. 开始使用吧！

## MacOS

### 手动安装

1.  去 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载对应芯片以 `.dmg` 的安装包
2.  下载完成后双击安装包进行安装，然后将 `DashPlayer` 拖动到 `Applications` 文件夹。
3.  开始使用吧！

### 故障排除

#### "DashPlayer" can’t be opened because the developer cannot be verified.

<p align="center">
  <img width="300" alt="image" src="https://user-images.githubusercontent.com/39454841/226151784-b6ed3e65-2c0a-4ad0-93eb-57d45108e1ba.png">
</p>

点击 `Cancel` 按钮，然后去 `设置` -> `隐私与安全性` 页面，点击 `仍要打开` 按钮，然后在弹出窗口里点击 `打开` 按钮即可，以后打开 `DashPlayer` 就再也不会有任何弹窗告警了 🎉

<p align="center">
  <img width="500" alt="image" src="https://user-images.githubusercontent.com/39454841/226151875-03f79da9-45fc-4c0d-9d12-8cc9666ff904.png">
  <img width="200" alt="image" src="https://user-images.githubusercontent.com/39454841/226151917-6b59f228-2bb9-4f12-9584-32bca9699d8e.png">
</p>

#### XYZ is damaged and can’t be opened. You should move it to the Trash

> XYZ已损坏，无法打开。您应该将其移动到垃圾桶中。

在控制台中输入以下命令：

```bash
xattr -c <path/to/application.app>
```

示例：

```bash
xattr -c /Applications/DashPlayer.app
```


---
# 使用指南
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
- 调整当前句开始时间，提前 0.2 秒：“z”
- 调整当前句开始时间，延后 0.2 秒：“x”

具体快捷键可在设置界面查看

<img width="912" alt="image" src="https://github.com/solidSpoon/DashPlayer/assets/39454841/2b869c73-000d-45cb-9914-2bf2e7147e8f">

### 使用蓝牙手柄控制播放

#### 蓝牙手柄控制的原理

八位堂家的 [Micro](https://www.8bitdo.cn/micro/) 和 [Zero2](https://www.8bitdo.cn/zero2/) 蓝牙手柄可当做蓝牙键盘使用。它们非常小巧, 单手握持很舒服, 所以可以用它来操控 DashPlayer。

- 将手柄通过键盘模式链接到电脑
- 打开 DashPlayer 设置界面，进入快捷键设置，设置手柄对应按键为快捷键

<table>
    <thead>
    <tr>
        <th>产品名称</th>
        <th>图片</th>
    </tr>
    </thead>
    <tbody>
    <tr>
        <td>Micro 蓝牙手柄</td>
        <td><img src="https://github.com/solidSpoon/DashPlayer/assets/39454841/778a38e6-880e-4c5b-bec2-2b3c7a41de7a"></td>
    </tr>
    <tr>
        <td>Zero2 蓝牙手柄</td>
        <td><img src="https://github.com/solidSpoon/DashPlayer/assets/39454841/d2d480d2-7449-4f7a-82bb-b351b0db60f6"></td>
    </tr>
    </tbody>
</table>

## 机器翻译

DashPlayer 目前支持使用：

- 腾讯云翻译字幕
- 有道云翻译单词（鼠标**放置**在视频下方字幕行的单词上）
- 点击单词播放发音


要启用翻译功能，需要申请[腾讯云](https://console.cloud.tencent.com/cam/capi)和[有道云](https://ai.youdao.com/console/#/service-singleton/text-translation)的密钥，并在设置中填入

<img width="912" alt="image" src="https://github.com/solidSpoon/DashPlayer/assets/39454841/fdc4dc49-066b-482b-ac2d-f961e7dcdc77">

腾讯云翻译每月有一定的免费额度，足够个人使用，DashPlayer 会采用缓存和懒加载等技术尽可能节省您的额度。

