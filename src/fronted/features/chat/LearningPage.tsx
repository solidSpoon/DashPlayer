'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import useChatPanel from '@/fronted/features/chat/chatStore';
import { chatApi } from '@/fronted/features/chat/chatApi';
import { useSentenceLearningChat } from '@/fronted/features/chat/useSentenceLearningChat';
import LearningWorkspace, { type LearningSentence } from '@/fronted/features/chat/components/LearningWorkspace';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import useVocabulary from '@/fronted/features/player/vocabularyStore';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';
import { getTtsUrl, playAudioUrl } from '@/fronted/infrastructure/audio/AudioPlayer';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import TimeUtil from '@/common/utils/TimeUtil';
import type { SentenceVocabularyVO, SentenceWordEntry } from '@/common/types/vo/SentenceVocabularyVO';

const logger = getRendererLogger('LearningPage');

/**
 * 整句学习页容器。
 *
 * 说明：
 * - 页面在播放器内部替换视频与主字幕区域，进入时视频已暂停，页面不承载播放控制；
 * - 进入页面不等后端：当前字幕行先乐观摆上来，云端补全出更完整的句子后再替换，
 *   生词与悬停取词走本地词典，页面一出现就能看；
 * - 学习句取自创建会话时冻结的主题，中文译文随整句补全一起取回，未补全时退回字幕自带中文；
 * - 结构化解析（意群、词组）按需生成：点左栏入口才发起唯一一次模型调用；
 * - 语法不单独出结构化结果，想讲语法点输入框上方的「本句语法」快捷提问，由对话流回答。
 */
export default function LearningPage() {
    const { t } = useTranslation('common');
    const topicText = useChatPanel((state) => state.topicText);
    const topicTranslation = useChatPanel((state) => state.topicTranslation);
    const anchorIndex = useChatPanel((state) => state.anchorIndex);
    const chatSessionId = useChatPanel((state) => state.chatSessionId);
    const sentenceResolveError = useChatPanel((state) => state.sentenceResolveError);
    const cloudAvailable = useChatPanel((state) => state.cloudAvailable);
    const analysis = useChatPanel((state) => state.analysis);
    const analysisStatus = useChatPanel((state) => state.analysisStatus);
    const analysisError = useChatPanel((state) => state.analysisError);
    const chat = useSentenceLearningChat();
    // 后端会话建立前，对话与解析都没有可用的主题快照，入口先按住
    const sessionReady = chatSessionId !== '';

    // 整句补全失败时显式提示；学习页仍用当前字幕行继续
    useEffect(() => {
        if (sentenceResolveError) {
            toast.error(t('learning.sentenceResolveFailed'));
        }
    }, [sentenceResolveError, t]);
    const vocabulary = useVocabulary();
    const sentences = usePlayerState((state) => state.sentences);
    // 本地选词结果：生词卡与悬停取词共用同一份数据
    const [sentenceVocabulary, setSentenceVocabulary] = useState<SentenceVocabularyVO | null>(null);

    // 主题所在字幕行：句子信息与位置标签都从它取值，句子列表不变时不必重算
    const topicLine = useMemo(
        () => (anchorIndex === null ? undefined : sentences.find((sentence) => sentence.index === anchorIndex)),
        [anchorIndex, sentences]
    );

    const sentence: LearningSentence = useMemo(() => ({
        en: topicText,
        // 整句补全带回来的译文优先；未启用云端整句学习时退回字幕自带中文
        zh: topicTranslation || topicLine?.textZH || '',
        position: anchorIndex === null
            ? ''
            : [
                topicLine ? TimeUtil.secondToTimeStrCompact(topicLine.start) : '',
                t('learning.position', { index: anchorIndex, total: sentences.length }),
            ].filter(Boolean).join(' · '),
    }), [anchorIndex, sentences.length, t, topicLine, topicText, topicTranslation]);

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
        (word: string): SentenceWordEntry | null => sentenceVocabulary?.details[word] ?? null,
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

    const requestAnalysis = useCallback(() => {
        void useChatPanel.getState().startAnalysis();
    }, []);

    return (
        <div className="h-full w-full select-text">
            <LearningWorkspace
                sentence={sentence}
                analysis={analysis}
                analysisStatus={analysisStatus}
                analysisError={analysisError}
                onRequestAnalysis={requestAnalysis}
                sessionReady={sessionReady}
                cloudAvailable={cloudAvailable}
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
            />
        </div>
    );
}
