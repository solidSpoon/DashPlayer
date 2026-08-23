import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useSWR from 'swr';
import { swrMutate, SWR_KEY } from '@/fronted/lib/swr-util';
import { cn } from '@/fronted/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useLayout from '@/fronted/hooks/useLayout';
import useFile from '@/fronted/features/file-browser/fileStore';
import useSetting from '@/fronted/features/settings/settingsStore';
import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';
import AutoClipButton from './AutoClipButton';
import ClearAdjustButton from './ClearAdjustButton';
import SettingToggle from './SettingToggle';
import TranscriptButton from './TranscriptButton';
import WithMarkdownTooltip from '@/fronted/components/shared/common/WithMarkdownTooltip';
import { playerApi } from '@/fronted/features/player/playerApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';

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
    syncSide,
    changeShowEn,
    changeShowCn,
    changeShowSourceZh,
    changeSyncSide,
  } = usePlayerUi(
    useShallow((s) => ({
      showEn: s.showEn,
      showCn: s.showCn,
      showSourceZh: s.showSourceZh,
      syncSide: s.syncSide,
      changeShowEn: s.changeShowEn,
      changeShowCn: s.changeShowCn,
      changeShowSourceZh: s.changeShowSourceZh,
      changeSyncSide: s.changeSyncSide,
    }))
  );

  const singleRepeat = usePlayer((s) => s.singleRepeat);
  const setSingleRepeat = usePlayer((s) => s.setSingleRepeat);
  const autoPause = usePlayer((s) => s.autoPause);
  const setAutoPause = usePlayer((s) => s.setAutoPause);
  const autoPlayNext = usePlayer((s) => s.autoPlayNext);
  const setAutoPlayNext = usePlayer((s) => s.setAutoPlayNext);

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

  useEffect(() => {
    if (autoPlayNextSetting === 'true') {
      setAutoPlayNext(true);
    }
    if (autoPlayNextSetting === 'false') {
      setAutoPlayNext(false);
    }
  }, [autoPlayNextSetting, setAutoPlayNext]);

  return (
    <Card className={cn('w-full h-full flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs')}>
      <CardHeader className="shrink-0 px-4 pt-3.5 pb-2.5 border-b border-border/40">
        <CardTitle className="text-sm font-semibold">{t('controlBox.title')}</CardTitle>
      </CardHeader>
      
      {/* 滚动区域：仅开关网格在高度不够时纵向滚动 */}
      <CardContent
        className={cn(
          'w-full flex-1 min-h-0 overflow-y-auto px-4 py-2',
          'scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-thumb-rounded scrollbar-track-transparent'
        )}
      >
        <div
          className="grid min-h-0 content-start auto-rows-min gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
        >
          {/* 字幕轨道：并入网格中，在有空间时占 2 列，联动系统主题色 */}
          <div className="sm:col-span-2 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 min-h-[38px]">
            <span className="text-xs font-medium text-muted-foreground select-none shrink-0">
              {t('controlBox.subtitleTracks')}
            </span>
            <div className="flex items-center gap-1.5">
              <WithMarkdownTooltip md={t('controlBox.trackEnHint', { shortcut: getShortcut('shortcut.toggleEnglishDisplay') })}>
                <button
                  type="button"
                  onClick={changeShowEn}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg border transition-all duration-150 select-none font-medium',
                    showEn
                      ? 'bg-amber-400 text-black border-amber-500 font-semibold shadow-2xs'
                      : 'bg-transparent text-muted-foreground border-border/60 hover:border-border hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  {t('controlBox.showEnglish')}
                </button>
              </WithMarkdownTooltip>

              <WithMarkdownTooltip md={t('controlBox.trackCnHint', { shortcut: getShortcut('shortcut.toggleChineseDisplay') })}>
                <button
                  type="button"
                  onClick={changeShowCn}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg border transition-all duration-150 select-none font-medium',
                    showCn
                      ? 'bg-amber-400 text-black border-amber-500 font-semibold shadow-2xs'
                      : 'bg-transparent text-muted-foreground border-border/60 hover:border-border hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  {t('controlBox.showChinese')}
                </button>
              </WithMarkdownTooltip>

              <WithMarkdownTooltip md={t('controlBox.trackSourceZhHint')}>
                <button
                  type="button"
                  onClick={changeShowSourceZh}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg border transition-all duration-150 select-none font-medium',
                    showSourceZh
                      ? 'bg-amber-400 text-black border-amber-500 font-semibold shadow-2xs'
                      : 'bg-transparent text-muted-foreground border-border/60 hover:border-border hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  {t('controlBox.showSourceZh')}
                </button>
              </WithMarkdownTooltip>
            </div>
          </div>

          <SettingToggle
            id="syncSide"
            label={t('controlBox.syncSideSubtitles')}
            checked={syncSide}
            onCheckedChange={() => changeSyncSide()}
            tooltipMd={t('controlBox.syncSideHint')}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          <SettingToggle
            id="singleRepeat"
            label={t('controlBox.singleRepeat')}
            checked={singleRepeat}
            onCheckedChange={() => setSingleRepeat(!singleRepeat)}
            tooltipMd={t('controlBox.shortcutHint', { shortcut: getShortcut('shortcut.repeatSentence') })}
            className="h-9 px-3 py-1 rounded-xl"
            labelClassName="text-xs font-medium"
          />
          <SettingToggle
            id="autoPause"
            label={t('controlBox.autoPause')}
            checked={autoPause}
            onCheckedChange={() => setAutoPause(!autoPause)}
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
              setAutoPlayNext(next);
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
        </div>
      </CardContent>

      {/* 固定的底部动作工具栏：绝不与滚动内容重叠 */}
      <div className="shrink-0 px-4 py-2.5 border-t border-border/50 bg-muted/15 flex flex-wrap items-center gap-2">
        <ClearAdjustButton className="h-8 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 px-3 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-none" />
        <TranscriptButton className="h-8 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 px-3 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-none" />
        <AutoClipButton className="h-8 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 px-3 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-none" />
      </div>
    </Card>
  );
}
