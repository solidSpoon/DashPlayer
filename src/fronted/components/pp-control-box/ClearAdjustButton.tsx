import React from 'react';
import toast from 'react-hot-toast';
import { codeBlock } from 'common-tags';
import TooltippedButton from '@/fronted/components/common/TooltippedButton';
import { Eraser } from 'lucide-react';
import { sentenceClearAllAdjust } from '@/fronted/hooks/usePlayerControllerSlices/createSentenceSlice';
import useSetting from '@/fronted/hooks/useSetting';

const getShortcut = (key: string) => useSetting.getState().setting(key as any);

export default function ClearAdjustButton() {
  const tooltipMd = codeBlock`
  #### 清除时间调整
  _清除当前视频的所有时间调整_

  当字幕时间戳不准确时, 可以使用如下快捷键调整:
  - 快捷键 ${getShortcut('shortcut.adjustBeginMinus')} 将当前句子开始时间提前 0.2 秒
  - 快捷键 ${getShortcut('shortcut.adjustBeginPlus')} 将当前句子开始时间推后 0.2 秒
  - 快捷键 ${getShortcut('shortcut.adjustEndMinus')} 将当前句子结束时间提前 0.2 秒
  - 快捷键 ${getShortcut('shortcut.adjustEndPlus')} 将当前句子结束时间推后 0.2 秒
  `;

  const handleClick = async () => {
    toast('清除了', { icon: '👏' });
    await sentenceClearAllAdjust();
  };

  return (
    <TooltippedButton
      icon={Eraser}
      text="清除时间调整"
      onClick={handleClick}
      tooltipMd={tooltipMd}
      tooltipClassName="p-8 pb-6 rounded-md shadow-lg"
      variant="ghost"
    />
  );
}