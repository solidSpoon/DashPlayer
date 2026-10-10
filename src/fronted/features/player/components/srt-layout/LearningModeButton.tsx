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
import {
    CAPTION_CARD_BUTTON_CLASS,
    CAPTION_CARD_IDLE_CLASS,
    captionCardActiveClass,
} from '@/fronted/features/player/components/captionCardShell';

/**
 * 整句学习开关按钮。
 *
 * 与「进入学习页」的快捷键是同一个动作：未打开时按当前字幕句进入学习页，
 * 已打开时只隐藏学习页、保留会话，后台生成不中断。
 * 按钮挂在两处：播放画面胶囊的最右侧、学习界面右下角的单独胶囊里；
 * 自身为卡片内的 24px 正圆（与胶囊内其余按钮同款），两处胶囊的高度因而一致。
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
                            CAPTION_CARD_BUTTON_CLASS,
                            learningVisible ? captionCardActiveClass('emerald') : CAPTION_CARD_IDLE_CLASS
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
