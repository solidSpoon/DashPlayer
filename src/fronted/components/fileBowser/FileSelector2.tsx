import React from 'react';
import {useNavigate} from 'react-router-dom';
import {pathToFile} from '../../../common/utils/FileParser';
import useFile from '../../hooks/useFile';
import {cn} from '../../../common/utils/Util';
import usePlayerController from '../../hooks/usePlayerController';
import FileItem from './FileItem';
import {Button} from "@/fronted/components/ui/button";

export interface OpenFileProps {
    directory?: boolean;
    className?: string;
    onSelected?: () => void;
}

const api = window.electron;

export default function FileSelector2({
                                          directory,
                                          className,
                                          onSelected,
                                      }: OpenFileProps) {
    const updateFile = useFile((s) => s.updateFile);
    const changePopType = usePlayerController((s) => s.changePopType);
    const navigate = useNavigate();
    const handleClick = async () => {
        const project = await api.selectFile(directory ?? false);
        console.log('project', project);
        if (!project) {
            return;
        }
        if (typeof project === 'string') {
            // 是字幕文件
            const file = await pathToFile(project);
            updateFile(file);
            onSelected?.();
            return;
        }

        console.log('project', project);
        const video =
            project.videos.filter((v) => {
                return v.current_playing === true;
            })[0] ?? project.videos[0];
        if (!video) {
            return;
        }
        api.playerSize();
        navigate(`/player/${video.id}`);
        onSelected?.();
        changePopType('none');
    };

    return (
        <>
            {directory && (
                <Button
                    onClick={() => handleClick()}
                    variant={"outline"}
                    className={cn('w-28')}
                >Open Folder</Button>
            )}
            {!directory && (
                <Button
                    onClick={() => handleClick()}
                    variant={"outline"}
                    className={cn('w-28')}
                >Open File</Button>
            )}
        </>
    );
}

FileSelector2.defaultProps = {
    directory: false,
    className: '',
    onSelected: () => {},
};
