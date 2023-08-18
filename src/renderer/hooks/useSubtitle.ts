import { useEffect, useState } from 'react';
import axios from 'axios';
import FileT from '../lib/param/FileT';
import SentenceT from '../lib/param/SentenceT';
import parseSrtSubtitles from '../lib/parseSrt';
import TranslateBuf from '../lib/TranslateBuf';
import TransFiller from '../lib/TransFiller';
import callApi from '../lib/apis/ApiWrapper';

function getTranslatedArray(
    arr: SentenceT[],
    buffer: TranslateBuf
): SentenceT[] {
    const newArr: SentenceT[] = [...arr];
    const { response } = buffer;
    if (response === undefined) {
        return newArr;
    }
    response.forEach((item, i) => {
        const index = buffer.startIndex + i;
        if (index < newArr.length) {
            const n: SentenceT = arr[index].clone();
            n.msTranslate = item;
            newArr[index] = n;
        }
    });
    return newArr;
}

async function trans(
    arr: SentenceT[],
    url: string,
    update: (arr: SentenceT[]) => void
) {
    let tempArr = arr;
    const buffers: TranslateBuf[] = TransFiller.splitToBuffers(arr, 1000);
    // eslint-disable-next-line no-restricted-syntax
    for (const buffer of buffers) {
        if (buffer.isEmpty()) {
            return;
        }
        // eslint-disable-next-line no-await-in-loop
        buffer.response = (await callApi('batch-translate', [
            buffer.strs,
        ])) as string[];
        const translatedArray = getTranslatedArray(tempArr, buffer);
        translatedArray.forEach((item) => {
            item.updateKey();
        });
        // eslint-disable-next-line no-restricted-syntax
        for (const item of translatedArray) {
            if (item.fileUrl !== url) {
                return;
            }
        }
        update(translatedArray);
        tempArr = translatedArray;
        // eslint-disable-next-line no-await-in-loop
        await TransFiller.sleep(300);
    }
}

async function loadSubtitle(
    subtitleFile: FileT,
    update: (arr: SentenceT[]) => void
) {
    const url = subtitleFile?.objectUrl ?? '';

    const axiosResponse = await axios.get(url);

    const str = axiosResponse.data;

    const srtSubtitles = parseSrtSubtitles(str);
    srtSubtitles.forEach((item) => {
        item.fileUrl = url;
        item.updateKey();
    });
    update(srtSubtitles);
    trans(srtSubtitles, url, update);
}

export default function useSubtitle(subtitleFile: FileT | undefined) {
    const [subtitle, setSubtitle] = useState<SentenceT[]>([]);

    const set = (arr: SentenceT[]) => {
        console.log('set');
        setSubtitle(arr);
    };

    useEffect(() => {
        console.log('useEffect');
        if (subtitleFile?.objectUrl === undefined) return;
        loadSubtitle(subtitleFile, set);
    }, [subtitleFile]);

    return subtitle;
}
