# 配置有道云密钥

您需要有道智云的密钥才能使用有道的单词翻译服务。

## 简要说明

1. 官方网站：[有道智云 AI 开放平台](http://ai.youdao.com/)
2. 单词翻译（文本翻译）需要搭配语音合成使用。
2. 官方资费说明：[文本翻译](https://ai.youdao.com/DOCSIRMA/html/trans/price/wbfy/index.html) [语音合成](https://ai.youdao.com/DOCSIRMA/html/tts/price/yyhc/index.html)
3. 有道翻译官方接口会提供 50 元免费体验金，用完之后就要收费了。
4. DashPlayer 会缓存翻译结果，所以不会每次都调用有道翻译接口。

## 申请步骤

<procedure title="配置有道云密钥" id="config-youdao-api">
<step>打开 <a href="http://ai.youdao.com">有道智云 AI 开放平台</a> 并点击右上角的注册。</step>
<step>打开 <a href="https://ai.youdao.com/console/#/service-singleton/text-translation">文本翻译服务页面</a>，点击<control>创建应用</control>按钮，填写如下信息：

<p><control>应用名称</control>：DashPlayer</p>
<p><control>选择服务</control>：</p>
<list>
<li><ui-path>自然语言翻译服务 | 文本翻译</ui-path></li>
<li><ui-path>智能语音服务 | 语音合成</ui-path></li>
</list>
<p><control>接入方式</control>：API</p>
<p><control>应用类别</control>：实用工具</p>
<p>点击确定完成创建。</p>
</step>

<step>打开 <a href="https://ai.youdao.com/console/#/app-overview">应用总览</a>页面，在应用列表中找到刚才创建的「应用名称」为「DashPlayer」的应用，然后就会看到「应用 ID」和「密钥/包名/Bundle ID」。将其填入 DashPlayer 即可！</step>
</procedure>

如有疑惑的地方，请在 [issue](https://github.com/solidSpoon/DashPlayer/issues) 反馈。
