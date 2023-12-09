import 'ag-grid-community/styles/ag-grid-no-native-widgets.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import 'ag-grid-enterprise';
import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community/dist/lib/entities/colDef';
import { IServerSideDatasource } from 'ag-grid-community';
import { WordView } from '../../../../db/tables/wordView'; // Theme

const api = window.electron;
const createDatasource:IServerSideDatasource = {
        // called by the grid when more rows are required
        getRows: async params => {
            console.log('Getting datasource rows', params.request);
            // get data for request from server
            const response = await api.getWordRows(params.request);
            params.success({
                rowData: response.map((row: WordView) => ({
                    id: row.id,
                    word: row.word,
                    translation: row.translate,
                    familiar: row.familiar,
                    note: row.note,
                })), // map to the ag-grid expected format
            });
            // params.success({
            //     rowData: [],
            // })
        }
    };


const WordManagement = () => {
    // Column Definitions: Defines & controls grid columns.
    const [colDefs] = useState<ColDef[]>([
        {
            field: 'word',
            width: 150,
        },
        {
            field: 'translation',
            width: 130,
        },
        {
            field: 'familiar',
            width: 225,
        },
        {
            field: 'note',
            width: 225,
        },
    ]);

    // Apply settings across all columns
    const defaultColDef = useMemo<ColDef>(() => ({
        // filter: 'agTextColumnFilter',
        editable: true,
    }), []);

    // Container: Defines the grid's theme & dimensions.
    return (
        <div
            className="ag-theme-quartz bg-write"
            style={{ width: '100%', height: '100%' }}
        >
            <AgGridReact
                className={'ag-theme-balham'}
                rowModelType={'serverSide'}
                serverSideDatasource={createDatasource}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                enableRangeSelection
                getRowId={(params) => params.data.id}
                rowSelection='multiple'
                onSelectionChanged={(event) => console.log('Row Selected!')}
                onCellValueChanged={(event) =>
                    console.log(`New Cell Value: ${event.value}`)
                }
            />
        </div>
    );
};

export default WordManagement;
