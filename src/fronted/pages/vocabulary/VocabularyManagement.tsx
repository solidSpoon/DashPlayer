import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Search, Play , Info } from 'lucide-react';
import useSetting from '@/fronted/hooks/useSetting';
import useSWR from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import ReactPlayer from 'react-player';
import UrlUtil from '@/common/utils/UrlUtil';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';

interface WordItem {
    id: number;
    word: string;
    stem: string;
    translate: string;
    note: string;
    created_at: string;
    updated_at: string;
    videoCount?: number;
}

interface VideoClipWithPlayer {
    key: string;
    sourceType: 'oss' | 'local';
    videoName: string;
    videoPath: string;
    createdAt: number;
    clipContent: Array<{
        index: number;
        start: number;
        end: number;
        contentEn: string;
        contentZh: string;
        isClip: boolean;
    }>;
    isPlaying?: boolean;
    currentTime?: number;
}

const VocabularyManagement = () => {
    const api = window.electron;
    const [searchTerm, setSearchTerm] = useState('');
    const [words, setWords] = useState<WordItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedWord, setSelectedWord] = useState<WordItem | null>(null);
    const [videoClips, setVideoClips] = useState<VideoClipWithPlayer[]>([]);
    const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
    const [playingClip, setPlayingClip] = useState<VideoClipWithPlayer | null>(null);
    const playerRef = React.useRef<ReactPlayer>(null);
    const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
    const theme = useSetting((s) => s.values.get('appearance.theme'));

    // 从视频学习接口获取真实视频数据
    const { data: learningClips = [], mutate: mutateLearningClips } = useSWR(
        selectedWord ?
            `${apiPath('video-learning/search')}-${selectedWord.word}` :
            apiPath('video-learning/search'),
        async () => {
            if (selectedWord) {
                // 根据选中的单词搜索
                return await window.electron.call('video-learning/search', {
                    keyword: '',
                    keywordRange: 'clip',
                    date: { from: undefined, to: undefined },
                    matchedWord: selectedWord.word
                });
            } else {
                // 显示所有学习片段
                return await window.electron.call('video-learning/search', {
                    keyword: '',
                    keywordRange: 'clip',
                    date: { from: undefined, to: undefined }
                });
            }
        },
        {
            fallbackData: []
        }
    );

    const filteredWords = useMemo(() => {
        let displayWords = words;
        // 限制显示1000个单词用于原型探索
        if (displayWords.length > 1000) {
            displayWords = displayWords.slice(0, 1000);
        }

        if (!searchTerm) return displayWords;
        const term = searchTerm.toLowerCase();
        return displayWords.filter(word =>
            word.word.toLowerCase().includes(term) ||
            word.translate?.toLowerCase().includes(term) ||
            word.stem?.toLowerCase().includes(term)
        );
    }, [words, searchTerm]);

    const fetchWords = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.call('vocabulary/get-all', {});
            if (result.success) {
                const wordData = result.data || [];
                console.log('获取到的单词数据:', wordData.length, '个单词');

                // 为每个单词获取视频数量
                const wordsWithVideoCount = await Promise.all(
                    wordData.map(async (word) => {
                        try {
                            const videoResult = await window.electron.call('video-learning/search', {
                                keyword: '',
                                keywordRange: 'clip',
                                date: { from: undefined, to: undefined },
                                matchedWord: word.word
                            });
                            return {
                                ...word,
                                videoCount: (videoResult.success && Array.isArray(videoResult.data)) ? videoResult.data.length : 0
                            };
                        } catch (error) {
                            console.error(`获取单词 ${word.word} 的视频数量失败:`, error);
                            return {
                                ...word,
                                videoCount: 0
                            };
                        }
                    })
                );

                // 按视频数量排序，有视频的放前面
                const sortedWords = wordsWithVideoCount.sort((a, b) => {
                    if (a.videoCount! > 0 && b.videoCount === 0) return -1;
                    if (a.videoCount === 0 && b.videoCount! > 0) return 1;
                    if (a.videoCount! > b.videoCount!) return -1;
                    if (a.videoCount! < b.videoCount!) return 1;
                    return 0;
                });

                setWords(sortedWords);
            }
        } catch (error) {
            console.error('获取单词失败:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleWordClick = useCallback((word: WordItem) => {
        setSelectedWord(word);
        // 触发重新搜索，数据会通过 SWR 自动更新
        mutateLearningClips();
        setPlayingVideoId(null);
        setPlayingClip(null);
    }, [mutateLearningClips]);

    const handleVideoPlay = useCallback((clipId: string) => {
        const clip = videoClips.find(c => c.key === clipId);
        if (clip) {
            setVideoClips(prev => prev.map(c => ({
                ...c,
                isPlaying: c.key === clipId
            })));
            setPlayingVideoId(clipId);
            setPlayingClip(clip);
        }
    }, [videoClips]);

    const exportTemplate = useCallback(async () => {
        try {
            console.log('开始导出模板...');
            const result = await window.electron.call('vocabulary/export-template', {});
            console.log('导出结果:', result);

            if (result.success) {
                console.log('开始处理base64数据，长度:', result.data?.length);
                // 将base64转换为ArrayBuffer
                const binaryString = atob(result.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                console.log('转换完成，字节数:', bytes.length);

                // 创建下载链接
                const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '单词管理模板.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                console.log('下载链接已创建');

                // 显示成功提示
                setTimeout(() => {
                    alert('模板已成功导出到下载文件夹');
                }, 100);
            } else {
                console.error('导出失败:', result.error);
                alert(`导出失败：${result.error}`);
            }
        } catch (error) {
            console.error('导出模板失败:', error);
            alert('导出失败，请重试');
        }
    }, []);

    const importWords = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const result = await window.electron.call('vocabulary/import', {
                filePath: file.path
            });

            if (result.success) {
                await fetchWords(); // 重新加载单词列表
            }
        } catch (error) {
            console.error('导入单词失败:', error);
        } finally {
            setLoading(false);
            // 重置文件输入
            event.target.value = '';
        }
    }, [fetchWords]);

    useEffect(() => {
        fetchWords();
    }, [fetchWords]);

    // 为处理中的视频生成缩略图
    const generateThumbnailsForLocalClips = useCallback(async (clips: VideoClipWithPlayer[]) => {
        const localClips = clips.filter(clip => clip.sourceType === 'local');
        if (localClips.length === 0) return;

        // 只为还没有缩略图的视频生成
        const clipsWithoutThumbnails = localClips.filter(clip => !thumbnailUrls[clip.key]);
        if (clipsWithoutThumbnails.length === 0) return;

        const newThumbnailUrls: Record<string, string> = {};

        for (const clip of clipsWithoutThumbnails) {
            try {
                const startTime = getStartTime(clip);
                const thumbnailUrl = await api.call('split-video/thumbnail', {
                    filePath: clip.videoPath,
                    time: startTime
                });
                newThumbnailUrls[clip.key] = thumbnailUrl;
            } catch (error) {
                console.error('Failed to generate thumbnail for local clip:', error);
            }
        }

        if (Object.keys(newThumbnailUrls).length > 0) {
            setThumbnailUrls(prev => ({ ...prev, ...newThumbnailUrls }));
        }
    }, [thumbnailUrls]);

    // 为OSS类型的视频获取缩略图（通过统一接口）
    const generateThumbnailsForOssClips = useCallback(async (clips: VideoClipWithPlayer[]) => {
        const ossClips = clips.filter(clip => clip.sourceType === 'oss');
        if (ossClips.length === 0) return;
        // 只为还没有缩略图的视频生成
        const clipsWithoutThumbnails = ossClips.filter(clip => !thumbnailUrls[clip.key]);
        if (clipsWithoutThumbnails.length === 0) return;
        const newThumbnailUrls: Record<string, string> = {};

        for (const clip of clipsWithoutThumbnails) {
            try {
                // 对于OSS类型，使用videoName作为视频路径生成缩略图
                const startTime = getStartTime(clip);
                const thumbnailUrl = await api.call('split-video/thumbnail', {
                    filePath: clip.videoName,
                    time: startTime
                });
                newThumbnailUrls[clip.key] = thumbnailUrl;
            } catch (error) {
                console.error('Failed to generate thumbnail for OSS clip:', error);
            }
        }
        if (Object.keys(newThumbnailUrls).length > 0) {
            setThumbnailUrls(prev => ({ ...prev, ...newThumbnailUrls }));
        }
    }, [thumbnailUrls]);

    // 监听学习片段数据变化
    useEffect(() => {
        const clipsData = learningClips?.success ? learningClips.data : [];
        if (!Array.isArray(clipsData)) return;

        const clips = clipsData.slice(0, 20) // 限制显示前20个片段
            .map(clip => ({
                ...clip,
                isPlaying: false,
                currentTime: clip.clipContent[0]?.start || 0
            }));
        setVideoClips(clips);

        // 为本地和OSS视频生成缩略图
        generateThumbnailsForLocalClips(clips);
        generateThumbnailsForOssClips(clips);
    }, [learningClips, generateThumbnailsForLocalClips, generateThumbnailsForOssClips]);

    // Helper functions
    const getVideoUrl = (clip: VideoClipWithPlayer): string => {
        return clip.sourceType === 'local'
            ? UrlUtil.file(clip.videoPath)
            : UrlUtil.file(clip.videoName); // OSS类型使用videoName作为文件路径
    };

    const getStartTime = (clip: VideoClipWithPlayer): number => {
        const mainClip = clip.clipContent.find(c => c.isClip) || clip.clipContent[0];
        return mainClip?.start || 0;
    };

    const getThumbnailUrl = async (clip: VideoClipWithPlayer): Promise<string> => {
        if (clip.sourceType === 'local') {
            return thumbnailUrls[clip.key] ? UrlUtil.file(thumbnailUrls[clip.key]) : '';
        } else {
            // OSS类型：使用统一接口获取缩略图
            try {
                const startTime = getStartTime(clip);
                // 对于OSS类型，我们需要从clip content中获取实际的视频路径
                // 这里暂时返回空字符串，后续可以实现OSS缩略图获取逻辑
                return '';
            } catch (error) {
                console.error('Failed to get OSS thumbnail:', error);
                return '';
            }
        }
    };

    const getThumbnailUrlSync = (clip: VideoClipWithPlayer): string => {
        return clip.sourceType === 'local'
            ? (thumbnailUrls[clip.key] ? UrlUtil.file(thumbnailUrls[clip.key]) : '')
            : ''; // OSS类型暂时返回空，等待异步获取
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* 顶部操作区域 */}
            <div className="p-6 bg-white dark:bg-gray-800 border-b">
                <div className="container mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Play className="w-6 h-6" />
                            <h1 className="text-2xl font-bold">视频学习</h1>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-yellow-600 rounded"></div>
                                <span>处理中（播放原视频）</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 主体内容区域 */}
            <div className="flex-1 px-4 py-4 flex gap-4 overflow-hidden">
                {/* 左侧：单词筛选器 */}
                <div className="w-[480px] flex flex-col border-r">
                    <div className="p-4 border-b space-y-3">
                        {/* 搜索框 */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="搜索单词..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Button
                            variant={selectedWord ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedWord(null)}
                            className="w-full"
                        >
                            显示全部视频
                        </Button>
                    </div>

                    <div className="flex-1 overflow-auto p-3">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    加载中...
                                </div>
                            </div>
                        ) : filteredWords.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                {searchTerm ? '未找到匹配的单词' : '暂无生词记录'}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredWords.slice(0, 80).map((word) => (
                                    <div
                                        key={word.id}
                                        className={`
                                            p-2 rounded cursor-pointer transition-all text-sm leading-tight
                                            ${selectedWord?.id === word.id
                                                ? 'bg-blue-500 text-white shadow-sm'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }
                                        `}
                                        onClick={() => handleWordClick(word)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="font-medium">
                                                {word.word}
                                            </div>
                                            {word.videoCount && word.videoCount > 0 && (
                                                <div className={`
                                                    text-xs px-2 py-0.5 rounded-full
                                                    ${selectedWord?.id === word.id
                                                        ? 'bg-blue-400 text-white'
                                                        : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                    }
                                                `}>
                                                    {word.videoCount}个视频
                                                </div>
                                            )}
                                        </div>
                                        <div className={`text-xs truncate ${selectedWord?.id === word.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                            {word.translate || '暂无释义'}
                                        </div>
                                    </div>
                                ))}
                                {filteredWords.length > 80 && (
                                    <div className="text-center text-xs text-gray-500 py-1">
                                        还有 {filteredWords.length - 80} 个...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t text-xs text-gray-500 text-center">
                        共 {words.length} 个单词
                        {searchTerm && (
                            <div className="text-blue-600">
                                搜索到 {filteredWords.length} 个
                            </div>
                        )}
                        {words.length > 1000 && !searchTerm && (
                            <div className="text-orange-600">
                                显示前80个
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧：视频流 */}
                <div className="flex-1 flex flex-col">

                    {/* 视频流内容 */}
                    <div className="flex-1 overflow-auto p-4">
                        {videoClips.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-gray-500">
                                <div className="text-center">
                                    <Play className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                    <p className="text-lg mb-2">
                                        {selectedWord ? '暂无相关视频' : '暂无视频片段'}
                                    </p>
                                    <p className="text-sm">
                                        {selectedWord
                                            ? '该单词暂无相关视频片段'
                                            : '请先添加一些视频片段到收藏'
                                        }
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {videoClips.map((clip) => {
                                    const mainClip = clip.clipContent.find(c => c.isClip) || clip.clipContent[0];
                                    const subtitle = `${mainClip?.contentEn || ''} ${mainClip?.contentZh || ''}`.trim();
                                    const videoTitle = clip.videoName.split('/').pop() || 'Unknown Video';
                                    const thumbnailUrl = getThumbnailUrlSync(clip);

                                    return (
                                        <div
                                            key={clip.key}
                                            className={`
                                                border rounded-lg overflow-hidden cursor-pointer transition-all group
                                                ${clip.key === playingVideoId
                                                    ? 'border-blue-500 ring-2 ring-blue-200'
                                                    : clip.sourceType === 'local'
                                                        ? 'border-yellow-300 dark:border-yellow-600 hover:shadow-lg'
                                                        : 'border-gray-200 dark:border-gray-700 hover:shadow-lg'
                                                }
                                            `}
                                            onClick={() => handleVideoPlay(clip.key)}
                                        >
                                            {/* 视频预览图 */}
                                            <div className="relative bg-gray-100 aspect-[16/7] flex items-center justify-center">
                                                {thumbnailUrl ? (
                                                    <img
                                                        src={thumbnailUrl}
                                                        alt={videoTitle}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className={`w-full h-full flex items-center justify-center ${
                                                        clip.sourceType === 'local'
                                                            ? 'bg-gradient-to-br from-yellow-500 to-orange-600'
                                                            : 'bg-gradient-to-br from-blue-500 to-purple-600'
                                                    }`}>
                                                        <Play className="w-8 h-8 text-white/80" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <Play className="w-8 h-8 text-white" />
                                                </div>

                                                {/* 状态标识 */}
                                                {clip.isPlaying && (
                                                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                                                        播放中
                                                    </div>
                                                )}
                                                {clip.sourceType === 'local' && !clip.isPlaying && (
                                                    <div className="absolute top-2 left-2 bg-yellow-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                                        处理中
                                                    </div>
                                                )}

                                                {/* hover提示 */}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="bg-black/30 text-white/60 p-1 rounded-full cursor-default hover:bg-black/50 hover:text-white/80 transition-colors">
                                                                    <Info className="w-3 h-3" />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <div className="space-y-1">
                                                                    <div><strong>状态:</strong> {clip.sourceType === 'local' ? '处理中' : '已完成'}</div>
                                                                    <div><strong>视频名称:</strong> {clip.videoName.split('/').pop() || 'Unknown Video'}</div>
                                                                    <div><strong>时间范围:</strong> {formatTime(mainClip?.start || 0)} - {formatTime(mainClip?.end || 0)}</div>
                                                                    <div><strong>创建时间:</strong> {new Date(clip.createdAt).toLocaleString()}</div>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </div>

                                            {/* 视频信息 */}
                                            <div className="p-2 bg-white dark:bg-gray-800">
                                                <p className="text-xs text-gray-600 line-clamp-2">
                                                    {subtitle}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>


                    {/* 视频播放器 */}
                    {playingClip ? (
                        <div className="border-t bg-white dark:bg-gray-800">
                            <div className="p-6">

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {/* 视频播放器 */}
                                    <div>
                                        <AspectRatio ratio={16 / 9}>
                                            <div className="w-full rounded-lg overflow-hidden">
                                                <ReactPlayer
                                                    ref={playerRef}
                                                    url={getVideoUrl(playingClip)}
                                                    width="100%"
                                                    height="100%"
                                                    controls={true}
                                                    playing={true}
                                                    onStart={() => {
                                                        // 如果是本地视频，跳转到指定时间
                                                        if (playingClip.sourceType === 'local') {
                                                            const startTime = getStartTime(playingClip);
                                                            playerRef.current?.seekTo(startTime);
                                                        }
                                                    }}
                                                    onEnded={() => {
                                                        // 保持播放器状态，循环播放
                                                    }}
                                                />
                                            </div>
                                        </AspectRatio>
                                    </div>

                                    <div className="overflow-auto max-h-64">
                                        <div className="space-y-2">
                                            {playingClip.clipContent?.map((line, index) => (
                                                <div
                                                    key={index}
                                                    className={`
                                                        p-2 rounded text-sm
                                                        ${line.isClip
                                                            ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500'
                                                            : 'bg-gray-50 dark:bg-gray-800'
                                                        }
                                                    `}
                                                >
                                                    <div className="text-xs text-gray-500 mb-1">
                                                        {formatTime(line.start)} - {formatTime(line.end)}
                                                    </div>
                                                    <div className="text-gray-900 dark:text-gray-100">
                                                        {line.contentEn}
                                                    </div>
                                                    <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                                                        {line.contentZh}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* 空白骨架屏幕 */
                        <div className="border-t bg-white dark:bg-gray-800">
                            <div className="p-6">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {/* 视频播放器骨架 */}
                                    <div>
                                        <AspectRatio ratio={16 / 9}>
                                            <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 flex items-center justify-center">
                                                        <Play className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                                                    </div>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">点击上方视频开始播放</p>
                                                </div>
                                            </div>
                                        </AspectRatio>
                                    </div>

                                    {/* 字幕区域骨架 */}
                                    <div className="overflow-auto max-h-64">
                                        <div className="space-y-2">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-800">
                                                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-1"></div>
                                                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full mb-1"></div>
                                                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VocabularyManagement;

// 时间格式化函数
const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

