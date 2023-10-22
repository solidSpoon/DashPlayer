import { useEffect, useRef, useState } from 'react';
import SettingButton from '../../../components/setting/SettingButton';
import SettingInput from '../../../components/setting/SettingInput';
import ItemWrapper from '../../../components/setting/ItemWapper';
import FooterWrapper from '../../../components/setting/FooterWrapper';
import Header from '../../../components/setting/Header';
import useSetting, { Appearance, Secret } from '../../../hooks/useSetting';
import ThemePreview from '../../../components/ThemePreview';
import { Slider } from '../../../components/Slider';
import SliderInput from '../../../components/setting/SliderInput';
import Title from '../../../components/setting/Title';
import { THEME } from '../../../../types/Types';

const AppearanceSetting = () => {
    const appearance = useSetting((s) => s.appearance);
    console.log(appearance);
    const setAppearance = useSetting((s) => s.setAppearance);
    const [localAppearance, setLocalAppearance] =
        useState<Appearance>(appearance);

    const eqServer =
        JSON.stringify(appearance) === JSON.stringify(localAppearance);
    const update = (key: keyof Appearance) => (value: string) => {
        setLocalAppearance({ ...localAppearance, [key]: value });
    };
    const handleSubmit = async () => {
        setAppearance(localAppearance);
    };
    const seletedRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (seletedRef.current) {
            seletedRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [localAppearance.theme]);
    useEffect(() => {
        setLocalAppearance(appearance);
    }, [appearance]);
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
    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="外观" description="设置主题与字号" />
            <div className="px-3 py-2 h-40 border-t border-b flex overflow-x-scroll scrollbar-thin gap-8 scrollbar-thumb-rounded scrollbar-thumb-gray-400/25">
                {THEME.map((theme) => {
                    return (
                        <div
                            className={`h-full flex flex-col gap-2 bg-black/5 p-2 rounded-lg ${
                                localAppearance.theme === theme.name
                                    ? 'border-2 border-yellow-500'
                                    : 'border-2 border-transparent'
                            }`}
                            onClick={() => {
                                update('theme')(theme.name);
                            }}
                            ref={
                                localAppearance.theme === theme.name
                                    ? seletedRef
                                    : null
                            }
                        >
                            <ThemePreview
                                theme={theme.name}
                                className={`${theme.name} w-44 flex-1 h-0 flex-shrink-0 rounded overflow-hidden`}
                            />
                            <div className="text-center text-sm">
                                {theme.name}
                            </div>
                        </div>
                    );
                })}
            </div>
            <ItemWrapper>
                <SliderInput
                    title="字体大小"
                    values={['小', '中', '大']}
                    defaultValue={fontSizeToValue(localAppearance.fontSize)}
                    inputWidth="w-56"
                    setValue={(v) => {
                        if (v === '小') {
                            update('fontSize')('fontSizeSmall');
                        }
                        if (v === '中') {
                            update('fontSize')('fontSizeMedium');
                        }
                        if (v === '大') {
                            update('fontSize')('fontSizeLarge');
                        }
                    }}
                />
            </ItemWrapper>
            <FooterWrapper>
                <SettingButton
                    disabled={eqServer}
                    handleSubmit={handleSubmit}
                />
            </FooterWrapper>
        </form>
    );
};
export default AppearanceSetting;
