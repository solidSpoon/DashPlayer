import {VideoInfo} from '@/common/types/video-info';


export default interface FfmpegService {
    splitVideo({
                   inputFile,
                   startSecond,
                   endSecond,
                   outputFile
               }: {
        inputFile: string,
        startSecond: number,
        endSecond: number,
        outputFile: string
    }): Promise<void>;

    splitVideoByTimes({
                          inputFile,
                          times,
                          outputFolder,
                          outputFilePrefix
                      }: {
        inputFile: string,
        times: number[],
        outputFolder: string,
        outputFilePrefix: string
    }): Promise<string[]>;

    duration(filePath: string): Promise<number>;

    thumbnail({
                  inputFile,
                  outputFileName,
                  outputFolder,
                  time,
                  inputDuration,
                  options
              }: {
        inputFile: string,
        outputFileName: string,
        outputFolder: string,
        time: number,
        inputDuration?: number,
        options?: {
            quality?: 'low' | 'medium' | 'high' | 'ultra';
            width?: number;
            format?: 'jpg' | 'png';
        }
    }): Promise<void>;

    splitToAudio({
                     taskId,
                     inputFile,
                     outputFolder,
                     segmentTime,
                     onProgress
                 }: {
        taskId: number,
        inputFile: string,
        outputFolder: string,
        segmentTime: number,
        onProgress?: (progress: number) => void
    }): Promise<string[]>;

    toMp4({
              inputFile,
              onProgress
          }: {
        inputFile: string,
        onProgress?: (progress: number) => void
    }): Promise<string>;

    mkvToMp4({
                 taskId,
                 inputFile,
                 outputFile,
                 onProgress
             }: {
        taskId: number,
        inputFile: string,
        outputFile?: string,
        onProgress?: (progress: number) => void
    }): Promise<string>;

    extractSubtitles({
                         taskId,
                         inputFile,
                         outputFile,
                         onProgress,
                         en
                     }: {
        taskId: number,
        inputFile: string,
        outputFile?: string,
        onProgress?: (progress: number) => void,
        en: boolean
    }): Promise<string>;

    trimVideo(inputPath: string, startTime: number, endTime: number, outputPath: string): Promise<void>;

    /**
     * Get video information
     */
    getVideoInfo(filePath: string): Promise<VideoInfo>;

    /**
     * Convert audio file to WAV format
     */
    convertToWav(inputPath: string, outputPath: string): Promise<void>;

    /**
     * NEW: Trim audio by time range (re-encode to mp3 for compatibility)
     */
    trimAudio(inputPath: string, startTime: number, endTime: number, outputPath: string): Promise<void>;

    /**
     * NEW: Split audio by VAD timeline ranges
     */
    splitAudioByTimeline(args: {
        inputFile: string,
        ranges: Array<{ start: number, end: number }>,
        outputFolder: string,
        outputFilePrefix?: string
    }): Promise<string[]>;
}
