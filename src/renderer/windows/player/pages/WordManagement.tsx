import 'ag-grid-community/styles/ag-grid-no-native-widgets.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import 'ag-grid-enterprise';
import React, {
    LegacyRef,
    MutableRefObject,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community/dist/lib/entities/colDef';
import { useShallow } from 'zustand/react/shallow'; // Theme
import { RowClassParams } from 'ag-grid-community/dist/lib/entities/gridOptions';
import WordLevelHeader from '../../../components/WordLevelHeader';
import FilterEditor from '../../../components/filterEidter';
import useDataPage from '../../../hooks/useDataPage/useDataPage';

const WordManagement = () => {
    const gridRef = useRef<AgGridReact>(null);
    const { dataSource, tryMount, unMount, diff, setRef, setCellSelection, ele } =
        useDataPage(
            useShallow((s) => ({
                dataSource: s.data.wordView.dataSource,
                tryMount: s.tryMount,
                unMount: s.unmount,
                diff: s.diff,
                setRef: s.setRef,
                setCellSelection: s.setCellSelection,
                ele: s.data.wordView.ele,
            }))
        );
    const cellStyle = (field: string) => {
        // 淡蓝色
        return (params: any) => {
            if (params.data.markup !== 'update') {
                return null;
            }
            if ((params.data.updateColumns ?? []).includes(field)) {
                // mark police cells as red
                return { backgroundColor: '#e6f7ff' };
            }
            return null;
        };
    };
    // Column Definitions: Defines & controls grid columns.
    const [colDefs] = useState<ColDef[]>([
        {
            headerName: '',
            field: 'fakeId',
            width: 50,
            editable: false,
            lockPosition: 'left',
            resizable: false,
            cellStyle: { 'text-align': 'center' },
        },
        {
            field: 'word',
            width: 150,
            cellStyle: cellStyle('word'),
        },
        {
            field: 'translate',
            width: 130,
            cellStyle: cellStyle('translate'),
        },
        {
            field: 'familiar',
            width: 100,
            cellStyle: cellStyle('familiar'),
        },
        {
            field: 'note',
            width: 1000,
            cellStyle: cellStyle('note'),
        },
    ]);
    const getRowStyle = (params: RowClassParams) => {
        const { markup } = params.data;
        if (markup === 'new') {
            // 淡绿
            return { backgroundColor: '#f6ffed' };
        }
        if (markup === 'delete') {
            // 淡红
            return { backgroundColor: '#ffe6e6' };
        }
        if (markup === 'new-delete') {
            // 淡粉色
            return { backgroundColor: '#fff0f6' };
        }
    };
    // Apply settings across all columns
    const defaultColDef = useMemo<ColDef>(
        () => ({
            // filter: 'agTextColumnFilter',
            editable: true,
            floatingFilter: false,
            suppressMenu: false,
            menuTabs: [],
        }),
        []
    );

    useEffect(() => {
        tryMount('wordView');
        return () => {
            unMount('wordView');
        };
    }, []);

    const handleRangeSelectionChanged = (event: any) => {
        const cellRanges = ele.current?.api.getCellRanges();
        console.log('cellRanges', cellRanges);
        setCellSelection('wordView', cellRanges??[]);
    };
    // Container: Defines the grid's theme & dimensions.
    return (
        <div
            className="w-full h-full flex flex-col bg-white"
            style={{ width: '100%', height: '100%' }}
        >
            <div className="h-10 grid place-content-center">
                Word Management
            </div>
            <WordLevelHeader keyName="wordView" />
            <FilterEditor keyName="wordView" />
            <AgGridReact
                onRangeSelectionChanged={(event) => {
                    handleRangeSelectionChanged(event);
                }}
                ref={(r) => setRef('wordView', r)}
                getRowStyle={getRowStyle}
                onStateUpdated={() => diff('wordView')}
                animateRows={false}
                className="ag-theme-balham flex-1"
                rowData={dataSource}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                enableRangeSelection
                getRowId={(params) => params.data.fakeId}
                rowSelection="multiple"
                onSelectionChanged={(event) => console.log('Row Selected!')}
                onCellValueChanged={(event) =>
                    console.log(`New Cell Value: ${event.value}`)
                }
            />
        </div>
    );
};

export default WordManagement;
