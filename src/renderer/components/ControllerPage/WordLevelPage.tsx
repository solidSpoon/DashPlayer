import 'react-data-grid/lib/styles.css';

import DataGrid, {
    Column,
    CopyEvent,
    FillEvent,
    PasteEvent,
    RowsChangeData,
    SelectColumn,
    textEditor,
} from 'react-data-grid';
import { useEffect, useState } from 'react';
import { WordLevel } from '../../../db/entity/WordLevel';

const api = window.electron;
export interface Row {
    id: number;
    word: string;
    translation: string;
    level: number;
}
function rowKeyGetter(row: Row): string {
    return `${row.id}`;
}

const columns: readonly Column<Row>[] = [
    SelectColumn,
    {
        key: 'id',
        name: 'ID',
        width: 80,
        resizable: true,
        frozen: true,
    },
    {
        key: 'word',
        name: 'Word',
        width: 300,
        resizable: true,
        renderEditCell: textEditor,
    },
    {
        key: 'translation',
        name: 'Translation',
        width: 300,
        resizable: true,
        renderEditCell: textEditor,
    },
    {
        key: 'level',
        name: 'Level',
        width: 80,
        resizable: true,
        renderEditCell: textEditor,
    },
];

async function getData() {
    const data = await api.listWordsLevel(1000, 1);
    return data.data.map((item: WordLevel) => {
        return {
            id: item.id ?? '',
            word: item.word ?? '',
            translation: item.translate ?? '',
            level: item.level ?? 0,
        } as Row;
    });
}

const WordLevelPage = () => {
    const [rows, setRows] = useState<Row[]>([]);
    const [selectedRows, setSelectedRows] = useState(
        (): ReadonlySet<string> => new Set()
    );

    useEffect(() => {
        const init = async () => {
            console.log('init');
            const rs = await getData();
            console.log('rs', rs);
            setRows(rs);
        };
        init();
    }, []);

    const handleFill = ({
        columnKey,
        sourceRow,
        targetRow,
    }: FillEvent<Row>): Row => {
        return { ...targetRow, [columnKey]: sourceRow[columnKey as keyof Row] };
    };

    const handlePaste = ({
        sourceColumnKey,
        sourceRow,
        targetColumnKey,
        targetRow,
    }: PasteEvent<Row>): Row => {
        const incompatibleColumns = ['email', 'zipCode', 'date'];
        if (
            sourceColumnKey === 'avatar' ||
            ['id', 'avatar'].includes(targetColumnKey) ||
            ((incompatibleColumns.includes(targetColumnKey) ||
                incompatibleColumns.includes(sourceColumnKey)) &&
                sourceColumnKey !== targetColumnKey)
        ) {
            return targetRow;
        }

        return {
            ...targetRow,
            [targetColumnKey]: sourceRow[sourceColumnKey as keyof Row],
        };
    };

    const handleCopy = ({
        sourceRow,
        sourceColumnKey,
    }: CopyEvent<Row>): void => {
        if (window.isSecureContext) {
            navigator.clipboard.writeText(
                sourceRow[sourceColumnKey as keyof Row] as string
            );
        }
    };

    const onRowsChange = async (rs: Row[], data: RowsChangeData<Row>) => {
        setRows(rs);
        const nrs: WordLevel[] = [];
        data.indexes.forEach((index) => {
            const item = rs[index];
            const row = {
                word: item.word,
                translate: item.translation,
                level: item.level,
            } as WordLevel;
            nrs.push(row);
        });
        await api.batchUpdateLevelWords(nrs);
        const newRows = await getData();
        setRows(newRows);
    };

    return (
        <DataGrid
            style={{
                height: 'calc(100vh - 200px)',
                width: '100%',
            }}
            columns={columns}
            rows={rows}
            rowKeyGetter={rowKeyGetter}
            onRowsChange={onRowsChange}
            onFill={handleFill}
            onCopy={handleCopy}
            onPaste={handlePaste}
            rowHeight={30}
            selectedRows={selectedRows}
            onSelectedRowsChange={setSelectedRows}
            className="fill-grid"
            direction="ltr"
            onCellClick={(args, event) => {
                if (args.column.key === 'title') {
                    event.preventGridDefault();
                    args.selectCell(true);
                }
            }}
        />
    );
};
export default WordLevelPage;
