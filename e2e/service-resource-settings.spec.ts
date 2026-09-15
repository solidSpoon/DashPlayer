import { expect, type Page } from '@playwright/test';
import { readConfigValue, launchAppSession, test } from './fixtures';
import { openSettingsSection, reloadSettingsPage, switchSettingsSection, chooseInRow, selectInRow } from './settings-page';

/** 进入服务与资源设置页。 */
async function openResourcesSetting(page: Page): Promise<void> {
    await openSettingsSection(page, '服务与资源', page.getByRole('heading', { name: '服务与资源' }));
}

/** 「API 类型」下拉的显示文案到存储枚举值的对应表。 */
const API_FORMAT_BY_LABEL: Record<string, string> = {
    'OpenAI 兼容': 'openai',
    'Anthropic 兼容': 'anthropic',
    'Gemini': 'gemini',
};

/** 云端服务里填写的 API Key，仅用于验证落盘，不是真实密钥。 */
const API_KEY = 'sk-e2e-not-a-real-key';
/** 云端服务里填写的接口地址。 */
const ENDPOINT = 'https://api.e2e.test/v1';
/** 新增的模型标识。 */
const NEW_MODEL = 'e2e-model-alpha';
/** 自定义翻译风格提示词。 */
const CUSTOM_STYLE = 'E2E 自定义翻译风格：保持原句语序';

test.describe('服务与资源设置', () => {
    test('[SET-SVC-01] 云端服务填写的密钥、接口地址与模型清单会落盘，重进页面仍回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        await page.getByPlaceholder('sk-...').fill(API_KEY);
        await page.getByPlaceholder('https://api.deepseek.com/v1').fill(ENDPOINT);

        // 模型标识靠「添加」进列表，不是直接编辑文本
        await page.getByPlaceholder('输入模型标识，如 gpt-4o-mini').fill(NEW_MODEL);
        await page.getByRole('button', { name: '添加' }).click();
        await expect(page.getByRole('cell', { name: NEW_MODEL })).toBeVisible();

        await expect.poll(() => readConfigValue(userDataDir, 'apiKeys.openAi.key')).toBe(API_KEY);
        await expect.poll(() => readConfigValue(userDataDir, 'apiKeys.openAi.endpoint')).toBe(ENDPOINT);
        // 模型清单以换行文本落盘；断言包含而不是全等，避免绑死内置默认模型
        await expect.poll(() => readConfigValue(userDataDir, 'models.openai.available')).toContain(NEW_MODEL);

        // 重进页面：密钥、地址与模型清单都来自后端回读
        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await expect(page.getByPlaceholder('sk-...')).toHaveValue(API_KEY);
        await expect(page.getByPlaceholder('https://api.deepseek.com/v1')).toHaveValue(ENDPOINT);
        await expect(page.getByRole('cell', { name: NEW_MODEL })).toBeVisible();
    });

    test('[SET-SVC-02] 识别方式、翻译风格与词典补充方式改动会落盘，重进页面仍回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        // 识别方式藏在「查看详情」里，展开后才能改
        await page.getByRole('button', { name: '查看详情' }).click();
        await chooseInRow(page, '识别方式', '兼容模式');
        await expect.poll(() => readConfigValue(userDataDir, 'transcription.engine')).toBe('sherpa-onnx');

        // 翻译风格切到自定义后，提示词输入框才可编辑
        await chooseInRow(page, '翻译风格', '自定义');
        const customStyleInput = page.locator('textarea');
        await customStyleInput.fill(CUSTOM_STYLE);

        await chooseInRow(page, '超出词库时的补充方式', '不补充');

        await expect.poll(() => readConfigValue(userDataDir, 'features.openai.subtitleTranslationMode')).toBe('custom');
        await expect.poll(() => readConfigValue(userDataDir, 'features.openai.subtitleCustomStyle')).toBe(CUSTOM_STYLE);
        await expect.poll(() => readConfigValue(userDataDir, 'providers.dictionary')).toBe('none');

        // 重进页面：三项选择与自定义提示词都来自后端回读
        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await page.getByRole('button', { name: '查看详情' }).click();
        await expect(selectInRow(page, '识别方式')).toHaveText('兼容模式');
        await expect(selectInRow(page, '翻译风格')).toHaveText('自定义');
        await expect(page.locator('textarea')).toHaveValue(CUSTOM_STYLE);
        await expect(selectInRow(page, '超出词库时的补充方式')).toHaveText('不补充');
    });

    test('[SET-SVC-03] 识别方式在兼容模式与硬件加速之间往返切换都落盘，重进页面回显最后一次选择', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);
        await page.getByRole('button', { name: '查看详情' }).click();

        // 默认是硬件加速，先切到兼容模式，确认同一个下拉换回来也能写回配置
        await expect(selectInRow(page, '识别方式')).toHaveText('硬件加速（推荐）');
        await chooseInRow(page, '识别方式', '兼容模式');
        await expect.poll(() => readConfigValue(userDataDir, 'transcription.engine')).toBe('sherpa-onnx');

        await chooseInRow(page, '识别方式', '硬件加速（推荐）');
        await expect.poll(() => readConfigValue(userDataDir, 'transcription.engine')).toBe('whisper-cpp');

        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await page.getByRole('button', { name: '查看详情' }).click();
        await expect(selectInRow(page, '识别方式')).toHaveText('硬件加速（推荐）');
    });

    test('[SET-SVC-04] 使用厂商预设会回填接口地址与 API 类型并落盘，重进页面仍回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        await page.getByRole('button', { name: '使用预设' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('选择厂商预设')).toBeVisible();

        // 预设的地址与类型从弹窗里现读，断言不写死具体厂商参数
        const presetCard = dialog.locator('div.rounded-lg').filter({ hasText: 'Claude (Anthropic)' });
        const presetEndpoint = (await presetCard.locator('div.font-mono').innerText()).trim();
        const presetFormatLabel = (await presetCard.getByText(/^(OpenAI 兼容|Anthropic 兼容|Gemini)$/).innerText()).trim();
        await presetCard.getByRole('button', { name: '使用', exact: true }).click();
        await expect(dialog).toBeHidden();

        const presetApiFormat = API_FORMAT_BY_LABEL[presetFormatLabel];
        await expect.poll(() => readConfigValue(userDataDir, 'apiKeys.openAi.endpoint')).toBe(presetEndpoint);
        await expect.poll(() => readConfigValue(userDataDir, 'apiKeys.openAi.apiFormat')).toBe(presetApiFormat);

        // 当前页面即时回显
        await expect(page.getByPlaceholder('https://api.deepseek.com/v1')).toHaveValue(presetEndpoint);
        await expect(selectInRow(page, 'API 类型')).toHaveText(presetFormatLabel);

        // 重进页面：地址与类型来自后端回读
        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await expect(page.getByPlaceholder('https://api.deepseek.com/v1')).toHaveValue(presetEndpoint);
        await expect(selectInRow(page, 'API 类型')).toHaveText(presetFormatLabel);
    });

    test('[SET-SVC-05] 新增的模型可以删除，被功能占用的模型不能删除', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        // 内置默认模型被整句讲解等功能占用，删除按钮应当禁用
        const inUseRow = page.getByRole('row').filter({ hasText: '整句讲解' });
        await expect(inUseRow).toBeVisible();
        await expect(inUseRow.getByRole('button').last()).toBeDisabled();

        // 新加的模型没被任何功能占用，可以删掉
        const temporaryModel = 'e2e-model-temp';
        await page.getByPlaceholder('输入模型标识，如 gpt-4o-mini').fill(temporaryModel);
        await page.getByRole('button', { name: '添加' }).click();
        await expect.poll(() => readConfigValue(userDataDir, 'models.openai.available')).toContain(temporaryModel);

        const temporaryRow = page.getByRole('row').filter({ hasText: temporaryModel });
        await expect(temporaryRow.getByRole('button').last()).toBeEnabled();
        await temporaryRow.getByRole('button').last().click();

        // 删除同样要写回配置，而不是只从界面表格里消失
        await expect.poll(() => readConfigValue(userDataDir, 'models.openai.available')).not.toContain(temporaryModel);
        await expect(page.getByRole('cell', { name: temporaryModel })).toHaveCount(0);
    });

    test('[SET-SVC-06] 把字幕翻译指到新增的云端模型后，模型槽位落盘并回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        await page.getByPlaceholder('输入模型标识，如 gpt-4o-mini').fill(NEW_MODEL);
        await page.getByRole('button', { name: '添加' }).click();
        await expect.poll(() => readConfigValue(userDataDir, 'models.openai.available')).toContain(NEW_MODEL);

        // 功能下拉里的模型清单来自详情缓存，保存成功后缓存会立刻刷新，新模型无需重进页面即可选中
        await chooseInRow(page, '字幕翻译', NEW_MODEL);

        // 引擎原本就是云端，写盘上唯一的变化是「上次选的模型」这个槽位
        await expect.poll(() => readConfigValue(userDataDir, 'models.openai.subtitleTranslation')).toBe(NEW_MODEL);

        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await expect(selectInRow(page, '字幕翻译')).toHaveText(NEW_MODEL);
    });

    test('[SET-SVC-07] 字幕翻译切到本地基础资源包后引擎落盘，重进页面回显且提示只支持中文', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        await chooseInRow(page, '字幕翻译', '本地基础资源包');

        await expect.poll(() => readConfigValue(userDataDir, 'providers.subtitleTranslation')).toBe('local-mt');
        await expect(page.getByText('轻量翻译只支持翻译为中文。')).toBeVisible();

        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await expect(selectInRow(page, '字幕翻译')).toHaveText('本地基础资源包');
    });

    test('[SET-SVC-08] 词典查询切到本地增强资源包后引擎落盘，重进页面回显并提示资源未下载', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        await chooseInRow(page, '词典查询', '本地增强资源包');

        await expect.poll(() => readConfigValue(userDataDir, 'providers.dictionary')).toBe('local');
        // 本地增强模型还没下载时，页面必须说清为什么现在用不了
        await expect(page.getByText('所选资源还没下载，请先在上方下载本地基础资源包。')).toBeVisible();

        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await expect(selectInRow(page, '词典查询')).toHaveText('本地增强资源包');
    });

    test('[SET-SVC-09] 整句讲解切到禁用后开关落盘为关闭，重进页面仍回显禁用', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        // 默认开启，且默认指向内置云端模型
        await expect(selectInRow(page, '整句讲解')).not.toHaveText('禁用');

        await chooseInRow(page, '整句讲解', '禁用');

        await expect.poll(() => readConfigValue(userDataDir, 'features.openai.enableSentenceLearning')).toBe('false');

        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await expect(selectInRow(page, '整句讲解')).toHaveText('禁用');
    });

    test('[SET-SVC-10] 把功能从云端模型切走后，原模型的删除按钮恢复可用且删得掉', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        // 新加的模型指给字幕翻译后就成了「在用」的模型，占用是现算的，删除按钮随之禁用
        await page.getByPlaceholder('输入模型标识，如 gpt-4o-mini').fill(NEW_MODEL);
        await page.getByRole('button', { name: '添加' }).click();
        await chooseInRow(page, '字幕翻译', NEW_MODEL);
        await expect.poll(() => readConfigValue(userDataDir, 'models.openai.subtitleTranslation')).toBe(NEW_MODEL);

        const modelRow = page.getByRole('row').filter({ hasText: NEW_MODEL });
        await expect(modelRow.getByRole('button').last()).toBeDisabled();

        // 把字幕翻译切回本地：占用应当当场解除，不需要重进页面
        await chooseInRow(page, '字幕翻译', '本地基础资源包');
        await expect(modelRow.getByRole('button').last()).toBeEnabled();

        await modelRow.getByRole('button').last().click();
        await expect.poll(() => readConfigValue(userDataDir, 'models.openai.available')).not.toContain(NEW_MODEL);
        await expect(page.getByRole('cell', { name: NEW_MODEL })).toHaveCount(0);
    });

    test('[SET-SVC-11] 关掉应用再打开，云端密钥仍原样回读', async ({ userDataDir }) => {
        const first = await launchAppSession(userDataDir);
        try {
            await openResourcesSetting(first.page);
            await first.page.getByPlaceholder('sk-...').fill(API_KEY);
            await expect.poll(() => readConfigValue(userDataDir, 'apiKeys.openAi.key')).toBe(API_KEY);
        } finally {
            await first.close();
        }

        // 重启后不做任何操作：密钥必须来自持久化配置，而不是本次进程里的状态
        const restarted = await launchAppSession(userDataDir);
        try {
            await openResourcesSetting(restarted.page);
            await expect(restarted.page.getByPlaceholder('sk-...')).toHaveValue(API_KEY);
        } finally {
            await restarted.close();
        }
    });

    test('[SET-SVC-13] 把云端模型清单删空后清单保持为空，此时改动偏好仍会正常落盘', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        // 默认那个模型被三处占用，先逐个解绑，删除按钮才会亮
        await chooseInRow(page, '整句讲解', '禁用');
        await chooseInRow(page, '字幕翻译', '关闭');
        await chooseInRow(page, '词典查询', '不补充');
        await expect.poll(() => readConfigValue(userDataDir, 'providers.subtitleTranslation')).toBe('none');

        const builtinRow = page.getByRole('row').filter({ hasText: 'gpt-5.4-nano' });
        await expect(builtinRow.getByRole('button').last()).toBeEnabled();
        await builtinRow.getByRole('button').last().click();

        // 清空就是清空：清单在磁盘上留空，不会又被兜底成默认模型塞回来
        await expect.poll(() => readConfigValue(userDataDir, 'models.openai.available')).toBe('');
        await expect(page.getByRole('cell', { name: 'gpt-5.4-nano' })).toHaveCount(0);
        await reloadSettingsPage(page, page.getByRole('heading', { name: '服务与资源' }));
        await expect(page.getByRole('cell', { name: 'gpt-5.4-nano' })).toHaveCount(0);

        // 清单为空只该拦住「要用云端」的功能，不该连带把无关偏好一起拒绝保存
        await page.getByRole('button', { name: '查看详情' }).click();
        await chooseInRow(page, '翻译风格', '简化英文');
        await expect.poll(() => readConfigValue(userDataDir, 'features.openai.subtitleTranslationMode')).toBe('simple_en');
        // 值落盘之外还要确认页面没弹保存失败横幅：保存被拒时值也不会变，
        // 但「值没变」只会表现为超时，横幅才是用户看到的那句错误。放保存之后断言才抓得到。
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('[SET-SVC-17] 填完密钥立刻切到别的设置栏目，密钥仍会落盘并在重进后回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openResourcesSetting(page);

        await page.getByPlaceholder('sk-...').fill(API_KEY);

        // 关键：填完立刻离开，不给 600ms 防抖留时间。密钥是最不能丢的值，
        // 用户填完随手切走若静默丢失，会表现为「填了密钥但还是提示未配置」。
        await switchSettingsSection(page, '外观', page.getByRole('button', { name: '深色' }));

        await expect.poll(() => readConfigValue(userDataDir, 'apiKeys.openAi.key')).toBe(API_KEY);

        // 回到该页：密钥来自后端回读，而不是页面里残留的输入
        await switchSettingsSection(page, '服务与资源', page.getByRole('heading', { name: '服务与资源' }));
        await expect(page.getByPlaceholder('sk-...')).toHaveValue(API_KEY);
    });
});
