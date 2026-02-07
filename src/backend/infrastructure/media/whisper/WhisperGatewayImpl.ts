import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import WhisperGateway, {
    WhisperTranscribeRequest,
    WhisperTranscribeResult,
    WhisperWarningCode,
} from '@/backend/application/ports/gateways/media/WhisperGateway';
import TYPES from '@/backend/ioc/types';
import { WhisperCppCli } from '@/backend/infrastructure/media/whisper/WhisperCppCli';
import { WhisperCppArgsBuilder } from '@/backend/infrastructure/media/whisper/WhisperCppArgsBuilder';
import { getMainLogger } from '@/backend/infrastructure/logger';

/**
 * 基于 whisper.cpp CLI 的本地转录网关实现。
 */
@injectable()
export default class WhisperGatewayImpl implements WhisperGateway {
    private readonly logger = getMainLogger('WhisperGateway');

    constructor(
        @inject(TYPES.WhisperCppCli) private readonly whisperCppCli: WhisperCppCli,
    ) {}

    /**
     * 执行一次 whisper.cpp 本地转录并返回输出产物。
     * 会在内部完成能力探测、参数构建、进程执行与结果校验。
     */
    public async transcribe(request: WhisperTranscribeRequest): Promise<WhisperTranscribeResult> {
        const executablePath = this.whisperCppCli.resolveExecutablePath();
        this.logRuntimeProbe(executablePath);

        const helpText = await this.whisperCppCli.getHelpText(executablePath);
        const { args, outSrt, vadSkippedBecauseUnsupported } = WhisperCppArgsBuilder.build({
            helpText,
            modelSize: request.modelSize,
            enableVad: request.enableVad,
            vadModel: request.vadModel,
            modelsRoot: request.modelsRoot,
            processedAudioPath: request.processedAudioPath,
            tempFolder: request.tempFolder,
        });

        this.logger.info('whisper.cpp cli args', { args });

        await this.whisperCppCli.run({
            executablePath,
            args,
            isCancelled: request.isCancelled,
            onProgressEvent: request.onProgressEvent,
        });

        if (!fs.existsSync(outSrt)) {
            throw new Error(`whisper.cpp did not generate srt output: ${outSrt}`);
        }

        const warnings: WhisperWarningCode[] = [];
        if (vadSkippedBecauseUnsupported) {
            warnings.push('VAD_UNSUPPORTED');
        }

        return {
            outSrt,
            warnings,
        };
    }

    /**
     * 取消当前正在执行的 whisper.cpp 进程。
     */
    public cancelActive(): void {
        this.whisperCppCli.killActive('SIGKILL');
    }

    /**
     * 记录运行环境探测信息，方便排查二进制与动态库问题。
     */
    private logRuntimeProbe(executablePath: string): void {
        const executableDir = path.dirname(executablePath);
        const platform = process.platform;
        const arch = process.arch;
        let libs: string[] = [];

        try {
            if (platform === 'darwin') {
                libs = fs.readdirSync(executableDir).filter((name) => name.endsWith('.dylib'));
            } else if (platform === 'linux') {
                libs = fs.readdirSync(executableDir).filter((name) => /\.so(\.|$)/.test(name));
            }
        } catch (error) {
            this.logger.warn('whisper.cpp probe failed to read executable dir', { executableDir, error });
        }

        const metalFile = platform === 'darwin' ? path.join(executableDir, 'ggml-metal.metal') : null;
        this.logger.info('whisper.cpp runtime probe', {
            executablePath,
            executableDir,
            platform,
            arch,
            libsCount: libs.length,
            libs: libs.slice(0, 20),
            metalFileExists: metalFile ? fs.existsSync(metalFile) : undefined,
        });
    }
}
