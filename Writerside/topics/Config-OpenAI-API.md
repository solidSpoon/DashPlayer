# 配置 OpenAI 密钥

> 如果你不知道 OpenAI 是什么，可以参考 [OpenAI 官网](https://www.openai.com/)。
> 
> 简而言之，OpenAI 提供了一些强大又便宜的人工智能 API，可以用来做各种有趣的事情。

您需要配置 OpenAI 密钥才能使用转录字幕，整句学习相关功能。

OpenAI 官方接口可能不好获得，您可以通过第三方的中转服务来获取 OpenAI 密钥，通常这些中转服务会提供更便宜的价格：

- https://one.gptnb.me/
- https://www.gptapi.us/
- https://aihubmix.com/

注册充值后将 key 和 endpoint 填入 DashPlayer 的设置中。

![open-ai-api-setting.png](open-ai-api-setting.png)

目前 DashPlayer 会调用 `gpt-3.5-turbo` 和 `whisper-1` 这两个接口，价格比较便宜。 请确保您使用的中转站支持这两个接口。
