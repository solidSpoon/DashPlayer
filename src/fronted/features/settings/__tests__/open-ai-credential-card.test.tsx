import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { ServiceCredentialSettingDetailVO } from '@/common/types/vo/service-credentials-setting-vo';
import { CLOUD_AI_PROVIDER_PRESETS } from '@/common/constants/cloud-ai-provider-presets';
import { OpenAiCredentialCard } from '../components/OpenAiCredentialCard';

const translationDict: Record<string, string> = {
    'serviceCredentials.openai.usePreset': '使用预设',
    'serviceCredentials.openai.presetDialogTitle': '选择厂商预设',
    'serviceCredentials.openai.useThisPreset': '使用',
    'serviceCredentials.openai.apiFormatLabel': 'API 类型',
    'serviceCredentials.openai.apiFormatOpenai': 'OpenAI 兼容',
    'serviceCredentials.openai.apiFormatAnthropic': 'Anthropic 兼容',
    'serviceCredentials.openai.modelsLabel': '可用模型列表',
    'serviceCredentials.openai.addPlaceholder': '输入模型标识',
    'serviceCredentials.openai.tableTest': '测试',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => translationDict[key] ?? key,
    }),
}));

const buildDefaultValues = (
    openai?: Partial<ServiceCredentialSettingDetailVO['openai']>,
): ServiceCredentialSettingDetailVO => ({
    openai: {
        key: '',
        endpoint: '',
        versionPath: '/v1',
        apiFormat: 'openai',
        models: [],
        ...openai,
    },
    tencent: { secretId: '', secretKey: '' },
});

const renderCard = (defaultValues: ServiceCredentialSettingDetailVO) => {
    const Wrapper: React.FC = () => {
        const form = useForm<ServiceCredentialSettingDetailVO>({ defaultValues });
        return (
            <OpenAiCredentialCard
                form={form}
                testingModel={null}
                testResults={{}}
                onTestModel={() => undefined}
                onModelRemoved={() => undefined}
                onCopy={() => undefined}
                onOpenUrl={() => undefined}
            />
        );
    };
    return render(<Wrapper />);
};

describe('OpenAiCredentialCard', () => {
    it('点击「使用预设」打开弹窗并列出全部厂商预设', async () => {
        const user = userEvent.setup();
        renderCard(buildDefaultValues());

        await user.click(screen.getByRole('button', { name: '使用预设' }));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('选择厂商预设')).toBeInTheDocument();
        for (const preset of CLOUD_AI_PROVIDER_PRESETS) {
            expect(within(dialog).getByText(preset.name)).toBeInTheDocument();
            expect(within(dialog).getByText(`${preset.endpoint}${preset.versionPath}`)).toBeInTheDocument();
        }
    });

    it('选择 DeepSeek 预设后回填完整接口地址，且不覆盖已有模型列表', async () => {
        const user = userEvent.setup();
        renderCard(buildDefaultValues({
            models: [{ model: 'existing-model', inUseBy: [] }],
        }));

        await user.click(screen.getByRole('button', { name: '使用预设' }));
        const dialog = await screen.findByRole('dialog');
        const useButtons = within(dialog).getAllByRole('button', { name: '使用' });
        const deepSeekIndex = CLOUD_AI_PROVIDER_PRESETS.findIndex((preset) => preset.id === 'deepseek');
        await user.click(useButtons[deepSeekIndex]);

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByDisplayValue('https://api.deepseek.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('/v1')).toBeInTheDocument();
        expect(screen.getByText('existing-model')).toBeInTheDocument();
    });

    it('选择 Anthropic 预设后 API 类型切换为 Anthropic 兼容', async () => {
        const user = userEvent.setup();
        renderCard(buildDefaultValues());

        await user.click(screen.getByRole('button', { name: '使用预设' }));
        const dialog = await screen.findByRole('dialog');
        const useButtons = within(dialog).getAllByRole('button', { name: '使用' });
        const anthropicIndex = CLOUD_AI_PROVIDER_PRESETS.findIndex((preset) => preset.id === 'anthropic');
        await user.click(useButtons[anthropicIndex]);

        expect(await screen.findByText('Anthropic 兼容')).toBeInTheDocument();
        expect(screen.getByDisplayValue('https://api.anthropic.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('/v1')).toBeInTheDocument();
    });
});
