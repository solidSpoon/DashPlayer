import SentenceT from './param/SentenceT';

const current = (s: SentenceT, currentTime: number): boolean => {
    let { timeEnd } = s;
    const { timeStart } = s;
    if (s.nextItem !== undefined) {
        timeEnd = s.nextItem.timeStart;
    }
    if (timeEnd === undefined || timeStart === undefined) {
        return false;
    }
    return currentTime >= timeStart - 0.2 && currentTime <= timeEnd;
};

const searchSubtitle = (
    subtitles: SentenceT[] | undefined,
    currentTime: number,
    currentSubtitle: SentenceT | undefined
): SentenceT | undefined => {
    if (subtitles === undefined) {
        return undefined;
    }
    if (
        currentSubtitle === undefined ||
        currentSubtitle.fileUrl !== subtitles[0].fileUrl
    ) {
        return subtitles.find((v) => current(v, currentTime)) as SentenceT;
    }

    if (current(currentSubtitle, currentTime)) {
        return currentSubtitle;
    }

    if (currentSubtitle.prevItem !== undefined) {
        if (current(currentSubtitle.prevItem, currentTime)) {
            return currentSubtitle.prevItem;
        }
    }
    if (currentSubtitle.nextItem !== undefined) {
        if (current(currentSubtitle.nextItem, currentTime)) {
            return currentSubtitle.nextItem;
        }
    }
    return subtitles.find((v) => current(v, currentTime)) as SentenceT;
};
export default searchSubtitle;
