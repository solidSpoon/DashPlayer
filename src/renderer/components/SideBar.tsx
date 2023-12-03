import { useNavigate, useRoutes } from 'react-router-dom';
import { cn } from '../../utils/Util';
import logoLight from '../../../assets/logo-light.png';
import useFile from '../hooks/useFile';

const SideBar = () => {
    const navigate = useNavigate();
    const video = useFile((s) => s.currentVideo);
    return (
        <div
            className={cn(
                'w-full h-full flex flex-col text-black bg-stone-200'
            )}
        >
            <div className={cn('basis-1/4 flex items-center justify-center')}>
                <img
                    className={cn('w-24 h-24 aspect-square user-drag-none')}
                    src={logoLight}
                />
            </div>
            <div className={cn('flex-1 flex flex-col')}>
                <div
                    onClick={() => navigate('/home')}
                    className={cn('w-full p-2 grid place-content-center')}
                >
                    Home
                </div>
                <div
                    onClick={() => navigate(`/player/${video?.id}?sideBarAnimation=false`)}
                    className={cn('w-full p-2 grid place-content-center')}
                >
                    Player
                </div>
                <div
                    onClick={() => navigate('/word-management')}
                    className={cn('w-full p-2 grid place-content-center')}
                >
                    Word Management
                </div>
            </div>
        </div>
    );
};

export default SideBar;
