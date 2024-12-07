enum ErrorConstants {
    CLIP_EXISTS = 'Clip already exists',
    CACHE_NOT_FOUND = 'Cache not found',
    CANCEL_MSG = 'dp-用户取消',
}

export default ErrorConstants;

export function isErrorCancel(e: unknown): boolean {
  return e instanceof Error &&(e.message === ErrorConstants.CANCEL_MSG || e.message === 'ffmpeg was killed with signal SIGKILL');
}
