import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { cn } from "@/fronted/lib/utils";
import useSetting from '@/fronted/features/settings/settingsStore';
import { FONT_SIZE } from '@/fronted/styles/style';

interface NormalLineParam {
    text: string;
    order: 'second' | 'third';
    source?: 'ai' | 'source';
}

const NormalLine = ({ text, order, source }: NormalLineParam) => {
    const fontSize = useSetting((state) => state.values.get('appearance.fontSize'));

    if (text === undefined) {
        return <div />;
    }
    return (
        <div
            className={cn(
                'my-0 mx-6 py-1 px-1 font-normal tracking-wide text-stone-600 dark:text-neutral-300 flex items-center justify-center gap-2 leading-relaxed transition-colors',
                fontSize === 'fontSizeSmall' && (order === 'second' ? FONT_SIZE["ms2-small"] : FONT_SIZE["ms3-small"]),
                fontSize === 'fontSizeMedium' && (order === 'second' ? FONT_SIZE["ms2-medium"] : FONT_SIZE["ms3-medium"]),
                fontSize === 'fontSizeLarge' && (order === 'second' ? FONT_SIZE["ms2-large"] : FONT_SIZE["ms3-large"]),
            )}
        >
            {source && (
                <span
                    className={cn(
                        "inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[10px] font-medium tracking-wider uppercase select-none opacity-70 hover:opacity-100 transition-opacity shrink-0",
                        source === 'ai'
                            ? "text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20"
                            : "text-stone-500 dark:text-neutral-400 bg-stone-500/10 border border-stone-500/20"
                    )}
                    title={source === 'ai' ? 'AI 翻译' : '原片字幕'}
                >
                    {source === 'ai' ? 'AI' : 'SRT'}
                </span>
            )}
            <span>{text}</span>
        </div>
    );
};

export default NormalLine;
