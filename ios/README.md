# DashPlayer iOS

配套桌面端的手机客户端。连到电脑上 DashPlayer 的手机访问服务（默认端口 27182），
读最近播放、放视频、按句切字幕、点词查词，进度写回桌面端。

和网页版功能对齐，界面按 iOS 重做：原生导航、表单式设置、锁屏控制、后台播放。

## 环境

- Xcode 27（iOS 17 及以上）
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)：`brew install xcodegen`

工程文件由 `project.yml` 生成，不提交 `DashPlayerMobile.xcodeproj`。

## 生成工程并编译

```bash
cd ios
xcodegen generate
open DashPlayerMobile.xcodeproj   # 想用 Xcode 跑就用这个
```

命令行出 IPA（不签名，交给侧载工具重签）：

```bash
xcodebuild -project DashPlayerMobile.xcodeproj \
  -scheme DashPlayerMobile \
  -configuration Release -sdk iphoneos \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO

mkdir -p build/ipa/Payload
cp -R build/Build/Products/Release-iphoneos/DashPlayer.app build/ipa/Payload/
cd build/ipa && zip -qry ../DashPlayerMobile.ipa Payload
```

产物在 `ios/build/DashPlayerMobile.ipa`。

## 安装到手机

三种都行：

1. LiveContainer：把 IPA 传到手机，打开 LiveContainer 点右上角 `+` → 「通过IPA文件安装」，
   它用导入的证书重签后运行。
2. SideStore / AltStore：直接装这个 IPA，占一个免费名额，7 天续签。
3. Xcode 直接 Run：Apple ID 免费账号即可，7 天过期，重新 Run 一次。

## 用之前

电脑上 DashPlayer 打开「手机访问」，把设置页显示的地址（形如 `http://192.168.1.5:27182`）
填进 App 首屏。两边在同一个 Wi-Fi 下。装完第一次连不上，先看电脑那边服务有没有起来。

## 结构

```
DashPlayerMobile/
  Sources/
    DashPlayerApp.swift    入口、根视图切换、音频会话
    ServerStore.swift      服务器地址的保存与校验
    APIClient.swift        /api 接口封装
    Models.swift           接口数据模型
    RecentListView.swift   最近播放列表
    WatchScreen.swift      播放页布局
    WatchModel.swift       播放器、字幕索引、循环、查词、进度
    SubtitleIndex.swift    按时间找当前句（移植桌面端 SrtTender）
    WordText.swift         可点单词的文本视图
    ...                    其余为独立小组件
  Assets.xcassets          图标与主题色
  Info.plist               局域网明文访问、后台音频
```

## 图标

AppIcon 取自 `assets/icons/icon.svg`，没有另画。iOS 的图标要铺满整块画布、由系统自己裁圆角，
所以把原来的圆角白底板换成满幅白底，字母和星星原样保留，渲染成 1024×1024 PNG。
主图标改动后按同样方式重新导出一份即可。

## 已知限制

- AVPlayer 只吃 MP4/MOV 这类，MKV、AVI 播不了；和网页版一致，需要先在电脑上「播放修复」转 MP4。
- 没有全屏按钮，横屏就是把界面转过来。
- 没有离线下载，视频是边下边播。
