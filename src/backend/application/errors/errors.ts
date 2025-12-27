import { ExtendableError } from 'ts-error';

/**
 * Whisper 相应格式错误
 */
export class WhisperResponseFormatError extends ExtendableError {
}

/**
 * 任务被用户取消
 */
export class CancelByUserError extends ExtendableError {
}
