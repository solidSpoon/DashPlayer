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
import { useTranslation as useI18nTranslation } from 'react-i18next';

const getShortcut = (key: SettingKey) => {
  return useSetting.getState().setting(key);
};

export default function ControlBox() {
  const { t } = useI18nTranslation('player');
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
            label={t('controlBox.showEnglish')}
            checked={showEn}
            onCheckedChange={() => changeShowEn()}
            tooltipMd={t('controlBox.shortcutHint', { shortcut: getShortcut('shortcut.toggleEnglishDisplay') })}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="showCn"
            label={t('controlBox.showChinese')}
            checked={showCn}
            onCheckedChange={() => changeShowCn()}
            tooltipMd={t('controlBox.shortcutHint', { shortcut: getShortcut('shortcut.toggleChineseDisplay') })}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="syncSide"
            label={t('controlBox.syncSideSubtitles')}
            checked={syncSide}
            onCheckedChange={() => changeSyncSide()}
            tooltipMd={t('controlBox.syncSideHint')}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="singleRepeat"
            label={t('controlBox.singleRepeat')}
            checked={singleRepeat}
            onCheckedChange={() => setSingleRepeat(!singleRepeat)}
            tooltipMd={t('controlBox.shortcutHint', { shortcut: getShortcut('shortcut.repeatSentence') })}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="autoPause"
            label={t('controlBox.autoPause')}
            checked={autoPause}
            onCheckedChange={() => setAutoPause(!autoPause)}
            tooltipMd={t('controlBox.autoPauseHint', { shortcut: getShortcut('shortcut.autoPause') })}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
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
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="nightMode"
            label={t('controlBox.nightMode')}
            checked={setting('appearance.theme') === 'dark'}
            onCheckedChange={() => {
              setSetting('appearance.theme', setting('appearance.theme') === 'dark' ? 'light' : 'dark');
            }}
            tooltipMd={t('controlBox.shortcutHint', { shortcut: getShortcut('shortcut.nextTheme') })}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="fullScreen"
            label={t('controlBox.fullScreen')}
            checked={windowState === 'fullscreen'}
            onCheckedChange={async () => {
              if (windowState === 'fullscreen') {
                await backendClient.call('system/window-size/change', 'normal');
              } else {
                await backendClient.call('system/window-size/change', 'fullscreen');
              }
              await swrMutate(SWR_KEY.WINDOW_SIZE);
            }}
            tooltipMd={t('controlBox.fullScreenHint')}
            className="h-11 px-3 py-2"
            labelClassName="text-sm"
          />
          <SettingToggle
            id="podcstMode"
            label={t('controlBox.podcastMode')}
            checked={podcstMode}
            onCheckedChange={() => {
              setPodcastMode(!podcstMode);
              changeFullScreen(false);
            }}
            tooltipMd={t('controlBox.podcastModeHint')}
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
