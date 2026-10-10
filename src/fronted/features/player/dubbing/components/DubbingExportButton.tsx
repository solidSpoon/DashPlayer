import { useNavigate } from 'react-router-dom';
import { codeBlock } from 'common-tags';
import { useTranslation } from 'react-i18next';
import { AudioLines } from 'lucide-react';

import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';

interface DubbingExportButtonProps {
    className?: string;
}

/**
 * 控制台「配音导出」按钮。
 *
 * 只作跳转快捷方式：点击进入配音导出页，在那里查看并导出所有录过配音的视频。
 */
export default function DubbingExportButton({ className }: DubbingExportButtonProps) {
    const { t } = useTranslation('player');
    const navigate = useNavigate();

    const tooltipMd = codeBlock`
    #### ${t('dubbing.export.tooltipTitle')}
    _${t('dubbing.export.tooltipSubtitle')}_

    1. ${t('dubbing.export.workflow1')}
    2. ${t('dubbing.export.workflow2')}
    `;

    return (
        <TooltippedButton
            icon={AudioLines}
            text={t('dubbing.export.button')}
            onClick={() => navigate('/dubbing')}
            tooltipMd={tooltipMd}
            variant="ghost"
            className={className}
        />
    );
}
