# 配置有道云密钥

> 有道云是**可选**配置。如果您已配置 OpenAI，OpenAI 也可以提供词典查询功能。
>
> 有道云可作为词典查询的替代方案，提供有道词典的专业释义。

配置有道云后，您可以在设置中心的「功能设置」页面将词典查询的引擎切换为「有道词典」。

![dic-youdao.png](dic-youdao.png)

## 简要说明

1. 官方网站：[有道智云 AI 开放平台](http://ai.youdao.com/)
2. DashPlayer 只使用有道的**文本翻译**服务，创建应用时无需勾选语音合成（单词发音由内置的本地 TTS 模型提供）。
3. 官方资费说明：[文本翻译](https://ai.youdao.com/DOCSIRMA/html/trans/price/wbfy/index.html)
4. 有道翻译官方接口会提供 50 元免费体验金，用完之后就要收费了。
5. DashPlayer 会缓存查询结果，所以不会每次都调用有道翻译接口。

## 申请步骤

<procedure title="配置有道云密钥" id="config-youdao-api">
<step>打开 <a href="http://ai.youdao.com">有道智云 AI 开放平台</a> 并点击右上角的注册。</step>
<step>打开 <a href="https://ai.youdao.com/console/#/service-singleton/text-translation">文本翻译服务页面</a>，点击<control>创建应用</control>按钮，填写如下信息：

<p><control>应用名称</control>：DashPlayer</p>
<p><control>选择服务</control>：</p>
<list>
<li><ui-path>自然语言翻译服务 | 文本翻译</ui-path></li>
</list>
<p><control>接入方式</control>：API</p>
<p><control>应用类别</control>：实用工具</p>
<p>点击确定完成创建。</p>
</step>

<step>打开 <a href="https://ai.youdao.com/console/#/app-overview">应用总览</a>页面，在应用列表中找到刚才创建的「应用名称」为「DashPlayer」的应用，然后就会看到「应用 ID」和「密钥/包名/Bundle ID」。</step>
<step>在 DashPlayer 设置中心，进入「服务凭据」，在有道区域填入「应用 ID」和「应用密钥」，点击「测试连接」验证是否配置成功。</step>
</procedure>

如有疑惑的地方，请在 [issue](https://github.com/solidSpoon/DashPlayer/issues) 反馈。
