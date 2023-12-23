import { useEffect, useRef } from 'react';
import SettingButton from '../../../../components/setting/SettingButton';
import { ItemWrapper, FooterWrapper, Header, SliderInput, Title } from '../../../../components/setting';
import ThemePreview from '../../../../components/ThemePreview';
import useSettingForm from '../../../../hooks/useSettingForm';
import Separator from '../../../../components/Separtor';
import { cn } from '../../../../../common/utils/Util';

const AppearanceSetting = () => {
    const { setting, setSetting, submit, eqServer } = useSettingForm([
        'appearance.theme',
        'appearance.fontSize'
    ]);

    const seletedRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (seletedRef.current) {
            seletedRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
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
        <form className='w-full h-full flex flex-col gap-5'>
            <Header title='外观' description='设置主题与字号' />
            <Separator orientation={'horizontal'} />
            <ItemWrapper>
                <Title title={'Theme'} description={'设置主题'} />
                <div
                    className='px-3 py-2 h-60 flex-shrink-0  flex overflow-x-scroll scrollbar-thin gap-8 scrollbar-thumb-rounded scrollbar-thumb-gray-400/25'>
                    {['dark', 'light'].map((t) => {
                        return (
                            <div
                                className={cn(
                                    `h-full flex flex-col gap-2`
                                )}
                                onClick={() => {
                                    setSetting('appearance.theme', t);
                                }}
                                ref={theme === t ? seletedRef : null}
                            >
                                <div className={cn('p-1 h-full rounded-lg', theme === t
                                    ? 'border-2 border-black'
                                    : 'border-2 border-gray-200')}>
                                    <ThemePreview
                                        theme={t}
                                        className={cn(
                                            `${t} w-80 flex-1 flex-shrink-0 rounded overflow-hidden h-full`
                                        )}
                                    />
                                </div>
                                <div className='text-center'>{t}</div>
                            </div>
                        );
                    })}
                </div>
                <Title title={'Font Size'} description={'设置字号'} />
                <SliderInput
                    title='字体大小'
                    values={['小', '中', '大']}
                    defaultValue={fontSizeToValue(fontSize ?? 'fontSizeMedium')}
                    inputWidth='w-56'
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
