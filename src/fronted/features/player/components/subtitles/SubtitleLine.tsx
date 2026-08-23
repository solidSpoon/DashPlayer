import {cn} from "@/fronted/lib/utils";
import useSetting from "@/fronted/features/settings/settingsStore";
import {FONT_SIZE} from "@/fronted/styles/style";

interface SubtitleLineProps {
    text: string;
    order: 'second' | 'third';
}
const SubtitleLine = ({ text, order }: SubtitleLineProps) => {
    const fontSize = useSetting((state) => state.values.get('appearance.fontSize'));
    
    if (text === undefined) {
        return <div />;
    }
    return (
        <div
            className={cn(
                'my-0 mx-10 py-1.5 px-4 bg-black/60 backdrop-blur-xs text-white rounded-lg shadow-lg text-center',
                fontSize === 'fontSizeSmall' && (order === 'second' ? FONT_SIZE["ms2-small"] : FONT_SIZE["ms3-small"]),
                fontSize === 'fontSizeMedium' && (order === 'second' ? FONT_SIZE["ms2-medium"] : FONT_SIZE["ms3-medium"]),
                fontSize === 'fontSizeLarge' && (order === 'second' ? FONT_SIZE["ms2-large"] : FONT_SIZE["ms3-large"]),
            )}
        >
            {text}
        </div>
    );
};

export default SubtitleLine;

