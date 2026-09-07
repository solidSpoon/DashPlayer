import StrUtil from '@/common/utils/str-util';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { Nullable } from '@/common/types/Types';
import { TypeGuards } from '@/common/utils/TypeGuards';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const api = backendClient;
const cache = new Map<string, string>();
let player: HTMLAudioElement | null = null;

export const playAudioUrl = async (audioUrl: Nullable<string>) => {
    if (TypeGuards.isNull(audioUrl)) {
        return;
    }
    player?.pause();
    getRendererLogger('AudioPlayer').debug('play audio url', { audioUrl });
    player = new Audio(audioUrl);
    player.volume = 0.5;
    await player.play();
};

/**
 * 使用浏览器内置语音朗读单词，作为 sherpa 离线 TTS 不可用时的回退。
 *
 * @param word 待朗读的英文单词。
 */
export const playWord = async (word: string) => {
    if (!('speechSynthesis' in window)) {
        getRendererLogger('AudioPlayer').debug('speech synthesis unavailable');
        return;
    }
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
};

export const getTtsUrl = async (str: string) => {
    str = str.trim();
    if (StrUtil.isBlank(str)) {
        return;
    }
    let audioUrl = cache.get(str);
    if (audioUrl) {
        return audioUrl;
    }

    try {
        audioUrl = await api.call('ai-func/tts', str);
        getRendererLogger('AudioPlayer').debug('tts result', { audioUrl });
    } catch (error) {
        getRendererLogger('AudioPlayer').warn('tts failed', { error });
        return;
    }

    if (!StrUtil.isBlank(audioUrl)) {
        cache.set(str, audioUrl);
        return audioUrl;
    }
    return;
};
