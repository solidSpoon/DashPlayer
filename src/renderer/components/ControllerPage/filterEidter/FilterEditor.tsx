import { useRef, useState } from 'react';
import { cn } from '../../../../utils/Util';
import OneLineEditor from './OneLineEditor';
import { suggestOrderBy, suggestWhere } from '../../../../utils/SqliteSuggest';
import { build } from '../../../../utils/SqliteBuilder';

const FilterEditor = () => {
    const where = useRef<string>();
    const orderBy = useRef<string>();

    const className =
        'bg-gray-200 p-1 px-2 text-sm flex items-center justify-center h-[25px]';
    const handleSubmit = () => {
        console.log('where', where.current);
        console.log('orderBy', orderBy.current);
        build(where.current ?? '', orderBy.current ?? '');
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
