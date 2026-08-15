import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import {cn} from "@/fronted/lib/utils";
import useSetting from '@/fronted/features/settings/settingsStore';
import {FONT_SIZE} from '@/fronted/styles/style';

interface NormalLineParam {
    text: string;
    order: 'second' | 'third';
}

const NormalLine = ({text, order}: NormalLineParam) => {
    const show = usePlayerUi((state) => state.showCn);
    const fontSize = useSetting((state) => state.values.get('appearance.fontSize'));

    if (text === undefined) {
        return <div/>;
    }
    return (
        <div
            className={cn(`my-0 mx-10 py-2.5 px-1 text-stone-600 dark:text-neutral-300`,
                fontSize === 'fontSizeSmall' && (order === 'second' ? FONT_SIZE["ms2-small"] : FONT_SIZE["ms3-small"]),
                fontSize === 'fontSizeMedium' && (order === 'second' ? FONT_SIZE["ms2-medium"] : FONT_SIZE["ms3-medium"]),
                fontSize === 'fontSizeLarge' && (order === 'second' ? FONT_SIZE["ms2-large"] : FONT_SIZE["ms3-large"]),
                !show && 'text-transparent',
            )}
        >
            {text}
        </div>
    );
};

export default NormalLine;
