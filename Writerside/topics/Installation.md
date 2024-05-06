# 安装指南

DashPlayer 目前并没有进行应用签名，因此在安装过程中可能会遭到操作系统的警告，当您遇到安装问题时请阅读下面的指南

## Windows

1. 在 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载以 `.exe` 结尾的安装包
2. 下载完成后双击安装包进行安装
3. 如果提示不安全，可以点击 `更多信息` -> `仍要运行` 进行安装
4. 开始使用吧！

## MacOS

### 手动安装

1. 去 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载对应芯片以 `.dmg` 的安装包
2. 下载完成后双击安装包进行安装，然后将 `DashPlayer` 拖动到 `Applications` 文件夹。
3. 开始使用吧！

### 故障排除

#### "DashPlayer" can’t be opened because the developer cannot be verified.

<p align="center">
  <img width="300" alt="image" src="https://user-images.githubusercontent.com/39454841/226151784-b6ed3e65-2c0a-4ad0-93eb-57d45108e1ba.png"/>
</p>

点击 `Cancel` 按钮，然后去 `设置` -> `隐私与安全性` 页面，点击 `仍要打开` 按钮，然后在弹出窗口里点击 `打开`
按钮即可，以后打开 `DashPlayer` 就再也不会有任何弹窗告警了 🎉

| ![img](https://user-images.githubusercontent.com/39454841/226151875-03f79da9-45fc-4c0d-9d12-8cc9666ff904.png){width="200"} | ![img](https://user-images.githubusercontent.com/39454841/226151917-6b59f228-2bb9-4f12-9584-32bca9699d8e.png){width="200"} |
|----------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|

#### XYZ is damaged and can’t be opened. You should move it to the Trash

XYZ 已损坏，无法打开。您应该将其移动到垃圾桶中。

在控制台中输入以下命令：

```bash
xattr -c <path/to/application.app>
```

示例：

```bash
xattr -c /Applications/DashPlayer.app
```
