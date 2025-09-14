import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import useSWR from 'swr';
import { swrMutate, SWR_KEY } from '@/fronted/lib/swr-util';
import { cn } from '@/fronted/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import usePlayerController from '../../hooks/usePlayerController';
import useLayout from '../../hooks/useLayout';
import useSetting from '@/fronted/hooks/useSetting';
import { SettingKey } from '@/common/types/store_schema';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { SettingToggle, TranscriptButton, AutoClipButton, ClearAdjustButton } from './index';

const api = window.electron;
const logger = getRendererLogger('ControlBox');

const getShortcut = (key: SettingKey) => {
  return useSetting.getState().setting(key);
};

export default function ControlBox() {
  const {
    showEn,
    showCn,
    syncSide,
    singleRepeat,
    changeShowEn,
    changeShowCn,
    changeSyncSide,
    changeSingleRepeat,
    autoPause,
    changeAutoPause,
    autoPlayNext,
    changeAutoPlayNext
  } = usePlayerController(
    useShallow((s) => ({
      showEn: s.showEn,
      showCn: s.showCn,
      syncSide: s.syncSide,
      showWordLevel: s.showWordLevel,
      changeShowEn: s.changeShowEn,
      changeShowCn: s.changeShowCn,
      changeSyncSide: s.changeSyncSide,
      changeShowWordLevel: s.changeShowWordLevel,
      singleRepeat: s.singleRepeat,
      changeSingleRepeat: s.changeSingleRepeat,
      autoPause: s.autoPause,
      changeAutoPause: s.changeAutoPause,
      autoPlayNext: s.autoPlayNext,
      changeAutoPlayNext: s.changeAutoPlayNext
    }))
  );

  const setSetting = useSetting((s) => s.setSetting);
  const setting = useSetting((s) => s.setting);

  const { data: windowState } = useSWR(SWR_KEY.WINDOW_SIZE, () => api.call('system/window-size'));

  const { podcstMode, setPodcastMode } = useLayout(
    useShallow((s) => ({
      podcstMode: s.podcastMode,
      setPodcastMode: s.setPodcastMode
    }))
  );

  const changeFullScreen = useLayout((s) => s.changeFullScreen);

  return (
    <Card className={cn('w-full h-full flex flex-col')}>
      <CardHeader>
        <CardTitle>Player Controls</CardTitle>
        <CardDescription>Manage player settings and behavior</CardDescription>
      </CardHeader>

      <CardContent
        className={cn(
          'grid place-content-start overflow-y-auto gap-y-4 w-full h-0 flex-1 pt-1',
          'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-thumb-rounded scrollbar-track-gray-100 scrollbar-track-rounded'
        )}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        <SettingToggle
          id="showEn"
          label="展示英文字幕"
          checked={showEn}
          onCheckedChange={() => changeShowEn()}
          tooltipMd={`快捷键为 ${getShortcut('shortcut.toggleEnglishDisplay')}`}
        />
        <SettingToggle
          id="showCn"
          label="展示中文字幕"
          checked={showCn}
          onCheckedChange={() => changeShowCn()}
          tooltipMd={`快捷键为 ${getShortcut('shortcut.toggleChineseDisplay')}`}
        />
        <SettingToggle
          id="syncSide"
          label="同步侧边字幕"
          checked={syncSide}
          onCheckedChange={() => changeSyncSide()}
          tooltipMd="隐藏英文字幕时也隐藏侧边字幕，鼠标移动到侧边时显示"
        />
        <SettingToggle
          id="singleRepeat"
          label="单句循环"
          checked={singleRepeat}
          onCheckedChange={() => changeSingleRepeat()}
          tooltipMd={`快捷键为 ${getShortcut('shortcut.repeatSentence')}`}
        />
        <SettingToggle
          id="autoPause"
          label="自动暂停"
          checked={autoPause}
          onCheckedChange={() => changeAutoPause()}
          tooltipMd={`当前句子结束自动暂停 快捷键为 ${getShortcut('shortcut.autoPause')}`}
        />
        <SettingToggle
          id="autoPlayNext"
          label="自动播放下一个"
          checked={autoPlayNext}
          onCheckedChange={() => changeAutoPlayNext()}
          tooltipMd="文件夹模式下视频结束后自动播放下一个视频"
        />
        <SettingToggle
          id="nightMode"
          label="夜间模式"
          checked={setting('appearance.theme') === 'dark'}
          onCheckedChange={() => {
            setSetting('appearance.theme', setting('appearance.theme') === 'dark' ? 'light' : 'dark');
          }}
          tooltipMd={`快捷键为 ${getShortcut('shortcut.nextTheme')}`}
        />
        <SettingToggle
          id="fullScreen"
          label="全屏模式"
          checked={windowState === 'fullscreen'}
          onCheckedChange={async () => {
            if (windowState === 'fullscreen') {
              await api.call('system/window-size/change', 'normal');
            } else {
              await api.call('system/window-size/change', 'fullscreen');
            }
            await swrMutate(SWR_KEY.WINDOW_SIZE);
          }}
          tooltipMd="点击进入/退出全屏"
        />
        <SettingToggle
          id="podcstMode"
          label="播客模式"
          checked={podcstMode}
          onCheckedChange={() => {
            setPodcastMode(!podcstMode);
            changeFullScreen(false);
          }}
          tooltipMd="播放音频文件时请启用播客模式"
        />

        <ClearAdjustButton />
        <TranscriptButton />
        <AutoClipButton />
      </CardContent>
    </Card>
  );
}