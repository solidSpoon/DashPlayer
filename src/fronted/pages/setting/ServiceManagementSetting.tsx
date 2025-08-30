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
import { Bot, Languages, Book, TestTube, CheckCircle, XCircle } from 'lucide-react';
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
    
    // Test states
    const [testingOpenAi, setTestingOpenAi] = React.useState(false);
    const [testingTencent, setTestingTencent] = React.useState(false);
    const [testingYoudao, setTestingYoudao] = React.useState(false);
    
    // Test results
    const [openAiTestResult, setOpenAiTestResult] = React.useState<{ success: boolean, message: string } | null>(null);
    const [tencentTestResult, setTencentTestResult] = React.useState<{ success: boolean, message: string } | null>(null);
    const [youdaoTestResult, setYoudaoTestResult] = React.useState<{ success: boolean, message: string } | null>(null);

    // Store original values for change detection
    const [originalValues, setOriginalValues] = React.useState<ApiSettingVO | null>(null);

    // Watch all form values for change detection
    const currentValues = watch();

    // Watch for subtitle translation mutual exclusion
    const openaiSubtitleEnabled = watch('openai.enableSubtitleTranslation');
    const tencentSubtitleEnabled = watch('tencent.enableSubtitleTranslation');

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
                    enableSentenceLearning: settings.openai.enableSentenceLearning || false,
                    enableSubtitleTranslation: settings.openai.enableSubtitleTranslation || false,
                },
                tencent: {
                    secretId: settings.tencent.secretId || '',
                    secretKey: settings.tencent.secretKey || '',
                    enableSubtitleTranslation: settings.tencent.enableSubtitleTranslation || false,
                },
                youdao: {
                    secretId: settings.youdao.secretId || '',
                    secretKey: settings.youdao.secretKey || '',
                    enableDictionary: settings.youdao.enableDictionary || false,
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
            setValue(`${service}.enableSubtitleTranslation`, false);
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
            <Header title="API 配置" description="配置各项 API 服务的密钥和功能启用状态" />

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
                                        onCheckedChange={(checked) => setValue('openai.enableSentenceLearning', !!checked)}
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
                                    checked={watch('youdao.enableDictionary')}
                                    onCheckedChange={(checked) => setValue('youdao.enableDictionary', !!checked)}
                                />
                                <Label htmlFor="youdao-dictionary" className="font-normal">
                                    词典查询
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
