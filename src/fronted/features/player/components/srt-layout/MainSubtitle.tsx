import React, { ReactElement, useEffect, useMemo } from 'react';
import TranslatableLine from '@/fronted/features/player/components/subtitles/TranslatableLineWrapper';
import NormalLine from './NormalLine';
import useTranslation from '@/fronted/features/player/translationStore';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';

export default function MainSubtitle() {
    const logger = getRendererLogger('MainSubtitle');
    const sentence = usePlayerState((s) => s.currentSentence);
    const srtTender = usePlayerState((s) => s.srtTender);
    const adjusted = useMemo(() => (sentence && srtTender ? (srtTender.adjusted(sentence) ?? false) : false), [sentence, srtTender]);

    const requestTranslation = useTranslation(state => state.requestTranslation);
    const engine = useTranslation(state => state.engine);
    const openAiMode = useTranslation(state => state.openAiMode);
    const activeFileHash = useTranslation(state => state.activeFileHash);

    // 在组件顶层获取当前句子的翻译
    const translationKey = sentence?.translationKey || '';
    const newTranslation = useTranslation(state => state.translations.get(translationKey)) || '';
    // 当前句子、翻译引擎或字幕上下文完成初始化时，触发懒加载翻译。
    useEffect(() => {
        logger.debug('subtitle translation trigger evaluated', {
            sentenceIndex: sentence?.index,
            sentenceFileHash: sentence?.fileHash,
            activeFileHash,
            engine,
            openAiMode,
            canRequest: Boolean(sentence && engine !== 'none' && activeFileHash === sentence?.fileHash),
        });
        if (sentence && engine !== 'none' && activeFileHash === sentence.fileHash) {
            requestTranslation(sentence.fileHash, sentence.index);
        }
    }, [logger, sentence, engine, openAiMode, activeFileHash, requestTranslation]);

    const showCn = usePlayerUi((state) => state.showCn);
    const showSourceZh = usePlayerUi((state) => state.showSourceZh);

    const ele = (): ReactElement[] => {
        if (!sentence) {
            return [];
        }

        const lines: ReactElement[] = [];

        // 1. 原文字幕 (保留占位，showEn 为 false 时呈现模糊遮罩，hover 显示)
        if (StrUtil.isNotBlank(sentence.text)) {
            lines.push(
                <TranslatableLine
                    adjusted={adjusted}
                    clearAdjust={() => { void playerActions.clearAdjust(); }}
                    key={`first-${sentence.key}`}
                    sentence={sentence}
                />
            );
        }

        // 2. 机器翻译
        if (showCn && StrUtil.isNotBlank(newTranslation)) {
            lines.push(
                <NormalLine
                    key={`translation-${sentence.key}`}
                    text={newTranslation}
                    order="second"
                />
            );
        }

        // 3. 字幕自带中文
        if (showSourceZh && StrUtil.isNotBlank(sentence.textZH)) {
            lines.push(
                <NormalLine
                    key={`sourceZh-${sentence.key}`}
                    text={sentence.textZH!}
                    order={lines.length === 1 ? 'second' : 'third'}
                />
            );
        }

        return lines;
    };

    const render = () => {
        if (!sentence) {
            return <div className="w-full h-full" />;
        }
        return (
            <div
                key={`trans-sub:${sentence?.key}`}
                className="flex flex-col w-full text-center text-textColor shadow-inner h-0"
            >
                {ele()}
            </div>
        );
    };

    return render();
}
