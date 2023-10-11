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
    fileT.fileName = path.substring(path.lastIndexOf('/') + 1);
    fileT.path = path;
    fileT.objectUrl = (await api.openFile(path)) ?? '';
    fileT.fileType = path.endsWith('srt') ? FileType.SUBTITLE : FileType.VIDEO;
    console.log('fileT', fileT);
    return fileT;
};

export { pathToFile };

export default parseFile;
