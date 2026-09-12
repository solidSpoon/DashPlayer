'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import useChatPanel from '@/fronted/features/chat/chatStore';
import { chatApi } from '@/fronted/features/chat/chatApi';
import { useSentenceLearningChat } from '@/fronted/features/chat/useSentenceLearningChat';
import LearningWorkspace, { type LearningSentence, type LearningWordDetail } from '@/fronted/features/chat/components/LearningWorkspace';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import useVocabulary from '@/fronted/features/player/vocabularyStore';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';
import { getTtsUrl, playAudioUrl } from '@/fronted/infrastructure/audio/AudioPlayer';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import TimeUtil from '@/common/utils/TimeUtil';
import type { SentenceVocabularyVO } from '@/common/types/vo/SentenceVocabularyVO';

const logger = getRendererLogger('LearningPage');

/**
 * 整句学习页容器。
 *
 * 说明：
 * - 页面在播放器内部替换视频与主字幕区域，进入时视频已暂停，页面不承载播放控制；
 * - 学习句取自创建会话时冻结的主题，中文译文按锚点索引从播放器字幕里精确匹配；
 * - 生词与悬停取词来自本地词典（`vocabulary/pick-sentence`），打开页面即可用，不等待模型；
 * - 结构化解析按需触发（点击左栏懒加载入口），对话由 useSentenceLearningChat 承载。
 */
export default function LearningPage() {
    const { t } = useTranslation('common');
    const hideLearning = useChatPanel((state) => state.hideLearning);
    const analysis = useChatPanel((state) => state.analysis);
    const analysisStatus = useChatPanel((state) => state.analysisStatus);
    const analysisError = useChatPanel((state) => state.analysisError);
    const topicText = useChatPanel((state) => state.topicText);
    const anchorIndex = useChatPanel((state) => state.anchorIndex);
    const chat = useSentenceLearningChat();
    const vocabulary = useVocabulary();
    const sentences = usePlayerState((state) => state.sentences);
    // 本地选词结果：生词卡与悬停取词共用同一份数据
    const [sentenceVocabulary, setSentenceVocabulary] = useState<SentenceVocabularyVO | null>(null);

    const topicLine = anchorIndex === null
        ? undefined
        : sentences.find((sentence) => sentence.index === anchorIndex);

    const sentence: LearningSentence = useMemo(() => ({
        en: topicText,
        zh: topicLine?.textZH ?? '',
        position: anchorIndex === null
            ? ''
            : [
                topicLine ? TimeUtil.secondToTimeStrCompact(topicLine.start) : '',
                t('learning.position', { index: anchorIndex, total: sentences.length }),
            ].filter(Boolean).join(' · '),
    }), [anchorIndex, sentences.length, t, topicLine, topicText]);

    // 句子一变就重新选词：本地词典、同步返回，不涉及模型与网络
    useEffect(() => {
        const text = topicText.trim();
        if (!text) {
            setSentenceVocabulary(null);
            return;
        }
        let cancelled = false;
        chatApi.pickSentenceVocabulary(text)
            .then((result) => {
                if (!cancelled) {
                    setSentenceVocabulary(result);
                }
            })
            .catch((error) => {
                // 本地词典缺失属打包问题，必须显式暴露，不能静默给出空生词
                logger.error('failed to pick sentence vocabulary', {
                    error: error instanceof Error ? error.message : error,
                });
                if (!cancelled) {
                    setSentenceVocabulary(null);
                    toast.error(t('learning.vocabFailed'));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [t, topicText]);

    const vocabWords = useMemo(() => sentenceVocabulary?.picks ?? [], [sentenceVocabulary]);

    const resolveWordDetail = useCallback(
        (word: string): LearningWordDetail | null => sentenceVocabulary?.details[word] ?? null,
        [sentenceVocabulary]
    );

    const speak = useCallback((text: string) => {
        if (!text.trim()) {
            return;
        }
        getTtsUrl(text)
            .then((url) => playAudioUrl(url))
            .catch((error) => {
                logger.error('failed to speak text', { error: error instanceof Error ? error.message : error });
            });
    }, []);

    const requestAnalysis = useCallback(() => {
        void useChatPanel.getState().startAnalysis();
    }, []);

    /**
     * 切换生词收藏：未收藏时加入词汇工坊，已收藏时从词表移除。
     *
     * 说明：收藏时把本地词典的释义一并入库，避免后端再调用一次词典；
     * 取消收藏按基础形态删除，因为词表命中可能来自变体形态。
     */
    const toggleFavorite = useCallback(async (word: string, meaning: string) => {
        const favorited = vocabulary.isVocabularyWord(word);
        try {
            if (favorited) {
                const baseWord = vocabulary.getBaseWord(word);
                const result = await videoLearningApi.deleteWord(baseWord ?? word);
                if (!result.success) {
                    toast.error(result.error || t('unfavoriteWordFailed'));
                    return;
                }
                vocabulary.removeVocabularyWords([
                    ...(result.data ? [result.data.word] : []),
                    ...(baseWord ? [baseWord] : []),
                    word,
                ]);
                toast.success(t('wordUnfavorited'));
                return;
            }
            const result = await videoLearningApi.favoriteWord(word, meaning);
            if (!result.success || !result.data) {
                toast.error(result.error || t('favoriteWordFailed'));
                return;
            }
            vocabulary.addVocabularyWords([result.data.word]);
            toast.success(result.data.alreadyExists ? t('wordAlreadyFavorited') : t('wordFavorited'));
        } catch (error) {
            logger.error('failed to toggle favorite word', { error: error instanceof Error ? error.message : error });
            toast.error(favorited ? t('unfavoriteWordFailed') : t('favoriteWordFailed'));
        }
    }, [t, vocabulary]);

    const isFavorite = useCallback((word: string) => vocabulary.isVocabularyWord(word), [vocabulary]);

    return (
        <div className="h-full w-full select-text">
            <LearningWorkspace
                sentence={sentence}
                analysis={analysis}
                analysisStatus={analysisStatus}
                analysisError={analysisError}
                onRequestAnalysis={requestAnalysis}
                vocabWords={vocabWords}
                resolveWordDetail={resolveWordDetail}
                messages={chat.messageViews}
                isBusy={chat.isBusy}
                input={chat.input}
                onInputChange={chat.setInput}
                onSubmit={(text) => {
                    void chat.handleSubmit(text);
                }}
                onStop={chat.stop}
                onSpeak={speak}
                onJumpToLine={(index) => {
                    const target = sentences.find((item) => item.index === index);
                    if (target) {
                        playerActions.gotoSentence(target);
                    }
                }}
                isFavorite={isFavorite}
                onToggleFavorite={(word, meaning) => {
                    void toggleFavorite(word, meaning);
                }}
                onBackToPlayer={hideLearning}
            />
        </div>
    );
}
