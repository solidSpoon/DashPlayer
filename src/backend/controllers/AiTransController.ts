import registerRoute from '@/common/api/register';
import { YdRes } from '@/common/types/YdRes';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import TranslateService from '@/backend/services/AiTransServiceImpl';
import SystemService from '@/backend/services/SystemService';

@injectable()
export default class AiTransController implements Controller {
    @inject(TYPES.TranslateService)
    private translateService!: TranslateService;

    @inject(TYPES.SystemService)
    private systemService!: SystemService;

    // 翻译任务队列
    private translationQueue: Array<{ key: string, sentences: string[], engine: 'tencent' | 'openai' }> = [];
    private isProcessing = false;

    public async batchTranslate(sentences: string[]): Promise<Map<string, string>> {
        return this.translateService.transSentences(sentences);
    }

    public async youDaoTrans(str: string): Promise<YdRes | null> {
        return this.translateService.transWord(str);
    }

    public async requestGroupTranslation(params: { 
        engine: 'tencent' | 'openai',
        translations: Array<{ key: string, sentences: string[] }>
    }): Promise<void> {
        console.log('接收翻译请求:', params);
        
        // 先批量检查缓存，只添加未缓存的翻译到队列
        for (const translation of params.translations) {
            const cachedTranslation = await this.translateService.getTranslationByKey(translation.key);
            
            if (cachedTranslation) {
                // 直接返回缓存结果
                await this.systemService.callRendererApi('translation/result', {
                    key: translation.key,
                    translation: cachedTranslation
                });
                console.log(`从缓存返回 - Key: ${translation.key}, Translation: ${cachedTranslation}`);
            } else {
                // 添加到翻译队列
                this.translationQueue.push({
                    key: translation.key,
                    sentences: translation.sentences,
                    engine: params.engine
                });
            }
        }

        // 启动处理队列 (如果未在处理中)
        this.processTranslationQueue();
    }

    private async processTranslationQueue(): Promise<void> {
        if (this.isProcessing || this.translationQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        console.log(`开始处理翻译队列，共 ${this.translationQueue.length} 个任务`);

        while (this.translationQueue.length > 0) {
            const task = this.translationQueue.shift()!;
            
            try {
                await this.processTranslationTask(task);
            } catch (error) {
                console.error('翻译任务处理失败:', error);
                // 可以选择重试或跳过
            }
        }

        this.isProcessing = false;
        console.log('翻译队列处理完成');
    }

    private async processTranslationTask(task: { key: string, sentences: string[], engine: 'tencent' | 'openai' }): Promise<void> {
        console.log(`🔄 开始处理翻译任务 - Key: ${task.key}`);
        console.log(`📝 句子内容: ${JSON.stringify(task.sentences)}`);
        console.log(`🔧 翻译引擎: ${task.engine}`);
        
        try {
            let translation = '';

            // 进行翻译 (缓存已在 requestGroupTranslation 中检查过)
            if (task.engine === 'tencent') {
                // 使用腾讯翻译 - 翻译中间那句话
                const targetSentence = task.sentences[Math.floor(task.sentences.length / 2)];
                console.log(`🎯 目标句子: "${targetSentence}"`);
                
                if (!targetSentence || targetSentence.trim() === '') {
                    console.warn(`⚠️ 目标句子为空，跳过翻译`);
                    translation = '';
                } else {
                    console.log(`🌐 直接调用腾讯客户端...`);
                    // 直接调用腾讯客户端，避免使用原有的缓存逻辑
                    const tencentClient = this.translateService.getTencentClient();
                    if (!tencentClient) {
                        console.error(`❌ 腾讯客户端未初始化`);
                        translation = '';
                    } else {
                        const transResult = await tencentClient.batchTrans([targetSentence]);
                        translation = transResult.get(targetSentence) || '';
                        console.log(`🌐 腾讯翻译返回: "${translation}"`);
                        
                        if (!translation) {
                            console.warn(`⚠️ 腾讯翻译返回空结果`);
                        }
                    }
                }
            } else if (task.engine === 'openai') {
                // 使用OpenAI翻译 - 后续实现流式翻译
                console.log(`🤖 使用OpenAI翻译（暂未实现）`);
                translation = '(OpenAI翻译待实现)';
            }

            // 保存到数据库缓存
            if (translation && translation.trim() !== '') {
                console.log(`💾 保存翻译结果到缓存...`);
                await this.translateService.saveTranslationByKey(task.key, translation);
                console.log(`✅ 缓存保存成功`);
            } else {
                console.log(`❌ 翻译结果为空，不保存缓存`);
            }
            
            console.log(`🏁 翻译任务完成 - Key: ${task.key}, Translation: "${translation}"`);

            // 回传翻译结果
            await this.systemService.callRendererApi('translation/result', {
                key: task.key,
                translation
            });
            console.log(`📤 翻译结果已发送到前端`);

        } catch (error) {
            console.error(`❌ 翻译任务失败 - Key: ${task.key}`, error);
            
            // 回传空翻译
            await this.systemService.callRendererApi('translation/result', {
                key: task.key,
                translation: ''
            });
        }
    }

    // 测试腾讯翻译API是否正常工作
    public async testTencentTranslation(): Promise<void> {
        console.log('🧪 测试腾讯翻译API...');
        
        try {
            const testSentences = ['Hello world', 'How are you?', 'This is a test'];
            console.log(`📝 测试句子: ${JSON.stringify(testSentences)}`);
            
            const result = await this.translateService.transSentences(testSentences);
            console.log(`🌐 腾讯翻译结果:`, result);
            
            result.forEach((translation, sentence) => {
                console.log(`  "${sentence}" -> "${translation}"`);
            });
            
        } catch (error) {
            console.error('❌ 腾讯翻译测试失败:', error);
        }
    }

    // 测试新的翻译流程
    public async testNewTranslationFlow(): Promise<void> {
        console.log('🧪 测试新的翻译流程...');
        
        try {
            // 模拟前端发送的请求
            const testRequest = {
                engine: 'tencent' as const,
                translations: [
                    {
                        key: 'test-key-1',
                        sentences: ['', 'Hello world', 'How are you?'] // 模拟附近三行
                    },
                    {
                        key: 'test-key-2', 
                        sentences: ['Hello world', 'How are you?', 'This is a test']
                    }
                ]
            };

            console.log(`📤 模拟翻译请求: ${JSON.stringify(testRequest, null, 2)}`);
            
            await this.requestGroupTranslation(testRequest);
            
        } catch (error) {
            console.error('❌ 新翻译流程测试失败:', error);
        }
    }

    registerRoutes(): void {
        registerRoute('ai-trans/batch-translate', (p) => this.batchTranslate(p));
        registerRoute('ai-trans/word', (p) => this.youDaoTrans(p));
        registerRoute('ai-trans/request-group-translation', (p) => this.requestGroupTranslation(p));
        registerRoute('ai-trans/test-tencent', () => this.testTencentTranslation());
        registerRoute('ai-trans/test-new-flow', () => this.testNewTranslationFlow());
    }

}
