import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { Progress } from '@/fronted/components/ui/progress';
import { Textarea } from '@/fronted/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/fronted/components/ui/dropdown-menu';
import Separator from '@/fronted/components/Separtor';
import { Bot, Languages, Book, TestTube, CheckCircle, XCircle, Cpu, HardDrive, ChevronDown } from 'lucide-react';
import Header from '@/fronted/pages/setting/setting/Header';
import FooterWrapper from '@/fronted/pages/setting/setting/FooterWrapper';
import {ApiSettingVO} from "@/common/types/vo/api-setting-vo";
import { useToast } from '@/fronted/components/ui/use-toast';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';
import { WhisperModelStatusVO } from '@/common/types/vo/whisper-model-vo';

const api = window.electron;

const OPENAI_MODEL_PRESETS = [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (推荐)' },
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
];

const ServiceManagementSetting = () => {
    const logger = getRendererLogger('ServiceManagementSetting');

    // Fetch settings with SWR
    const { data: settings, mutate } = useSWR('settings/services/get-all', () =>
        api.call('settings/services/get-all')
    );

    const { register, handleSubmit, watch, setValue, reset } = useForm<ApiSettingVO>();
    const { toast } = useToast();

    // Register hidden fields for Whisper to ensure they're included in form data
    register('whisper.enabled');
    register('whisper.enableTranscription');
    register('whisper.modelSize');
    register('whisper.enableVad');
    register('whisper.vadModel');
    register('openai.subtitleTranslationMode');
    register('openai.subtitleCustomStyle');

    // Whisper settings - now part of main form
    const whisperEnabled = watch('whisper.enabled');
    const whisperTranscriptionEnabled = watch('whisper.enableTranscription');
    const whisperModelSize = watch('whisper.modelSize');
    const whisperEnableVad = watch('whisper.enableVad');
    const whisperVadModel = watch('whisper.vadModel');

    // Test states
    const [testingOpenAi, setTestingOpenAi] = React.useState(false);
    const [testingTencent, setTestingTencent] = React.useState(false);
    const [testingYoudao, setTestingYoudao] = React.useState(false);

    // Test results
    const [openAiTestResult, setOpenAiTestResult] = React.useState<{ success: boolean, message: string } | null>(null);
    const [tencentTestResult, setTencentTestResult] = React.useState<{ success: boolean, message: string } | null>(null);
    const [youdaoTestResult, setYoudaoTestResult] = React.useState<{ success: boolean, message: string } | null>(null);

    // Auto-save tracking
    const [, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [, setAutoSaveError] = React.useState<string | null>(null);
    const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoSaveIdleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSavePromiseRef = React.useRef<Promise<void> | null>(null);
    const hasChangesRef = React.useRef(false);
    const isMountedRef = React.useRef(true);
    // Whisper states
    const [whisperModelStatus, setWhisperModelStatus] = React.useState<WhisperModelStatusVO | null>(null);
    const [downloadingWhisperModel, setDownloadingWhisperModel] = React.useState(false);
    const [downloadingVadModel, setDownloadingVadModel] = React.useState(false);
    const [downloadProgressByKey, setDownloadProgressByKey] = React.useState<Record<string, { percent: number; downloaded?: number; total?: number }>>({});

    // Store original values for change detection
    const [originalValues, setOriginalValues] = React.useState<ApiSettingVO | null>(null);

    // Watch all form values for change detection
    const currentValues = watch();

    const refreshWhisperModelStatus = React.useCallback(async () => {
        try {
            const status = await api.call('whisper/models/status');
            setWhisperModelStatus(status);
        } catch (error) {
            logger.error('failed to fetch whisper model status', { error });
        }
    }, [logger]);

    React.useEffect(() => {
        refreshWhisperModelStatus().catch(() => null);
    }, [refreshWhisperModelStatus]);

    React.useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent).detail as { key: string; percent: number; downloaded?: number; total?: number } | undefined;
            if (!detail?.key) return;
            setDownloadProgressByKey((prev) => ({
                ...prev,
                [detail.key]: { percent: detail.percent, downloaded: detail.downloaded, total: detail.total },
            }));

            if (detail.percent >= 100) {
                setTimeout(() => {
                    refreshWhisperModelStatus().catch(() => null);
                }, 300);
            }
        };
        window.addEventListener('whisper-model-download-progress', handler as EventListener);
        return () => {
            window.removeEventListener('whisper-model-download-progress', handler as EventListener);
        };
    }, [refreshWhisperModelStatus]);

    // Watch for subtitle translation mutual exclusion
    const openaiSubtitleEnabled = watch('openai.enableSubtitleTranslation');
    const tencentSubtitleEnabled = watch('tencent.enableSubtitleTranslation');
    const openaiSubtitleMode = watch('openai.subtitleTranslationMode');
    const openaiSubtitleCustomStyle = watch('openai.subtitleCustomStyle');
    const resolvedSubtitleMode = (openaiSubtitleMode || 'zh') as 'zh' | 'simple_en' | 'custom';
    const isCustomSubtitleMode = resolvedSubtitleMode === 'custom';
    const subtitleStyleDisplay = React.useMemo(() => {
        if (resolvedSubtitleMode === 'custom') {
            return openaiSubtitleCustomStyle ?? getSubtitleDefaultStyle('custom');
        }
        return getSubtitleDefaultStyle(resolvedSubtitleMode);
    }, [resolvedSubtitleMode, openaiSubtitleCustomStyle]);
    // Watch for dictionary mutual exclusion
    const openaiDictionaryEnabled = watch('openai.enableDictionary');
    const youdaoDictionaryEnabled = watch('youdao.enableDictionary');

    // Watch for transcription mutual exclusion
    const openaiTranscriptionEnabled = watch('openai.enableTranscription');


    // Custom change detection
    const hasChanges = React.useMemo(() => {
        if (!originalValues) return false;
        return JSON.stringify(currentValues) !== JSON.stringify(originalValues);
    }, [currentValues, originalValues]);

    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    React.useEffect(() => {
        hasChangesRef.current = hasChanges;
    }, [hasChanges]);

    const saveSettings = React.useCallback(async (data: ApiSettingVO) => {
        try {
            await api.call('settings/services/update', {
                service: 'openai',
                settings: data
            });

            await api.call('settings/services/update', {
                service: 'tencent',
                settings: data
            });

            await api.call('settings/services/update', {
                service: 'youdao',
                settings: data
            });

            await api.call('settings/services/update', {
                service: 'whisper',
                settings: data
            });

            await mutate();
            setOriginalValues(data);
            logger.info('settings updated successfully');
        } catch (error) {
            logger.error('failed to update settings', { error });
            throw error;
        }
    }, [mutate, logger]);

    const runSave = React.useCallback((data: ApiSettingVO) => {
        if (autoSaveIdleTimerRef.current) {
            clearTimeout(autoSaveIdleTimerRef.current);
            autoSaveIdleTimerRef.current = null;
        }
        const savePromise = (async () => {
            if (isMountedRef.current) {
                setAutoSaveStatus('saving');
                setAutoSaveError(null);
            }
            try {
                await saveSettings(data);
                if (isMountedRef.current) {
                    setAutoSaveStatus('saved');
                    autoSaveIdleTimerRef.current = setTimeout(() => {
                        if (isMountedRef.current) {
                            setAutoSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
                        }
                    }, 2000);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (isMountedRef.current) {
                    setAutoSaveStatus('error');
                    setAutoSaveError(message);
                    toast({
                        variant: 'destructive',
                        title: '保存失败',
                        description: message,
                    });
                }
                throw error;
            }
        })();

        pendingSavePromiseRef.current = savePromise;
        savePromise.finally(() => {
            if (pendingSavePromiseRef.current === savePromise) {
                pendingSavePromiseRef.current = null;
            }
        });
        return savePromise;
    }, [saveSettings, toast]);

    const flushPendingSave = React.useCallback(async () => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        if (pendingSavePromiseRef.current) {
            await pendingSavePromiseRef.current;
        }
        if (!originalValues || !hasChangesRef.current) {
            return;
        }
        await handleSubmit(runSave)();
        if (pendingSavePromiseRef.current) {
            await pendingSavePromiseRef.current;
        }
    }, [handleSubmit, runSave, originalValues]);

    React.useEffect(() => {
        if (!originalValues || !hasChanges) {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
            return;
        }
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
            handleSubmit(runSave)().catch((error) => {
                logger.error('auto save failed', { error });
            });
        }, 800);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, [currentValues, hasChanges, originalValues, handleSubmit, runSave, logger]);

    React.useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
            if (autoSaveIdleTimerRef.current) {
                clearTimeout(autoSaveIdleTimerRef.current);
                autoSaveIdleTimerRef.current = null;
            }
            if (hasChangesRef.current) {
                flushPendingSave().catch(() => undefined);
            }
        };
    }, [flushPendingSave]);

    // Initialize form when settings load
    React.useEffect(() => {
        if (settings) {
            const formData: ApiSettingVO = {
                openai: {
                    key: settings.openai.key || '',
                    endpoint: settings.openai.endpoint || 'https://api.openai.com',
                    model: settings.openai.model || 'gpt-4o-mini',
                    enableSentenceLearning: settings.openai.enableSentenceLearning || true,
                    enableSubtitleTranslation: settings.openai.enableSubtitleTranslation || true,
                    subtitleTranslationMode: settings.openai.subtitleTranslationMode || 'zh',
                    subtitleCustomStyle: settings.openai.subtitleCustomStyle || getSubtitleDefaultStyle('custom'),
                    enableDictionary: settings.openai.enableDictionary ?? true,
                    enableTranscription: settings.openai.enableTranscription ?? true,
                },
                tencent: {
                    secretId: settings.tencent.secretId || '',
                    secretKey: settings.tencent.secretKey || '',
                    enableSubtitleTranslation: settings.tencent.enableSubtitleTranslation || false,
                },
                youdao: {
                    secretId: settings.youdao.secretId || '',
                    secretKey: settings.youdao.secretKey || '',
                    enableDictionary: settings.youdao.enableDictionary ?? false,
                },
                whisper: {
                    enabled: (settings.whisper && settings.whisper.enabled) || false,
                    enableTranscription: (settings.whisper && settings.whisper.enableTranscription) || false,
                    modelSize: (settings.whisper && settings.whisper.modelSize) || 'base',
                    enableVad: (settings.whisper && settings.whisper.enableVad) ?? true,
                    vadModel: (settings.whisper && settings.whisper.vadModel) || 'silero-v6.2.0',
                },
            };
            reset(formData, { keepDefaultValues: false });
            setOriginalValues(formData);
        }
    }, [settings, reset]);


    // Handle mutual exclusion for subtitle translation
    const handleSubtitleTranslationChange = (service: 'openai' | 'tencent', enabled: boolean) => {
        if (enabled) {
            if (service === 'openai') {
                setValue('openai.enableSubtitleTranslation', true);
                setValue('tencent.enableSubtitleTranslation', false);
            } else {
                setValue('tencent.enableSubtitleTranslation', true);
                setValue('openai.enableSubtitleTranslation', false);
            }
        } else {
            // Check if this would leave no subtitle translation enabled
            const otherService = service === 'openai' ? 'tencent' : 'openai';
            const otherEnabled = watch(`${otherService}.enableSubtitleTranslation`);
            if (!otherEnabled) {
                // Prevent disabling - at least one must be enabled
                return;
            }
            setValue(`${service}.enableSubtitleTranslation`, false);
        }
    };

    // Handle mutual exclusion for dictionary
    const handleDictionaryChange = (service: 'openai' | 'youdao', enabled: boolean) => {
        if (enabled) {
            if (service === 'openai') {
                setValue('openai.enableDictionary', true);
                setValue('youdao.enableDictionary', false);
            } else {
                setValue('youdao.enableDictionary', true);
                setValue('openai.enableDictionary', false);
            }
        } else {
            // Check if this would leave no dictionary enabled
            const otherService = service === 'openai' ? 'youdao' : 'openai';
            const otherEnabled = watch(`${otherService}.enableDictionary`);
            if (!otherEnabled) {
                // Prevent disabling - at least one must be enabled
                return;
            }
            setValue(`${service}.enableDictionary`, false);
        }
    };

    // Handle mutual exclusion for transcription
    const handleTranscriptionChange = (service: 'openai' | 'whisper', enabled: boolean) => {
        if (enabled) {
            if (service === 'openai') {
                setValue('openai.enableTranscription', true);
                setValue('whisper.enableTranscription', false);
            } else {
                const targetSize = (whisperModelSize === 'large' ? 'large' : 'base') as 'base' | 'large';
                const modelReady = whisperModelStatus?.whisper?.[targetSize]?.exists;
                if (!modelReady) {
                    toast({
                        title: '需要先下载模型',
                        description: `请先下载 Whisper ${targetSize} 模型，下载完成后才能开启转录。`,
                        variant: 'destructive',
                    });
                    setValue('whisper.enableTranscription', false);
                    return;
                }
                setValue('whisper.enableTranscription', true);
                setValue('openai.enableTranscription', false);
                // Also enable whisper service when transcription is enabled
                setValue('whisper.enabled', true);
            }
        } else {
            // Check if this would leave no transcription enabled
            const otherEnabled = service === 'openai' ? whisperTranscriptionEnabled : openaiTranscriptionEnabled;
            if (!otherEnabled) {
                // Prevent disabling - at least one must be enabled
                return;
            }
            if (service === 'openai') {
                setValue('openai.enableTranscription', false);
            } else {
                setValue('whisper.enableTranscription', false);
            }
        }
    };

    const downloadSelectedWhisperModel = async () => {
        const size = (whisperModelSize === 'large' ? 'large' : 'base') as 'base' | 'large';
        const key = `whisper:${size}`;
        setDownloadingWhisperModel(true);
        setDownloadProgressByKey((prev) => ({ ...prev, [key]: { percent: 0 } }));
        try {
            await api.call('whisper/models/download', { modelSize: size });
            toast({ title: '下载完成', description: `Whisper 模型已下载：${size}` });
            await refreshWhisperModelStatus();
        } catch (error) {
            toast({
                title: '下载失败',
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive',
            });
        } finally {
            setDownloadingWhisperModel(false);
        }
    };

    const downloadSelectedVadModel = async () => {
        const vadModel = (whisperVadModel === 'silero-v5.1.2' ? 'silero-v5.1.2' : 'silero-v6.2.0') as 'silero-v5.1.2' | 'silero-v6.2.0';
        const key = `vad:${vadModel}`;
        setDownloadingVadModel(true);
        setDownloadProgressByKey((prev) => ({ ...prev, [key]: { percent: 0 } }));
        try {
            await api.call('whisper/models/download-vad', { vadModel });
            toast({ title: '下载完成', description: `VAD 模型已下载：${vadModel}` });
            await refreshWhisperModelStatus();
        } catch (error) {
            toast({
                title: '下载失败',
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive',
            });
        } finally {
            setDownloadingVadModel(false);
        }
    };


    const testProvider = async (provider: 'openai' | 'tencent' | 'youdao') => {
        const setTesting = {
            'openai': setTestingOpenAi,
            'tencent': setTestingTencent,
            'youdao': setTestingYoudao
        }[provider];

        const setResult = {
            'openai': setOpenAiTestResult,
            'tencent': setTencentTestResult,
            'youdao': setYoudaoTestResult
        }[provider];

        setTesting(true);
        setResult(null);

        try {
            await flushPendingSave();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setResult({
                success: false,
                message: `自动保存设置失败，请稍后重试：${message}`
            });
            setTesting(false);
            return;
        }

        try {
            const routeMap: Record<typeof provider, 'settings/services/test-openai' | 'settings/services/test-tencent' | 'settings/services/test-youdao'> = {
                openai: 'settings/services/test-openai',
                tencent: 'settings/services/test-tencent',
                youdao: 'settings/services/test-youdao',
            };
            const result = await api.call(routeMap[provider]);
            setResult(result);
        } catch (error) {
            setResult({
                success: false,
                message: `连接测试时发生错误: ${error}`
            });
        } finally {
            setTesting(false);
        }
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                handleSubmit(runSave)().catch((error) => {
                    logger.error('manual submit failed', { error });
                });
            }}
            className="w-full h-full flex flex-col gap-6"
        >
            <Header title="服务配置" description="配置 API 服务和本地服务的功能设置" />

            <div className="flex flex-col gap-6 h-0 flex-1 overflow-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-gray-300">
                {/* OpenAI Service */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bot className="h-5 w-5" />
                            OpenAI
                        </CardTitle>
                        <CardDescription>
                            配置 OpenAI 服务，支持整句学习和字幕翻译功能
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="openai-key">API Key</Label>
                                <Input
                                    id="openai-key"
                                    type="password"
                                    placeholder="sk-******************"
                                    {...register('openai.key')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="openai-endpoint">API 端点</Label>
                                <Input
                                    id="openai-endpoint"
                                    placeholder="https://api.openai.com"
                                    {...register('openai.endpoint')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="openai-model">模型</Label>
                            <div className="flex items-center gap-2 w-64">
                                <Input
                                    id="openai-model"
                                    placeholder="例如 gpt-4o-mini"
                                    className="flex-1"
                                    {...register('openai.model')}
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" type="button" className="shrink-0">
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {OPENAI_MODEL_PRESETS.map((preset) => (
                                            <DropdownMenuItem
                                                key={preset.value}
                                                onSelect={() => setValue('openai.model', preset.value, { shouldDirty: true, shouldTouch: true })}
                                            >
                                                {preset.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">启用功能</Label>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="openai-sentence-learning"
                                        checked={watch('openai.enableSentenceLearning')}
                                        onCheckedChange={(checked) => {
                                            if (!checked) return; // 禁止取消整句学习
                                            setValue('openai.enableSentenceLearning', true);
                                        }}
                                    />
                                    <Label htmlFor="openai-sentence-learning" className="font-normal">
                                        整句学习
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="openai-subtitle-translation"
                                        checked={openaiSubtitleEnabled}
                                        onCheckedChange={(checked) => handleSubtitleTranslationChange('openai', !!checked)}
                                    />
                                    <Label htmlFor="openai-subtitle-translation" className="font-normal">
                                        字幕翻译
                                        {tencentSubtitleEnabled && (
                                            <span className="text-xs text-muted-foreground ml-2">(与腾讯云翻译互斥)</span>
                                        )}
                                    </Label>
                                </div>
                                {openaiSubtitleEnabled && (
                                    <div className="pl-6 space-y-3">
                                        <div className="space-y-3">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium">字幕翻译输出</Label>
                                                <Select
                                                    value={resolvedSubtitleMode}
                                                    onValueChange={(value) => setValue('openai.subtitleTranslationMode', value as 'zh' | 'simple_en' | 'custom')}
                                                >
                                                    <SelectTrigger className="w-64">
                                                        <SelectValue placeholder="选择翻译输出" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="zh">翻译成中文</SelectItem>
                                                        <SelectItem value="simple_en">输出简易英文</SelectItem>
                                                        <SelectItem value="custom">自定义风格</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium">翻译风格</Label>
                                                <Textarea
                                                    value={subtitleStyleDisplay}
                                                    onChange={(event) => {
                                                        if (isCustomSubtitleMode) {
                                                            setValue('openai.subtitleCustomStyle', event.target.value, { shouldDirty: true });
                                                        }
                                                    }}
                                                    placeholder="示例：保持自然口语化，语句顺畅并兼顾字幕节奏。"
                                                    className="h-32"
                                                    readOnly={!isCustomSubtitleMode}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    自定义模式下可描述语气、细节程度、用词偏好等要求；预设模式展示系统默认风格。
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="openai-dictionary"
                                        checked={openaiDictionaryEnabled}
                                        onCheckedChange={(checked) => handleDictionaryChange('openai', !!checked)}
                                    />
                                    <Label htmlFor="openai-dictionary" className="font-normal">
                                        词典查询
                                        {youdaoDictionaryEnabled && (
                                            <span className="text-xs text-muted-foreground ml-2">(与有道词典互斥)</span>
                                        )}
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="openai-transcription"
                                        checked={openaiTranscriptionEnabled}
                                        onCheckedChange={(checked) => handleTranscriptionChange('openai', !!checked)}
                                    />
                                    <Label htmlFor="openai-transcription" className="font-normal">
                                        字幕转录
                                        {whisperEnabled && (
                                            <span className="text-xs text-muted-foreground ml-2">(与 Whisper 转录互斥)</span>
                                        )}
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {openAiTestResult && (
                                    <>
                                        {openAiTestResult.success ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <span className={`text-sm ${openAiTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                            {openAiTestResult.message}
                                        </span>
                                    </>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => testProvider('openai')}
                                disabled={testingOpenAi}
                                className="flex items-center gap-2"
                            >
                                <TestTube className="h-4 w-4" />
                                {testingOpenAi ? '测试中...' : '测试连接'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tencent Service */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Languages className="h-5 w-5" />
                            腾讯云翻译
                        </CardTitle>
                        <CardDescription>
                            配置腾讯云翻译服务，提供快速字幕翻译功能
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tencent-secret-id">Secret ID</Label>
                                <Input
                                    id="tencent-secret-id"
                                    placeholder="AKI******************"
                                    {...register('tencent.secretId')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tencent-secret-key">Secret Key</Label>
                                <Input
                                    id="tencent-secret-key"
                                    type="password"
                                    placeholder="******************"
                                    {...register('tencent.secretKey')}
                                />
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">启用功能</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="tencent-subtitle-translation"
                                    checked={tencentSubtitleEnabled}
                                    onCheckedChange={(checked) => handleSubtitleTranslationChange('tencent', !!checked)}
                                />
                                <Label htmlFor="tencent-subtitle-translation" className="font-normal">
                                    字幕翻译
                                    {openaiSubtitleEnabled && (
                                        <span className="text-xs text-muted-foreground ml-2">(与OpenAI翻译互斥)</span>
                                    )}
                                </Label>
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {tencentTestResult && (
                                    <>
                                        {tencentTestResult.success ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <span className={`text-sm ${tencentTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                            {tencentTestResult.message}
                                        </span>
                                    </>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => testProvider('tencent')}
                                disabled={testingTencent}
                                className="flex items-center gap-2"
                            >
                                <TestTube className="h-4 w-4" />
                                {testingTencent ? '测试中...' : '测试连接'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Youdao Service */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Book className="h-5 w-5" />
                            有道词典
                        </CardTitle>
                        <CardDescription>
                            配置有道智云服务，提供单词词典查询功能
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="youdao-secret-id">App Key</Label>
                                <Input
                                    id="youdao-secret-id"
                                    placeholder="应用ID"
                                    {...register('youdao.secretId')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="youdao-secret-key">App Secret</Label>
                                <Input
                                    id="youdao-secret-key"
                                    type="password"
                                    placeholder="******************"
                                    {...register('youdao.secretKey')}
                                />
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">启用功能</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="youdao-dictionary"
                                    checked={youdaoDictionaryEnabled}
                                    onCheckedChange={(checked) => handleDictionaryChange('youdao', !!checked)}
                                />
                                <Label htmlFor="youdao-dictionary" className="font-normal">
                                    词典查询
                                    {openaiDictionaryEnabled && (
                                        <span className="text-xs text-muted-foreground ml-2">(与OpenAI词典互斥)</span>
                                    )}
                                </Label>
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {youdaoTestResult && (
                                    <>
                                        {youdaoTestResult.success ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <span className={`text-sm ${youdaoTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                            {youdaoTestResult.message}
                                        </span>
                                    </>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => testProvider('youdao')}
                                disabled={testingYoudao}
                                className="flex items-center gap-2"
                            >
                                <TestTube className="h-4 w-4" />
                                {testingYoudao ? '测试中...' : '测试连接'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Whisper Local Service */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Cpu className="h-5 w-5" />
                            Whisper 本地字幕识别
                        </CardTitle>
                        <CardDescription>
                            本地离线语音识别服务，无需网络连接即可生成字幕
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        <Separator orientation="horizontal" />


                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">启用功能</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="whisper-transcription"
                                    checked={whisperTranscriptionEnabled}
                                    onCheckedChange={(checked) => {
                                        handleTranscriptionChange('whisper', !!checked);
                                    }}
                                />
                                <Label htmlFor="whisper-transcription" className="font-normal">
                                    本地字幕转录
                                    {openaiTranscriptionEnabled && (
                                        <span className="text-xs text-muted-foreground ml-2">(与 OpenAI 转录互斥)</span>
                                    )}
                                </Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                启用后，转录功能将优先使用本地 Whisper 引擎
                            </p>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">模型选择</Label>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">模型大小</Label>
                                    <Select
                                        value={whisperModelSize || 'base'}
                                        onValueChange={(v) => {
                                            setValue('whisper.modelSize', v as 'base' | 'large');
                                        }}
                                        disabled={false}
                                    >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择模型" />
                                    </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="base">base（速度快）</SelectItem>
                                            <SelectItem value="large">large（更准）</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        需要先下载模型，下载完成后才能转录
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">模型管理</Label>
                            <div className="grid grid-cols-1 gap-3 text-sm">
	                                <div className="flex items-center justify-between gap-3">
	                                    {(() => {
	                                        const size = (whisperModelSize === 'large' ? 'large' : 'base') as 'base' | 'large';
	                                        const key = `whisper:${size}`;
	                                        const status = whisperModelStatus?.whisper?.[size];
	                                        const p = downloadProgressByKey[key]?.percent;
	                                        const showProgress = downloadingWhisperModel && (p != null) && !status?.exists;
	                                        return (
	                                            <>
	                                                <div className="min-w-0">
	                                                    <div className="font-medium">
	                                                        Whisper {whisperModelSize === 'large' ? 'large' : 'base'} 模型
	                                                    </div>
	                                                    <div className="text-xs text-muted-foreground break-all">
	                                                        {status?.path || '...'}
	                                                    </div>
	                                                    <div className="text-xs text-muted-foreground">
	                                                        状态：{status?.exists ? '已下载' : (showProgress ? `下载中 ${p}%` : '未下载')}
	                                                    </div>
	                                                    {showProgress && (
	                                                        <div className="mt-2">
	                                                            <Progress value={p} />
	                                                        </div>
	                                                    )}
	                                                </div>
	                                                <Button
	                                                    type="button"
	                                                    variant="outline"
	                                                    size="sm"
	                                                    onClick={() => downloadSelectedWhisperModel().catch(() => null)}
	                                                    disabled={downloadingWhisperModel || !!status?.exists}
	                                                >
	                                                    {status?.exists ? '已下载' : (downloadingWhisperModel ? '下载中...' : '下载')}
	                                                </Button>
	                                            </>
	                                        );
	                                    })()}
	                                </div>

	                                <div className="flex items-center justify-between gap-3">
	                                    {(() => {
	                                        const vadModel = (whisperVadModel === 'silero-v5.1.2' ? 'silero-v5.1.2' : 'silero-v6.2.0') as 'silero-v5.1.2' | 'silero-v6.2.0';
	                                        const key = `vad:${vadModel}`;
	                                        const status = whisperModelStatus?.vad?.[vadModel];
	                                        const p = downloadProgressByKey[key]?.percent;
	                                        const showProgress = downloadingVadModel && (p != null) && !status?.exists;
	                                        return (
	                                            <>
	                                                <div className="min-w-0">
	                                                    <div className="font-medium">
	                                                        VAD 模型（{whisperVadModel === 'silero-v5.1.2' ? 'silero-v5.1.2' : 'silero-v6.2.0'}）
	                                                    </div>
	                                                    <div className="text-xs text-muted-foreground break-all">
	                                                        {status?.path || '...'}
	                                                    </div>
	                                                    <div className="text-xs text-muted-foreground">
	                                                        状态：{status?.exists ? '已下载' : (showProgress ? `下载中 ${p}%` : '未下载')}
	                                                    </div>
	                                                    {showProgress && (
	                                                        <div className="mt-2">
	                                                            <Progress value={p} />
	                                                        </div>
	                                                    )}
	                                                </div>
	                                                <Button
	                                                    type="button"
	                                                    variant="outline"
	                                                    size="sm"
	                                                    onClick={() => downloadSelectedVadModel().catch(() => null)}
	                                                    disabled={downloadingVadModel || !whisperEnableVad || !!status?.exists}
	                                                >
	                                                    {status?.exists ? '已下载' : (downloadingVadModel ? '下载中...' : '下载')}
	                                                </Button>
	                                            </>
	                                        );
	                                    })()}
	                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-xs text-muted-foreground">
                                            存储目录：{whisperModelStatus?.modelsRoot || '...'}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => refreshWhisperModelStatus().catch(() => null)}
                                    >
                                        刷新
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                提示：开启本地转录前必须下载对应的 Whisper 模型；开启 VAD 则需要下载 VAD 模型
                            </p>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">自动 VAD</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="whisper-enable-vad"
                                    checked={!!whisperEnableVad}
                                    onCheckedChange={(checked) => {
                                        setValue('whisper.enableVad', !!checked);
                                    }}
                                    disabled={false}
                                />
                                <Label htmlFor="whisper-enable-vad" className="font-normal">
                                    启用静音检测（VAD）
                                </Label>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">VAD 模型</Label>
                                <Select
                                    value={whisperVadModel || 'silero-v6.2.0'}
                                    onValueChange={(v) => {
                                        setValue('whisper.vadModel', v as 'silero-v5.1.2' | 'silero-v6.2.0');
                                    }}
                                    disabled={!whisperEnableVad}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择 VAD 模型" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="silero-v6.2.0">silero-v6.2.0（推荐）</SelectItem>
                                        <SelectItem value="silero-v5.1.2">silero-v5.1.2</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    开启后需要下载 VAD 模型，用于提升长音频转录稳定性
                                </p>
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">功能说明</Label>
                            <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <HardDrive className="h-4 w-4" />
                                    <span>本地运行，保护隐私</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Cpu className="h-4 w-4" />
                                    <span>支持中英文语音识别</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <HardDrive className="h-4 w-4" />
                                    <span>自动生成 SRT 字幕文件</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <FooterWrapper>
                <Button
                    onClick={async () => {
                        await api.call('system/open-url', 'https://solidspoon.xyz/DashPlayer/');
                    }}
            variant="secondary"
        >
            查看文档
        </Button>
            </FooterWrapper>
        </form>
    );
};

export default ServiceManagementSetting;
