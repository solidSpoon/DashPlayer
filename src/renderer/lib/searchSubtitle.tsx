import SentenceT from './param/SentenceT';

const searchSubtitle = (
    subtitles: SentenceT[],
    currentTime: number
): number => {
    return (
        subtitles.findIndex((item) => item.isCurrent(currentTime)) ??
        subtitles.length - 1
    );
};
export default searchSubtitle;
