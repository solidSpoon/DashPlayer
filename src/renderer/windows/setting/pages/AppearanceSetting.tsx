import { useEffect, useRef } from 'react';
import SettingButton from '../../../components/setting/SettingButton';
import { ItemWrapper, FooterWrapper, Header, SliderInput } from '../../../components/setting';
import ThemePreview from '../../../components/ThemePreview';
import useSettingForm from '../../../hooks/useSettingForm';

const AppearanceSetting = () => {
    const { setting, setSetting, submit, eqServer } = useSettingForm([
        'appearance.theme',
        'appearance.fontSize',
    ]);

    const seletedRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (seletedRef.current) {
            seletedRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [setting('appearance.theme')]);

    const fontSizeToValue = (fontSize: string) => {
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
    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="外观" description="设置主题与字号" />
            <div className="px-3 py-2 h-40 border-t border-b flex overflow-x-scroll scrollbar-thin gap-8 scrollbar-thumb-rounded scrollbar-thumb-gray-400/25">
                {['dark', 'light'].map((t) => {
                    return (
                        <div
                            className={`h-full flex flex-col gap-2 bg-black/5 p-2 rounded-lg ${
                                theme === t
                                    ? 'border-2 border-yellow-500'
                                    : 'border-2 border-transparent'
                            }`}
                            onClick={() => {
                                setSetting('appearance.theme', t);
                            }}
                            ref={theme === t ? seletedRef : null}
                        >
                            <ThemePreview
                                theme={t}
                                className={`${t} w-44 flex-1 h-0 flex-shrink-0 rounded overflow-hidden`}
                            />
                            <div className="text-center text-sm">{t}</div>
                        </div>
                    );
                })}
            </div>
            <ItemWrapper>
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
                <SettingButton disabled={eqServer} handleSubmit={submit} />
            </FooterWrapper>
        </form>
    );
};
export default AppearanceSetting;
