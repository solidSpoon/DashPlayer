import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn, strBlank } from '../../../common/utils/Util';
import OneLineEditor from './OneLineEditor';
import {
    suggestOrderBy,
    suggestWhere,
} from '../../../common/utils/SqliteSuggest';
import { parseQuery } from '../../../common/utils/SqliteBuilder';
import useDataPage, {
    DataPageDataHolder,
} from '../../hooks/useDataPage/useDataPage';

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
    const [where, setWhere] = useState<string>();
    const [orderBy, setOrderBy] = useState<string>();

    const className = ' text-lg grid place-content-center h-[25px]';
    const handleSubmit = async () => {
        console.log('where', where);
        console.log('orderBy', orderBy);
        const { whereSql, orderBySql } = parseQuery(where ?? '', orderBy ?? '');
        setPageParam(keyName, 'whereSql', whereSql);
        setPageParam(keyName, 'orderBySql', orderBySql);
        updatePageParam(keyName, 'pageNum', 1);
        await load(keyName);
    };
    return (
        <div
            className={cn(
                'grid grid-cols-4 grid-rows-1 w-full items-center gap-2 whitespace-nowrap py-1 px-2'
            )}
            style={{
                gridTemplateColumns: 'auto 1fr auto 1fr',
            }}
        >
            <div
                className={cn(
                    className,
                    strBlank(where) ? 'text-gray-400' : 'text-indigo-600'
                )}
            >
                WHERE
            </div>

            <OneLineEditor
                onSubmit={() => handleSubmit()}
                type="sqliteWhere"
                completionItemProvider={suggestWhere}
                onValueUpdate={setWhere}
            />

            <div
                className={cn(
                    className,
                    strBlank(orderBy) ? 'text-gray-400' : 'text-indigo-600'
                )}
            >
                ORDER BY
            </div>

            <OneLineEditor
                onSubmit={() => handleSubmit()}
                type="sqliteOrderBy"
                completionItemProvider={suggestOrderBy}
                onValueUpdate={setOrderBy}
            />
        </div>
    );
};

export default FilterEditor;
