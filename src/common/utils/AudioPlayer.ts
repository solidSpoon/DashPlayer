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
    let audioUrl = cache.get(word);
    if (audioUrl) {
        await playAudioUrl(audioUrl);
        return;
    }
    const trans = await api.transWord(word);
    if (!trans?.basic) {
        return;
    }
    const outUrl = trans.basic['us-speech'] ?? trans.basic['uk-speech'];
    if (!outUrl) {
        return;
    }
    audioUrl = await getAudioUrl(outUrl);
    cache.set(word, audioUrl);
    await playAudioUrl(audioUrl);
};

export const getTtsUrl = async (str: string) => {
    str = str.trim();
    if (strBlank(str)) {
        return;
    }
    let audioUrl = cache.get(str);
    if (audioUrl) {
        return audioUrl;
    }
    audioUrl = await api.aiTts(str);
    cache.set(str, audioUrl);
    return audioUrl;
};
