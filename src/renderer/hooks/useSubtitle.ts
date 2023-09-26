import { useEffect, useState } from 'react';
import axios from 'axios';
import FileT from '../lib/param/FileT';
import SentenceT from '../lib/param/SentenceT';
import parseSrtSubtitles from '../lib/parseSrt';
import TranslateBuf from '../lib/TranslateBuf';
import TransFiller from '../lib/TransFiller';
import callApi from '../lib/apis/ApiWrapper';

function mergeToNew(baseArr: SentenceT[], buffer: TranslateBuf): SentenceT[] {
    const newArr: SentenceT[] = [...baseArr];
    const { response } = buffer;
    if (response === undefined) {
        return newArr;
    }
    response.forEach((item, i) => {
        const index = buffer.startIndex + i;
        if (index < newArr.length) {
            const n: SentenceT = baseArr[index].clone();
            n.msTranslate = item;
            newArr[index] = n;
        }
    });
    return newArr;
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
    // eslint-disable-next-line no-await-in-loop
    buffer.response = (await callApi('batch-translate', [
        buffer.strs,
    ])) as string[];
    return mergeToNew(srtSubtitles, buffer);
}

export default function useSubtitle(subtitleFile: FileT | undefined) {
    const [subtitle, setSubtitle] = useState<SentenceT[]>([]);

    useEffect(() => {
        let cancel = false;
        if (subtitleFile?.objectUrl === undefined) return () => {};
        const init = async () => {
            let srtSubtitles = await loadSubtitle(subtitleFile);
            setSubtitle(srtSubtitles);
            const buffers: TranslateBuf[] = TransFiller.splitToBuffers(
                srtSubtitles,
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
    }, [subtitleFile]);

    return subtitle;
}
