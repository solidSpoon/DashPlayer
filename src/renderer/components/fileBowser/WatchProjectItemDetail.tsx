import { GoFile } from 'react-icons/go';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import ListItem from './atom/ListItem';
import useFile from '../../hooks/useFile';
import { cn } from '../../../utils/Util';
import { WatchProjectVO } from '../../../db/services/WatchProjectService';

export interface WatchProjectItemDetailProps {
    item: WatchProjectVO;
    onRouteTo?: (id: number | null) => void;
    className?: string;
}

const WatchProjectItemDetail = ({
    item,
    onRouteTo,
    className,
}: WatchProjectItemDetailProps) => {
    console.log('watch project item', item);
    const currentVideo = useFile((s) => s.currentVideo);
    const navigate = useNavigate();

    return (
        <div
            className={cn(
                'w-full flex flex-col gap-2 overflow-y-scroll scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-thumb-rounded',
                className
            )}
        >
            <ListItem
                onClick={() => {
                    onRouteTo?.(null);
                }}
                content="..."
            />

            {item.videos.map((video) => {
                const isCurrent = currentVideo?.id === video.id;
                return (
                    <ListItem
                        className={cn(
                            isCurrent && 'bg-orange-200 hover:bg-orange-200/50'
                        )}
                        onClick={() => {
                            navigate(`/player/${video.id}`);
                        }}
                        content={video.video_name ?? ''}
                        key={video.id}
                        icon={<GoFile />}
                    />
                );
            })}
        </div>
    );
};

WatchProjectItemDetail.defaultProps = {
    className: '',
    onRouteTo: () => {},
};

export default WatchProjectItemDetail;