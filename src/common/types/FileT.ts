export enum FileType {
    VIDEO = 0,
    SUBTITLE = 1,
    OTHER = 2,
}

export default class FileT {
    fileName: string | undefined;

    objectUrl: string | undefined;

    fileType: FileType | undefined;

    path: string | undefined;
}
