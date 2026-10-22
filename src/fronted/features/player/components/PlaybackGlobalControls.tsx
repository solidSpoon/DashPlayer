import { useEffect, useState } from 'react';
import {
    CirclePause,
    Dumbbell,
    FastForward,
    Gauge,
    Languages,
    Mic,
    Pause,
    Play,
    Repeat,
    Repeat1,
    RotateCcw,
    Settings2,
    SkipBack,
    SkipForward,
    Sparkles,
    SquareDashedBottom,
} from 'lucide-react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/fronted/components/ui/popover';
import {
    CONTROL_POPOVER_HINT,
    CONTROL_POPOVER_ICON,
    CONTROL_POPOVER_LABEL,
    CONTROL_POPOVER_PANEL,
    CONTROL_POPOVER_SEPARATOR,
    ControlPopoverRow,
} from '@/fronted/features/player/components/ControlPopover';
import { cn } from '@/fronted/lib/utils';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { useTrainingModeStore } from '@/fronted/features/player/trainingStore';
import { TrainingSettingsDialog } from '@/fronted/features/player/components/TrainingSettingsDialog';
import useLayout from '@/fronted/hooks/useLayout';
import { isSidebarHiddenByEnglish } from '@/fronted/features/player/components/sidePanelVisibility';
import useSetting from '@/fronted/features/settings/settingsStore';

/**
 * 深色控制条上按钮的 hover 外观。
 *
 * 视频控制条的底色恒为深色（black/60 上叠白字），与应用主题无关，因此不能按 `dark:` 主题分支取反色：
 * 浅色主题下会退化成「背景加暗 + 文字转黑」，在黑底上等于没有 hover 反馈。
 * 本条上的按钮一律取这一份；宿主是亮色时才另给一套。
 */
export const DARK_BAR_BUTTON_HOVER = 'hover:bg-white/15 hover:text-white';

/**
 * 图标按钮在深色控制条上的统一样式。
 */
const ICON_BUTTON_CLASS = cn(
    'w-7 h-7 flex items-center justify-center rounded-lg text-white/80 transition-colors shrink-0',
    DARK_BAR_BUTTON_HOVER
);

/**
 * 深色控制条上带文字/徽章的按钮（训练模式、字幕轨道）。
 *
 * 与同一行里的图标按钮、倍速/音量、全屏保持同高同圆角（h-8 / rounded-lg / text-xs），
 * 只靠水平内边距和字号区分；否则会变成比邻居矮一头的胶囊，一行控件参差不齐。
 */
const TEXT_BUTTON_CLASS =
    'flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-medium leading-none transition-colors shrink-0';

/**
 * 训练按钮上的进度徽章（第 N 遍 / 当前倍速 / 留白秒数）。
 *
 * 统一为中性色：徽章只描述"进行到哪一步"，模式身份由按钮文字表达；
 * 三种语义色（琥珀=重复、紫=倍速、绿=留白）叠在绿底按钮上过于花。
 */
const TRAINING_BADGE_CLASS =
    'font-mono text-[10px] font-semibold leading-none bg-white/20 text-white px-1 py-0.5 rounded-sm';

/**
 * 把快捷键配置渲染成提示后缀。
 * @param key 快捷键文本，空表示未配置
 */
function formatShortcut(key?: string): string {
    return key ? ` (${key})` : '';
}

/**
 * 播放导航控件：上一句 / 播放暂停 / 下一句。
 *
 * 普通视图与全屏视图的控制条共用；播放状态与指令直接读播放器 store，
 * 不自带文案，因此两条控制条的落点与宽度都一致。
 *
 * @returns 播放导航控件。
 */
export function PlaybackNavControls() {
    const { t } = useI18nTranslation('player');
    const playing = usePlayerState((s) => s.playing);
    const prevShortcut = useSetting((s) => s.setting('shortcut.previousSentence'));
    const nextShortcut = useSetting((s) => s.setting('shortcut.nextSentence'));
    const playPauseShortcut = useSetting((s) => s.setting('shortcut.playPause'));

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => { void playerActions.prevSentence(); }}
                            className={ICON_BUTTON_CLASS}
                        >
                            <SkipBack className="w-3.5 h-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t('controlBar.prevSentence')}{formatShortcut(prevShortcut)}</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => playerActions.togglePlay()}
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/10 hover:bg-white/20 text-white/95 active:scale-95 transition-all"
                        >
                            {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{playing ? t('controlBar.pause') : t('controlBar.play')}{formatShortcut(playPauseShortcut)}</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => { void playerActions.nextSentence(); }}
                            className={ICON_BUTTON_CLASS}
                        >
                            <SkipForward className="w-3.5 h-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t('controlBar.nextSentence')}{formatShortcut(nextShortcut)}</TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}

/**
 * 播放模式与字幕显示控件：训练模式下拉 + 字幕轨道下拉，并持有训练参数配置弹窗。
 *
 * 训练状态与字幕轨道状态直接读 store；两条控制条各自挂一份，
 * 由于同一时刻只会渲染其中一条，训练参数弹窗也只会存在一个实例。
 *
 * 两个下拉与倍速弹窗一样用 Popover（非模态）：非模态浮层不会关掉整页的 pointer-events，
 * 因此展开状态下的第一次点击就能既收起旧的又打开新的；换成默认模态的 DropdownMenu 时，
 * 这次点击会被模态层吃掉，要再点一次才打得开。
 *
 * @param popoverOffset 弹窗底边到按钮顶边的间距，按宿主控制条形状取
 *                      CONTROL_POPOVER_OFFSET_STACKED_BAR / _SINGLE_ROW_BAR，避免弹窗压住本条进度条
 * @param onMenuOpenChange 任一菜单/弹窗展开状态变化时回调：宿主控制条据此保持可见，
 *                         否则鼠标移向菜单时会先触发控制条自身的移出隐藏
 * @returns 播放模式与字幕显示控件。
 */
export function PlaybackModeControls({
    popoverOffset,
    onMenuOpenChange,
}: {
    popoverOffset: number;
    onMenuOpenChange?: (open: boolean) => void;
}) {
    const { t } = useI18nTranslation('player');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [trainingMenuOpen, setTrainingMenuOpen] = useState(false);
    const [tracksMenuOpen, setTracksMenuOpen] = useState(false);

    useEffect(() => {
        onMenuOpenChange?.(trainingMenuOpen || tracksMenuOpen || settingsOpen);
    }, [trainingMenuOpen, tracksMenuOpen, settingsOpen, onMenuOpenChange]);

    const playbackRate = usePlayerState((s) => s.playbackRate);
    // 句末行为与训练开关的写入统一走 PlayerActions，此处只订阅展示用的值
    const singleRepeat = usePlayer((s) => s.singleRepeat);
    const autoPause = usePlayer((s) => s.autoPause);
    const shadowing = usePlayer((s) => s.shadowing);
    const shadowingPause = usePlayer((s) => s.shadowingPause);
    const sentenceLoop = usePlayer((s) => s.sentenceLoop);
    const activePlan = usePlayer((s) => s.activePlan);
    // 训练模式持久化配置：数值参数 + 两个常开行为开关，唯一真相在 trainingStore
    const trainingConfig = useTrainingModeStore((s) => s.config);
    const skipGap = useTrainingModeStore((s) => s.skipGap);
    const rewindOnResume = useTrainingModeStore((s) => s.rewindOnResume);

    const repeatShortcut = useSetting((s) => s.setting('shortcut.repeatSingleSentence'));
    const autoPauseShortcut = useSetting((s) => s.setting('shortcut.autoPause'));

    const showEn = usePlayerUi((state) => state.showEn);
    const showCn = usePlayerUi((state) => state.showCn);
    const showSourceZh = usePlayerUi((state) => state.showSourceZh);
    const showSideTranslation = usePlayerUi((state) => state.showSideTranslation);
    const syncSide = usePlayerUi((state) => state.syncSide);
    const changeShowEn = usePlayerUi((state) => state.changeShowEn);
    const changeShowCn = usePlayerUi((state) => state.changeShowCn);
    const changeShowSourceZh = usePlayerUi((state) => state.changeShowSourceZh);
    const changeShowSideTranslation = usePlayerUi((state) => state.changeShowSideTranslation);
    const changeSyncSide = usePlayerUi((state) => state.changeSyncSide);
    // 侧栏此刻是否真的被收起：收起时「随英文字幕隐藏」这行的提示要从「会怎样」换成「现在就是这样」
    const sidebarHidden = isSidebarHiddenByEnglish(syncSide, showEn);

    // 两种逐句循环配置互斥：×N 模式不带倍速表，精听模式带倍速表
    const loopTimesActive = sentenceLoop !== null && !sentenceLoop.rates;
    const loopRatesActive = sentenceLoop !== null && !!sentenceLoop.rates;
    const trainingActive = sentenceLoop !== null || skipGap || shadowing || rewindOnResume;
    // 模式身份由按钮文字表达（图标固定一颗，不再逐模式换图标、换色），优先级与 tooltip 一致
    const trainingLabel = singleRepeat
        ? t('controlBar.modeSingleRepeat')
        : autoPause
        ? t('controlBar.modeAutoPause')
        : shadowing
        ? t('controlBar.modeShadowing')
        : loopTimesActive
        ? t('controlBar.modeLoopTimes', { times: trainingConfig.repeatTimes })
        : loopRatesActive
        ? t('controlBar.modeLoopRates')
        : t('controlBar.modeTraining');

    // 进度徽章里的数字：按总数位数补零，避免 9→10 这类跨位时把按钮撑宽
    const loopCountText = activePlan
        ? `${String(activePlan.loopDone + 1).padStart(String(activePlan.loopTotal).length, '0')}/${activePlan.loopTotal}`
        : '';
    // 徽章槽位的固定宽度：按当前模式最长内容算（内容全是 10px 等宽字，ch 即一个字符宽）。
    // 槽位常驻、内容缺失时留透明占位，训练按钮的宽度才不会随「第几遍 / 当前倍速 / 留白倒计时」抖动，
    // 右侧一排按钮也就不会被挤来挤去。
    const loopTotalDigits = sentenceLoop
        ? String(sentenceLoop.rates ? sentenceLoop.rates.length : sentenceLoop.times).length
        : 1;
    const progressSlotWidth = loopRatesActive
        ? `calc(${5 + loopTotalDigits * 2 + 3}ch + 0.625rem)` // 「1.00x」+ 间距 + 「(N/M)」
        : `calc(${loopTotalDigits * 2 + 1}ch + 0.5rem)`; // 「N/M」；影子跟读倒计时位数更少，共用同一槽位

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1.5 shrink-0">
                {/* 训练模式：图标固定一颗 Dumbbell，模式身份写在按钮文字里，右侧只挂「进行到哪一步」的中性徽章 */}
                <Popover open={trainingMenuOpen} onOpenChange={setTrainingMenuOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <button
                                    className={cn(
                                        TEXT_BUTTON_CLASS,
                                        trainingActive
                                            ? 'text-emerald-200 bg-emerald-500/25 ring-1 ring-emerald-400/30'
                                            : cn('text-white/80', DARK_BAR_BUTTON_HOVER)
                                    )}
                                >
                                    <Dumbbell className="w-3.5 h-3.5" />
                                    <span className="font-sans">{trainingLabel}</span>

                                    {/* 进度徽章槽位：宽度按模式最长内容钉死、常驻（内容缺失时透明占位），
                                        徽章数字再怎么变也不会撑宽按钮 */}
                                    {loopTimesActive || loopRatesActive || shadowing ? (
                                        <span
                                            className="inline-flex items-center justify-center gap-0.5"
                                            style={{ minWidth: progressSlotWidth }}
                                        >
                                            {loopTimesActive ? (
                                                activePlan ? <span className={TRAINING_BADGE_CLASS}>{loopCountText}</span> : null
                                            ) : loopRatesActive ? (
                                                activePlan ? (
                                                    <>
                                                        <span className={TRAINING_BADGE_CLASS}>{playbackRate.toFixed(2)}x</span>
                                                        <span className="text-[10px] font-mono text-white/70">{`(${loopCountText})`}</span>
                                                    </>
                                                ) : null
                                            ) : shadowingPause ? (
                                                <ShadowCountdown key={shadowingPause.untilTs} untilTs={shadowingPause.untilTs} />
                                            ) : null}
                                        </span>
                                    ) : null}
                                </button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            {singleRepeat
                                ? `${t('controlBar.tooltipSingleRepeat')}${formatShortcut(repeatShortcut)}`
                                : autoPause
                                ? `${t('controlBar.tooltipAutoPause')}${formatShortcut(autoPauseShortcut)}`
                                : shadowing
                                ? `${t('controlBar.tooltipShadowing')}${shadowingPause ? t('controlBar.tooltipShadowingPausing') : ''}`
                                : loopTimesActive
                                ? t('controlBar.tooltipLoopTimes', {
                                    times: trainingConfig.repeatTimes,
                                    done: (activePlan?.loopDone ?? 0) + 1,
                                    total: activePlan?.loopTotal ?? trainingConfig.repeatTimes,
                                })
                                : loopRatesActive
                                ? t('controlBar.tooltipLoopRates', {
                                    rate: playbackRate,
                                    done: (activePlan?.loopDone ?? 0) + 1,
                                    total: activePlan?.loopTotal ?? trainingConfig.progressiveRates.length,
                                })
                                : trainingActive
                                ? t('controlBar.tooltipTrainingActive')
                                : t('controlBar.tooltipTrainingIdle')}
                        </TooltipContent>
                    </Tooltip>
                    <PopoverContent
                        side="top"
                        align="end"
                        sideOffset={popoverOffset}
                        className={cn('w-64', CONTROL_POPOVER_PANEL)}
                    >
                        <div className={cn('flex items-center gap-1.5', CONTROL_POPOVER_LABEL)}>
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                            {t('controlBar.trainingMenuLabel')}
                        </div>
                        <div className={CONTROL_POPOVER_SEPARATOR} />
                        {/* 句末行为（引擎层互斥：开启任一自动关闭其他） */}
                        <ControlPopoverRow
                            checked={singleRepeat}
                            icon={<Repeat1 className={CONTROL_POPOVER_ICON} />}
                            label={t('controlBar.rowSingleRepeat')}
                            right={repeatShortcut ? <span className={CONTROL_POPOVER_HINT}>{t('controlBar.shortcutHint', { shortcut: repeatShortcut })}</span> : undefined}
                            onActivate={() => playerActions.setSingleRepeat(!singleRepeat)}
                        />
                        <ControlPopoverRow
                            checked={autoPause}
                            icon={<CirclePause className={CONTROL_POPOVER_ICON} />}
                            label={t('controlBar.rowAutoPause')}
                            right={autoPauseShortcut ? <span className={CONTROL_POPOVER_HINT}>{t('controlBar.shortcutHint', { shortcut: autoPauseShortcut })}</span> : undefined}
                            onActivate={() => playerActions.setAutoPause(!autoPause)}
                        />
                        <ControlPopoverRow
                            checked={shadowing}
                            icon={<Mic className={CONTROL_POPOVER_ICON} />}
                            label={t('controlBar.rowShadowing')}
                            right={
                                <span className={CONTROL_POPOVER_HINT}>{t('controlBar.shadowingRatioHint', { ratio: trainingConfig.shadowingRatio.toFixed(1) })}</span>
                            }
                            title={t('controlBar.shadowingTitle', { ratio: trainingConfig.shadowingRatio.toFixed(1) })}
                            onActivate={() => playerActions.setShadowing(!shadowing)}
                        />
                        <ControlPopoverRow
                            checked={loopTimesActive}
                            icon={<Repeat className={CONTROL_POPOVER_ICON} />}
                            label={t('controlBar.rowLoopTimes', { times: trainingConfig.repeatTimes })}
                            title={t('controlBar.loopTimesTitle', { times: trainingConfig.repeatTimes })}
                            onActivate={() => {
                                playerActions.setSentenceLoop(loopTimesActive ? null : { times: trainingConfig.repeatTimes });
                            }}
                        />
                        <ControlPopoverRow
                            checked={loopRatesActive}
                            icon={<Gauge className={CONTROL_POPOVER_ICON} />}
                            label={t('controlBar.rowLoopRates')}
                            right={
                                <span className={CONTROL_POPOVER_HINT}>
                                    {trainingConfig.progressiveRates.map((r) => `${r}x`).join('→')}
                                </span>
                            }
                            title={t('controlBar.loopRatesTitle', { rates: trainingConfig.progressiveRates.map((r) => `${r}x`).join(' → ') })}
                            onActivate={() => {
                                playerActions.setSentenceLoop(
                                    loopRatesActive
                                        ? null
                                        : { times: trainingConfig.progressiveRates.length, rates: trainingConfig.progressiveRates }
                                );
                            }}
                        />
                        <div className={CONTROL_POPOVER_SEPARATOR} />
                        {/* 辅助播放行为 */}
                        <ControlPopoverRow
                            checked={skipGap}
                            icon={<FastForward className={CONTROL_POPOVER_ICON} />}
                            label={t('controlBar.rowSkipGap')}
                            title={t('controlBar.skipGapTitle')}
                            onActivate={() => playerActions.setSkipGap(!skipGap)}
                        />
                        <ControlPopoverRow
                            checked={rewindOnResume}
                            icon={<RotateCcw className={CONTROL_POPOVER_ICON} />}
                            label={t('controlBar.rowRewindOnResume')}
                            title={t('controlBar.rewindTitle')}
                            onActivate={() => playerActions.setRewindOnResume(!rewindOnResume)}
                        />
                        <div className={CONTROL_POPOVER_SEPARATOR} />
                        <ControlPopoverRow
                            icon={<Settings2 className={CONTROL_POPOVER_ICON} />}
                            label={t('controlBar.rowSettings')}
                            onActivate={() => {
                                setTrainingMenuOpen(false);
                                setSettingsOpen(true);
                            }}
                        />
                    </PopoverContent>
                </Popover>

                {/* 字幕轨道开关下拉菜单（直观展示当前是双语/单英文/单中文/全关状态） */}
                <Popover open={tracksMenuOpen} onOpenChange={setTracksMenuOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <button
                                    className={cn(TEXT_BUTTON_CLASS, 'text-white/80', DARK_BAR_BUTTON_HOVER)}
                                >
                                    <Languages className="w-3.5 h-3.5" />
                                    {/* 轨道标签: 双语/英/中/隐藏；状态只看这个词，不再给按钮加常驻底色 */}
                                    <span className="font-sans">
                                        {showEn && (showCn || showSourceZh)
                                            ? t('controlBar.tracksBilingual')
                                            : showEn
                                            ? t('controlBar.tracksEnglish')
                                            : showCn || showSourceZh
                                            ? t('controlBar.tracksChinese')
                                            : t('controlBar.tracksNone')}
                                    </span>
                                </button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end">
                            {t('controlBar.tracksTooltipPrefix') +
                                (showEn && (showCn || showSourceZh)
                                    ? t('controlBar.tracksTooltipBilingual')
                                    : showEn
                                    ? t('controlBar.tracksTooltipEnglish')
                                    : showCn || showSourceZh
                                    ? t('controlBar.tracksTooltipChinese')
                                    : t('controlBar.tracksTooltipNone'))}
                        </TooltipContent>
                    </Tooltip>
                    <PopoverContent
                        side="top"
                        align="end"
                        sideOffset={popoverOffset}
                        className={cn('w-56', CONTROL_POPOVER_PANEL)}
                    >
                        <div className={CONTROL_POPOVER_LABEL}>
                            {t('controlBox.subtitleTracks')}
                        </div>
                        <div className={CONTROL_POPOVER_SEPARATOR} />
                        <ControlPopoverRow
                            checked={showEn}
                            label={t('controlBox.showEnglish')}
                            onActivate={() => changeShowEn()}
                        />
                        <ControlPopoverRow
                            checked={showCn}
                            label={t('controlBox.showChinese')}
                            onActivate={() => changeShowCn()}
                        />
                        <ControlPopoverRow
                            checked={showSourceZh}
                            label={t('controlBox.showSourceZh')}
                            onActivate={() => changeShowSourceZh()}
                        />
                        {/* 侧栏：译文与「随英文字幕隐藏」同一块栏的两个开关，顺序与播放控制面板保持一致 */}
                        <div className={CONTROL_POPOVER_SEPARATOR} />
                        <div className={CONTROL_POPOVER_LABEL}>
                            {t('controlBox.sideGroupLabel')}
                        </div>
                        <ControlPopoverRow
                            checked={showSideTranslation}
                            label={t('controlBox.showSideTranslation')}
                            title={t('controlBox.sideTranslationHint')}
                            onActivate={() => changeShowSideTranslation()}
                        />
                        <ControlPopoverRow
                            checked={syncSide}
                            label={t('controlBox.sidebarFollowsEnglish')}
                            title={sidebarHidden ? t('controlBox.sidebarHiddenNow') : t('controlBox.sidebarFollowsEnglishHint')}
                            onActivate={() => changeSyncSide()}
                        />
                    </PopoverContent>
                </Popover>

                {/* 硬字幕遮挡：一键开关，位置与大小在画面里直接拖贴片 */}
                <HardsubMaskButton />

                {/* 训练模式参数配置弹窗 */}
                <TrainingSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
            </div>
        </TooltipProvider>
    );
}

/**
 * 硬字幕遮挡开关：视频控制条上的一键开关。
 *
 * 与「播放控制」面板里的开关是同一个状态，两处互相同步；这里只负责开与关，
 * 贴片的位置与大小靠画面里直接拖拽（见 HardsubMask），所以不挂二级弹窗。
 * 播客模式不看画面，遮挡无意义，直接不渲染。
 *
 * 开启态用中性白底而不是彩色：控制条上已经有绿（训练）一种语义色，
 * 再添一种色会让「这个按钮是开着还是被禁用」变成要辨色的谜题。
 *
 * 文字在 lg 以下隐藏：窄窗（≤1000 CSS px）时控制条本来就摆不下，多这一截文字会把最右的图标挤出可视区；
 * 隐藏后仅留图标，无障碍名称改由 aria-label 提供（display:none 的文字节点不在无障碍树里），
 * 视觉用户靠 tooltip 与图标认。
 *
 * @returns 遮挡开关按钮；播客模式下什么都不渲染。
 */
function HardsubMaskButton() {
    const { t } = useI18nTranslation('player');
    const maskOn = usePlayerUi((s) => s.hardsubMaskOn);
    const toggleMask = usePlayerUi((s) => s.toggleHardsubMask);
    const podcastMode = useLayout((s) => s.podcastMode);

    if (podcastMode) {
        return null;
    }

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={toggleMask}
                        aria-pressed={maskOn}
                        aria-label={t('hardsubMask.label')}
                        className={cn(
                            TEXT_BUTTON_CLASS,
                            maskOn
                                ? 'bg-white/20 text-white ring-1 ring-white/30'
                                : cn('text-white/80', DARK_BAR_BUTTON_HOVER)
                        )}
                    >
                        <SquareDashedBottom className="w-3.5 h-3.5" />
                        <span className="font-sans hidden lg:inline">{t('hardsubMask.label')}</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                    {t('hardsubMask.label')}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/**
 * 影子跟读留白剩余秒数徽章：按 200ms tick 派生渲染剩余时间。
 * 独立成子组件以隔离高频刷新；setState 仅在定时器回调中发生，挂载阶段无同步写状态。
 * @param untilTs 留白结束的时间戳（毫秒）
 */
function ShadowCountdown({ untilTs }: { untilTs: number }) {
    // 初始值在 useState 惰性初始化中派生（父级以 untilTs 作 key，变化即重挂载）；后续由定时器回调刷新
    const [secondsLeft, setSecondsLeft] = useState(() => Math.max(Math.ceil((untilTs - Date.now()) / 1000), 0));
    useEffect(() => {
        const intervalId = setInterval(() => {
            setSecondsLeft(Math.max(Math.ceil((untilTs - Date.now()) / 1000), 0));
        }, 200);
        return () => clearInterval(intervalId);
    }, [untilTs]);
    return (
        <span className={cn(TRAINING_BADGE_CLASS, 'animate-pulse')}>
            {String(secondsLeft).padStart(2, '0')}s
        </span>
    );
}
