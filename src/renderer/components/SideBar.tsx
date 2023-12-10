import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { cn } from '../../utils/Util';
import logoLight from '../../../assets/logo-light.png';
import useFile from '../hooks/useFile';
import { IoHomeOutline } from 'react-icons/io5';
import { HiOutlineAcademicCap, HiOutlineHome, HiOutlineVideoCamera } from 'react-icons/hi';
import { cloneElement, ReactElement } from 'react';

const SideBar = () => {
    const navigate = useNavigate();
    const location = useLocation()
    const video = useFile((s) => s.currentVideo);
    const item = (text:string, path:string, key:string, icon: ReactElement) => {
        return (
            <div
                onClick={() => navigate(path)}
                className={cn('w-full px-2 flex justify-start items-center gap-2 rounded-lg',
                    location.pathname.includes(key) && 'bg-stone-300'
                )}
            >
                {cloneElement(icon, {className: cn('w-5 h-5 text-amber-600')})}
                <div className={cn('py-2 h-full text-base font-thin grid place-content-center')}>{text}</div>
            </div>
        )
    }

    return (
        <div
            className={cn(
                'w-full h-full flex flex-col text-black bg-stone-200 border-r border-stone-300'
            )}
        >
            <div className={cn('basis-1/4 flex items-center justify-center')}>
                <img
                    className={cn('w-24 h-24 aspect-square user-drag-none')}
                    src={logoLight}
                />
            </div>
            <div className={cn('flex-1 flex flex-col p-3')}>
                {item('Home', '/home', 'home', <HiOutlineHome />)}
                {item('Player', `/player/${video?.id}?sideBarAnimation=false`,'player', <HiOutlineVideoCamera />)}
                {item('Word Management', '/word-management','word-management', <HiOutlineAcademicCap />)}
            </div>
        </div>
    );
};

export default SideBar;
