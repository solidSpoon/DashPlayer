import { cn } from '@/fronted/lib/utils';
import { PiSpeakerSimpleHigh } from 'react-icons/pi';
import { getTtsUrl, playAudioUrl } from '@/common/utils/AudioPlayer';
import { useState } from 'react';
import { Loader, Volume2 } from 'lucide-react';

export interface PlayableProps {
    className?: string;
    children?: string;
}

const Playable = ({ className, children }: PlayableProps) => {
    const [loading, setLoading] = useState(false);
    return (
        <span
            onClick={async () => {
                setLoading(true);
                const str = children || '';
                console.log('ttsStr', str);
                const ttsUrl = await getTtsUrl(str);
                setLoading(false);
                console.log('ttsUrl', ttsUrl);
                await playAudioUrl(ttsUrl);
            }}
            className={cn(' cursor-pointer hover:underline', className)}>
            {children}

            {loading ? <Loader className={'inline-block ml-1 w-4 h-4'} /> :
                <Volume2 className={'inline-block ml-1 w-4 h-4'} />}
        </span>
    );
};

Playable.defaultProps = {
    className: '',
    children: ''
};

export default Playable;
