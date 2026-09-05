import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';

/** 待确认态自动复位等待时间（毫秒）。 */
const CONFIRM_RESET_MS = 3000;

type Props = {
  /** 常态触发器的提示文案（兼作待确认态 tooltip）。 */
  title: string;
  /** 进入待确认态后按钮上显示的确认文案。 */
  confirmLabel: string;
  /** 删除请求是否进行中。 */
  deleting: boolean;
  /** 第二次点击确认后触发。 */
  onConfirm: () => void;
  /** 常态触发器的自定义样式；用于适配列表行、图片覆盖层等不同宿主。 */
  triggerClassName?: string;
};

/**
 * 原地两次点击确认的删除按钮。
 *
 * 行为说明：
 * - 首次点击进入待确认态并变红显示确认文案；
 * - 超时未再次点击会自动复位；
 * - 再次点击才真正触发删除；
 * - 删除进行中显示转圈并禁止重复提交。
 */
export default function ConfirmDeleteButton({ title, confirmLabel, deleting, onConfirm, triggerClassName }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (deleting) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onConfirm();
  };

  if (armed || deleting) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={deleting}
        className={cn(
          'px-1.5 py-0.5 rounded-md text-[10px] leading-none font-medium shrink-0 transition-colors cursor-pointer',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
          deleting && 'opacity-60 cursor-not-allowed'
        )}
        title={title}
      >
        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : confirmLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'p-1 rounded-md transition-all cursor-pointer shrink-0',
        'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
        triggerClassName
      )}
      title={title}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
