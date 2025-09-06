import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import Separator from '@/fronted/components/Separtor';
import { Bot, Languages, Book, TestTube, CheckCircle, XCircle, Download, Cpu, HardDrive } from 'lucide-react';
import Header from '@/fronted/components/setting/Header';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import {ApiSettingVO} from "@/common/types/vo/api-setting-vo";
import { useToast } from '@/fronted/components/ui/use-toast';

const api = window.electron;

const ServiceManagementSetting = () => {
    // Fetch settings with SWR
    const { data: settings, mutate } = useSWR('settings/get-all-services', () =>
        api.call('settings/get-all-services')
    );

    const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<ApiSettingVO>();
    const { toast } = useToast();
    
    // Register hidden fields for Whisper to ensure they're included in form data
    register('whisper.enabled');
    register('whisper.enableTranscription');
    
    // Whisper settings - now part of main form
    const whisperEnabled = watch('whisper.enabled');
    const whisperTranscriptionEnabled = watch('whisper.enableTranscription');

    // Test states
    const [testingOpenAi, setTestingOpenAi] = React.useState(false);
    const [testingTencent, setTestingTencent] = React.useState(false);
    const [testingYoudao, setTestingYoudao] = React.useState(false);

    // Test results
    const [openAiTestResult, setOpenAiTestResult] = React.useState<{ success: boolean, message: string } | null>(null);
    const [tencentTestResult, setTencentTestResult] = React.useState<{ success: boolean, message: string } | null>(null);
    const [youdaoTestResult, setYoudaoTestResult] = React.useState<{ success: boolean, message: string } | null>(null);

    // Whisper states
    const [whisperModelDownloaded, setWhisperModelDownloaded] = React.useState(false);
    const [downloading, setDownloading] = React.useState(false);
    const [downloadProgress, setDownloadProgress] = React.useState(0);

    // Store original values for change detection
    const [originalValues, setOriginalValues] = React.useState<ApiSettingVO | null>(null);

    // Watch all form values for change detection
    const currentValues = watch();

    // Watch for subtitle translation mutual exclusion
    const openaiSubtitleEnabled = watch('openai.enableSubtitleTranslation');
    const tencentSubtitleEnabled = watch('tencent.enableSubtitleTranslation');

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
                },
            };
            reset(formData, { keepDefaultValues: false });
            setOriginalValues(formData);
        }
    }, [settings, reset]);

    // Check Whisper model status
    React.useEffect(() => {
        const checkModelStatus = async () => {
            try {
                const downloaded = await api.call('system-is-whisper-model-downloaded');
                setWhisperModelDownloaded(downloaded);
            } catch (error) {
                console.error('Failed to check Whisper model status:', error);
            }
        };
        checkModelStatus();
    }, []);

    // Register renderer API for progress updates
    React.useEffect(() => {
        const unregister = api.registerRendererApis({
            'whisper/download-progress': (params: { progress: number }) => {
                console.log('🔥 Received download progress:', params.progress);
                setDownloadProgress(params.progress);
            }
        });
        
        return () => {
            unregister();
        };
    }, []);

    // Handle model download
    const downloadModel = async () => {
        console.log('🔥 Download button clicked!');
        console.log('🔥 Current whisperModelDownloaded:', whisperModelDownloaded);
        console.log('🔥 Current downloading:', downloading);
        
        if (downloading) {
            console.log('🔥 Already downloading, ignoring click');
            return;
        }
        
        // 双重检查：如果已经下载，直接提示用户
        if (whisperModelDownloaded) {
            toast({
                title: "模型已存在",
                description: "Whisper 模型已经下载完成，无需重复下载",
            });
            return;
        }
        
        setDownloading(true);
        setDownloadProgress(0);
        console.log('🔥 Starting model download...');
        
        try {
            const result = await api.call('whisper-download-model');
            console.log('🔥 Download API call result:', result);
            console.log('🔥 Download completed, checking model status...');
            
            const downloaded = await api.call('system-is-whisper-model-downloaded');
            console.log('🔥 Model downloaded status:', downloaded);
            setWhisperModelDownloaded(downloaded);
            
            toast({
                title: "模型下载完成",
                description: "Whisper 模型已成功下载并安装",
            });
        } catch (error) {
            console.error('🔥 Download failed:', error);
            toast({
                title: "模型下载失败",
                description: `下载过程中发生错误: ${error}`,
                variant: "destructive",
            });
        } finally {
            setDownloading(false);
        }
    };

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

        // 检查是否有未保存的更改
        if (hasChanges) {
            setResult({
                success: false,
                message: '请先保存配置后再测试'
            });
            return;
        }

        setTesting(true);
        setResult(null);
        try {
            const result = await api.call(`settings/test-${provider}` as 'settings/test-openai' | 'settings/test-tencent' | 'settings/test-youdao');
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

    const onSubmit = async (data: ApiSettingVO) => {
        try {
                        
            // Update OpenAI service
            await api.call('settings/update-service', {
                service: 'openai',
                settings: data
            });

            // Update Tencent service
            await api.call('settings/update-service', {
                service: 'tencent',
                settings: data
            });

            // Update Youdao service
            await api.call('settings/update-service', {
                service: 'youdao',
                settings: data
            });

            // Update Whisper service
            await api.call('settings/update-service', {
                service: 'whisper',
                settings: data
            });

            // Refresh settings data and update original values
            await mutate();
            setOriginalValues(data);
            console.log('Settings updated successfully');
        } catch (error) {
            console.error('Failed to update settings:', error);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="w-full h-full flex flex-col gap-6">
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
                            <Select value={watch('openai.model')} onValueChange={(value) => setValue('openai.model', value)}>
                                <SelectTrigger className="w-64">
                                    <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gpt-4o-mini">gpt-4o-mini (推荐)</SelectItem>
                                    <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                                    <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                                </SelectContent>
                            </Select>
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
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">模型状态</Label>
                            <div className="flex items-center gap-2">
                                {whisperModelDownloaded ? (
                                    <>
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        <span className="text-sm text-green-600">模型已下载</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="h-4 w-4 text-red-500" />
                                        <span className="text-sm text-red-600">模型未下载</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <Separator orientation="horizontal" />

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">模型管理</Label>
                            <div className="flex items-center gap-4">
                                <Button
                                    type="button"
                                    variant={whisperModelDownloaded ? "outline" : "default"}
                                    size="sm"
                                    onClick={downloadModel}
                                    disabled={downloading}
                                    className="flex items-center gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    {downloading ? '下载中...' : whisperModelDownloaded ? '重新下载' : '下载模型'}
                                </Button>
                                {downloading && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <div className="w-24 bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${downloadProgress * 100}%` }}
                                            ></div>
                                        </div>
                                        <span>{Math.round(downloadProgress * 100)}%</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                模型大小约 1.2GB，下载后支持本地离线语音识别
                            </p>
                        </div>

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
                                    disabled={!whisperModelDownloaded}
                                />
                                <Label htmlFor="whisper-transcription" className="font-normal">
                                    本地字幕转录
                                    {!whisperModelDownloaded && (
                                        <span className="text-xs text-muted-foreground ml-2">(需要先下载模型)</span>
                                    )}
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
                                    <Download className="h-4 w-4" />
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
                <Button
                    type="submit"
                    disabled={!hasChanges || isSubmitting}
                >
                    {isSubmitting ? '保存中...' : '保存配置'}
                </Button>
            </FooterWrapper>
        </form>
    );
};

export default ServiceManagementSetting;
