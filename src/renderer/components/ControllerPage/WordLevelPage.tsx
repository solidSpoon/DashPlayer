import React, { useCallback, useEffect, useState } from 'react';
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import './WordLevelPage.model.css';
import { TypeEditInfo } from '@inovua/reactdatagrid-community/types';
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

export type MarkupType = 'default' | 'new' | 'delete' | 'update';
export interface WordLevelRow extends WordLevel {
    index: number;
    fakeId: number;
    markup: MarkupType;
    updateColumns: (keyof WordLevel)[];
}
const rowClassName = ({ data }: { data: WordLevelRow }) => {
    if (data.markup === 'new') {
        console.log('mark new');
        return 'global-custom-row-green global-custom-row';
    }
    if (data.markup === 'delete') {
        return 'global-custom-row-red global-custom-row';
    }

    if (data.markup === 'update') {
        return 'global-custom-row-blue global-custom-row';
    }

    return 'global-custom-row';
};
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

const onRender = (
    colName: keyof WordLevel,
    cellProps: any,
    { data }: { data: WordLevelRow }
) => {
    cellProps.style.background = data.updateColumns.includes(colName)
        ? '#97aeff'
        : 'inherit';
};

export const defaultColumns = [
    {
        name: 'fakeId',
        header: '',
        minWidth: 50,
        maxWidth: 50,
        type: 'number',
    },
    {
        name: 'word',
        header: 'Word',
        minWidth: 50,
        defaultFlex: 1,
        onRender: onRender.bind(null, 'word'),
    },
    {
        name: 'translate',
        header: 'Translation',
        maxWidth: 1000,
        defaultFlex: 1,
        onRender: onRender.bind(null, 'translate'),
    },
    {
        name: 'level',
        header: 'Level',
        maxWidth: 100,
        defaultFlex: 1,
        onRender: onRender.bind(null, 'level'),
    },
    {
        name: 'note',
        header: 'Note',
        minWidth: 100,
        defaultFlex: 2,
        onRender: onRender.bind(null, 'note'),
    },
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
    // const { dataSource, setDataSource, loading, page } = useWordsLevelPage();
    const {
        dataSource,
        setDataSource,
        loading,
        tryMount,
        unMount,
        cellSelection,
        setCellSelection,
        columOrder,
        setColumnOrder,
    } = useDataPage(
        useShallow((s) => ({
            dataSource: s.data.wordLevel.dataSource,
            setDataSource: s.setDataSource,
            loading: s.data.wordLevel.loading,
            tryMount: s.tryMount,
            unMount: s.unmount,
            cellSelection: s.data.wordLevel.cellSelection,
            setCellSelection: s.setCellSelection,
            columOrder: s.data.wordLevel.columOrder,
            setColumnOrder: s.setColumnOrder,
        }))
    );
    useEffect(() => {
        tryMount(KEY);
        return () => {
            unMount(KEY);
        };
    }, [tryMount, unMount]);

    const [columns] = useState(defaultColumns);

    const onEditComplete = useCallback(
        ({ value, columnId, rowIndex }: TypeEditInfo) => {
            const data = [...dataSource];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const oldVal = data[rowIndex][columnId];
            if (value === oldVal) {
                return;
            }
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const oldUpdateColumns = data[rowIndex].updateColumns || [];
            data[rowIndex] = {
                ...data[rowIndex],
                [columnId]: value,
                markup: 'update',
                updateColumns: [
                    ...new Set([
                        ...oldUpdateColumns,
                        columnId,
                    ] as (keyof WordLevel)[]),
                ],
            };
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
                rowClassName={rowClassName}
                // rowStyle={rowStyle}
                className={cn('flex-1')}
                copySpreadsheetCompatibleString
                cellSelection={cellSelection}
                onCellSelectionChange={(s) => setCellSelection(KEY, s)}
                onEditComplete={onEditComplete}
                editable
                style={gridStyle}
                idProperty="id"
                columns={columns}
                columnOrder={columOrder}
                onColumnOrderChange={(o) => setColumnOrder(KEY, o)}
                dataSource={dataSource}
            />
        </div>
    );
};
export default WordLevelPage;
