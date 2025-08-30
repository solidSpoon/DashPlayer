import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import Separator from '@/fronted/components/Separtor';
import { Bot, Languages, Book } from 'lucide-react';
import Header from '@/fronted/components/setting/Header';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';

const api = window.electron;

type ServiceSettings = {
    openai: ServiceConfig;
    tencent: ServiceConfig;
    youdao: ServiceConfig;
};

type ServiceConfig = {
    credentials: Record<string, string>;
    enabledFeatures: Record<string, boolean>;
};

type FormData = {
    openai: {
        key: string;
        endpoint: string;
        model: string;
        enableSentenceLearning: boolean;
        enableSubtitleTranslation: boolean;
    };
    tencent: {
        secretId: string;
        secretKey: string;
        enableSubtitleTranslation: boolean;
    };
    youdao: {
        secretId: string;
        secretKey: string;
        enableDictionary: boolean;
    };
};

const ServiceManagementSetting = () => {
    const { register, handleSubmit, watch, setValue, reset, formState: { isDirty, isSubmitting } } = useForm<FormData>({
        defaultValues: {
            openai: {
                key: '',
                endpoint: 'https://api.openai.com',
                model: 'gpt-4o-mini',
                enableSentenceLearning: false,
                enableSubtitleTranslation: false,
            },
            tencent: {
                secretId: '',
                secretKey: '',
                enableSubtitleTranslation: true,
            },
            youdao: {
                secretId: '',
                secretKey: '',
                enableDictionary: true,
            },
        }
    });

    // Watch for subtitle translation mutual exclusion
    const openaiSubtitleEnabled = watch('openai.enableSubtitleTranslation');
    const tencentSubtitleEnabled = watch('tencent.enableSubtitleTranslation');

    // Load settings on mount
    React.useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings: ServiceSettings = await api.call('settings/get-all-services');
                reset({
                    openai: {
                        key: settings.openai.credentials.key || '',
                        endpoint: settings.openai.credentials.endpoint || 'https://api.openai.com',
                        model: settings.openai.credentials.model || 'gpt-4o-mini',
                        enableSentenceLearning: settings.openai.enabledFeatures.sentenceLearning || false,
                        enableSubtitleTranslation: settings.openai.enabledFeatures.subtitleTranslation || false,
                    },
                    tencent: {
                        secretId: settings.tencent.credentials.secretId || '',
                        secretKey: settings.tencent.credentials.secretKey || '',
                        enableSubtitleTranslation: settings.tencent.enabledFeatures.subtitleTranslation || false,
                    },
                    youdao: {
                        secretId: settings.youdao.credentials.secretId || '',
                        secretKey: settings.youdao.credentials.secretKey || '',
                        enableDictionary: settings.youdao.enabledFeatures.dictionary || false,
                    },
                });
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        };
        loadSettings();
    }, [reset]);

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

    const onSubmit = async (data: FormData) => {
        try {
            // Update OpenAI service
            await api.call('settings/update-service', {
                service: 'openai',
                settings: {
                    credentials: {
                        key: data.openai.key,
                        endpoint: data.openai.endpoint,
                        model: data.openai.model,
                    },
                    enabledFeatures: {
                        sentenceLearning: data.openai.enableSentenceLearning,
                        subtitleTranslation: data.openai.enableSubtitleTranslation,
                    }
                }
            });

            // Update Tencent service
            await api.call('settings/update-service', {
                service: 'tencent',
                settings: {
                    credentials: {
                        secretId: data.tencent.secretId,
                        secretKey: data.tencent.secretKey,
                    },
                    enabledFeatures: {
                        subtitleTranslation: data.tencent.enableSubtitleTranslation,
                    }
                }
            });

            // Update Youdao service
            await api.call('settings/update-service', {
                service: 'youdao',
                settings: {
                    credentials: {
                        secretId: data.youdao.secretId,
                        secretKey: data.youdao.secretKey,
                    },
                    enabledFeatures: {
                        dictionary: data.youdao.enableDictionary,
                    }
                }
            });

            console.log('Settings updated successfully');
        } catch (error) {
            console.error('Failed to update settings:', error);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="w-full h-full flex flex-col gap-6">
            <Header title="AI 服务配置" description="配置各项 AI 服务的密钥和功能启用状态" />
            
            <div className="flex flex-col gap-6">
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
                    disabled={!isDirty || isSubmitting}
                >
                    {isSubmitting ? '保存中...' : '保存配置'}
                </Button>
            </FooterWrapper>
        </form>
    );
};

export default ServiceManagementSetting;