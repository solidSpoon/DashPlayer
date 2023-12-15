import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { cn } from '../../utils/Util';
import logoLight from '../../../assets/logo-light.png';
import useFile from '../hooks/useFile';
import { HiOutlineAcademicCap, HiOutlineHome, HiOutlineVideoCamera } from 'react-icons/hi';
import { cloneElement, ReactElement } from 'react';
export interface SideBarProps {
    compact?: boolean;
}
const SideBar = ({compact}:SideBarProps) => {
    const navigate = useNavigate();
    const location = useLocation()
    const video = useFile((s) => s.currentVideo);
    const item = (text:string, path:string, key:string, icon: ReactElement) => {
        return (
            <div
                onClick={() => navigate(path)}
                className={cn('w-full px-2 flex justify-start items-center gap-2 rounded-lg h-10',
                    location.pathname.includes(key) && 'bg-stone-300',
                    compact && 'justify-center'
                )}
            >
                {cloneElement(icon, {className: cn('w-5 h-5 text-amber-600 flex-shrink-0')})}
                {!compact && (
                    <div className={cn('text-base font-thin  truncate w-0 flex-1')}>{text}</div>
                )}
            </div>
        )
    }

    return (
        <div
            className={cn(
                'w-full h-full flex flex-col text-black bg-stone-200 border-r border-stone-300'
            )}
        >
            <div className={cn('flex-1 flex items-center justify-center')}>
                <img
                    className={cn('w-24 h-24 user-drag-none',
                        compact && 'w-14 h-14'
                        )}
                    src={logoLight}
                />
            </div>
            <div className={cn('basis-3/4 flex flex-col p-3')}>
                {/*{item('Home', '/home', 'home', <HiOutlineHome />)}*/}
                {item('Player', `/player/${video?.id}?sideBarAnimation=false`,'player', <HiOutlineVideoCamera />)}
                {item('Word Management', '/word-management','word-management', <HiOutlineAcademicCap />)}
            </div>
        </div>
    );
};

SideBar.defaultProps = {
    compact: false,
};

export default SideBar;
