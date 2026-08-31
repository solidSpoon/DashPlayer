# 安装指南

DashPlayer 目前并没有进行应用签名，因此在安装过程中可能会遭到操作系统的警告，当您遇到安装问题时请阅读下面的指南

## Windows

Windows 提供两种安装包格式，请根据需求选择其一：

| 格式 | 特点 |
|------|------|
| `.exe`（推荐） | 双击即装，无需管理员权限，安装路径固定 |
| `.msi` | 有安装向导，**可以自定义安装路径**，需要管理员权限 |

> **注意：** 两种格式不能混用。如果您之前安装了其中一种，切换到另一种之前请先完全卸载旧版本，否则可能出现多个版本并存的问题。

### 安装步骤

1. 在 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载所需格式的安装包
2. 下载完成后双击安装包进行安装
3. 如果提示不安全，可以点击 `更多信息` -> `仍要运行` 进行安装
4. 开始使用吧！

### 故障排除

#### 双击 `.exe` 后提示 "Installation has failed"

弹窗里的 `Open Setup Log` 按钮有时打不开（安装器在很早阶段失败时还来不及生成日志），这是正常现象。可以按下面的顺序排查：

1. **确认没有残留进程占用**：打开任务管理器，结束所有 `DashPlayer` 相关进程后重试
2. **清理旧版本残留**：如果你之前安装过 DashPlayer，先卸载旧版本，再删除 `%LocalAppData%\DashPlayer` 目录后重试
3. **检查杀毒软件拦截记录**：未签名应用的安装器可能被杀毒软件静默拦截，将其加入白名单后重试
4. **查看安装日志**：用文件管理器打开 `%LocalAppData%\SquirrelTemp`，把 `SquirrelSetup.log` 里最后一段报错贴到 [issue](https://github.com/solidSpoon/DashPlayer/issues) 中
5. **换用 `.msi` 安装包**：MSI 与 EXE 是两套独立的安装方式，EXE 安装失败时 MSI 通常可以正常安装

#### 安装成功后无法启动

若安装完成但应用无法启动，请携带 `%LocalAppData%\DashPlayer` 下的日志文件[提交 issue](https://github.com/solidSpoon/DashPlayer/issues)。

## MacOS

### 手动安装

1. 去 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载对应芯片以 `.dmg` 的安装包
2. 下载完成后双击安装包进行安装，然后将 `DashPlayer` 拖动到 `Applications` 文件夹。
3. 开始使用吧！

### 故障排除

由于 DashPlayer 目前没有 Apple 开发者签名，macOS 会将其识别为未验证的应用，可能会阻止打开或提示文件已损坏。这是正常现象，按照以下方法操作即可正常使用。

#### "DashPlayer" can't be opened because the developer cannot be verified.

<p align="center">
  <img width="300" alt="image" src="https://user-images.githubusercontent.com/39454841/226151784-b6ed3e65-2c0a-4ad0-93eb-57d45108e1ba.png"/>
</p>

点击 `Cancel` 按钮，然后去 `设置` -> `隐私与安全性` 页面，点击 `仍要打开` 按钮，然后在弹出窗口里点击 `打开`
按钮即可，以后打开 `DashPlayer` 就再也不会有任何弹窗告警了 🎉

| ![img](https://user-images.githubusercontent.com/39454841/226151875-03f79da9-45fc-4c0d-9d12-8cc9666ff904.png){width="200"} | ![img](https://user-images.githubusercontent.com/39454841/226151917-6b59f228-2bb9-4f12-9584-32bca9699d8e.png){width="200"} |
|----------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|

#### XYZ is damaged and can't be opened. You should move it to the Trash

XYZ 已损坏，无法打开。您应该将其移动到垃圾桶中。

在控制台中输入以下命令：

```bash
xattr -c <path/to/application.app>
```

示例：

```bash
xattr -c /Applications/DashPlayer.app
```
