import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import { TypeEditInfo } from '@inovua/reactdatagrid-community/types';
import { TypeCellSelection } from '@inovua/reactdatagrid-community/types/TypeSelected';
import {
    PiArrowFatUp,
    PiArrowLeft,
    PiArrowLineLeft,
    PiArrowLineRight,
    PiArrowRight,
    PiArrowsCounterClockwiseLight,
    PiArrowUUpLeft,
    PiDownload,
    PiDownloadSimple,
    PiExport,
    PiMinus,
    PiPlus,
} from 'react-icons/pi';
import { useShallow } from 'zustand/react/shallow';
import {
    convertSelect,
    copy,
    CPInfo,
    DataHolder,
    paste,
} from '../../../utils/ClipBoardConverter';
import { cn } from '../../../utils/Util';
import { Pagination } from '../../../db/service/WordLevelService';
import Separator from '../Separtor';
import FilterEditor from './filterEidter/FilterEditor';
import useWordsLevelPage from '../../hooks/useWordsLevelPage';
import useGlobalClipboard, {
    ClipboardContent,
} from '../../hooks/useClipboard/useGlobalClipboard';

export interface Row {
    index: number;
    id: number;
    word: string;
    translation: string;
    level: number;
    note?: string;
    markup: 'default' | 'new' | 'delete' | 'update';
}

const api = window.electron;

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
        name: 'index',
        header: '',
        minWidth: 50,
        maxWidth: 50,
    },
    {
        name: 'id',
        header: 'Id',
        defaultVisible: false,
        minWidth: 300,
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

const WordLevelPage = () => {
    const { registerPaste, registerCopy } = useGlobalClipboard(
        useShallow((s) => ({
            registerPaste: s.registerPaste,
            registerCopy: s.registerCopy,
        }))
    );

    const localClipboard = useRef<CPInfo[]>([]);
    const [columOrder, setColumOrder] = useState<string[]>(
        defaultColumns.map((item) => item.name)
    );
    const { dataSource, setDataSource, loading, page } = useWordsLevelPage();
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
            setDataSource(data);
            console.log(value, columnId, rowIndex);
        },
        [dataSource, setDataSource]
    );

    // useEffect(() => {
    //     const handleKeyDown = (event: KeyboardEvent) => {
    //         const code = event.which || event.keyCode;
    //         const charCode = String.fromCharCode(code).toLowerCase();
    //         if ((event.ctrlKey || event.metaKey) && charCode === 's') {
    //             // setState('CTRL+S');
    //             // alert('CTRL+S Pressed');
    //         } else if ((event.ctrlKey || event.metaKey) && charCode === 'c') {
    //             const dataHolder = new DataHolder(dataSource, columOrder);
    //             const selectResult = convertSelect(dataHolder, cellSelection);
    //             if (selectResult) {
    //                 localClipboard.current = copy(dataHolder, selectResult);
    //             }
    //         } else if ((event.ctrlKey || event.metaKey) && charCode === 'v') {
    //             const dataHolder = new DataHolder(dataSource, columOrder);
    //             const selectResult = convertSelect(dataHolder, cellSelection);
    //             if (selectResult) {
    //                 paste(dataHolder, selectResult, localClipboard.current);
    //                 setDataSource(dataHolder.getDataSource());
    //             }
    //         }
    //     };
    //
    //     window.addEventListener('keydown', handleKeyDown);
    //
    //     return () => window.removeEventListener('keydown', handleKeyDown);
    // }, [cellSelection, columOrder, dataSource, setDataSource]);
    useEffect(() => {
        const removeCp = registerCopy(() => {
            const dataHolder = new DataHolder(dataSource, columOrder);
            const selectResult = convertSelect(dataHolder, cellSelection);
            if (selectResult) {
                return {
                    type: 'dp-excel',
                    content: copy(dataHolder, selectResult),
                } as ClipboardContent;
            }
            return {
                type: 'none',
            } as ClipboardContent;
        });
        const removePs = registerPaste((cs: ClipboardContent[]) => {
            const cpInfo = cs.find((item) => item.type === 'dp-excel')
                ?.content as CPInfo[] | undefined;
            const dataHolder = new DataHolder(dataSource, columOrder);
            const selectResult = convertSelect(dataHolder, cellSelection);
            if (selectResult && cpInfo) {
                paste(dataHolder, selectResult, cpInfo);
                setDataSource(dataHolder.getDataSource());
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

    const buttonClass = 'cursor-default hover:bg-gray-200 rounded p-1 h-6 w-6';
    return (
        <div className="w-full h-full flex flex-col">
            <div
                className={cn(
                    'flex flex-row items-center justify-between h-9 px-2'
                )}
            >
                <div
                    className={cn(
                        'flex flex-row items-center justify-start gap-1 h-10 px-2'
                    )}
                >
                    <PiArrowLineLeft className={cn(buttonClass)} />
                    <PiArrowLeft className={cn(buttonClass)} />
                    <div
                        className={cn(
                            'flex items-center justify-center text-xs gap-1'
                        )}
                    >
                        <span>
                            {page?.from} - {page?.to}{' '}
                        </span>
                        <span className={cn('text-gray-500')}>/</span>
                        <span>{page?.total}</span>
                    </div>
                    <PiArrowRight className={cn(buttonClass)} />
                    <PiArrowLineRight className={cn(buttonClass)} />
                    <Separator orientation="vertical" />
                    <PiArrowsCounterClockwiseLight
                        className={cn(buttonClass)}
                    />
                    <Separator orientation="vertical" />
                    <PiPlus className={cn(buttonClass)} />
                    <PiMinus className={cn(buttonClass)} />
                    <PiArrowUUpLeft className={cn(buttonClass)} />
                    <PiArrowFatUp
                        className={cn(buttonClass, 'fill-green-600')}
                    />
                </div>
                <div
                    className={cn(
                        'flex flex-row items-center justify-end gap-1 h-10 px-2'
                    )}
                >
                    <PiDownload className={cn(buttonClass)} />
                    <Separator orientation="vertical" />
                    <PiDownloadSimple className={cn(buttonClass)} />
                    <PiExport className={cn(buttonClass)} />
                </div>
            </div>
            <div className={cn('z-50')}>
                <FilterEditor />
            </div>
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
