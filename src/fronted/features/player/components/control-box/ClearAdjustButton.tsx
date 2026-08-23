import React from 'react';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';
import { Eraser } from 'lucide-react';
import useFile from '@/fronted/features/file-browser/fileStore';
import useSetting from '@/fronted/features/settings/settingsStore';
import { RuntimeSettingKey } from '@/common/contracts/runtime-settings';
import { playerApi } from '@/fronted/features/player/playerApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * 从运行时设置缓存读取快捷键。
 *
 * @param key 快捷键对应的运行时设置键。
 * @returns 当前快捷键文本。
 */
const getShortcut = (key: RuntimeSettingKey) => useSetting.getState().setting(key);

interface ClearAdjustButtonProps {
  className?: string;
}

export default function ClearAdjustButton({ className }: ClearAdjustButtonProps) {
  const { t } = useI18nTranslation('player');
  const tooltipMd = codeBlock`
  #### ${t('clearAdjust.tooltipTitle')}
  _${t('clearAdjust.tooltipSubtitle')}_

  ${t('clearAdjust.shortcutIntro')}
  - ${t('clearAdjust.shortcutBeginMinus', { shortcut: getShortcut('shortcut.adjustBeginMinus') })}
  - ${t('clearAdjust.shortcutBeginPlus', { shortcut: getShortcut('shortcut.adjustBeginPlus') })}
  - ${t('clearAdjust.shortcutEndMinus', { shortcut: getShortcut('shortcut.adjustEndMinus') })}
  - ${t('clearAdjust.shortcutEndPlus', { shortcut: getShortcut('shortcut.adjustEndPlus') })}
  `;

  const handleClick = async () => {
    const fileHash = useFile.getState().srtHash;
    if (!fileHash) return;
    await playerApi.deleteTimestampAdjustment(fileHash);
    // 触发字幕重载
    const path = useFile.getState().subtitlePath;
    useFile.setState({ subtitlePath: null });
    setTimeout(() => {
      if (path) useFile.setState({ subtitlePath: path });
    }, 0);
    toast(t('clearAdjust.done'), { icon: '👏' });
  };

  return (
    <TooltippedButton
      icon={Eraser}
      text={t('clearAdjust.button')}
      onClick={handleClick}
      tooltipMd={tooltipMd}
      variant="ghost"
      className={className}
    />
  );
}
