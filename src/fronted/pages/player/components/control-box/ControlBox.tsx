import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useSWR from 'swr';
import { swrMutate, SWR_KEY } from '@/fronted/lib/swr-util';
import { cn } from '@/fronted/lib/utils';
import { Card, CardContent } from '@/fronted/components/ui/card';
import usePlayerUi from '@/fronted/hooks/usePlayerUi';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import useLayout from '@/fronted/hooks/useLayout';
import useSetting from '@/fronted/hooks/useSetting';
import { SettingKey } from '@/common/types/store_schema';
import { SettingToggle, TranscriptButton, AutoClipButton, ClearAdjustButton } from './index';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const getShortcut = (key: SettingKey) => {
  return useSetting.getState().setting(key);
};

export default function ControlBox() {
  const { showEn, showCn, syncSide, changeShowEn, changeShowCn, changeSyncSide } = usePlayerUi(
    useShallow((s) => ({
      showEn: s.showEn,
      showCn: s.showCn,
      syncSide: s.syncSide,
      changeShowEn: s.changeShowEn,
      changeShowCn: s.changeShowCn,
      changeSyncSide: s.changeSyncSide,
    }))
  );

  const singleRepeat = usePlayerV2((s) => s.singleRepeat);
  const setSingleRepeat = usePlayerV2((s) => s.setSingleRepeat);
  const autoPause = usePlayerV2((s) => s.autoPause);
  const setAutoPause = usePlayerV2((s) => s.setAutoPause);
  const autoPlayNext = usePlayerV2((s) => s.autoPlayNext);
  const setAutoPlayNext = usePlayerV2((s) => s.setAutoPlayNext);

  const setSetting = useSetting((s) => s.setSetting);
  const setting = useSetting((s) => s.setting);
  const autoPlayNextSetting = useSetting((s) => s.setting('player.autoPlayNext'));

  const { data: windowState } = useSWR(SWR_KEY.WINDOW_SIZE, () => backendClient.call('system/window-size'));

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
    <Card className={cn('w-full h-full flex flex-col')}>
      <CardContent
        className={cn(
          'w-full flex-1 min-h-0 overflow-y-auto p-3',
          'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-thumb-rounded scrollbar-track-gray-100 scrollbar-track-rounded'
        )}
      >
        <div
          className="grid min-h-0 content-start auto-rows-min gap-2 pr-1"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <SettingToggle
            id="showEn"
            label="展示英文字幕"
            checked={showEn}
            onCheckedChange={() => changeShowEn()}
            tooltipMd={`快捷键为 ${getShortcut('shortcut.toggleEnglishDisplay')}`}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="showCn"
            label="展示中文字幕"
            checked={showCn}
            onCheckedChange={() => changeShowCn()}
            tooltipMd={`快捷键为 ${getShortcut('shortcut.toggleChineseDisplay')}`}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="syncSide"
            label="同步侧边字幕"
            checked={syncSide}
            onCheckedChange={() => changeSyncSide()}
            tooltipMd="隐藏英文字幕时也隐藏侧边字幕，鼠标移动到侧边时显示"
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="singleRepeat"
            label="单句循环"
            checked={singleRepeat}
            onCheckedChange={() => setSingleRepeat(!singleRepeat)}
            tooltipMd={`快捷键为 ${getShortcut('shortcut.repeatSentence')}`}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="autoPause"
            label="自动暂停"
            checked={autoPause}
            onCheckedChange={() => setAutoPause(!autoPause)}
            tooltipMd={`当前句子结束自动暂停 快捷键为 ${getShortcut('shortcut.autoPause')}`}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="autoPlayNext"
            label="自动播放下一个"
            checked={autoPlayNext}
            onCheckedChange={async () => {
              const next = !autoPlayNext;
              setAutoPlayNext(next);
              await setSetting('player.autoPlayNext', next ? 'true' : 'false');
            }}
            tooltipMd="文件夹模式下视频结束后自动播放下一个视频"
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="nightMode"
            label="夜间模式"
            checked={setting('appearance.theme') === 'dark'}
            onCheckedChange={() => {
              setSetting('appearance.theme', setting('appearance.theme') === 'dark' ? 'light' : 'dark');
            }}
            tooltipMd={`快捷键为 ${getShortcut('shortcut.nextTheme')}`}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="fullScreen"
            label="全屏模式"
            checked={windowState === 'fullscreen'}
            onCheckedChange={async () => {
              if (windowState === 'fullscreen') {
                await backendClient.call('system/window-size/change', 'normal');
              } else {
                await backendClient.call('system/window-size/change', 'fullscreen');
              }
              await swrMutate(SWR_KEY.WINDOW_SIZE);
            }}
            tooltipMd="点击进入/退出全屏"
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
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
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <ClearAdjustButton className="h-11 w-full justify-start rounded-xl border-0 bg-muted/45 px-3 text-sm font-medium text-[#a85700] shadow-[0_1px_2px_rgba(60,64,67,0.10)] transition-colors hover:bg-[#fff1e6]" />
          <TranscriptButton className="h-11 w-full justify-start rounded-xl border-0 bg-muted/45 px-3 text-sm font-medium text-[#a85700] shadow-[0_1px_2px_rgba(60,64,67,0.10)] transition-colors hover:bg-[#fff1e6]" />
          <AutoClipButton className="h-11 w-full justify-start rounded-xl border-0 bg-muted/45 px-3 text-sm font-medium text-[#a85700] shadow-[0_1px_2px_rgba(60,64,67,0.10)] transition-colors hover:bg-[#fff1e6]" />
        </div>
      </CardContent>
    </Card>
  );
}
