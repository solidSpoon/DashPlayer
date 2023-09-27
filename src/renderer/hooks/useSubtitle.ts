import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import FileT from '../lib/param/FileT';
import SentenceT from '../lib/param/SentenceT';
import parseSrtSubtitles from '../lib/parseSrt';
import TranslateBuf from '../lib/TranslateBuf';
import TransFiller from '../lib/TransFiller';

const api = window.electron;
export interface SentenceApiParam {
    index: number;
    text: string;
    translate: string | undefined;
}

export const toSentenceApiParam = (sentence: SentenceT): SentenceApiParam => {
    return {
        index: sentence.index,
        text: sentence.text ?? '',
        translate: undefined,
    };
};

function merge(baseArr: SentenceT[], diff: SentenceApiParam[]) {
    const mapping = new Map<number, string>();
    diff.forEach((item) => {
        mapping.set(item.index, item.translate ?? '');
    });
    return baseArr.map((item, index) => {
        const translate = mapping.get(index);
        if (translate) {
            const ns = item.clone();
            ns.msTranslate = translate;
            return ns;
        }
        return item;
    });
}

async function loadSubtitle(subtitleFile: FileT) {
    const url = subtitleFile?.objectUrl ?? '';

    const axiosResponse = await axios.get(url);

    const str = axiosResponse.data;

    const srtSubtitles = parseSrtSubtitles(str);
    srtSubtitles.forEach((item) => {
        item.fileUrl = url;
        item.setKey();
    });
    return srtSubtitles;
}

async function transBuf(srtSubtitles: SentenceT[], buffer: TranslateBuf) {
    if (buffer.isEmpty()) {
        return srtSubtitles;
    }
    const res = await api.batchTranslate(buffer.sentences);
    return merge(srtSubtitles, res);
}

export default function useSubtitle(subtitleFile: FileT | undefined) {
    const [subtitle, setSubtitle] = useState<SentenceT[]>([]);
    const [secretVersion, setSecretVersion] = useState<number>(0);
    useEffect(() => {
        let cancel = false;
        if (subtitleFile?.objectUrl === undefined) return () => {};
        const init = async () => {
            let srtSubtitles = await loadSubtitle(subtitleFile);
            if (cancel) return;
            setSubtitle(srtSubtitles);
            const params = srtSubtitles.map(toSentenceApiParam);
            const cacheRes = await api.loadTransCache(params);
            srtSubtitles = merge(srtSubtitles, cacheRes);
            if (cancel) return;
            setSubtitle(srtSubtitles);
            const remain = srtSubtitles.filter(
                (item) =>
                    item.msTranslate === '' || item.msTranslate === undefined
            );
            const buffers: TranslateBuf[] = TransFiller.splitToBuffers(
                remain,
                1000
            );

            // eslint-disable-next-line no-restricted-syntax
            for (const buffer of buffers) {
                // eslint-disable-next-line no-await-in-loop
                srtSubtitles = await transBuf(srtSubtitles, buffer);
                if (cancel) return;
                setSubtitle(srtSubtitles);
                // eslint-disable-next-line no-await-in-loop
                await TransFiller.sleep(300);
            }
        };
        init();

        return () => {
            cancel = true;
        };
    }, [subtitleFile, secretVersion]);

    useEffect(() => {
        const cancel = api.onTencentSecretUpdate(() =>
            setSecretVersion((v) => v + 1)
        );
        return () => {
            cancel();
        };
    });

    return subtitle;
}
