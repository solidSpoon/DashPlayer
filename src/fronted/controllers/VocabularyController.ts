import { BaseRendererController } from '@/fronted/controllers/BaseRendererController';
import useVocabulary from '@/fronted/hooks/useVocabulary';
import { getRendererLogger } from '@/fronted/log/simple-logger';

export class VocabularyController extends BaseRendererController {
    readonly name = 'VocabularyController';

    protected setupApis(): void {
        this.batchRegisterApis({
            // 词汇匹配结果回调
            'vocabulary/match-result': async (params) => {
                this.logger.info('Vocabulary match result received', { params });
                
                const { vocabularyWords } = params;
                this.logger.info('Setting vocabulary words:', { 
                    words: vocabularyWords,
                    count: vocabularyWords.length 
                });
                
                // 更新store
                const currentState = useVocabulary.getState();
                this.logger.info('Current vocabulary store state before update:', { 
                    currentWords: currentState.vocabularyWords 
                });
                
                useVocabulary.getState().setVocabularyWords(vocabularyWords);
                
                // 验证更新
                const newState = useVocabulary.getState();
                this.logger.info('Vocabulary words updated in store', { 
                    wordCount: newState.vocabularyWords.length,
                    words: newState.vocabularyWords 
                });
                
                // 测试匹配功能
                if (vocabularyWords.length > 0) {
                    const testWord = vocabularyWords[0];
                    const isMatch = newState.isVocabularyWord(testWord);
                    this.logger.info('Test vocabulary word matching:', { 
                        testWord, 
                        isMatch 
                    });
                }
            }
        });
    }
}