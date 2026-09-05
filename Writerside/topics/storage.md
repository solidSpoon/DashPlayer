# 存储管理

进入 <control>设置中心</control> → <control>存储</control>页面，可以管理 DashPlayer 的本地存储。

![setting-storage.png](setting-storage.png)

## 存储路径

下载的视频、收藏的视频片段、词汇工坊片段以及本地模型等文件都会保存到存储路径（Library Path）对应的文件夹中。

- 点击 <control>打开 Library 文件夹</control> 可以直接在系统文件管理器中打开该文件夹
- 修改存储路径后，需要重启 DashPlayer 才能生效

页面下方还会按类别（视频文件、收藏片段、词汇工坊片段、本地模型、临时文件等）统计存储用量。

## 重置数据库

点击 <control>重置数据库</control> 会清空全部数据库记录并重启应用：

- 重启后会自动从本地片段文件重建收藏片段与词汇工坊的索引
- 其余数据（如观看历史、生词记录）将丢失，且此操作不可撤销，请谨慎使用

## 修复片段索引

如果收藏片段或词汇工坊片段的记录丢失或显示异常，可以分别点击：

- <control>重新同步收藏片段</control>：从本地 `favourite_clips` 文件夹重新构建收藏片段索引
- <control>重新同步词汇工坊</control>：从本地 `word_video` 文件夹重新构建词汇工坊片段记录
