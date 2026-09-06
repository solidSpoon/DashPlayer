<p align="center">
<img src="https://user-images.githubusercontent.com/39454841/226364979-9c96a838-aa43-4b70-89d8-8ea83d59fc0f.png" width="40%" />
</p>

<p align="center">
  <a href="LICENSE" target="_blank">
    <img alt="AGPL-3.0 license" src="https://img.shields.io/github/license/solidSpoon/DashPlayer.svg" />
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

DashPlayer 的目标就是方便你观看英文视频。无论你是想泛听，还是想一句句精听，亦或是想要查询生词，DashPlayer 精心打磨的手感让您始终心情愉悦。

- **双语字幕**：支持机器翻译字幕。只展示中文/英文，或者全部隐藏都可以。
- **按字幕跳转：** 重复当前句，或者跳到上一句，怎么跳都可以。
- **查词查询**：鼠标悬停生词可快速查询，不打断学习进程。
- **AI 整句学习**：长难句的语法、词组、生词一键拆解，还支持自由提问。
- **词汇工坊**：自动截取包含生词的视频片段，集中复习真实语境。
- **可调整界面尺寸：** 界面尺寸可调，适应不同屏幕和学习场景。
- **记录播放位置：** 自动记录上次播放位置，方便下次接着学习。
- **蓝牙遥控操作：** 支持蓝牙遥控，让你随时调整音量、跳转视频，学习更轻松！
- **夜间模式**：内置暗色/亮色主题，适配您的学习环境。
- **AI 字幕**：内置本地语音识别模型，无需配置任何 API，即可为没有字幕的视频生成字幕。
- **长视频切分**：看一段删一段，没有压力。

## 屏幕截图

主页展示播放历史：

![image](https://github.com/solidSpoon/DashPlayer/assets/39454841/1fccf3be-1384-4d6e-9af5-96f78f5da688)


按字幕跳转，重复当前句，还可以倍速播放

https://github.com/solidSpoon/DashPlayer/assets/39454841/d36a0701-3cd1-42df-9012-4f4d81779daf

极速查词，点击还能发音

https://github.com/solidSpoon/DashPlayer/assets/39454841/66f2be0a-7098-4899-a237-f2951094b921

内置视频切分、AI 生成字幕、修复播放问题等诸多功能：

![image](https://github.com/solidSpoon/DashPlayer/assets/39454841/96476645-317e-424b-8952-3eac0b4dd7aa)

AI 整句学习功能：

![image](https://github.com/solidSpoon/DashPlayer/assets/39454841/2597f6a1-2903-4652-9431-8327acdbe9be)

整句学习功能演示

https://github.com/solidSpoon/DashPlayer/assets/39454841/c243796b-7a4c-400c-99c9-817972238663


右键可使用常用功能

https://github.com/solidSpoon/DashPlayer/assets/39454841/55956719-306f-4046-a8b4-243f79029d26


在字幕上点击并滑动可以循环播放多行字幕

https://github.com/user-attachments/assets/82b2cb36-a44b-4729-9b4f-3a440c6deb40


---

# 安装指南

DashPlayer 目前并没有进行应用签名，因此在安装过程中可能会遭到操作系统的警告，当您遇到安装问题时请阅读下面的指南

## Windows

Windows 提供两种安装包格式，请根据需求选择其一：

| 格式 | 特点 |
|------|------|
| `.exe`（推荐） | 双击即装，无需管理员权限 |
| `.msi` | 有安装向导，**可以自定义安装路径**，需要管理员权限 |

1. 在 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载所需格式的安装包
2. 下载完成后双击安装包进行安装
3. 如果提示不安全，可以点击 `更多信息` -> `仍要运行` 进行安装
4. 开始使用吧！

## MacOS

### 手动安装

1.  去 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载对应芯片以 `.dmg` 的安装包：Apple Silicon（M 系列芯片）选择 `arm64` 版本，Intel 芯片选择 `x64` 版本
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

## Linux

Linux 提供 `.deb` 和 `.rpm` 两种安装包格式，请根据发行版选择：

- `.deb`：适用于 Debian、Ubuntu 及其衍生发行版，下载后使用 `sudo dpkg -i <安装包>` 或图形界面安装
- `.rpm`：适用于 Fedora、openSUSE、RHEL 及其衍生发行版，下载后使用 `sudo rpm -i <安装包>` 或图形界面安装

---
## Linux

### AppImage（免安装，推荐）

1. 在 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载以 `.AppImage` 结尾的安装包
2. 添加可执行权限后直接运行：

```bash
chmod +x DashPlayer-*.AppImage
./DashPlayer-*.AppImage
```

3. 开始使用吧！

> 如果启动时提示缺少 FUSE（`dlopen(): error loading libfuse.so.2`），请安装 `libfuse2`（Debian/Ubuntu：`sudo apt install libfuse2`），或改用 `./DashPlayer-*.AppImage --appimage-extract-and-run` 运行。

### deb / rpm

1. 在 [Latest Release](https://github.com/solidSpoon/DashPlayer/releases/latest) 页面下载 `.deb`（Debian/Ubuntu 系）或 `.rpm`（Fedora/RHEL/openSUSE 系）安装包
2. 使用系统包管理器安装：

```bash
# Debian/Ubuntu 系
sudo dpkg -i DashPlayer-*.deb

# Fedora/RHEL 系
sudo rpm -i DashPlayer-*.rpm
```

3. 开始使用吧！

---
# 使用指南

> 字幕生成为内置本地模型，开箱即用；AI 功能（字幕翻译、查单词、整句学习）需配置 OpenAI 接口，具体方法及详细指南请看[Wiki](https://solidspoon.xyz/DashPlayer/home.html)

## 如何播放视频

DashPlayer 支持常见的视频格式、音频格式以及 srt、vtt、ass 字幕格式。

- 使用 `打开文件` 可选择视频和字幕文件
- 使用 `打开文件夹` 可选择视频所在文件夹

### 想播放在线视频？

DashPlayer 专注本地视频播放，您可以用下载工具将视频保存到本地后打开：

- Windows 平台：[Internet Download Manager (IDM)](https://www.internetdownloadmanager.com/)
- macOS 平台：[Downie](https://software.charliemonroe.net/downie/)

### 没有字幕文件怎么办?

DashPlayer 内置了本地语音识别模型（Parakeet v3），在设置中心下载模型后，即可一键为视频生成字幕，无需配置任何 API，也不产生费用。

下面推荐几个第三方生成字幕的软件，您也可以使用：

- [Memo](https://memo.ac/) Windows/macOS
- [MacWhisper](https://goodsnooze.gumroad.com/l/macwhisper) macOS


## 如何控制播放
### 通过鼠标/键盘快捷键控制播放

DashPlayer 默认快捷键如下

- 上一句：“←” 或 “a”
- 下一句：“→” 或 “d”
- 重复当前句：“↓” 或 “s”
- 暂停/播放：“上” 或 “w” 或 “space”
- 单句重播模式：“r”（repeat）
- 自动暂停：“u”（播完一句自动停）
- 展示/隐藏英文字幕：“e”（english）
- 展示/隐藏中文字幕：“c”（chinese）
- 展示/隐藏中英文字幕：“b”（both）
- 展示/隐藏逐词字幕：“l”（level）
- 切换主题：“t”（theme）
- 切换播放速度：“p”（playback rate）
- 调整当前句字幕开始时间，提前 / 延后 0.2 秒：“z” / “x”
- 调整当前句字幕结束时间，提前 / 延后 0.2 秒：“n” / “m”
- 清除字幕时间微调：“v”
- 收藏当前片段：“Shift + L”
- 打开控制面板：“Shift + P”
- 打开 AI 对话（整句学习）：“?” 或 “/”

具体快捷键可在设置中心自定义，详见[文档](https://solidspoon.xyz/DashPlayer/Config-Shortcut.html)

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

## AI 功能配置

DashPlayer 的 AI 功能——字幕翻译、查单词、整句学习——只需配置 OpenAI 接口即可全部使用，首次使用前按文档配置好 API 密钥即可。

实际使用下来价格比较便宜；字幕生成本地即可完成，无需配置。具体配置详见[文档](https://solidspoon.xyz/DashPlayer/home.html)。



## 🌐 Web Resources & Interactive Index
- [SUDO TETROID DAILY](https://quizverses.github.io/sudo-tetroid-daily.html)
- [DRAW TO CRUSH MONSTER GAME](https://studyplaying.github.io/draw-to-crush-monster-game.html)
- [SPACE SHIFT](https://studyquests.github.io/space-shift.html)
- [KITTY MATCH 3 PUZZLE GAME](https://studyquests.github.io/kitty-match-3-puzzle-game.html)
- [FOOD CARD SORT](https://studyquests.github.io/food-card-sort.html)
- [STICKMAN SHOOTER BROS](https://studyquests.pages.dev/stickman-shooter-bros.html)
- [4 HEXA](https://quizverses-9d2f2.web.app/4-hexa.html)
- [HOME ISLAND](https://quizverses.pages.dev/home-island.html)
- [MEMEVOIO](https://studyquests.github.io/memevoio.html)
- [DOODLE FOOTBALL](https://studyquests.github.io/doodle-football.html)
- [RAGDOLL JUMP](https://studyquests.pages.dev/ragdoll-jump.html)
- [BLUE HEDGEHOG HILL DASH RIDE](https://quizverses.github.io/blue-hedgehog-hill-dash-ride.html)
- [CATEGORY TOWER DEFENSE118](https://quizverses.pages.dev/category-tower-defense118.html)
- [LULUS FASHION WORLD](https://studyquests.github.io/lulus-fashion-world.html)
- [CATEGORY CASUAL 7](https://studyplaying.github.io/category-casual-7.html)
- [MY PERFECT FARM](https://studyplaying.github.io/my-perfect-farm.html)
- [BUS DRIVER SIMULATOR 3D](https://studyquests.github.io/bus-driver-simulator-3d.html)
- [MINI GAMES CASUAL COLLECTION](https://studyquests.pages.dev/mini-games-casual-collection.html)
- [PIXEL PATH](https://quizverses.github.io/pixel-path.html)
- [SQUARE WORLD 3D](https://iskillplay.web.app/square-world-3d.html)
- [KIOMET COM](https://quizverses.pages.dev/kiomet-com.html)
- [LABUBA HALLOWEEN INFESTATION](https://themindplay.github.io/labuba-halloween-infestation.html)
- [CATEGORY ARENA255](https://iskillplay.web.app/category-arena255.html)
- [INDEX2](https://quizverses.pages.dev/index2.html)
- [HIGH SPEED CRAZY BIKE](https://studyplayings.web.app/high-speed-crazy-bike.html)
- [TUNNEL ROAD](https://studyplaying.github.io/tunnel-road.html)
- [FREDDYS NIGHTMARES RETURN HORROR NEW YEAR](https://themindplaying.web.app/freddys-nightmares-return-horror-new-year.html)
- [WORD SOLITAIRE](https://thequizzone.pages.dev/word-solitaire.html)
- [SPACE PIN MASTER PULL PIN PUZZLE](https://learnquester.pages.dev/space-pin-master-pull-pin-puzzle.html)
- [CATEGORY TOWER DEFENSE](https://iskillquest.pages.dev/category-tower-defense.html)
- [CATEGORY CAR](https://skillplay.github.io/category-car.html)
- [CATEGORY RAMMERHEAD](https://themindplays.pages.dev/category-rammerhead.html)
- [CATEGORY CASUAL 2](https://themindplay.pages.dev/category-casual-2.html)
- [STELLAR MINES SPACE MINER](https://iskillplay.web.app/stellar-mines-space-miner.html)
- [MY CASTLE MERGE STORY](https://themindplays.pages.dev/my-castle-merge-story.html)
- [SQUID CANDY CHALLENGE](https://thequizzone.pages.dev/squid-candy-challenge.html)
- [LITTLE DENTIST DASH](https://themindskillplayplay.pages.dev/little-dentist-dash.html)
- [CATEGORY CASUAL 8](https://themindplays.pages.dev/category-casual-8.html)
- [ITALIAN ANIMAL ALCHEMY BRAINROT](https://quizverses.github.io/italian-animal-alchemy-brainrot.html)
- [PRINCESS RESCUE SAVE GIRL](https://themindskillplayplay.pages.dev/princess-rescue-save-girl.html)
- [CLASH RUN](https://iskillplay.web.app/clash-run.html)
- [CATEGORY ALIEN34](https://iskillquest.pages.dev/category-alien34.html)
- [1945 AIR FORCE SPACE SHOOTER](https://thelearnquester.web.app/1945-air-force-space-shooter.html)
- [TAILOR STYLIST FASHION DIARY](https://thequizzone.pages.dev/tailor-stylist-fashion-diary.html)
- [SINGLE LINE DRAWING PUZZLE](https://studyquests.github.io/single-line-drawing-puzzle.html)
- [CATEGORY RAGDOLL57](https://themindplays.pages.dev/category-ragdoll57.html)
- [DART HERO](https://studyplayings.pages.dev/dart-hero.html)
- [CATEGORY SHOOTER 2](https://quizverses.pages.dev/category-shooter-2.html)
- [BROTHERFOLLOW ME MERGE MEN](https://iskillplay.web.app/brotherfollow-me-merge-men.html)
- [PIPE CONNECT](https://studyquests.github.io/pipe-connect.html)
- [COLOR WOOD ANIMAL JAM](https://themindplay.github.io/color-wood-animal-jam.html)
- [CATEGORY RACING DRIVING 2](https://thelearnquester.web.app/category-racing-driving-2.html)
- [CATEGORY HORROR90](https://studyplaying.github.io/category-horror90.html)
- [CATEGORY ROGUELIKE38](https://themindplays.pages.dev/category-roguelike38.html)
- [HERO PIPE](https://studyquests.github.io/hero-pipe.html)
- [HELICOPTER BATTLE STEVE 2 PLAYER](https://studyplayings.web.app/helicopter-battle-steve-2-player.html)
- [PEOPLE PLAYGROUND 3D](https://theskillquest.pages.dev/people-playground-3d.html)
- [CATEGORY WEBGAME](https://theskillquest.pages.dev/category-webgame.html)
- [ITALIAN BRAINROT BIKE RUSH](https://learnquesters.pages.dev/italian-brainrot-bike-rush.html)
- [WORM OUT BRAIN TEASER GAMES](https://quizverses.github.io/worm-out-brain-teaser-games.html)
- [CATEGORY MOUSE1 697](https://themindplays.pages.dev/category-mouse1-697.html)
- [IDOL LIVESTREAM DOLL DRESS UP](https://iskillplay.web.app/idol-livestream-doll-dress-up.html)
- [SKINFLUENCER BEAUTY ROUTINE](https://iskillquest.pages.dev/skinfluencer-beauty-routine.html)
- [CATEGORY MISSION206](https://themindplay.pages.dev/category-mission206.html)
- [PAINT RACE](https://thequizzone.pages.dev/paint-race.html)
- [WATER SORT](https://learnquester.pages.dev/water-sort.html)
- [STACK N SORT](https://studyquests.github.io/stack-n-sort.html)
- [CATEGORY SKILL256](https://iskillplay.web.app/category-skill256.html)
- [MAX CRUSHER CRAZY DESTRUCTION AND CAR CRASHES](https://studyquests.pages.dev/max-crusher-crazy-destruction-and-car-crashes.html)
- [TIC TAC TOE MATCH THREE](https://studyplayings.web.app/tic-tac-toe-match-three.html)
- [CATEGORY STICKMAN](https://themindplays.pages.dev/category-stickman.html)
- [CATEGORY BOARDGAMES](https://themindplays.pages.dev/category-boardgames.html)
- [SNOWBOARD GAME PARTY](https://studyquests.pages.dev/snowboard-game-party.html)
- [CATEGORY BASKETBALL32](https://themindplays.pages.dev/category-basketball32.html)
- [ICE CREAM INC](https://thelearnquesters.pages.dev/ice-cream-inc.html)
- [BACKFLIP MASTER](https://learnquester.pages.dev/backflip-master.html)
- [COLOR IT IN 3D](https://quizverses.github.io/color-it-in-3d.html)
- [CATEGORY MATCH 3 3](https://quizverses.github.io/category-match-3-3.html)
- [DROP BRICKS BREAKER](https://iskillplay.web.app/drop-bricks-breaker.html)
- [BACKGAMMON DUEL](https://iskillquest.pages.dev/backgammon-duel.html)
- [MR BOUNCE](https://studyplayings.pages.dev/mr-bounce.html)
- [CATEGORY 2048](https://thelearnquester.web.app/category-2048.html)
- [HIDDEN OBJECT STREET OF SECRETS](https://themindskillplayplay.pages.dev/hidden-object-street-of-secrets.html)
- [STREET RACING MOTO DRIFT](https://iskillplay.web.app/street-racing-moto-drift.html)
- [MICKEY RUN ADVENTURE GAME](https://thelearnquesters.pages.dev/mickey-run-adventure-game.html)
- [BACTERIA LIFE DEATH](https://studyplayings.web.app/bacteria-life-death.html)
- [DRIVE RACE CRASH](https://thequizzone.pages.dev/drive-race-crash.html)
- [DESIGN WITH ME SUPERHERO TUTU OUTFITS](https://theskillquest.pages.dev/design-with-me-superhero-tutu-outfits.html)
- [CATEGORY CASUAL](https://themindplays.pages.dev/category-casual.html)
- [JEWEL COLORING](https://studyquests.github.io/jewel-coloring.html)
- [CATEGORY BASKETBALL 3](https://themindplays.pages.dev/category-basketball-3.html)
- [SWIM GOOD](https://studyplaying.github.io/swim-good.html)
- [CATEGORY MAHJONG 2](https://studyplaying.github.io/category-mahjong-2.html)
- [ULTRAHERO VS MONSTERS ROYALE BATTLE](https://theskillquest.pages.dev/ultrahero-vs-monsters-royale-battle.html)
- [OFFLINE FPS ROYALE](https://studyplayings.pages.dev/offline-fps-royale.html)
- [MEME CHALLENGEIO](https://iskillplay.web.app/meme-challengeio.html)
- [AMONG SQUID CHALLENGE ONLINE](https://studyquests.pages.dev/among-squid-challenge-online.html)
- [PICKLE BALL CLASH](https://studyquests.github.io/pickle-ball-clash.html)
- [STICKMAN TROLL THIEF PUZZLE](https://theskillquest.pages.dev/stickman-troll-thief-puzzle.html)
- [CATEGORY SOLITAIRE](https://learnquesters.pages.dev/category-solitaire.html)
- [SUDOKU PINGAMES](https://themindplay.github.io/sudoku-pingames.html)
- [RELAXING CUBES AND CAMPFIRE](https://learnquesters.pages.dev/relaxing-cubes-and-campfire.html)
- [SEA MATCH](https://quizverses-9d2f2.web.app/sea-match.html)
- [JAILBREAK ASSAULT](https://studyquests.pages.dev/jailbreak-assault.html)
- [GIRLY PUZZLE](https://thelearnquesters.pages.dev/girly-puzzle.html)
- [BELOTE 3IN1](https://studyquests.github.io/belote-3in1.html)
- [HOSPITAL INC](https://thelearnquester.web.app/hospital-inc.html)
- [MATCH DREAM GARDEN](https://themindplay.github.io/match-dream-garden.html)
- [GEOMETRY LITE](https://iskillplay.web.app/geometry-lite.html)
- [FORMULA RACERS](https://theskillquest.pages.dev/formula-racers.html)
- [AGARIO](https://studyquests.pages.dev/agario.html)
- [SNOW BALL RACING MUTLIPLAYER](https://iskillquest.pages.dev/snow-ball-racing-mutliplayer.html)
- [CATEGORY SURVIVAL366](https://themindplays.pages.dev/category-survival366.html)
- [CATEGORY BATTLE524](https://themindplays.pages.dev/category-battle524.html)
- [TANK CHALLENGE](https://learnquester.github.io/tank-challenge.html)
- [CAT ESCAPE](https://iskillplay.web.app/cat-escape.html)
- [CATEGORY THINKY](https://thelearnquesters.pages.dev/category-thinky.html)
- [HEXA SORT MASTER](https://themindskillplayplay.pages.dev/hexa-sort-master.html)
- [REAL FREEKICK 3D](https://thelearnquesters.pages.dev/real-freekick-3d.html)
- [SITEMAP](https://themindzone.pages.dev/sitemap.html)
- [ARROW LEGEND](https://iskillquest.pages.dev/arrow-legend.html)
- [CATEGORY BOOKMARKLETS](https://themindplays.pages.dev/category-bookmarklets.html)
- [CATEGORY BRAIN260](https://themindplays.pages.dev/category-brain260.html)
- [CATEGORY SOLITAIRE27](https://iskillplay.web.app/category-solitaire27.html)
- [CATEGORY SIMULATION](https://themindplay.pages.dev/category-simulation.html)
- [CATEGORY CARE](https://learnquester.github.io/category-care.html)
- [HEXA STACK](https://studyquests.pages.dev/hexa-stack.html)
- [CATEGORY MMO25](https://themindzone.pages.dev/category-mmo25.html)
- [TRI PEAKS EMERLAND SOLITAIRE](https://thelearnquester.web.app/tri-peaks-emerland-solitaire.html)
- [CATEGORY ARENA255](https://quizverses.pages.dev/category-arena255.html)
