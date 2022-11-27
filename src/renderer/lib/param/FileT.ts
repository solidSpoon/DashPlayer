export enum FileType {
    VIDEO = 0,
    SUBTITLE = 1
}

export default class FileT {
    constructor() {
    }

    fileName: string;
    objectUrl: string;
    fileType: FileType;
}