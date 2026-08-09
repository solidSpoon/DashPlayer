import { existsSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

/**
 * AI SDK 升级验证测试的配置读取。
 *
 * 说明：直接读取应用开发环境的配置文件（Electron userData 下的 config.dev.json，
 * 与应用运行时 `storeGet('apiKeys.openAi.key')` 等读取的是同一份文件），不额外维护测试环境文件。
 * 文件缺失、解析失败或 Key 不完整时返回 null，由测试用例自行跳过。
 */
export type AiSdkTestConfig = {
    /** OpenAI 兼容接口的 API Key。 */
    key: string;
    /** OpenAI 兼容接口的 base URL（不含 /v1 后缀）。 */
    endpoint: string;
    /** 本次验证使用的模型 id。 */
    model: string;
    /** config.dev.json 的 models.openai.available 解析出的模型清单（可能为空）。 */
    availableModels: string[];
    /** config.dev.json 的 models.openai.sentenceLearning（可能为空）。 */
    sentenceLearningModel: string;
};

/**
 * 解析应用 userData 目录，与 Electron `app.getPath('userData')` 的默认行为对齐。
 *
 * @returns userData 目录绝对路径。
 */
const resolveUserDataDir = (): string => {
    let base: string;
    if (process.platform === 'darwin') {
        base = path.join(os.homedir(), 'Library', 'Application Support');
    } else if (process.platform === 'win32') {
        base = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    } else {
        // Electron 在 Linux 上会优先使用 XDG_CONFIG_HOME，需与其保持一致。
        base = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    }
    return path.join(base, 'DashPlayer');
};

/**
 * 从应用开发环境配置文件读取 AI SDK 测试连接信息。
 *
 * @returns 配置对象；文件缺失、解析失败或 Key 不完整时返回 null。
 */
export const loadAiSdkTestConfig = (): AiSdkTestConfig | null => {
    const devConfigPath = path.join(resolveUserDataDir(), 'config.dev.json');
    if (!existsSync(devConfigPath)) {
        return null;
    }
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(devConfigPath, 'utf8'));
    } catch {
        return null;
    }
    const config = raw as {
        apiKeys?: { openAi?: { key?: string; endpoint?: string } };
        models?: { openai?: { sentenceLearning?: string; available?: string } };
    };
    const key = config.apiKeys?.openAi?.key?.trim() ?? '';
    const endpoint = config.apiKeys?.openAi?.endpoint?.trim() ?? '';
    if (!key || !endpoint) {
        return null;
    }
    const sentenceModel = config.models?.openai?.sentenceLearning?.trim() ?? '';
    const availableModels = (config.models?.openai?.available ?? '')
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    // 模型解析与 ModelRoutingServiceImpl 保持一致：优先场景模型，其次可用清单第一个。
    const model = sentenceModel && availableModels.includes(sentenceModel)
        ? sentenceModel
        : (availableModels[0] ?? 'gpt-5.4-nano');
    return { key, endpoint, model, availableModels, sentenceLearningModel: sentenceModel };
};
