import SettingInput from '@/fronted/components/setting/SettingInput';
import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import Header from '@/fronted/components/setting/Header';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import Separator from '@/fronted/components/Separtor';
import {Button} from "@/fronted/components/ui/button";

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
        'shortcut.adjustBeginMinus',
        'shortcut.adjustBeginPlus',
        'shortcut.adjustEndMinus',
        'shortcut.adjustEndPlus',
        'shortcut.clearAdjust',
        'shortcut.nextPlaybackRate',
    ]);
    return (
        <form className="h-full overflow-y-auto flex flex-col gap-4">
            <Header title="快捷键" description="多个快捷键用 , 分割" />
            <Separator orientation="horizontal" className="px-0" />
            <ItemWrapper>
                <SettingInput
                    title="上一句"
                    description="跳转到上一句"
                    value={setting('shortcut.previousSentence')}
                    setValue={setSettingFunc('shortcut.previousSentence')}
                />
                <SettingInput
                    title="下一句"
                    description="跳转到下一句"
                    value={setting('shortcut.nextSentence')}
                    setValue={setSettingFunc('shortcut.nextSentence')}
                />
                <SettingInput
                    title="重复"
                    description="重复当前句子"
                    value={setting('shortcut.repeatSentence')}
                    setValue={setSettingFunc('shortcut.repeatSentence')}
                />
                <SettingInput
                    title="播放/暂停"
                    description="播放/暂停"
                    value={setting('shortcut.playPause')}
                    setValue={setSettingFunc('shortcut.playPause')}
                />
                <SettingInput
                    title="单句重复"
                    description="自动重复当前句子"
                    value={setting('shortcut.repeatSingleSentence')}
                    setValue={setSettingFunc('shortcut.repeatSingleSentence')}
                />
                <SettingInput
                    title="展示/隐藏英文"
                    description="展示/隐藏英文字幕"
                    value={setting('shortcut.toggleEnglishDisplay')}
                    setValue={setSettingFunc('shortcut.toggleEnglishDisplay')}
                />
                <SettingInput
                    title="展示/隐藏中文"
                    description="展示/隐藏中文字幕"
                    value={setting('shortcut.toggleChineseDisplay')}
                    setValue={setSettingFunc('shortcut.toggleChineseDisplay')}
                />
                <SettingInput
                    title="展示/隐藏中英"
                    description="展示/隐藏中英文字幕"
                    value={setting('shortcut.toggleBilingualDisplay')}
                    setValue={setSettingFunc('shortcut.toggleBilingualDisplay')}
                />
                <SettingInput
                    title="展示/隐藏生词翻译"
                    description="展示/隐藏生词翻译(正在开发中)"
                    value={setting('shortcut.toggleWordLevelDisplay')}
                    setValue={setSettingFunc('shortcut.toggleWordLevelDisplay')}
                />
                <SettingInput
                    title="切换主题"
                    description="切换播放器的明亮/暗黑主题"
                    value={setting('shortcut.nextTheme')}
                    setValue={setSettingFunc('shortcut.nextTheme')}
                />
                <SettingInput
                    title="切换播放速度"
                    description="在播放器速度选择弹窗勾选的速度中切换"
                    value={setting('shortcut.nextPlaybackRate')}
                    setValue={setSettingFunc('shortcut.nextPlaybackRate')}/>
                <SettingInput
                    title="开始时间 -"
                    description="当精听一句话时, 可能遇到字幕时间不准确的情况, 可以通过这个快捷键来调整字幕的开始时间"
                    value={setting('shortcut.adjustBeginMinus')}
                    setValue={setSettingFunc('shortcut.adjustBeginMinus')}
                />
                <SettingInput
                    title="开始时间 +"
                    description="当精听一句话时, 可能遇到字幕时间不准确的情况, 可以通过这个快捷键来调整字幕的开始时间"
                    value={setting('shortcut.adjustBeginPlus')}
                    setValue={setSettingFunc('shortcut.adjustBeginPlus')}
                />
                <SettingInput
                    title="结束时间 -"
                    description="当精听一句话时, 可能遇到字幕时间不准确的情况, 可以通过这个快捷键来调整字幕的结束时间"
                    value={setting('shortcut.adjustEndMinus')}
                    setValue={setSettingFunc('shortcut.adjustEndMinus')}
                />
                <SettingInput
                    title="结束时间 +"
                    description="当精听一句话时, 可能遇到字幕时间不准确的情况, 可以通过这个快捷键来调整字幕的结束时间"
                    value={setting('shortcut.adjustEndPlus')}
                    setValue={setSettingFunc('shortcut.adjustEndPlus')}
                />
                <SettingInput
                    title="重置时间调整"
                    description="调整后可以用这个快捷键重置当前句子的时间"
                    value={setting('shortcut.clearAdjust')}
                    setValue={setSettingFunc('shortcut.clearAdjust')}
                />
            </ItemWrapper>

            <FooterWrapper>
                <Button
                    onClick={submit}
                    disabled={eqServer}
                >
                    Apply
                </Button>

            </FooterWrapper>
        </form>
    );
};
export default ShortcutSetting;
