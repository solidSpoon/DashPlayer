import React from 'react';
import {Button} from '@/fronted/components/ui/button';
import { MediaFormats } from '@/common/utils/MediaUtil';
import { repairApi } from '../repairApi';
import { useTranslation } from 'react-i18next';

export default function RepairFileSelector({
                                         onSelected
                                     }: {
    onSelected: (ps: string[]) => Promise<void>;
}) {
    const { t } = useTranslation('common');
    const handleClick = async () => {
        // 需不需要修复要靠探测，不能按扩展名筛：常见扩展名也可能带着放不出的音轨/编码。
        const ps = await repairApi.selectFiles(MediaFormats);
        if (ps.length > 0) {
            await onSelected(ps);
        }
    };

    return (
        <Button
            onClick={() => handleClick()}
            variant={'outline'}
            className="w-28"
        >{t('addFile')}</Button>
    );
}
