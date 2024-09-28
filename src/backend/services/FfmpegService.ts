

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
                  time
              }: {
        inputFile: string,
        outputFileName: string,
        outputFolder: string,
        time: number
    }): Promise<void>;

    splitToAudio({
                     taskId,
                     inputFile,
                     outputFolder,
                     segmentTime
                 }: {
        taskId: number,
        inputFile: string,
        outputFolder: string,
        segmentTime: number,
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
                 onProgress
             }: {
        taskId: number,
        inputFile: string,
        onProgress?: (progress: number) => void
    }): Promise<string>;

    extractSubtitles({
                         taskId,
                         inputFile,
                         onProgress,
                         en
                     }: {
        taskId: number,
        inputFile: string,
        onProgress?: (progress: number) => void,
        en: boolean
    }): Promise<string>;

    trimVideo(inputPath: string, startTime: number, endTime: number, outputPath: string): Promise<void>;
}

