import toast from 'react-hot-toast';
import {
    PlaybackRepairDiagnosis,
    RepairReason,
    RepairTaskResult,
} from '@/common/contracts/playback-repair';
import { DpTask, DpTaskState } from '@/common/contracts/dp-task';
import PathUtil from '@/common/utils/PathUtil';
import StrUtil from '@/common/utils/str-util';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import i18n from '@/fronted/i18n';
import useFile from '@/fronted/features/file-browser/fileStore';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { playerApi } from '@/fronted/features/player/playerApi';
import { repairApi } from '@/fronted/features/repair/repairApi';
import { verifyRepairedPlayback } from '@/fronted/features/player/verifyRepairedPlayback';
import useDpTaskCenter, { registerDpTask } from '@/fronted/hooks/useDpTaskCenter';

const logger = getRendererLogger('PlaybackRepair');

/**
 * 一键修复的最终状态。
 *
 * - `repaired`：已生成产物（若当时仍在播放该文件，播放源已切换）；
 * - `not-needed`：诊断结论认为无需修复，没有创建任务；
 * - `failed`：修复任务失败或用户取消。
 */
export type RepairOutcomeStatus = 'repaired' | 'not-needed' | 'failed' | 'already-running';

export interface PlaybackRepairOutcome {
    /** 最终状态。 */
    status: RepairOutcomeStatus;
    /** 本次诊断结论；启动阶段就失败时没有诊断结论。 */
    diagnosis?: PlaybackRepairDiagnosis;
}

/**
 * 诊断单个媒体文件是否需要修复。
 *
 * @param filePath 媒体绝对路径。
 * @returns 诊断结论。
 */
export async function diagnosePlayback(filePath: string): Promise<PlaybackRepairDiagnosis> {
    return repairApi.diagnose(filePath);
}

/**
 * 判断任务是否已进入终态。
 *
 * @param task 后台任务。
 * @returns 任务已结束（成功、失败或取消）时返回 `true`。
 */
function isFinalTask(task: DpTask): boolean {
    return task.status === DpTaskState.DONE
        || task.status === DpTaskState.FAILED
        || task.status === DpTaskState.CANCELLED;
}

/**
 * 从任务结果中读出百分比进度。
 *
 * @param result 任务结果的序列化文本。
 * @returns 可解析出的进度；无法解析时返回 `null`。
 */
function parseProgress(result: string | null): number | null {
    if (StrUtil.isBlank(result ?? '')) {
        return null;
    }
    try {
        const parsed = JSON.parse(result as string) as RepairTaskResult;
        return typeof parsed.progress === 'number' ? Math.round(parsed.progress) : null;
    } catch {
        return null;
    }
}

/**
 * 订阅任务直到进入终态。
 *
 * @param taskId 后端任务编号。
 * @param onUpdate 每次任务更新时的回调。
 * @returns 终态任务。
 */
function watchTask(taskId: number, onUpdate: (task: DpTask) => void): Promise<DpTask> {
    return new Promise((resolve) => {
        void registerDpTask(async () => taskId, {
            onUpdated: (task) => onUpdate(task),
            onFinish: (task) => resolve(task),
        });
        // 订阅建立前任务可能已经结束，这里补一次当前状态判断，避免永久等待。
        const current = useDpTaskCenter.getState().tasks.get(taskId);
        if (current && current !== 'init' && isFinalTask(current)) {
            resolve(current);
        }
    });
}

/**
 * 正在修复的媒体路径。
 *
 * 修复产物固定写在源文件旁边，同一文件并发修复会互相覆盖，因此在入口处拦截重复点击。
 */
const repairingPaths = new Set<string>();

/**
 * 一键修复当前播放的媒体。
 *
 * 流程：诊断并创建任务 → 展示进度 → 完成后如果仍在播放该文件，
 * 就把播放位置写到产物记录上并让播放器切到产物，从而回到原来的位置继续播。
 *
 * @param filePath 待修复媒体绝对路径。
 * @returns 本次修复的最终状态；同一文件已有修复在跑时返回 `null`（仅提示，不启动新任务）。
 */
export async function repairPlayback(filePath: string): Promise<PlaybackRepairOutcome | null> {
    if (repairingPaths.has(filePath)) {
        toast(i18n.t('player:repair.inProgress'));
        return null;
    }
    repairingPaths.add(filePath);
    try {
        return await runRepair(filePath);
    } finally {
        repairingPaths.delete(filePath);
    }
}

/**
 * 执行一次完整的修复流程。
 *
 * @param filePath 待修复媒体绝对路径。
 * @returns 本次修复的最终状态。
 */
async function runRepair(filePath: string): Promise<PlaybackRepairOutcome> {
    const startedPath = useFile.getState().videoPath;
    const startedVideoId = useFile.getState().videoId;
    const startPosition = usePlayer.getState().getExactPlayTime();
    const toastId = toast.loading(i18n.t('player:repair.inProgress'));

    let taskId: number | null;
    let diagnosis: PlaybackRepairDiagnosis;
    try {
        const started = await repairApi.startRepair(filePath);
        taskId = started.taskId;
        diagnosis = started.diagnosis;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('repair start failed', { filePath, error: message });
        toast.error(i18n.t('player:repair.failed', { message }), { id: toastId });
        return { status: 'failed' };
    }

    if (taskId === null) {
        // 诊断结论是「无需修复」或「已修复」，属于信息提示而非错误，用普通样式展示。
        toast(describeNoRepair(diagnosis.reason), { id: toastId });
        return { status: 'not-needed', diagnosis };
    }
    const startedTaskId: number = taskId;

    const task = await watchTask(startedTaskId, (updated) => {
        const progress = parseProgress(updated.result);
        toast.loading(
            progress === null
                ? i18n.t('player:repair.inProgress')
                : i18n.t('player:repair.inProgressPercent', { progress }),
            { id: toastId },
        );
    });

    if (task.status !== DpTaskState.DONE) {
        const message = task.progress ?? i18n.t('player:repair.failed', { message: task.status });
        toast.error(message, { id: toastId });
        return { status: 'failed', diagnosis };
    }

    // 后端已按 ffprobe 验收过产物，这里再用真正要播它的引擎静默试播一次；
    // 没通过就不切换，并删掉产物，否则下次打开会被优先选中。
    const verified = await verifyOutput(diagnosis);
    if (!verified) {
        toast.error(i18n.t('player:repair.failed', { message: i18n.t('player:repair.verifyFailed') }), { id: toastId });
        return { status: 'failed', diagnosis };
    }

    await switchToRepairedMedia({
        startedPath,
        startedVideoId,
        startPosition,
        toastId,
    });
    return { status: 'repaired', diagnosis };
}

/**
 * 修复完成后把播放器切到修复产物。
 *
 * 用户已经切到别的媒体时只提示结果，不改动当前播放；仍在播放时先把当前进度写到
 * 产物记录上，再让播放详情重新解析路径，播放器就会在产物上恢复到原位置。
 *
 * @param args.startedPath 开始修复时正在播放的媒体路径。
 * @param args.startedVideoId 开始修复时正在播放的观看记录 ID。
 * @param args.startPosition 开始修复时的播放位置，单位为秒。
 * @param args.toastId 进度提示的 toast ID，用于改写成最终提示。
 */
async function switchToRepairedMedia(args: {
    startedPath: string | null;
    startedVideoId: string | null;
    startPosition: number;
    toastId: string;
}): Promise<void> {
    const { startedPath, startedVideoId, startPosition, toastId } = args;
    if (!startedPath || !startedVideoId || useFile.getState().videoPath !== startedPath) {
        toast.success(i18n.t('player:repair.done'), { id: toastId });
        return;
    }

    try {
        // 先取一次播放详情：这会补建产物对应的观看记录，随后的进度写入才有落点。
        const detail = await playerApi.getPlayerDetail(startedVideoId);
        if (detail) {
            await playerApi.updateProgress({
                file: PathUtil.join(detail.basePath, detail.fileName),
                currentPosition: startPosition,
            });
        }
        await swrMutate(SWR_KEY.PLAYER_P);
        toast.success(i18n.t('player:repair.doneSwitched'), { id: toastId });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('switch to repaired media failed', {
            filePath: startedPath,
            error: message,
        });
        // 产物已经生成，只是切换失败；如实提示，让用户重新打开该媒体即可。
        toast.error(i18n.t('player:repair.failed', { message }), { id: toastId });
    }
}

/**
 * 预检阶段能给出的学习结论原因。
 */
type LearnedRepairReason = Extract<RepairReason, 'undecodable-video' | 'unsupported-audio'>;

/**
 * 对诊断结论为「可直接播放」的媒体做一次真机探测，把结论性证据写入学习能力缓存。
 *
 * 目的是封住静态白名单的跨平台误判（如无硬解机器上的 HEVC）：白名单说能播但实测
 * 解不出画面/声音时，把该编码记为不可解，之后的诊断会据此收紧配方，当前文件也
 * 能拿到修复提示而不是「无需修复 → 播放黑屏」的死胡同。
 *
 * 探测是静默的（隐藏元素、静音），且后端保证每个编码每台机器最多探测一次。
 *
 * @param diagnosis 已完成的诊断结论，提供编码名与预期流。
 * @returns 实测出不可解时返回建议的提示原因；其余情况返回 null。
 */
export async function probeAndRecordPlaybackCapability(
    diagnosis: PlaybackRepairDiagnosis,
): Promise<LearnedRepairReason | null> {
    // 已经判定要修的文件不需要探测：修复本身会给出正确配方。
    if (diagnosis.reason !== 'playable') {
        return null;
    }
    const videoCodec = diagnosis.videoCodec ?? null;
    const audioCodec = diagnosis.audioCodec ?? null;
    if (!videoCodec && !audioCodec) {
        return null;
    }

    try {
        const shouldProbe = await repairApi.shouldProbeCapability({ videoCodec, audioCodec });
        if (!shouldProbe) {
            return null;
        }
        const result = await verifyRepairedPlayback(diagnosis.filePath, {
            expectVideo: diagnosis.hasVideoStream,
            expectAudio: diagnosis.hasAudioStream,
        });
        if (!result.conclusive) {
            // 试播没跑起来时计数不可信：不下任何结论，也不打断用户。
            logger.debug('capability probe inconclusive', { filePath: diagnosis.filePath });
            return null;
        }

        if (result.ok) {
            await recordEvidence(diagnosis, 'video', true);
            await recordEvidence(diagnosis, 'audio', true);
            return null;
        }

        const failedDimensions = result.failedDimensions ?? [];
        for (const dimension of failedDimensions) {
            await recordEvidence(diagnosis, dimension, false);
        }
        // 画面和声音都没解出时按视频问题提示（配方同为整片重编码）。
        return failedDimensions.includes('video') ? 'undecodable-video' : 'unsupported-audio';
    } catch (error) {
        // 探测是锦上添花的能力：失败只记日志，不影响打开文件的正常流程。
        logger.debug('capability probe failed', {
            filePath: diagnosis.filePath,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/**
 * 把单个维度的证据上报给学习缓存。
 *
 * @param diagnosis 诊断结论，提供编码名与源文件路径。
 * @param dimension 证据所属维度。
 * @param playable 是否实测解出。
 */
async function recordEvidence(
    diagnosis: PlaybackRepairDiagnosis,
    dimension: 'video' | 'audio',
    playable: boolean,
): Promise<void> {
    const codec = dimension === 'video' ? diagnosis.videoCodec : diagnosis.audioCodec;
    if (!codec) {
        return;
    }
    await repairApi.recordPlaybackEvidence({
        codec,
        kind: dimension,
        playable,
        conclusive: true,
        sourceFile: diagnosis.filePath,
    });
}

/**
 * 对修复产物做真机试播验收，未通过时删掉产物。
 *
 * @param diagnosis 本次诊断结论，提供产物路径与源文件的流信息。
 * @returns 验收通过时返回 `true`。
 */
async function verifyOutput(diagnosis: PlaybackRepairDiagnosis): Promise<boolean> {
    const outputPath = diagnosis.outputPath;
    if (!outputPath) {
        logger.error('repair output path missing', { filePath: diagnosis.filePath });
        return false;
    }

    const result = await verifyRepairedPlayback(outputPath, {
        expectVideo: diagnosis.hasVideoStream,
        expectAudio: diagnosis.hasAudioStream,
    });
    if (result.ok) {
        return true;
    }

    logger.error('repaired media failed playback verification', {
        filePath: diagnosis.filePath,
        outputPath,
        conclusive: result.conclusive,
        detail: result.detail ?? 'unknown',
    });
    // 试播没跑起来（例如自动播放被拦）时计数不可信：如实记录但不删产物、也不阻止切换。
    if (!result.conclusive) {
        return true;
    }

    try {
        await repairApi.discard({ filePath: diagnosis.filePath, outputPath });
    } catch (error) {
        logger.error('discard unplayable repair output failed', {
            outputPath,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    return false;
}

/**
 * 把「无需修复」的诊断原因翻译成用户能看懂的提示。
 *
 * @param reason 诊断原因。
 * @returns 面向用户的提示文案。
 */
function describeNoRepair(reason: RepairReason): string {
    if (reason === 'already-repaired') {
        return i18n.t('player:repair.alreadyRepaired');
    }
    return i18n.t('player:repair.notNeeded');
}
