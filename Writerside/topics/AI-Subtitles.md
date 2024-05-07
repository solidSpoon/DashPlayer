# 人工智能字幕

DashPlayer 的核心功能要求必须有视频的 `srt` 字幕文件，当您没有字幕文件时，可以使用人工智能来生成字幕。

DashPlayer 目前支持调用 OpenAI 的 `Whisper` 接口生成字幕，这个模型的准确度很高，价格也比较便宜。

<procedure title="使用 OpenAI 生成字幕" id="ai-subtitles">
<step><a href="Config-OpenAI-API.md">配置 OpenAI 密钥</a></step>
<step>进入<control>Transcript</control>页面</step>
<step>在左侧文件浏览器中找到相应的文件后点击<control>添加到转录队列</control></step>
<step>点击<control>转录</control>按钮</step>
</procedure>

> 转录时调用接口响应的时间会比较长，实际测试发现代理服务可能会切断这种长时间的连接，如果转录失败，请尝试在代理中将您配置的
> OpenAI 域名排除。
> {style="note"}

转录时您可以离开这个界面继续观看视频，但请不要关闭 DashPlayer。转录完成后会自动更新相关视频的字幕。

