import FileT, { FileType } from './param/FileT';

const api = window.electron;
const parseFile = (file: File): FileT => {
    const fileT = new FileT();
    fileT.fileName = file.name;
    fileT.path = file.path;
    fileT.objectUrl = URL.createObjectURL(file);
    // ".mp4,.mkv,.srt,.webm"
    const isSrt = file.name.endsWith('srt');
    const isVideo =
        file.type.endsWith('mp4') ||
        file.type.endsWith('webm') ||
        file.type.endsWith('mkv');
    if (isSrt) {
        fileT.fileType = FileType.SUBTITLE;
    } else if (isVideo) {
        fileT.fileType = FileType.VIDEO;
    } else {
        fileT.fileType = FileType.OTHER;
    }
    return fileT;
};

const pathToFile = async (path: string): Promise<FileT> => {
    const fileT = new FileT();
    const fileSeparator = path.lastIndexOf('/') > 0 ? '/' : '\\';
    fileT.fileName = path.substring(path.lastIndexOf(fileSeparator) + 1);
    fileT.path = path;
    const fileType = path.endsWith('srt') ? FileType.SUBTITLE : FileType.VIDEO;
    fileT.objectUrl =
        fileType === FileType.SUBTITLE
            ? (await api.openFile(path)) ?? ''
            : `dp:///${path}`;
    fileT.fileType = fileType;

    console.log('fileT', fileT);
    return fileT;
};

export { pathToFile };

export default parseFile;
