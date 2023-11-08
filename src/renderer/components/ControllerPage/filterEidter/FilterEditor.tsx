import { cn } from '../../../../utils/Util';
import OneLineEditor from './OneLineEditor';
import { suggestOrderBy, suggestWhere } from '../../../../utils/SqliteSuggest';

const FilterEditor = () => {
    const className =
        'bg-gray-200 p-1 px-2 text-sm flex items-center justify-center h-[25px]';
    return (
        <div className={cn('w-full flex items-center')}>
            <div className={cn(className)}>WHERE</div>
            <div className={cn('flex-1 px-2')}>
                <OneLineEditor
                    type="sqliteWhere"
                    completionItemProvider={suggestWhere}
                    onSubmit={() => {}}
                />
            </div>
            <div className={cn(className)}>ORDER BY</div>
            <div className={cn('flex-1 px-2')}>
                <OneLineEditor
                    type="sqliteOrderBy"
                    completionItemProvider={suggestOrderBy}
                    onSubmit={() => {}}
                />
            </div>
        </div>
    );
};

export default FilterEditor;
