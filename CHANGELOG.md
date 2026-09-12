# Changelog

All notable changes to this project are documented in this file.

## [6.12.0](https://github.com/solidSpoon/DashPlayer/compare/v6.11.2...v6.12.0) (2026-09-12)


### Features

* 云端 AI 接入支持厂商预设与多种 API 格式 ([5d45565](https://github.com/solidSpoon/DashPlayer/commit/5d4556520d3edc1617c791d697b7d0e60d582241))
* 云端 AI 接入支持厂商预设与多种 API 格式 ([59a5bc2](https://github.com/solidSpoon/DashPlayer/commit/59a5bc24ecb764de20730183f177db9f99f31c4e))
* 云端接口地址改为完整 base URL 直存并迁移历史配置 ([87b72fd](https://github.com/solidSpoon/DashPlayer/commit/87b72fd0129b5e6c4aa7fb47668ee23ef70dfaa8))
* 修复名单持久化到数据库、按组展示、整批探测与强制修复 ([0ac29b0](https://github.com/solidSpoon/DashPlayer/commit/0ac29b07ca9e966e43df97b43d3f62fb9f188a70))
* 修复记录持久化到 dp_repair_task，修复页面改为读记录表 ([61ad921](https://github.com/solidSpoon/DashPlayer/commit/61ad921ca1a1cc1cb87a0f6ccf4521db4fc3e192))
* 修复页面接管从播放页发起的修复任务 ([b3b440a](https://github.com/solidSpoon/DashPlayer/commit/b3b440a5b9aebe5dc25b80997b336873d0b3c745))
* 厂商预设改为弹窗选择且只回填接口地址与 API 类型 ([5f89854](https://github.com/solidSpoon/DashPlayer/commit/5f89854e6fd51639e3a8aa9b092ed12ceae55e8f))
* 句型学习报错中文化并给出重配引导 ([37bdf5a](https://github.com/solidSpoon/DashPlayer/commit/37bdf5a92096ad42fdd69aa1f5f645783a5847a6))
* 字幕可疑检测与生成字幕引导提示 ([a22c938](https://github.com/solidSpoon/DashPlayer/commit/a22c938dad22cdb6adac7a7a27f0853650f02bd8))
* 字幕可疑检测与生成字幕引导提示 ([a9d1b4b](https://github.com/solidSpoon/DashPlayer/commit/a9d1b4bd3a3aa6c6cb9e458b569f0aac74ce0617))
* 接口地址拆成基础地址与版本路径两个输入框 ([723cf91](https://github.com/solidSpoon/DashPlayer/commit/723cf91523404310684cea26b7891f2b2cb1dc2b))
* 整句学习句带出中文译文，意群改用主舞台下划线标记 ([9c6c61b](https://github.com/solidSpoon/DashPlayer/commit/9c6c61b12b802d685e45809ca58c524f482d4999))
* 整句学习页重做，解析按需触发并接入本地词典选词 ([e458713](https://github.com/solidSpoon/DashPlayer/commit/e458713bdcae8efb59c536e0e0e01fc2916c0efe))
* 整句讲解不可用时置灰解析与对话入口 ([45e3299](https://github.com/solidSpoon/DashPlayer/commit/45e3299dc12e5d3954c5da1844035902d5ea8ebe))
* 新增「修复播放问题」一键修复流程，并校验修复产物确实可播 ([b261b08](https://github.com/solidSpoon/DashPlayer/commit/b261b080e424ca73089bde9c0a20a92a31945cd9))
* 新增「修复播放问题」一键修复流程，并校验修复产物确实可播 ([6979625](https://github.com/solidSpoon/DashPlayer/commit/697962562435e97ed784615603bb2f4ac3ce8277))
* 新增云端接口地址迁移，把老版本的 /v1 写入用户配置 ([2760870](https://github.com/solidSpoon/DashPlayer/commit/27608702513aff7a46bbf03754a9d48cdc0034ba))
* 新增播放能力学习缓存，跨平台白名单误判可自愈 ([a87625d](https://github.com/solidSpoon/DashPlayer/commit/a87625def031bbb505a5146f4ce2026475a44908))
* 本地字幕翻译改为源文锚定填槽解码 ([9635460](https://github.com/solidSpoon/DashPlayer/commit/9635460d3b0ec977448b3aa7b31b38ab746b30dd))
* 本地字幕翻译缓存键编入策略版本 ([a262ccf](https://github.com/solidSpoon/DashPlayer/commit/a262ccfc4d3a0c1e66ee14729f4331c636729a39))
* 第二地址框改为完整请求路径覆盖 ([011d04c](https://github.com/solidSpoon/DashPlayer/commit/011d04c3d7b756e0633bc22a1e9cb72baf671ab6))


### Bug Fixes

* 云端模型占用改为按引擎配置现算并实时反馈 ([36a3e94](https://github.com/solidSpoon/DashPlayer/commit/36a3e942a686c185be7b3652ed4b5414603c9527))
* 修复产物先写临时文件再改名，避免写在中途的产物被播放与探测选中 ([c6030ed](https://github.com/solidSpoon/DashPlayer/commit/c6030ed1307403836fc0efc3012769e67eeca971))
* 修复名单添加文件时放行全部媒体格式，不再只让选 mkv ([ff4fbab](https://github.com/solidSpoon/DashPlayer/commit/ff4fbab242ebea484dd3a9681f11d13a007869bb))
* 修复播放任务竞态并校验修复名单路径 ([2af11f7](https://github.com/solidSpoon/DashPlayer/commit/2af11f7ea6b4357f75b109c82576b4c84f407e40))
* 修复播放任务竞态并校验修复名单路径 ([35b98a0](https://github.com/solidSpoon/DashPlayer/commit/35b98a09a55761b22543ecb6209c4a3934363e89))
* 修复页面不再给纯音频文件请求缩略图 ([c96621e](https://github.com/solidSpoon/DashPlayer/commit/c96621e09608d2c4e6da385b86e53ae9b2ec3bcc))
* 停止生成后丢弃迟到的流片段，避免写入已关闭的流 ([552d44e](https://github.com/solidSpoon/DashPlayer/commit/552d44ecb656c17663994cf011bf54dff22373ca))
* 同一媒体的修复并发发起时合并为同一次任务 ([ee7e0bc](https://github.com/solidSpoon/DashPlayer/commit/ee7e0bc3488c7cc682e3b0e3d9a678d6067b96c6))
* 圆点标记不再让转录按钮图标回退默认尺寸 ([d7911dd](https://github.com/solidSpoon/DashPlayer/commit/d7911dd6afbdd0178efe47e7aeedd467826dc32f))
* 填槽译文槽排除控制字符并按源文推导槽上限 ([3213bc2](https://github.com/solidSpoon/DashPlayer/commit/3213bc2452f0d7e56cc5b55c0dc9a12c33108d4e))
* 字幕文件已被删除时按无字幕处理，不再弹错误提示 ([b8e81b9](https://github.com/solidSpoon/DashPlayer/commit/b8e81b95ce4346042e55dde6e0f70b57ab2a92ac))
* 小圆点改锚定按钮右上角，不再贴在图标上 ([532d485](https://github.com/solidSpoon/DashPlayer/commit/532d48520d8bbbb5b0306a77b238ff3238c31044))
* 已取消/失败等记录恢复强制修复入口，取消原因在详情行展示 ([0687df2](https://github.com/solidSpoon/DashPlayer/commit/0687df283d0f296cf18c2d517670c8eb4d7735e8))
* 已有排队或运行中转录任务时不再重复引导生成字幕 ([ab14799](https://github.com/solidSpoon/DashPlayer/commit/ab14799d805975536f58320397362d2e800d4c53))
* 播放验收不再把缺失的解码计数器当作零解码 ([aa14b14](https://github.com/solidSpoon/DashPlayer/commit/aa14b1458f9900dea669a10935f31c24240bd14e))
* 服务设置页开关与模型列表随表单变更即时刷新 ([ca109da](https://github.com/solidSpoon/DashPlayer/commit/ca109da8ac1cfba0583bba74ac5553139612ea73))
* 版本路径输入框改为独占一行 ([f1d324c](https://github.com/solidSpoon/DashPlayer/commit/f1d324cdf3f5748ca39256e89882e5a2fb2e4029))
* 迁移失败不再清空数据库，改为进入恢复模式交给用户决定 ([052be8d](https://github.com/solidSpoon/DashPlayer/commit/052be8dcf862596790b23dd063621d50e1c56399))
* 迁移失败不再清空数据库，改为进入恢复模式交给用户决定 ([a1ab16d](https://github.com/solidSpoon/DashPlayer/commit/a1ab16dca23b3e9f9f8b7b29949157c8ee67d138))
* 连通性测试为推理模型留出正文输出预算 ([2daa66f](https://github.com/solidSpoon/DashPlayer/commit/2daa66f2c48684500b602c71765339328184fc32))

## [6.11.2](https://github.com/solidSpoon/DashPlayer/compare/v6.11.1...v6.11.2) (2026-09-10)


### Bug Fixes

* 修复首次使用引导被启动门槛覆盖而永不展示 ([1d4e805](https://github.com/solidSpoon/DashPlayer/commit/1d4e805e2bd1686cbd0efca1dce5b67893fe208b))
* 修复首次使用引导被启动门槛覆盖而永不展示 ([88bc316](https://github.com/solidSpoon/DashPlayer/commit/88bc316886509baa719deecc437bb0bd9ff624f3))

## [6.11.1](https://github.com/solidSpoon/DashPlayer/compare/v6.11.0...v6.11.1) (2026-09-10)


### Bug Fixes

* 修复打包版启动崩溃（scoped 依赖丢失 + 原生动态库未解包）并按平台裁剪原生库 ([56d20a4](https://github.com/solidSpoon/DashPlayer/commit/56d20a4ba25aa8a8e450ed7005e3d8e6c9aaa820))
* 打包时解出原生动态库，修复 onnxruntime/sharp 加载失败 ([6365651](https://github.com/solidSpoon/DashPlayer/commit/6365651299b7affc897c6f3d7060fe99306a0133))
* 打包白名单放行 npm scope 目录，修复打包版 scoped 依赖丢失 ([598fba1](https://github.com/solidSpoon/DashPlayer/commit/598fba1a089e69ac6d9fe9f283a2020b12843231))

## [6.11.0](https://github.com/solidSpoon/DashPlayer/compare/v6.10.0...v6.11.0) (2026-09-10)


### Features

* Qwen3.5 本地大模型下载接入国内镜像 ([81eccff](https://github.com/solidSpoon/DashPlayer/commit/81eccff7a65697c587625b98c3bb65bb57aae010))
* whisper.cpp 无核显时静默回退 CPU 并记录 warn 日志 ([1d77d98](https://github.com/solidSpoon/DashPlayer/commit/1d77d981e6b2325d0f9c57b1096fa18769d344c5))
* whisper.cpp 运行时支持本地源码构建兜底 ([84165ce](https://github.com/solidSpoon/DashPlayer/commit/84165ce953ef8752aa0332b0d31f27822faa95aa))
* 云端或本地增强不可用时自动回退到基础资源 ([96d4d53](https://github.com/solidSpoon/DashPlayer/commit/96d4d533ca6121b3fd034346e4a7e2aca66147d6))
* 引导完成后按 GPU 优先切换识别引擎 ([67db347](https://github.com/solidSpoon/DashPlayer/commit/67db347eebd825b8c19f85649fad093a0e68fa7e))
* 引导页下载页补返回按钮，保存位置页重排 ([b93cb6f](https://github.com/solidSpoon/DashPlayer/commit/b93cb6f243ee13b60735494613f9d6b08ade77f5))
* 引导页完成页撒花改用 canvas-confetti ([3ffca06](https://github.com/solidSpoon/DashPlayer/commit/3ffca06218919f2d2d77b5f5827f14906cb7b6c9))
* 引导页恢复三屏：选择保存位置 → 下载运行环境 → 完成页 ([973cd2b](https://github.com/solidSpoon/DashPlayer/commit/973cd2b336432ae370392da53b7c0e6486185297))
* 引导页收敛为一屏全屏下载页，去掉步骤编号 ([8b56045](https://github.com/solidSpoon/DashPlayer/commit/8b56045de334198ccc21fbfcc6b696dbc138a466))
* 引导页改为先选方案、最后统一下载离线模型 ([e3501f0](https://github.com/solidSpoon/DashPlayer/commit/e3501f00a3aa2466e7d2b704b380c26985c618b2))
* 引导页档位建议纳入 GPU 加速探测 ([a3e740e](https://github.com/solidSpoon/DashPlayer/commit/a3e740ee3e0ab3f718fe88ec6e89e6676d141302))
* 引导页第二步补充「内置词典」条目，暗示查词开箱即用 ([6369c35](https://github.com/solidSpoon/DashPlayer/commit/6369c35cf608147ad54bccc6a59d9cb13b9226cd))
* 引导页简化为两步：选位置 + 下载一个离线资源包 ([b9b2f75](https://github.com/solidSpoon/DashPlayer/commit/b9b2f75e6c96b3754e20e6e4861a830b43688c50))
* 引导页翻译配置改为三档方案，并按电脑配置给出建议 ([a988cf6](https://github.com/solidSpoon/DashPlayer/commit/a988cf684eb139f399f53667ef5c7887bb7d2c59))
* 手动下载独立成一页，切换前先中断正在进行的下载 ([44f6a28](https://github.com/solidSpoon/DashPlayer/commit/44f6a2821d23615958dac21cb00efb4ba7eacae1))
* 整句讲解改为单下拉选择，词典文案点明内置词库规模 ([461614d](https://github.com/solidSpoon/DashPlayer/commit/461614d9d5921671fedab5ff91e71a46f5341a82))
* 新增「服务与资源（预览）」设置页，把本地资源合并成一个资源包 ([a1e83c0](https://github.com/solidSpoon/DashPlayer/commit/a1e83c0b9542527e14bd9a3880898831205eafb1))
* 新增首次使用引导，字幕翻译与查词可交叉配置本地或云端引擎 ([4cab6a0](https://github.com/solidSpoon/DashPlayer/commit/4cab6a00ce522852c0b44105203ea70591b22618))
* 本地增强与运行资源包补上资源体积 ([47fdd7c](https://github.com/solidSpoon/DashPlayer/commit/47fdd7c7561e6d151e0a99c24d73c1c7afc46d25))
* 本地增强显示具体模型名，当前使用总览同步带上 ([56fe775](https://github.com/solidSpoon/DashPlayer/commit/56fe77521507b0d0b8e9794d86f25f4875b2e98f))
* 本地增强补上本机硬件提示，说明它对内存与算力的要求 ([be4c762](https://github.com/solidSpoon/DashPlayer/commit/be4c76204518432844a450bada3de870c2f0a6a8))
* 本地字幕识别新增 whisper.cpp 核显引擎并可切换 ([d2424ab](https://github.com/solidSpoon/DashPlayer/commit/d2424ab86215e177090cb4725b7a6bbdb60b7e43))
* 本地字幕识别新增 whisper.cpp 核显引擎并可切换 ([558afbb](https://github.com/solidSpoon/DashPlayer/commit/558afbbebfd30292da1f2f41e156c9a36f2ca357))
* 本地快速翻译模型下载接入国内镜像 ([320eb7e](https://github.com/solidSpoon/DashPlayer/commit/320eb7e36b29391c35a59c2a28ee867022f6ed63))
* 本地轻量翻译模型（OPUS-MT）合入 main ([167f203](https://github.com/solidSpoon/DashPlayer/commit/167f203b0058439723b4bc5bc0dcf7f5880aaec9))
* 模型下载新增国内镜像与可达性探测回退 ([c788267](https://github.com/solidSpoon/DashPlayer/commit/c788267d0c907b327b93def50e870d4571e96c48))
* 模型下载源改用 ModelScope 优先，归档补充 SHA256 校验 ([178ee7b](https://github.com/solidSpoon/DashPlayer/commit/178ee7b13f5c93beebd9c37244a4a15a4ad74a14))
* 翻译风格固定展示实际生效的提示词，非自定义时只读 ([7bafa37](https://github.com/solidSpoon/DashPlayer/commit/7bafa37f74b88c065bf2d95294d44b8a5ca4a978))
* 老用户升级后自动沿用 sherpa-onnx CPU 识别引擎 ([08fd2f1](https://github.com/solidSpoon/DashPlayer/commit/08fd2f196475fc46737b037e3194d496513f8c08))
* 能力图标按当前配置点亮，悬停改用浮层提示 ([78c0d52](https://github.com/solidSpoon/DashPlayer/commit/78c0d52b1aa652fbfb49446fb90fcee9971d26ef))
* 设置页「本地快速翻译」补齐手动下载教程 ([ba479f7](https://github.com/solidSpoon/DashPlayer/commit/ba479f7f62f1bfbd17171205fa40b777caa081e2))
* 设置页新增「当前使用」总览，下拉按档位分组 ([dd1295e](https://github.com/solidSpoon/DashPlayer/commit/dd1295e063d2ceddaeebb4c0dcf31b4729f84854))
* 资源包手动下载教程改成三步式，增强模型与查词文案说清楚定位 ([9a5cd7d](https://github.com/solidSpoon/DashPlayer/commit/9a5cd7d44a6887f750b892bdf35976ac1ee2307c))
* 迁移失败进入启动恢复页，支持重试与重置 ([15c4526](https://github.com/solidSpoon/DashPlayer/commit/15c4526faf43e8ab1573d47dbf90afc06cc54da3))
* 重构「服务与模型」设置页，隐藏技术细节并支持按模型测试云端连通性 ([0546319](https://github.com/solidSpoon/DashPlayer/commit/054631955d01d1c6fcb07397fa117c8d975272a5))


### Bug Fixes

* parakeet-cli 单独空格 token 不再导致识别失败 ([2a94f28](https://github.com/solidSpoon/DashPlayer/commit/2a94f28f309a09e6235f2bd804eee30d1b641892))
* whisper.cpp 运行时按平台取资产扩展名，CI 缺资产时显式失败 ([869d2bb](https://github.com/solidSpoon/DashPlayer/commit/869d2bb2a22daabc1b6568caa0780e21da49f1a6))
* 修 whisper.cpp 运行时 Vulkan 目标的工具链（glslc 与 SPIRV-Headers） ([b5d92f5](https://github.com/solidSpoon/DashPlayer/commit/b5d92f59cef22b245074aa5fcf6e4e4967865469))
* 修 whisper.cpp 运行时 Vulkan 目标的工具链（glslc 与 SPIRV-Headers） ([33ba8d4](https://github.com/solidSpoon/DashPlayer/commit/33ba8d434bc5e377f9e7cf6e7b5b42b2059b5a58))
* 字幕翻译失败仅对失败批次回退到轻量模型 ([67d4d21](https://github.com/solidSpoon/DashPlayer/commit/67d4d2146019e8e5ecc104f0d4a713f5a892f409))
* 引导页下载进度与网速按 500ms 节流刷新，避免数字闪烁 ([f668a78](https://github.com/solidSpoon/DashPlayer/commit/f668a78d13f24f3bc828608988eed2670152408d))
* 引导页下载进度改为整体进度，不再每项从零重来 ([57d53d4](https://github.com/solidSpoon/DashPlayer/commit/57d53d403561f3bcbfe7581135363effab3581d5))
* 性能提示只留在本地增强，基础资源包不再提示 ([33f21e7](https://github.com/solidSpoon/DashPlayer/commit/33f21e782dc08dca7590cce904465c90d4123d1c))
* 手动下载教程里的归档文件名与上游保持一致，下载后无需改名 ([ffea3bf](https://github.com/solidSpoon/DashPlayer/commit/ffea3bffb86a52e69f792414a74a246b7a4d603f))
* 清除缓存只清已启用的引擎，全部关闭时不再显示该行 ([354306d](https://github.com/solidSpoon/DashPlayer/commit/354306d6d94127545f32be76bf660d3a929c08ef))
* 移除合并遗留的 SherpaOnnxCli 重复 DI 绑定 ([f7cacac](https://github.com/solidSpoon/DashPlayer/commit/f7cacac20f6d2f8d9ecb1d5abf518c02f1584de0))
* 补齐引导页校验/解压/安装阶段文案，顺手补上存储页两处缺的文案 ([676bd5b](https://github.com/solidSpoon/DashPlayer/commit/676bd5b1fdbde4a9ef8ee7f83659024546a373b2))
* 词典设置说明改回「内置优先、其它只补漏」的正确语义 ([414a027](https://github.com/solidSpoon/DashPlayer/commit/414a0278ae36aac3afc42adb4ebc6df5a8dc0ec9))

## [6.10.0](https://github.com/solidSpoon/DashPlayer/compare/v6.9.1...v6.10.0) (2026-09-07)


### Features

* **settings:** 重构本地模型卡片交互与文案 ([efbcf5e](https://github.com/solidSpoon/DashPlayer/commit/efbcf5e4850ac826b181422fcc6efe7b48b31f5e))
* 为 Linux 新增 AppImage 安装包 ([edf5544](https://github.com/solidSpoon/DashPlayer/commit/edf55444e299e181a6c75df31280cbaa6bf844b1))
* 为 Linux 新增 AppImage 安装包 ([957f2df](https://github.com/solidSpoon/DashPlayer/commit/957f2df4ae11608f628029a1e774e6abb9d3ec9d))
* 内置离线词典数据，未配置密钥也能查词 ([2fab004](https://github.com/solidSpoon/DashPlayer/commit/2fab00452f2d39add8d863891eced1347d6480a9))
* 内置离线词典数据，未配置密钥也能查词 ([cf7c916](https://github.com/solidSpoon/DashPlayer/commit/cf7c9164d65da74ec10e363dd9a11e108ed433f3))
* 本地引擎启用时后台预加载模型并常驻内存 ([63207ff](https://github.com/solidSpoon/DashPlayer/commit/63207ffda1c38e9f8b4506db282f8d4ecdc4c279))
* 本地模型字幕翻译与词典查询（仅 Mac） ([93efada](https://github.com/solidSpoon/DashPlayer/commit/93efadaef218bf3ac9c5ac4e3b4a6c2fbce1800f))
* 本地模型字幕翻译与词典查询（仅 Mac） ([d7d817c](https://github.com/solidSpoon/DashPlayer/commit/d7d817c52661e3e298359aa26bf6676c5b7c10a2))
* 本地模型测速改为稳态测试，不再冷加载 ([fd91d14](https://github.com/solidSpoon/DashPlayer/commit/fd91d14eb2efe43acc825f1f8074eb5c3bc67933))


### Bug Fixes

* **preload:** 补充 SimpleEvent 类型导入，修复存量 tsc 报错 ([a6c754a](https://github.com/solidSpoon/DashPlayer/commit/a6c754a4ade63c37902f90c9e304e63c8ea52d11))
* 修复 TagSelector autoFocus 与 SpeedSlider 可变声明两处 lint error ([4aefef7](https://github.com/solidSpoon/DashPlayer/commit/4aefef73701741b2b02ed08b8629f7d6142d1bf8))
* 统一自绘红绿灯到窗口右上角 ([e8e0f5f](https://github.com/solidSpoon/DashPlayer/commit/e8e0f5f597de957551553a9fbe3dd0bde5f47f79))
* 设置读取容错非法枚举值并显式引导用户重新选择 ([71b844f](https://github.com/solidSpoon/DashPlayer/commit/71b844fadd4152a11c20c0f649859610301d5129))

## [6.9.1](https://github.com/solidSpoon/DashPlayer/compare/v6.9.0...v6.9.1) (2026-09-05)


### Bug Fixes

* 播客模式点击生词发音时不再同时跳转到当前行开始 ([6f4c3ca](https://github.com/solidSpoon/DashPlayer/commit/6f4c3cae21b476c1d094ae06f29d1529ee3c9a53))
* 播客模式点击生词发音时不再同时跳转到当前行开始 ([321ec4b](https://github.com/solidSpoon/DashPlayer/commit/321ec4b4c8eb31b3680f7530844e9c4a5db9d049))
* 视频切分 AI 整理改走结构化输出，支持节流流式回显 ([e55f13f](https://github.com/solidSpoon/DashPlayer/commit/e55f13fac7235bbc208ae8c5eb58d9e9e0dafc1b))
* 视频切分 AI 整理改走结构化输出，支持节流流式回显 ([a43397d](https://github.com/solidSpoon/DashPlayer/commit/a43397dcf7faca5cfcf3e438527bfb2486bee0d4))

## [6.9.0](https://github.com/solidSpoon/DashPlayer/compare/v6.8.0...v6.9.0) (2026-09-05)


### Features

* **settings:** add skeleton loading and enhance storage usage UI ([6ad2880](https://github.com/solidSpoon/DashPlayer/commit/6ad2880f03808f705e51474458615e44ccfa6718))
* **settings:** optimize storage usage skeleton and visual UI ([a28834e](https://github.com/solidSpoon/DashPlayer/commit/a28834ef71d184edbeccacc93d1c2f46b03e7900))
* **settings:** 优化关于页面排版，重构新版本发现与更新日志展示体系 ([f3ea794](https://github.com/solidSpoon/DashPlayer/commit/f3ea7940c276a3caf71896ecdbb826139df92c6f))
* **settings:** 重构关于与更新页面并合并至设置中心 ([737ffb2](https://github.com/solidSpoon/DashPlayer/commit/737ffb2a8826315b7eb2df57fd38807a648f2b71))
* **settings:** 重构关于与更新页面并合并至设置中心 ([8a41f0b](https://github.com/solidSpoon/DashPlayer/commit/8a41f0b2cf0f2e49704b9e1025d87d75a9492d55))
* 词汇工坊支持删除学习片段 ([41cf49e](https://github.com/solidSpoon/DashPlayer/commit/41cf49ede83f906ee08c312a121f37052bee98e8))
* 词汇工坊支持删除学习片段 ([77c6626](https://github.com/solidSpoon/DashPlayer/commit/77c66266daaf7aefe85ee8957bff9a38999af9a1))


### Bug Fixes

* **settings:** 修正关于页面标题居中问题 ([e6ce30f](https://github.com/solidSpoon/DashPlayer/commit/e6ce30f06d54d3e713514192a5b972fad8c4708c))
* 删除片段后陈旧列表触发对已删文件的媒体探测 ([5e01520](https://github.com/solidSpoon/DashPlayer/commit/5e01520afca931da9cd19a6ef2d53331e40fe3b0))
* 锁定 tencentcloud-sdk-nodejs 到 4.0.829 ([d9905d8](https://github.com/solidSpoon/DashPlayer/commit/d9905d88c17be1d22c31febef2c6cd2652c8f249))

## [6.8.0](https://github.com/solidSpoon/DashPlayer/compare/v6.7.0...v6.8.0) (2026-09-05)


### Features

* **storage:** 设置页存储用量升级为分类环形图统计 ([11411f6](https://github.com/solidSpoon/DashPlayer/commit/11411f6efa8cb9e5ee6fb99cbfbcdcea14820acb))
* **storage:** 设置页存储用量升级为分类环形图统计 ([ae40f9e](https://github.com/solidSpoon/DashPlayer/commit/ae40f9e24d505ade6eb54fede13e68d9560b3c3c))
* 收藏片段页当前句接入单词级词典弹窗与生词高亮 ([825f531](https://github.com/solidSpoon/DashPlayer/commit/825f531988e268bf385a699b4ffd8c7c90d265b8))
* 收藏片段页当前句接入单词级词典弹窗与生词高亮 ([a3213e7](https://github.com/solidSpoon/DashPlayer/commit/a3213e702c207b6f8f6def8c04d4d3c67456f0f8))
* 收藏片段页当前句接入单词级词典弹窗与生词高亮 ([a3213e7](https://github.com/solidSpoon/DashPlayer/commit/a3213e702c207b6f8f6def8c04d4d3c67456f0f8))
* 词典弹窗星标支持取消收藏，点击切换生词表收录 ([405d317](https://github.com/solidSpoon/DashPlayer/commit/405d3173e5fcc4db46d5a8dc358df71c0b015853))
* 重置数据库增加二次确认弹窗 ([1fd6131](https://github.com/solidSpoon/DashPlayer/commit/1fd61310165dd733675eec86379440aa2722e74a))
* 重置数据库增加二次确认弹窗 ([41ddeeb](https://github.com/solidSpoon/DashPlayer/commit/41ddeeb472f7ad898e1937cbc64db987b5a285c6))


### Bug Fixes

* **ci:** Node 版本改为 22.x，满足 npm-run-all2 的引擎要求 ([a93d7d8](https://github.com/solidSpoon/DashPlayer/commit/a93d7d8d2f5a8680bc170d4ff6b2dca310642314))
* **ci:** 发版构建改为 workflow_call 链式调用 ([1cdf4cb](https://github.com/solidSpoon/DashPlayer/commit/1cdf4cb96f3d78e5f879b62a313491e59b6c4e3d))
* **ci:** 发版构建改为 workflow_call 链式调用 ([01101a7](https://github.com/solidSpoon/DashPlayer/commit/01101a7344dd7a9df7487f664d49177f27631f22))
* **ci:** 构建进程放宽 Node 堆上限，防 Vite 构建 OOM ([fa8af50](https://github.com/solidSpoon/DashPlayer/commit/fa8af50da3796f3c2dc4530ec97d5257c1f93a75))
* **ci:** 构建进程放宽 Node 堆上限至 4GB，防 Vite 构建 OOM ([9470aeb](https://github.com/solidSpoon/DashPlayer/commit/9470aeb255bc4abb198593db227602c056758c39))
* **ffmpeg:** 归一化 ffprobe 返回的字符串时长 ([93e591b](https://github.com/solidSpoon/DashPlayer/commit/93e591b77b08b1e4ecc0f0adb452c58df272c149))
* **models:** 必需条目按路径存在性检查，修复 Sherpa 已装模型被误报损坏 ([c074b51](https://github.com/solidSpoon/DashPlayer/commit/c074b5195a169e5618938acc8649b594b130e733))
* **storage:** 恢复抽象存储类的 [@injectable](https://github.com/injectable) 注解，修复容器解析崩溃 ([a92eb7a](https://github.com/solidSpoon/DashPlayer/commit/a92eb7a6145f9bd8618f2da64c2d6e0b5670bcb9))
* **update-check:** ETag 条件请求省限额，开发环境跳过检查，失败原因错误码化 ([2ce4b9b](https://github.com/solidSpoon/DashPlayer/commit/2ce4b9b0f76f8a3c5283b6f4f0d1410afc1b51c6))
* **update-check:** ETag 条件请求省限额，开发环境跳过检查，失败原因错误码化 ([fa053f9](https://github.com/solidSpoon/DashPlayer/commit/fa053f99c88f60404181174878efb6462ea3bd8c))
* 仓储层单词精确匹配替换未转义的 LIKE ([d33b7e6](https://github.com/solidSpoon/DashPlayer/commit/d33b7e6f1120bcb0802de90d650c595e6800f1c7))
* 修复 FFmpeg 转码兼容性问题并重构字幕提取选流 ([58329fe](https://github.com/solidSpoon/DashPlayer/commit/58329fe57e7bc85f67465987124ec8c2cab8d79c))
* 修复 FFmpeg 转码兼容性问题并重构字幕提取选流 ([29d8bbc](https://github.com/solidSpoon/DashPlayer/commit/29d8bbc804caac4aebde96cbd5b7b73e6c6ee69c))
* 导入词表统一小写归一，避免大小写变体撞唯一约束 ([47834e3](https://github.com/solidSpoon/DashPlayer/commit/47834e365c80803114a9da7ce7230f4cf0b73928))
* 收藏生词复用弹窗词典释义，不再强制二次调用词典 AI ([9672169](https://github.com/solidSpoon/DashPlayer/commit/967216942a626432a169d6bcbdbf15c78deccda9))
* 生词管理链路修复与优化（收藏释义复用、热路径 Set、裁切状态重检等） ([bc51bf4](https://github.com/solidSpoon/DashPlayer/commit/bc51bf4d9ca82fbbd050403afef563a30e3fb032))
* 结构化输出提示词补充 JSON 字样，修复收藏单词报错 ([a051d3f](https://github.com/solidSpoon/DashPlayer/commit/a051d3fc1b23a7f51e379e408bdaae26582de09b))
* 结构化输出提示词补充 JSON 字样，修复收藏单词报错 ([a664619](https://github.com/solidSpoon/DashPlayer/commit/a6646194ed2e2069c451ed3563cca4458856182a))
* 词汇工坊页面反馈优化：请求并行、toast 替换 alert、失败可见 ([7e08692](https://github.com/solidSpoon/DashPlayer/commit/7e08692a11123be5875a22136e093d6b20c7689a))
* 词表变化后自动重检当前视频的生词片段裁切状态 ([680714c](https://github.com/solidSpoon/DashPlayer/commit/680714cc71939f60deb13dca645de019e9a85ffd))
* 词表变化后重新拉起字幕生词分析，避免裁切状态卡在分析中 0% ([3d36b7c](https://github.com/solidSpoon/DashPlayer/commit/3d36b7cef9c12583caf78c99cc9d70cf85b6a687))


### Performance Improvements

* 生词表改用 Set 存储，消除字幕渲染热路径的数组全表扫描 ([939e782](https://github.com/solidSpoon/DashPlayer/commit/939e78258071548c640b337de1ca33e716898b6c))

## [6.7.0](https://github.com/solidSpoon/DashPlayer/compare/v6.6.0...v6.7.0) (2026-09-04)


### Features

* **log:** 转录任务补 done/cancelled/failed 收尾日志 ([1dec5de](https://github.com/solidSpoon/DashPlayer/commit/1dec5dec3926d54cd08ea129ad54ebff79ebebca))


### Bug Fixes

* **ci:** release-please 改用纯版本号 tag ([91ae929](https://github.com/solidSpoon/DashPlayer/commit/91ae9297460684076a4cdecdc6fbc3d6045291a8))
* **ci:** release-please 改用纯版本号 tag，匹配既有 v6.x.x 命名 ([5281eca](https://github.com/solidSpoon/DashPlayer/commit/5281eca803544638ed4940935f108bc6108a08a5))
* **log:** Error 序列化保留 statusCode 与 responseBody ([782d7f3](https://github.com/solidSpoon/DashPlayer/commit/782d7f313761e4be2d00aa37505cc1f208e3d04b))
* **log:** 周报问题修复——日志降噪、转录收尾、Error 证据与两处坏味道 ([b2f473c](https://github.com/solidSpoon/DashPlayer/commit/b2f473ce7086c46de1de4da8b292822f1f2b401f))
* **log:** 转录需求上报失败不再静默吞掉 ([3e6c744](https://github.com/solidSpoon/DashPlayer/commit/3e6c7444f9d6fad6e302335962ad5906357927f5))
* **log:** 降噪播放 ready 回调与字幕翻译回推链路日志 ([f035743](https://github.com/solidSpoon/DashPlayer/commit/f0357432ee9d67e59be2e3a559626d05f58e9fbe))
* 修复 issue 模板 frontmatter、日志路径指引，移除无效的 requiredHeaders ([3423d15](https://github.com/solidSpoon/DashPlayer/commit/3423d1543ec0060495baa65ee0b56c5f313e0fd1))
* 收藏片段直翻腾讯补 tencent 限流 ([c8a1864](https://github.com/solidSpoon/DashPlayer/commit/c8a18643499f0148d68aa7ff99b52045e2efeb2d))

## [Unreleased]

### Changed

- Refactored logging to remove tag-based filtering and APIs.
- Added `src/vite-env.d.ts` to fix `import.meta.env` TypeScript typing.
