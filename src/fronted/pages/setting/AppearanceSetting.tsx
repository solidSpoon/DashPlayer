import {
    ItemWrapper,
    FooterWrapper,
    Header,
    SliderInput,
    Title,
} from '@/fronted/components/setting';
import ThemePreview from '@/fronted/components/ThemePreview';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import Separator from '@/fronted/components/Separtor';
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('AppearanceSetting');

const AppearanceSetting = () => {
    const { setting, setSetting, submit, eqServer } = useSettingForm([
        'appearance.theme',
        'appearance.fontSize',
    ]);

    const fontSizeToValue = (fontSize: string) => {
        logger.debug('Converting fontSize to display value', { fontSize });
        if (fontSize === 'fontSizeSmall') {
            return '小';
        }
        if (fontSize === 'fontSizeMedium') {
            return '中';
        }
        if (fontSize === 'fontSizeLarge') {
            return '大';
        }
        return '中';
    };
    const theme = setting('appearance.theme');
    const fontSize = setting('appearance.fontSize');
    logger.debug('Current fontSize setting', { fontSize });
    return (
        <form className="w-full h-full flex flex-col gap-5">
            <Header title="外观" description="设置主题与字号" />
            <Separator orientation="horizontal" className="px-0" />
            <ItemWrapper>
                <Title title="Theme" description="设置主题" />
                <div className="px-3 py-2 h-60 flex-shrink-0  flex overflow-x-scroll scrollbar-thin gap-8 scrollbar-thumb-rounded scrollbar-thumb-gray-400/25">
                    {['dark', 'light'].map((t) => {
                        return (
                            <div
                                className={cn(`h-full flex flex-col gap-2`)}
                                onClick={() => {
                                    setSetting('appearance.theme', t);
                                }}
                            >
                                <div
                                    className={cn(
                                        'p-1 h-full rounded-lg',
                                        theme === t
                                            ? 'border-2 border-primary'
                                            : 'border-2 border-secondary'
                                    )}
                                >
                                    <ThemePreview
                                        theme={t}
                                        className={cn(
                                            `${t} w-80 flex-1 flex-shrink-0 rounded overflow-hidden h-full`
                                        )}
                                    />
                                </div>
                                <div className="text-center">{t}</div>
                            </div>
                        );
                    })}
                </div>
                <Title title="Font Size" description="设置字号" />
                <SliderInput
                    title="字体大小"
                    values={['小', '中', '大']}
                    defaultValue={fontSizeToValue(fontSize ?? 'fontSizeMedium')}
                    inputWidth="w-56"
                    setValue={(v) => {
                        if (v === '小') {
                            setSetting('appearance.fontSize', 'fontSizeSmall');
                        }
                        if (v === '中') {
                            setSetting('appearance.fontSize', 'fontSizeMedium');
                        }
                        if (v === '大') {
                            setSetting('appearance.fontSize', 'fontSizeLarge');
                        }
                    }}
                />
            </ItemWrapper>
            <FooterWrapper>
                <Button disabled={eqServer} onClick={submit}>Apply</Button>
            </FooterWrapper>
        </form>
    );
};
export default AppearanceSetting;
