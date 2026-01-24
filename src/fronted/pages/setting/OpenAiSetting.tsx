import SettingInput from '@/fronted/components/setting/SettingInput';
import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import Header from '@/fronted/components/setting/Header';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/fronted/components/ui/dropdown-menu';
import { EllipsisVertical, Eraser, SquarePlus } from 'lucide-react';
import * as React from 'react';
import { AiProviderConfig } from '@/common/types/store_schema';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/fronted/components/ui/dialog';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Switch } from '@/fronted/components/ui/switch';
import { v4 as uuidv4 } from 'uuid';


const api = window.electron;
const OpenAiSetting = () => {
    const { setting: streamSetting, setSettingFunc: setStreamSettingFunc, submit: submitStream, eqServer: eqStreamServer } = useSettingForm([
        'apiKeys.openAi.stream'
    ]);

    const [configs, setConfigs] = React.useState<AiProviderConfig[]>([]);
    const [activeConfigId, setActiveConfigId] = React.useState<string>('');
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [currentConfig, setCurrentConfig] = React.useState<AiProviderConfig | null>(null);
    const [initialConfigs, setInitialConfigs] = React.useState<AiProviderConfig[]>([]); // New state to store initial configs
    const [initialActiveConfigId, setInitialActiveConfigId] = React.useState<string>(''); // New state to store initial active config ID

    React.useEffect(() => {
        const loadConfigs = async () => {
            let parsedConfigs: AiProviderConfig[] = await api.call('setting/ai-providers/get') ?? []; // Default to empty array

            if (!Array.isArray(parsedConfigs)) {
                parsedConfigs = [];
            }
            setConfigs(parsedConfigs);
            setInitialConfigs(parsedConfigs); // Store initial value

            const storedActiveId = await api.call('setting/ai-providers/get-active');
            console.log('storedActiveId:', storedActiveId);
            const finalActiveId = storedActiveId || (parsedConfigs.length > 0 ? parsedConfigs[0].id : '');
            setActiveConfigId(finalActiveId);
            setInitialActiveConfigId(finalActiveId); // Store initial value
            console.log('final activeConfigId:', finalActiveId);
        };
        loadConfigs();
    }, []);

    const hasConfigsChanged = React.useMemo(() => {
        // Deep comparison for configs array
        if (configs.length !== initialConfigs.length) return true;
        for (let i = 0; i < configs.length; i++) {
            const current = configs[i];
            const initial = initialConfigs[i];
            if (!initial || // If initial config at this index doesn't exist (shouldn't happen with length check, but for safety)
                current.id !== initial.id ||
                current.name !== initial.name ||
                current.apiKey !== initial.apiKey ||
                current.endpoint !== initial.endpoint ||
                current.model !== initial.model) {
                return true;
            }
        }
        // Compare activeConfigId
        if (activeConfigId !== initialActiveConfigId) return true;

        return false;
    }, [configs, activeConfigId, initialConfigs, initialActiveConfigId]);

    // Function to handle saving/updating a configuration from the modal
    const handleSaveConfig = () => {
        if (!currentConfig) return;

        // Basic validation
        if (!currentConfig.name.trim()) {
            alert('Configuration name cannot be empty.');
            return;
        }
        if (!currentConfig.apiKey.trim()) {
            alert('API Key cannot be empty.');
            return;
        }
        if (!currentConfig.endpoint.trim()) {
            alert('Endpoint cannot be empty.');
            return;
        }
        if (!currentConfig.model.trim()) {
            alert('Model cannot be empty.');
            return;
        }

        setConfigs((prevConfigs) => {
            const safePrevConfigs = Array.isArray(prevConfigs) ? prevConfigs : [];
            const existingIndex = safePrevConfigs.findIndex((c) => c.id === currentConfig.id);
            if (existingIndex > -1) {
                // Update existing config
                const newConfigs = [...safePrevConfigs];
                newConfigs[existingIndex] = currentConfig;
                return newConfigs;
            } else {
                // Add new config
                return [...safePrevConfigs, currentConfig];
            }
        });
        setIsModalOpen(false);
        setCurrentConfig(null);
    };

    const handleDeleteConfig = (id: string) => {
        if (window.confirm('Are you sure you want to delete this configuration?')) {
            setConfigs((prevConfigs) => prevConfigs.filter((c) => c.id !== id));
            if (activeConfigId === id) {
                setActiveConfigId(''); // Clear active if deleted
            }
        }
    };


    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="OpenAI" description="配置 OpenAI 密钥以启用转录、AI 生成等功能" />
            <ItemWrapper>
                <div className="flex flex-col gap-4 w-full">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">AI Provider Configurations</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCurrentConfig({ id: uuidv4(), name: '', apiKey: '', endpoint: '', model: '' });
                                setIsModalOpen(true);
                            }}
                        >
                            <SquarePlus className="mr-2 h-4 w-4" /> Add New
                        </Button>
                    </div>

                    {configs.length === 0 ? (
                        <p className="text-gray-500">No AI provider configurations found. Click "Add New" to create one.</p>
                    ) : (
                        <div className="border rounded-md divide-y divide-gray-200">
                            {configs.map((config) => (
                                <div key={config.id} className="flex items-center justify-between p-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="activeConfig"
                                            checked={activeConfigId === config.id}
                                            onChange={() => setActiveConfigId(config.id)}
                                            className="form-radio h-4 w-4 text-blue-600"
                                        />
                                        <span>{config.name} {activeConfigId === config.id && '(Active)'}</span>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <EllipsisVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => {
                                                setCurrentConfig(config);
                                                setIsModalOpen(true);
                                            }}>
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDeleteConfig(config.id)}>
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Streaming Response Section - now uses streamSetting */}
                {/* <div className="flex flex-col gap-2 pl-2">
                    <Label>Streaming Response</Label>
                    <div className="flex items-center space-x-2">
                        <Switch id="stream"
                                checked={streamSetting('apiKeys.openAi.stream') === 'on'}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        setStreamSettingFunc('apiKeys.openAi.stream')('on');
                                    } else {
                                        setStreamSettingFunc('apiKeys.openAi.stream')('off');
                                    }
                                }}
                        />
                        <Label
                            className="font-light">观察到有些代理商在启用流式响应时会出现问题，如果你遇到问题，请尝试关闭此选项</Label>
                    </div>
                </div> */}

                <div
                    className={cn(
                        'text-sm text-gray-500 mt-2 flex flex-row gap-2'
                    )}
                >
                    你需要配置 OpenAI 密钥以启用转录、AI 生成等功能，详见
                    <a
                        className={cn('underline')}
                        onClick={async () => {
                            await api.call('system/open-url',
                                'https://solidspoon.xyz/DashPlayer/'
                            );
                        }}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        文档
                    </a>
                </div>
            </ItemWrapper>
            <FooterWrapper>
                <Button
                    onClick={async () => {
                        await api.call('system/open-url',
                            'https://solidspoon.xyz/DashPlayer/'
                        );
                    }}
                    variant="secondary"
                >
                    查看文档
                </Button>
                <Button
                    disabled={!hasConfigsChanged && eqStreamServer} // Apply button is enabled if configs changed OR stream changed
                    onClick={async () => {
                        submitStream(); // Submit the streaming setting
                        // 保存 aiProviderConfigs 和 activeConfigId
                        await api.call('setting/ai-providers/update-all', configs);
                        await api.call('setting/ai-providers/set-active', activeConfigId);
                        // After saving, reset initial states to reflect the new saved state
                        setInitialConfigs(configs);
                        setInitialActiveConfigId(activeConfigId);
                    }}
                >
                    Apply
                </Button>
            </FooterWrapper>
            {/* Modal for Add/Edit AI Provider Configuration */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{currentConfig?.id && currentConfig?.name ? 'Edit AI Provider: ' + currentConfig.name : 'Add New AI Provider'}</DialogTitle>
                        <DialogDescription>
                            {currentConfig?.id && currentConfig?.name ? 'Edit the details of your AI provider configuration.' : 'Add a new AI provider configuration.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={currentConfig?.name || ''}
                                onChange={(e) => setCurrentConfig(prev => prev ? { ...prev, name: e.target.value } : null)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="apiKey" className="text-right">
                                API Key
                            </Label>
                            <Input
                                id="apiKey"
                                type="password"
                                value={currentConfig?.apiKey || ''}
                                onChange={(e) => setCurrentConfig(prev => prev ? { ...prev, apiKey: e.target.value } : null)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="endpoint" className="text-right">
                                Endpoint
                            </Label>
                            <Input
                                id="endpoint"
                                value={currentConfig?.endpoint || ''}
                                onChange={(e) => setCurrentConfig(prev => prev ? { ...prev, endpoint: e.target.value } : null)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="model" className="text-right">
                                Model
                            </Label>
                            <Input
                                id="model"
                                value={currentConfig?.model || ''}
                                onChange={(e) => setCurrentConfig(prev => prev ? { ...prev, model: e.target.value } : null)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleSaveConfig}>Save changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </form>
    );
};
export default OpenAiSetting;
