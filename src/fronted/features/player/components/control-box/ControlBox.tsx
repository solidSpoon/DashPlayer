import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useSWR from 'swr';
import { swrMutate, SWR_KEY } from '@/fronted/lib/swr-util';
import { cn } from '@/fronted/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import type { HardsubMaskStyle } from '@/fronted/features/player/components/hardsubMaskVisuals';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import useLayout from '@/fronted/hooks/useLayout';
import useFile from '@/fronted/features/file-browser/fileStore';
import useSetting from '@/fronted/features/settings/settingsStore';
import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';
import AutoClipButton from './AutoClipButton';
import ClearAdjustButton from './ClearAdjustButton';
import DubbingExportButton from '@/fronted/features/player/dubbing/components/DubbingExportButton';
import RepairPlaybackButton from './RepairPlaybackButton';
import SettingToggle from './SettingToggle';
import TranscriptButton from './TranscriptButton';
import WithMarkdownTooltip from '@/fronted/components/shared/common/WithMarkdownTooltip';
import { playerApi } from '@/fronted/features/player/playerApi';
import { isSidebarHiddenByEnglish } from '@/fronted/features/player/components/sidePanelVisibility';
import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * 「字幕轨道」与「侧栏」两行共用的药丸外观。
 *
 * 两行说的是同一类常驻开关（哪些轨道/哪块侧栏常亮），观感必须一致；
 * 抽成常量而不是各写一份，否则以后调圆角内边距只会改到其中一行。
 * shrink-0 + whitespace-nowrap 是硬要求：面板可以窄到 300px 上下，药丸一旦被压缩，
 * 中文会逐字竖排、文字会压到左侧标签上；宁可让这一行换行变高。
 */
const TRACK_PILL_CLASS =
  'px-2.5 py-1 text-xs rounded-lg border transition-all duration-150 select-none font-medium shrink-0 whitespace-nowrap';
const TRACK_PILL_ACTIVE_CLASS = 'bg-primary text-primary-foreground border-primary shadow-xs';
const TRACK_PILL_IDLE_CLASS =
  'bg-transparent text-muted-foreground border-border/60 hover:border-border hover:text-foreground hover:bg-muted/40';

/**
 * 面板里的一颗开关药丸：两行轨道/侧栏开关共用，调用方只给标签、提示与开关状态。
 *
 * @param active 是否处于开启态（决定主色实底还是描边空心）。
 * @param hint Markdown 提示文案，悬停时展示。
 * @param label 药丸文字。
 * @param onClick 点击切换。
 */
function PanelPill({
  active,
  hint,
  label,
  onClick,
}: {
  active: boolean;
  hint: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <WithMarkdownTooltip md={hint}>
      <button
        type="button"
        onClick={onClick}
        className={cn(TRACK_PILL_CLASS, active ? TRACK_PILL_ACTIVE_CLASS : TRACK_PILL_IDLE_CLASS)}
      >
        {label}
      </button>
    </WithMarkdownTooltip>
  );
}

/**
 * 从运行时设置缓存读取快捷键。
 *
 * @param key 快捷键对应的运行时设置键。
 * @returns 当前快捷键文本。
 */
const getShortcut = (key: RuntimeSettingKey) => {
  return useSetting.getState().setting(key);
};

/**
 * 渲染播放器控制面板。
 *
 * 该面板聚合字幕显示、播放行为和窗口模式等控制项，
 * 并通过 i18n 文案展示标题与说明，便于快速识别面板用途。
 */
export default function ControlBox() {
  const { t } = useI18nTranslation('player');
  const {
    showEn,
    showCn,
    showSourceZh,
    showSideTranslation,
    syncSide,
    changeShowEn,
    changeShowCn,
    changeShowSourceZh,
    changeShowSideTranslation,
    changeSyncSide,
  } = usePlayerUi(
    useShallow((s) => ({
      showEn: s.showEn,
      showCn: s.showCn,
      showSourceZh: s.showSourceZh,
      showSideTranslation: s.showSideTranslation,
      syncSide: s.syncSide,
      changeShowEn: s.changeShowEn,
      changeShowCn: s.changeShowCn,
      changeShowSourceZh: s.changeShowSourceZh,
      changeShowSideTranslation: s.changeShowSideTranslation,
      changeSyncSide: s.changeSyncSide,
    }))
  );

  // 模式开关的写入统一走 PlayerActions，此处只订阅展示用的值
  const singleRepeat = usePlayer((s) => s.singleRepeat);
  const autoPause = usePlayer((s) => s.autoPause);
  const autoPlayNext = usePlayer((s) => s.autoPlayNext);

  // 遮挡贴片：播放控制面板里唯一的一处开关，开/关与贴片位置尺寸都会记住上次的选择
  const hardsubMaskOn = usePlayerUi((s) => s.hardsubMaskOn);
  const hardsubMaskStyle = usePlayerUi((s) => s.hardsubMaskStyle);
  const toggleHardsubMask = usePlayerUi((s) => s.toggleHardsubMask);
  const setHardsubMaskStyle = usePlayerUi((s) => s.setHardsubMaskStyle);

  const setSetting = useSetting((s) => s.setSetting);
  const setting = useSetting((s) => s.setting);
  const autoPlayNextSetting = useSetting((s) => s.setting('player.autoPlayNext'));

  const { data: windowState } = useSWR(SWR_KEY.WINDOW_SIZE, playerApi.getWindowState);

  const { podcstMode, setPodcastMode } = useLayout(
    useShallow((s) => ({
      podcstMode: s.podcastMode,
      setPodcastMode: s.setPodcastMode
    }))
  );

  const changeFullScreen = useLayout((s) => s.changeFullScreen);

  // 侧栏此刻是否真的被「随英文字幕隐藏」收起：收起时「侧栏译文」看不出效果，需要在组内就地说明
  const sidebarHidden = isSidebarHiddenByEnglish(syncSide, showEn);

  useEffect(() => {
    if (autoPlayNextSetting === 'true') {
      playerActions.setAutoPlayNext(true);
    }
    if (autoPlayNextSetting === 'false') {
      playerActions.setAutoPlayNext(false);
    }
  }, [autoPlayNextSetting]);

  return (
    <Card className={cn('w-full h-full flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs')}>
      <CardHeader className="shrink-0 px-4 pt-4 pb-3.5">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">{t('controlBox.title')}</CardTitle>
      </CardHeader>
      
      {/* 滚动区域：仅开关网格在高度不够时纵向滚动 */}
      <CardContent
        className={cn(
          'w-full flex-1 min-h-0 overflow-y-auto px-4 pt-0 pb-3',
          'scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-thumb-rounded scrollbar-track-transparent'
        )}
      >
        <div
          className="grid min-h-0 content-start auto-rows-min gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
        >
          {/* 字幕轨道：并入网格中，在有空间时占 2 列，跟随系统主色；窄宽时整组换行而不压缩药丸 */}
          <div className="col-span-full sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 min-h-[38px]">
            <span className="text-xs font-medium text-muted-foreground select-none shrink-0 whitespace-nowrap">
              {t('controlBox.subtitleTracks')}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <PanelPill
                active={showEn}
                hint={t('controlBox.trackEnHint', { shortcut: getShortcut('shortcut.toggleEnglishDisplay') })}
                label={t('controlBox.showEnglish')}
                onClick={changeShowEn}
              />
              <PanelPill
                active={showCn}
                hint={t('controlBox.trackCnHint', { shortcut: getShortcut('shortcut.toggleChineseDisplay') })}
                label={t('controlBox.showChinese')}
                onClick={changeShowCn}
              />
              <PanelPill
                active={showSourceZh}
                hint={t('controlBox.trackSourceZhHint')}
                label={t('controlBox.showSourceZh')}
                onClick={changeShowSourceZh}
              />
            </div>
          </div>

          {/* 侧栏：译文与「随英文字幕隐藏」管的是同一块右侧字幕栏，收成一组，不再一处药丸一处开关 */}
          <div className="col-span-full sm:col-span-2 flex flex-col justify-center gap-0.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 min-h-[38px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground select-none shrink-0 whitespace-nowrap">
                {t('controlBox.sideGroupLabel')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <PanelPill
                  active={showSideTranslation}
                  hint={t('controlBox.sideTranslationHint')}
                  label={t('controlBox.showSideTranslation')}
                  onClick={changeShowSideTranslation}
                />
                <PanelPill
                  active={syncSide}
                  hint={t('controlBox.sidebarFollowsEnglishHint')}
                  label={t('controlBox.sidebarFollowsEnglish')}
                  onClick={changeSyncSide}
                />
              </div>
            </div>
            {/* 侧栏正被收起时，「侧栏译文」点了也看不出变化，就地说明原因，免得像是开关坏了 */}
            {sidebarHidden && (
              <span className="text-[10px] leading-tight text-muted-foreground">
                {t('controlBox.sidebarHiddenNow')}
              </span>
            )}
          </div>
          <SettingToggle
            id="singleRepeat"
            label={t('controlBox.singleRepeat')}
            checked={singleRepeat}
            onCheckedChange={() => playerActions.setSingleRepeat(!singleRepeat)}
            tooltipMd={t('controlBox.shortcutHint', { shortcut: getShortcut('shortcut.repeatSentence') })}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          <SettingToggle
            id="autoPause"
            label={t('controlBox.autoPause')}
            checked={autoPause}
            onCheckedChange={() => playerActions.setAutoPause(!autoPause)}
            tooltipMd={t('controlBox.autoPauseHint', { shortcut: getShortcut('shortcut.autoPause') })}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          <SettingToggle
            id="autoPlayNext"
            label={t('controlBox.autoPlayNext')}
            checked={autoPlayNext}
            onCheckedChange={async () => {
              const next = !autoPlayNext;
              playerActions.setAutoPlayNext(next);
              await setSetting('player.autoPlayNext', next ? 'true' : 'false');
            }}
            tooltipMd={t('controlBox.autoPlayNextHint')}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          <SettingToggle
            id="nightMode"
            label={t('controlBox.nightMode')}
            checked={setting('appearance.theme') === 'dark'}
            onCheckedChange={() => {
              setSetting('appearance.theme', setting('appearance.theme') === 'dark' ? 'light' : 'dark');
            }}
            tooltipMd={t('controlBox.shortcutHint', { shortcut: getShortcut('shortcut.nextTheme') })}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          <SettingToggle
            id="fullScreen"
            label={t('controlBox.fullScreen')}
            checked={windowState === 'fullscreen'}
            onCheckedChange={async () => {
              if (windowState === 'fullscreen') {
                await playerApi.changeWindowSize('normal');
              } else {
                await playerApi.changeWindowSize('fullscreen');
              }
              await swrMutate(SWR_KEY.WINDOW_SIZE);
            }}
            tooltipMd={t('controlBox.fullScreenHint')}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          <SettingToggle
            id="podcstMode"
            label={t('controlBox.podcastMode')}
            checked={podcstMode}
            onCheckedChange={() => {
                const nextMode = !podcstMode;
                setPodcastMode(nextMode);
                changeFullScreen(false);
                const videoId = useFile.getState().videoId;
                if (videoId) {
                    void playerApi.setPodcastModePreference(videoId, nextMode);
                    void swrMutate(SWR_KEY.PLAYER_P);
                }
            }}
            tooltipMd={t('controlBox.podcastModeHint')}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          {/* 挡字幕排在最后：它是画面上的一次性遮挡，与上面这些「放什么内容」的开关不同类 */}
          <SettingToggle
            id="hardsubMask"
            label={t('hardsubMask.label')}
            checked={hardsubMaskOn}
            onCheckedChange={() => toggleHardsubMask()}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          {/* 遮挡样式：只在贴片开着时有意义，关着就不占位；五种盖法方便现场对比挑选 */}
          {hardsubMaskOn === true && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 min-h-[38px]">
              <span className="text-xs font-medium text-muted-foreground select-none shrink-0">
                {t('hardsubMask.styleLabel')}
              </span>
              <Select
                value={hardsubMaskStyle}
                onValueChange={(value) => setHardsubMaskStyle(value as HardsubMaskStyle)}
              >
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blur">{t('hardsubMask.styleBlur')}</SelectItem>
                  <SelectItem value="blurSampled">{t('hardsubMask.styleBlurSampled')}</SelectItem>
                  <SelectItem value="sampled">{t('hardsubMask.styleSampled')}</SelectItem>
                  <SelectItem value="stretch">{t('hardsubMask.styleStretch')}</SelectItem>
                  <SelectItem value="solid">{t('hardsubMask.styleSolid')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* 动作工具栏：自然跟随在控制项下方 */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 pb-1">
          <ClearAdjustButton className="h-8 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 px-3 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-none" />
          <RepairPlaybackButton className="h-8 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 px-3 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-none" />
          <TranscriptButton className="h-8 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 px-3 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-none" />
          <AutoClipButton className="h-8 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 px-3 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-none" />
          <DubbingExportButton className="h-8 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 px-3 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-none" />
        </div>
      </CardContent>
    </Card>
  );
}
