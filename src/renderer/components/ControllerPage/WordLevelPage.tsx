import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import { TypeEditInfo } from '@inovua/reactdatagrid-community/types';
import { TypeCellSelection } from '@inovua/reactdatagrid-community/types/TypeSelected';
import { WordLevel } from '../../../db/entity/WordLevel';
import {
    convertSelect,
    copy,
    CPInfo,
    DataHolder,
    paste,
} from '../../../utils/ClipBoardConverter';

export interface Row {
    id: number;
    word: string;
    translation: string;
    level: number;
}

const api = window.electron;

const defaultColumns = [
    {
        name: 'id',
        header: 'Id',
        defaultVisible: false,
        minWidth: 300,
        type: 'number',
    },
    { name: 'word', header: 'Word', minWidth: 50, defaultFlex: 2 },
    {
        name: 'translation',
        header: 'Translation',
        maxWidth: 1000,
        defaultFlex: 1,
    },
    { name: 'level', header: 'Level', maxWidth: 100, defaultFlex: 1 },
];

const gridStyle = { minHeight: 550 };

async function getData() {
    const data = await api.listWordsLevel(1000, 1);
    return data.data.map((item: WordLevel, index) => {
        return {
            id: item.id ?? 0,
            word: item.word ?? '',
            translation: item.translate ?? '',
            level: item.level ?? 0,
        } as Row;
    });
}

const WordLevelPage = () => {
    const localClipboard = useRef<CPInfo[]>([]);
    const [columOrder, setColumOrder] = useState<string[]>(
        defaultColumns.map((item) => item.name)
    );
    const [dataSource, setDataSource] = useState<WordLevel[]>([]);
    const [cellSelection, setCellSelection] = useState<TypeCellSelection>({
        '1,word': true,
    });
    useEffect(() => {
        // eslint-disable-next-line promise/catch-or-return,promise/always-return
        getData().then((d) => {
            setDataSource(d);
        });
    }, []);
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
        [dataSource]
    );

    useEffect(() => {
        const handleKeyDown = (event) => {
            event.preventDefault();
            const code = event.which || event.keyCode;

            const charCode = String.fromCharCode(code).toLowerCase();
            if ((event.ctrlKey || event.metaKey) && charCode === 's') {
                // setState('CTRL+S');
                // alert('CTRL+S Pressed');
            } else if ((event.ctrlKey || event.metaKey) && charCode === 'c') {
                console.log('handleCopy');
                const dataHolder = new DataHolder(dataSource, columOrder);
                console.log('dataHolder', dataHolder);
                const selectResult = convertSelect(dataHolder, cellSelection);
                console.log('selectResult', selectResult);
                if (selectResult) {
                    const copyResult = copy(dataHolder, selectResult);
                    console.log('copyResult', copyResult);
                    localClipboard.current = copyResult;
                }
            } else if ((event.ctrlKey || event.metaKey) && charCode === 'v') {
                const dataHolder = new DataHolder(dataSource, columOrder);
                console.log('dataHolder', dataHolder);
                const selectResult = convertSelect(dataHolder, cellSelection);
                console.log('selectResult', selectResult);
                if (selectResult) {
                    paste(dataHolder, selectResult, localClipboard.current);
                    setDataSource(dataHolder.getDataSource());
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cellSelection, columOrder, dataSource]);

    console.log('cellSelection', cellSelection);
    console.log('columOrder', columOrder);

    return (
        <div>
            <ReactDataGrid
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
