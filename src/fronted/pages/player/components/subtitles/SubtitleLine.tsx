import {cn} from "@/fronted/lib/utils";
import { usePlayerUi } from "@/fronted/hooks/usePlayerUi";
import useSetting from "@/fronted/hooks/useSetting";
import {FONT_SIZE} from "@/fronted/styles/style";


interface SubtitleLineProps {
    text: string;
    order: 'second' | 'third';
}
const SubtitleLine = ({ text, order }: SubtitleLineProps) => {
    const show = usePlayerUi((state) => state.showCn);
    const fontSize = useSetting((state) => state.values.get('appearance.fontSize'));
    
    if (text === undefined || !show) {
        return <div />;
    }
    return (
        <div
            className={cn(`my-0 mx-10 py-2.5 px-1 bg-black/50 text-white rounded`,
                fontSize === 'fontSizeSmall' &&(order === 'second' ? FONT_SIZE["ms2-small"] : FONT_SIZE["ms3-small"]),
                fontSize === 'fontSizeMedium' &&(order === 'second' ? FONT_SIZE["ms2-medium"] : FONT_SIZE["ms3-medium"]),
                fontSize === 'fontSizeLarge' &&(order === 'second' ? FONT_SIZE["ms2-large"] : FONT_SIZE["ms3-large"]),
                )}
        >
            {text}
        </div>
    );
};

export default SubtitleLine;
