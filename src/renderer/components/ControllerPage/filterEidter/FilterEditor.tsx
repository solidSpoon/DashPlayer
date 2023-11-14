import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../../../utils/Util';
import OneLineEditor from './OneLineEditor';
import { suggestOrderBy, suggestWhere } from '../../../../utils/SqliteSuggest';
import { parseQuery } from '../../../../utils/SqliteBuilder';
import useDataPage, {
    DataPageDataHolder,
} from '../../../hooks/useDataPage/useDataPage';

export interface FilterEditorProps {
    keyName: keyof DataPageDataHolder;
}
const FilterEditor = ({ keyName }: FilterEditorProps) => {
    const { setPageParam, load, updatePageParam } = useDataPage(
        useShallow((s) => ({
            setPageParam: s.updatePageParam,
            load: s.load,
            updatePageParam: s.updatePageParam,
        }))
    );
    const where = useRef<string>();
    const orderBy = useRef<string>();

    const className =
        'bg-gray-200 p-1 px-2 text-sm flex items-center justify-center h-[25px]';
    const handleSubmit = async () => {
        console.log('where', where.current);
        console.log('orderBy', orderBy.current);
        setPageParam(keyName, 'whereSql', where.current?.trim() ?? '');
        setPageParam(keyName, 'orderBySql', orderBy.current?.trim() ?? '');
        updatePageParam(keyName, 'pageNum', 1);
        await load(keyName);
    };
    return (
        <div className={cn('w-full flex items-center')}>
            <div className={cn(className)}>WHERE</div>
            <div className={cn('flex-1 px-2')}>
                <OneLineEditor
                    onSubmit={() => handleSubmit()}
                    type="sqliteWhere"
                    completionItemProvider={suggestWhere}
                    onValueUpdate={(s) => {
                        where.current = s;
                    }}
                />
            </div>
            <div className={cn(className)}>ORDER BY</div>
            <div className={cn('flex-1 px-2')}>
                <OneLineEditor
                    onSubmit={() => handleSubmit()}
                    type="sqliteOrderBy"
                    completionItemProvider={suggestOrderBy}
                    onValueUpdate={(s) => {
                        orderBy.current = s;
                    }}
                />
            </div>
        </div>
    );
};

export default FilterEditor;
