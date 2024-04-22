import { strBlank } from '@/common/utils/Util';

const cache = new Map<string, string>();
const api = window.electron;
let player: HTMLAudioElement | null = null;

async function getAudioUrl(outURl: string) {
    let audioUrl = cache.get(outURl);
    if (!audioUrl) {
        audioUrl = await api.fetchAudio(outURl);
        cache.set(outURl, audioUrl);
    }
    return audioUrl;
}

export const playAudioUrl = async (audioUrl: string) => {
    player?.pause();
    player = new Audio(audioUrl);
    player.volume = 0.5;
    await player.play();
};

export const playUrl = async (outURl: string) => {
    const audioUrl = await getAudioUrl(outURl);
    await playAudioUrl(audioUrl);
};

export const playWord = async (word: string) => {
    console.log('playWord', word);
    const cacheUrl = cache.get(word);
    if (cacheUrl) {
        await playAudioUrl(cacheUrl);
        return;
    }
    const trans = await api.transWord(word);
    const newUrl = trans?.speakUrl;
    if (strBlank(newUrl)) {
        return;
    }
    cache.set(word, newUrl);
    await playUrl(newUrl);
};
