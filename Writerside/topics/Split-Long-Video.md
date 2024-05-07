# 分割长视频

DashPlayer 本身对长视频播放做了优化，即使您打开十数个小时的视频也能流畅播放。但是我发现将长视频分段后观看起来会更容易，您可以看一点删除一点，看起来没有心里负担。

在 Split 页面，您可以对长视频切割，生成多个短视频，放在原视频的同名文件夹下。

## 如何使用

这个功能需要您输入 `时间戳 标题` 格式的文本，一般在视频的评论区或者简介中会有这样的格式。

在文本输入框中输入时间戳格式的文本，例如 `01:23:45` 代表 1 小时 23 分钟 45 秒。


![split-video.png](split-video.png)

您输入后可在右边的预览区域看到识别结果，点击 `分割` 按钮即可生成短视频。

![split-video-preview.png](split-video-preview.png)

为了方便您上手，这个界面下方有两个按钮，分别为：

- 加载示例配置
- 使用 AI 修正您输入的文本

## 示例

这个[视频](https://www.youtube.com/watch?v=bMknfKXIFA8)的长度为 12 小时，一次性看完可能会有些吃力。 
但是在视频的简介中有时间戳格式的文本。这里截取部分内容如下：

```text
0:00 Introduction
5:27 What we’ll learn
7:03 Fun facts about react
9:08 First react
17:13 First React Practice 
19:04 Local Setup (the quick way)
21:03 Why React?
30:38 JSX
40:19 Goodbye, CDNs!
44:27 Thought Experiment
49:57 Project 1 Part 1 - MarkUp
57:44 Pop Quiz!
59:55 Components
1:33:07 Setup a local React environment Create React App
1:33:53 Babel, Bundler, Build
1:34:47 Create React app
1:35:56 How to install Node.js
1:36:06 Use nvm or nvm-windows
1:36:33 How to install Node.js
1:41:30 Styles and images with CRA
1:46:03 Quick Mental Outline of Project 
1:50:00 Quick Figma Walkthrough
... 余下部分省略
```

复制这段文本到 Split 页面的文本输入框中，整理后的时间戳如下：

```text
00:00:00 Introduction
00:05:27 What we’ll learn
00:07:03 Fun facts about react
00:09:08 First react
00:17:13 First React Practice 
00:19:04 Local Setup (the quick way)
00:21:03 Why React?
00:30:38 JSX
00:40:19 Goodbye, CDNs!
00:44:27 Thought Experiment
00:49:57 Project 1 Part 1 - MarkUp
00:57:44 Pop Quiz!
00:59:55 Components
01:33:07 Setup a local React environment Create React App
01:33:53 Babel, Bundler, Build
01:34:47 Create React app
01:35:56 How to install Node.js
01:36:06 Use nvm or nvm-windows
01:36:33 How to install Node.js
01:41:30 Styles and images with CRA
01:46:03 Quick Mental Outline of Project 
01:50:00 Quick Figma Walkthrough
... 余下部分省略
```

这样您就可以将这个视频分割成多个小视频了。
