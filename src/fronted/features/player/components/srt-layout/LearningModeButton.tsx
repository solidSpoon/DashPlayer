import { GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { cn } from '@/fronted/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/fronted/components/ui/tooltip';
import useChatPanel from '@/fronted/features/chat/chatStore';
import useSetting from '@/fronted/features/settings/settingsStore';

/**
 * 字幕悬浮胶囊的外壳样式。
 *
 * 播放画面的胶囊与学习界面右下角的单独胶囊共用这一份：两边锚点相同、内边距相同，
 * 开关按钮又都是它们的最后一个子元素，落点因此与视图切换无关。
 */
export const CAPTION_CAPSULE_CLASS =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-300/60 dark:bg-neutral-700/60 border border-black/5 dark:border-white/5 backdrop-blur-sm shadow-xs';

/**
 * 整句学习开关按钮。
 *
 * 与「进入学习页」的快捷键是同一个动作：未打开时按当前字幕句进入学习页，
 * 已打开时只隐藏学习页、保留会话，后台生成不中断。
 * 按钮挂在两处：播放画面胶囊的最右侧、学习界面右下角的单独胶囊里；
 * 自身固定 24px 见方（与胶囊里的播放键同高），两处胶囊的高度因而一致。
 *
 * @returns 整句学习开关按钮。
 */
export default function LearningModeButton() {
    const { t } = useI18nTranslation('common');
    const learningVisible = useChatPanel((s) => s.learningVisible);
    const shortcut = useSetting((s) => s.setting('shortcut.aiChat')) ?? '';
    const label = learningVisible ? t('learning.backToPlayer') : t('learning.title');

    /**
     * 开关学习页：与快捷键走同一入口，进入失败（如当前没有可学习的字幕句）直接提示原因。
     */
    const handleClick = (): void => {
        void useChatPanel.getState().toggleLearning().catch((error) => {
            toast.error(error instanceof Error ? error.message : String(error));
        });
    };

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        onClick={handleClick}
                        aria-label={label}
                        className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors',
                            learningVisible
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-200/70 dark:bg-emerald-900/60 shadow-xs ring-1 ring-emerald-500/30'
                                : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300/60 dark:hover:bg-neutral-600/60'
                        )}
                    >
                        <GraduationCap className="w-3.5 h-3.5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                    {label}
                    {shortcut ? ` (${shortcut})` : ''}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
