import SentenceT from "./param/SentenceT";

const searchSubtitle = (subtitles: SentenceT[] , currentTime: number, currentSubtitle: SentenceT): SentenceT => {
    if (currentSubtitle === undefined || currentSubtitle.fileUrl !== subtitles[0].fileUrl) {
        return subtitles.find(v => current(v, currentTime)) as SentenceT;
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
    return subtitles.find(v => current(v, currentTime)) as SentenceT;
}
const current = (s: SentenceT, currentTime: number): boolean => {
    let timeEnd: number | undefined = s.timeEnd;
    if (s.nextItem !== undefined) {
        timeEnd = s.nextItem.timeStart;
    }
    // @ts-ignore
  return currentTime >= s.timeStart - 0.2 && currentTime <= timeEnd;
}
export default searchSubtitle;
