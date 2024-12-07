import { FolderVideos } from '@/common/types/tonvert-type';


export default interface ConvertService {
    toMp4(taskId: number, file: string): Promise<void>;

    fromFolder(folders: string[]): Promise<FolderVideos[]>;
}

