import {
    ItemWrapper,
    FooterWrapper,
    Header,
    Title,
} from "@/fronted/components/setting";
import useSettingForm from "@/fronted/hooks/useSettingForm";
import Separator from "@/fronted/components/Separtor";
import { cn } from "@/fronted/lib/utils";
import { Button } from "@/fronted/components/ui/button";
import { Input } from "@/fronted/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/fronted/components/ui/tooltip";
import { EdgeTtsVoice, TtsProvider } from "@/common/types/store_schema";
import * as React from "react";
import { ChevronRight, Search, X, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const api = window.electron;

interface CascaderVoice {
    locale: string;
    gender: "Female" | "Male";
    friendlyName: string;
    shortName: string;
    Name: string;
}

type GenderSelection = "Female" | "Male" | null;

const TtsCascader = ({
    value,
    onChange,
    voices,
    loading,
}: {
    value: string;
    onChange: (value: string) => void;
    voices: EdgeTtsVoice[];
    loading: boolean;
}) => {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedLocale, setSelectedLocale] = React.useState<string>("");
    const [selectedGender, setSelectedGender] =
        React.useState<GenderSelection>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const groupedData = React.useMemo(() => {
        const groups: Record<
            string,
            {
                locale: string;
                label: string;
                genders: {
                    gender: string;
                    label: string;
                    voices: CascaderVoice[];
                }[];
            }
        > = {};
        const localeLabels: Record<string, string> = {};

        voices.forEach((voice) => {
            if (!localeLabels[voice.Locale]) {
                localeLabels[voice.Locale] = voice.Locale;
            }
            if (!groups[voice.Locale]) {
                groups[voice.Locale] = {
                    locale: voice.Locale,
                    label: voice.Locale,
                    genders: [],
                };
            }

            const genderGroup = groups[voice.Locale].genders.find(
                (g) => g.gender === voice.Gender,
            );
            if (!genderGroup) {
                groups[voice.Locale].genders.push({
                    gender: voice.Gender,
                    label: voice.Gender === "Female" ? "女声" : "男声",
                    voices: [],
                });
            }

            const currentGenderGroup = groups[voice.Locale].genders.find(
                (g) => g.gender === voice.Gender,
            );
            if (currentGenderGroup) {
                currentGenderGroup.voices.push({
                    locale: voice.Locale,
                    gender: voice.Gender as "Female" | "Male",
                    friendlyName: voice.FriendlyName,
                    shortName: voice.ShortName,
                    Name: voice.Name,
                });
            }
        });

        return Object.values(groups).sort((a, b) =>
            a.label.localeCompare(b.label),
        );
    }, [voices]);

    const filteredData = React.useMemo(() => {
        if (!searchQuery) return groupedData;

        const query = searchQuery.toLowerCase();
        const result: typeof groupedData = [];

        groupedData.forEach((group) => {
            const filteredGenders = group.genders
                .map((gender) => {
                    const filteredVoices = gender.voices.filter(
                        (voice) =>
                            voice.friendlyName.toLowerCase().includes(query) ||
                            voice.shortName.toLowerCase().includes(query) ||
                            voice.locale.toLowerCase().includes(query) ||
                            voice.gender.toLowerCase().includes(query) ||
                            voice.Name.toLowerCase().includes(query),
                    );
                    return { ...gender, voices: filteredVoices };
                })
                .filter((g) => g.voices.length > 0);

            if (filteredGenders.length > 0) {
                result.push({ ...group, genders: filteredGenders });
            }
        });

        return result;
    }, [groupedData, searchQuery]);

    const getCurrentDisplay = () => {
        const voice = voices.find((v) => v.ShortName === value);
        return voice ? voice.FriendlyName : "点击选择音色...";
    };

    const handleLocaleClick = (locale: string) => {
        setSelectedLocale(locale);
        setSelectedGender(null);
    };

    const handleGenderClick = (gender: "Female" | "Male") => {
        setSelectedGender(gender);
    };

    const handleVoiceClick = (shortName: string) => {
        onChange(shortName);
        setOpen(false);
        setSearchQuery("");
        setSelectedLocale("");
        setSelectedGender(null);
    };

    React.useEffect(() => {
        if (value) {
            const voice = voices.find((v) => v.ShortName === value);
            if (voice) {
                setSelectedLocale(voice.Locale);
                setSelectedGender(voice.Gender as GenderSelection);
            }
        }
    }, [value, voices]);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open]);

    const getLocales = () => {
        if (searchQuery) {
            return filteredData.map((d) => d.locale);
        }
        return groupedData.map((d) => d.locale);
    };

    const getGenders = (locale: string) => {
        const group = (searchQuery ? filteredData : groupedData).find(
            (g) => g.locale === locale,
        );
        if (!group) return [];

        if (searchQuery) {
            return group.genders.map((g) => g.gender);
        }
        return group.genders.map((g) => g.gender);
    };

    const getVoices = (locale: string, gender: GenderSelection) => {
        if (!gender) return [];
        const group = (searchQuery ? filteredData : groupedData).find(
            (g) => g.locale === locale,
        );
        if (!group) return [];

        const genderGroup = group.genders.find((g) => g.gender === gender);
        return genderGroup ? genderGroup.voices : [];
    };

    return (
        <div ref={containerRef} className="relative">
            <Button
                type="button"
                variant="outline"
                className={cn(
                    "w-[500px] justify-between px-3 py-2 text-left font-normal",
                    // !value && "text-muted-foreground"
                )}
                onClick={() => setOpen(!open)}
            >
                <span className="truncate flex-1">{getCurrentDisplay()}</span>
                {open ? (
                    <ChevronRight className="w-4 h-4 rotate-90 ml-2 flex-shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 ml-2 flex-shrink-0" />
                )}
            </Button>

            {open && (
                <div className="absolute z-50 w-[600px] mt-1 bg-background border border-border rounded-md shadow-lg">
                    <div className="border-b border-border p-2 flex items-center gap-2">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索音色..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 h-8"
                        />
                        {searchQuery && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setSearchQuery("")}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>

                    <div className="h-[320px] flex overflow-hidden">
                        <div className="flex-1 border-r border-border overflow-y-auto py-1">
                            {loading ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                    加载中...
                                </div>
                            ) : getLocales().length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                    无结果
                                </div>
                            ) : (
                                (searchQuery ? filteredData : groupedData).map(
                                    (group) => (
                                        <button
                                            key={group.locale}
                                            type="button"
                                            onClick={() =>
                                                handleLocaleClick(group.locale)
                                            }
                                            className={cn(
                                                "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                                                selectedLocale ===
                                                    group.locale &&
                                                    "bg-accent text-accent-foreground",
                                            )}
                                        >
                                            <span>{group.label}</span>
                                            <ChevronRight className="w-4 h-4 flex-shrink-0" />
                                        </button>
                                    ),
                                )
                            )}
                        </div>

                        {selectedLocale && (
                            <div className="flex-1 border-r border-border overflow-y-auto py-1">
                                {getGenders(selectedLocale).length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                        无结果
                                    </div>
                                ) : (
                                    (
                                        (searchQuery
                                            ? filteredData
                                            : groupedData
                                        ).find(
                                            (g) => g.locale === selectedLocale,
                                        )?.genders || []
                                    ).map((gender) => (
                                        <button
                                            key={gender.gender}
                                            type="button"
                                            onClick={() =>
                                                handleGenderClick(
                                                    gender.gender as
                                                        | "Female"
                                                        | "Male",
                                                )
                                            }
                                            className={cn(
                                                "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                                                selectedGender ===
                                                    gender.gender &&
                                                    "bg-accent text-accent-foreground",
                                            )}
                                        >
                                            <span>{gender.label}</span>
                                            <ChevronRight className="w-4 h-4 flex-shrink-0" />
                                        </button>
                                    ))
                                )}
                            </div>
                        )}

                        {selectedLocale && selectedGender && (
                            <div className="flex-[1.5] overflow-y-auto py-1">
                                {getVoices(selectedLocale, selectedGender)
                                    .length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                        无结果
                                    </div>
                                ) : (
                                    getVoices(
                                        selectedLocale,
                                        selectedGender,
                                    ).map((voice) => (
                                        <button
                                            key={voice.shortName}
                                            type="button"
                                            onClick={() =>
                                                handleVoiceClick(
                                                    voice.shortName,
                                                )
                                            }
                                            className={cn(
                                                "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                                                value === voice.shortName &&
                                                    "bg-accent text-accent-foreground",
                                            )}
                                        >
                                            <div className="truncate">
                                                {voice.friendlyName}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {voice.shortName}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const TtsSetting = () => {
    const { setting, setSetting, submit, eqServer } = useSettingForm([
        "tts.provider",
        "tts.edgeTts.voice",
    ]);

    const provider = (setting("tts.provider") as TtsProvider) || "edge-tts";
    const selectedVoice = setting("tts.edgeTts.voice") || "en-US-JennyNeural";
    const [voices, setVoices] = React.useState<EdgeTtsVoice[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);

    const loadVoices = React.useCallback(
        async (forceRefresh: boolean = false) => {
            setLoading(true);
            try {
                const data = await api.call("tts/edge-tts/voices", {
                    forceRefresh,
                });
                setVoices(data);
            } catch (error) {
                console.error("Failed to load voices:", error);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadVoices(true);
            toast.success("音色列表已更新");
        } catch (error) {
            toast.error("更新音色列表失败");
        } finally {
            setRefreshing(false);
        }
    };

    React.useEffect(() => {
        if (provider === "edge-tts" && voices.length === 0) {
            loadVoices(false);
        }
    }, [provider, loadVoices]);

    return (
        <form className="w-full h-full flex flex-col gap-5">
            <Header title="TTS" description="配置文字转语音服务" />
            <Separator orientation="horizontal" className="px-0" />
            <ItemWrapper>
                <Title title="TTS Provider" description="选择 TTS 服务提供商" />
                <div className="px-3 py-2">
                    <select
                        value={provider}
                        onChange={(e) =>
                            setSetting(
                                "tts.provider",
                                e.target.value as TtsProvider,
                            )
                        }
                        className="w-[300px] h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        <option value="edge-tts">Edge TTS</option>
                        <option value="openai">OpenAI</option>
                    </select>
                </div>

                {provider === "edge-tts" && (
                    <>
                        <div className="px-3 py-2">
                            <div className="text-sm text-muted-foreground">
                                Edge TTS借用了微软Edge浏览器的TTS能力，支持多种语言和音色，且无需API Key即可使用。
                            </div>
                        </div>
                        <Title
                            title="音色选择"
                            description="选择 Edge TTS 音色（级联选择器）"
                        />
                        <div className="px-3 py-2 flex items-center gap-2">
                            <div className="flex-1">
                                <TtsCascader
                                    value={selectedVoice}
                                    onChange={(value) =>
                                        setSetting("tts.edgeTts.voice", value)
                                    }
                                    voices={voices}
                                    loading={loading}
                                />
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={handleRefresh}
                                            disabled={refreshing}
                                            className="flex-shrink-0 h-10 w-10"
                                        >
                                            <RefreshCw
                                                className={cn(
                                                    "h-4 w-4",
                                                    refreshing &&
                                                        "animate-spin",
                                                )}
                                            />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>获取最新音色</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </>
                )}

                {provider === "openai" && (
                    <div className="px-3 py-2">
                        <div className="text-sm text-muted-foreground">
                            OpenAI TTS 将使用您在 OpenAI 设置中配置的 API Key 和
                            Endpoint。
                        </div>
                    </div>
                )}
            </ItemWrapper>
            <FooterWrapper>
                <Button disabled={eqServer} onClick={submit}>
                    Apply
                </Button>
            </FooterWrapper>
        </form>
    );
};

export default TtsSetting;
