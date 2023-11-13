import { useCallback, useEffect, useState } from 'react';
import { WordLevel } from '../../db/entity/WordLevel';
import { Pagination } from '../../db/service/WordLevelService';
import { Row } from '../components/ControllerPage/WordLevelPage';

const api = window.electron;

function mapToDataSource(index: number, item: WordLevel) {
    return {
        index,
        id: item.id ?? 0,
        word: item.word ?? '',
        translation: item.translate ?? '',
        level: item.level ?? 0,
        markup: 'default',
    } as Row;
}

const useWordsLevelPage = () => {
    const [dataSource, setDataSource] = useState<WordLevel[]>([]);
    const [page, setPage] = useState<Pagination<WordLevel>>();
    const [loading, setLoading] = useState(true);

    const refresh = () => {};
    const submit = () => {};
    useEffect(() => {
        const init = async () => {
            const p = await api.listWordsLevel('1 = 1', 'id desc', 10, 1);
            const records = p.data.map((item: WordLevel, index) =>
                mapToDataSource(index, item)
            );
            setDataSource(records);
            setPage(p);
        };
        init();
    }, []);
    return {
        dataSource,
        setDataSource,
        page,
        loading,
        refresh,
        submit,
    };
};

export default useWordsLevelPage;
