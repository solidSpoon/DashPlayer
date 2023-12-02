import { cn } from '../../utils/Util';
import logoLight from '../../../assets/logo-light.png';
import logoDark from '../../../assets/logo-dark.png';

const SideBar = () => {
    return (
        <div className={cn('w-full h-full flex flex-col text-black bg-stone-200')}>
            <div className={cn('basis-1/4 flex items-center justify-center')}>
                <img
                    className={cn('w-2/3 aspect-square user-drag-none')}
                    src={logoLight}
                />
            </div>
            <div className={cn('flex-1 flex flex-col')}>
                <div className={cn('w-full p-2 grid place-content-center')}>
                    Home
                </div>
                <div className={cn('w-full p-2 grid place-content-center')}>
                    Library
                </div>
            </div>
        </div>
    );
};

export default SideBar;
