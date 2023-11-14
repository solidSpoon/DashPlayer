import React, { useCallback, useEffect, useState } from 'react';
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import { TypeEditInfo } from '@inovua/reactdatagrid-community/types';
import { TypeCellSelection } from '@inovua/reactdatagrid-community/types/TypeSelected';
import { useShallow } from 'zustand/react/shallow';
import {
    convertSelect,
    copy,
    DataHolder,
    paste,
    toCpInfos,
    toCpString,
} from '../../../utils/ClipBoardConverter';
import { cn } from '../../../utils/Util';
import useGlobalClipboard from '../../hooks/useClipboard/useGlobalClipboard';
import useDataPage, {
    DataPageDataHolder,
} from '../../hooks/useDataPage/useDataPage';
import { WordLevel } from '../../../db/entity/WordLevel';
import FilterEditor from './filterEidter/FilterEditor';
import WordLevelHeader from './WordLevelHeader';

export interface WordLevelRow extends WordLevel {
    index: number;
    fakeId: number;
    markup: 'default' | 'new' | 'delete' | 'update';
}

const rowStyle = ({ data }: any) => {
    const colorMap = new Map([
        ['default', ''],
        ['new', 'green'],
        ['delete', 'red'],
        ['update', 'blue'],
    ]);

    return {
        color: colorMap.get(data.markup),
    };
};

const defaultColumns = [
    {
        name: 'fakeId',
        header: '',
        minWidth: 50,
        maxWidth: 50,
        type: 'number',
    },
    { name: 'word', header: 'Word', minWidth: 50, defaultFlex: 1 },
    {
        name: 'translation',
        header: 'Translation',
        maxWidth: 1000,
        defaultFlex: 1,
    },
    { name: 'level', header: 'Level', maxWidth: 100, defaultFlex: 1 },
    { name: 'note', header: 'Note', minWidth: 100, defaultFlex: 2 },
];

const gridStyle = { minHeight: 550 };

const KEY: keyof DataPageDataHolder = 'wordLevel';
const WordLevelPage = () => {
    const { registerPaste, registerCopy } = useGlobalClipboard(
        useShallow((s) => ({
            registerPaste: s.registerPaste,
            registerCopy: s.registerCopy,
        }))
    );

    const [columOrder, setColumOrder] = useState<string[]>(
        defaultColumns.map((item) => item.name)
    );
    // const { dataSource, setDataSource, loading, page } = useWordsLevelPage();
    const { dataSource, setDataSource, loading, tryMount, unMount } =
        useDataPage(
            useShallow((s) => ({
                dataSource: s.data.wordLevel.dataSource,
                setDataSource: s.setDataSource,
                loading: s.data.wordLevel.loading,
                tryMount: s.tryMount,
                unMount: s.unmount,
            }))
        );
    useEffect(() => {
        tryMount(KEY);
        return () => {
            unMount(KEY);
        };
    }, [tryMount, unMount]);
    const [cellSelection, setCellSelection] = useState<TypeCellSelection>({
        '1,word': true,
    });

    const [columns] = useState(defaultColumns);

    const onEditComplete = useCallback(
        ({ value, columnId, rowIndex }: TypeEditInfo) => {
            const data = [...dataSource];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            data[rowIndex] = { ...data[rowIndex], [columnId]: value };
            setDataSource(KEY, data);
            console.log(value, columnId, rowIndex);
        },
        [dataSource, setDataSource]
    );
    useEffect(() => {
        const removeCp = registerCopy((): string => {
            const dataHolder = new DataHolder(dataSource, columOrder);
            const selectResult = convertSelect(dataHolder, cellSelection);
            if (selectResult) {
                return toCpString(copy(dataHolder, selectResult));
            }
            return '';
        });
        const removePs = registerPaste((cs: string) => {
            const cpInfo = toCpInfos(cs);
            const dataHolder = new DataHolder(dataSource, columOrder);
            const selectResult = convertSelect(dataHolder, cellSelection);
            if (selectResult && cpInfo) {
                paste(dataHolder, selectResult, cpInfo);
                setDataSource(KEY, dataHolder.getDataSource());
            }
        });
        return () => {
            removeCp();
            removePs();
        };
    }, [
        cellSelection,
        columOrder,
        dataSource,
        registerCopy,
        registerPaste,
        setDataSource,
    ]);

    console.log('cellSelection', cellSelection);
    console.log('columOrder', columOrder);

    return (
        <div className="w-full h-full flex flex-col">
            <WordLevelHeader keyName={KEY} />

            <FilterEditor keyName={KEY} />

            <ReactDataGrid
                headerHeight={30}
                rowHeight={25}
                rowStyle={rowStyle}
                className={cn('flex-1')}
                copySpreadsheetCompatibleString
                cellSelection={cellSelection}
                onCellSelectionChange={setCellSelection}
                onEditComplete={onEditComplete}
                editable
                style={gridStyle}
                idProperty="id"
                columns={columns}
                columnOrder={columOrder}
                onColumnOrderChange={setColumOrder}
                dataSource={dataSource}
            />
        </div>
    );
};
export default WordLevelPage;
