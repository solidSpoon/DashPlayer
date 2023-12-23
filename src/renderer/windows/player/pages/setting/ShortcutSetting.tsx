import SettingButton from '../../../../components/setting/SettingButton';
import SettingInput from '../../../../components/setting/SettingInput';
import ItemWrapper from '../../../../components/setting/ItemWrapper';
import FooterWrapper from '../../../../components/setting/FooterWrapper';
import Header from '../../../../components/setting/Header';
import useSettingForm from '../../../../hooks/useSettingForm';
import Separator from '../../../../components/Separtor';

const ShortcutSetting = () => {
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
        'shortcut.previousSentence',
        'shortcut.nextSentence',
        'shortcut.repeatSentence',
        'shortcut.playPause',
        'shortcut.repeatSingleSentence',
        'shortcut.toggleEnglishDisplay',
        'shortcut.toggleChineseDisplay',
        'shortcut.toggleBilingualDisplay',
        'shortcut.toggleWordLevelDisplay',
        'shortcut.nextTheme',
    ]);
    return (
        <form className=" h-full overflow-y-auto flex flex-col gap-4">
            <Header title="快捷键" description="多个快捷键用 , 分割" />
            <Separator orientation={'horizontal'} />
            <ItemWrapper>
                <SettingInput
                    title="上一句"
                    value={setting('shortcut.previousSentence')}
                    setValue={setSettingFunc('shortcut.previousSentence')}
                />
                <SettingInput
                    title="下一句"
                    value={setting('shortcut.nextSentence')}
                    setValue={setSettingFunc('shortcut.nextSentence')}
                />
                <SettingInput
                    title="重复"
                    value={setting('shortcut.repeatSentence')}
                    setValue={setSettingFunc('shortcut.repeatSentence')}
                />
                <SettingInput
                    title="播放/暂停"
                    value={setting('shortcut.playPause')}
                    setValue={setSettingFunc('shortcut.playPause')}
                />
                <SettingInput
                    title="单句重复"
                    value={setting('shortcut.repeatSingleSentence')}
                    setValue={setSettingFunc('shortcut.repeatSingleSentence')}
                />
                <SettingInput
                    title="展示/隐藏英文"
                    value={setting('shortcut.toggleEnglishDisplay')}
                    setValue={setSettingFunc('shortcut.toggleEnglishDisplay')}
                />
                <SettingInput
                    title="展示/隐藏中文"
                    value={setting('shortcut.toggleChineseDisplay')}
                    setValue={setSettingFunc('shortcut.toggleChineseDisplay')}
                />
                <SettingInput
                    title="展示/隐藏中英"
                    value={setting('shortcut.toggleBilingualDisplay')}
                    setValue={setSettingFunc('shortcut.toggleBilingualDisplay')}
                />
                <SettingInput
                    title="展示/隐藏生词翻译"
                    value={setting('shortcut.toggleWordLevelDisplay')}
                    setValue={setSettingFunc('shortcut.toggleWordLevelDisplay')}
                />
                <SettingInput
                    title="下一个主题"
                    value={setting('shortcut.nextTheme')}
                    setValue={setSettingFunc('shortcut.nextTheme')}
                />
            </ItemWrapper>

            <FooterWrapper>
                <SettingButton handleSubmit={submit} disabled={eqServer} />
            </FooterWrapper>
        </form>
    );
};
export default ShortcutSetting;
