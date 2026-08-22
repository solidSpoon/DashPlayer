import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { emptyFunc } from '@/common/utils/Util';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import { convertApi } from '../convertApi';
import { useTranslation } from 'react-i18next';

/** 转码文件夹选择器的输入属性。 */
export interface FolderSelectorProps {
    /** 用户完成选择后的回调。 */
    onSelected?: (folders: string[]) => void;
    /** 附加到按钮的样式类。 */
    className?: string;
}

const ConvertFolderSelector = ({ onSelected, className }: FolderSelectorProps) => {
    const { t } = useTranslation('common');
    const handleClick = async () => {
        const ps = await convertApi.selectFolders();
        if (ps.length > 0) {
            onSelected?.(ps);
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={() => handleClick()}
                        variant={'outline'}
                        className={cn('w-28', className)}
                    >{t('addFolder')}</Button>
                </TooltipTrigger>
                <TooltipContent>
                    文件夹内的视频和对应的字幕文件名称最好保持一致
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

ConvertFolderSelector.defaultProps = {
    onSelected: emptyFunc,
    className: ''
};

export default ConvertFolderSelector;
