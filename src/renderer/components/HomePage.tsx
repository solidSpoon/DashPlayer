import { logo } from '../../pic/img';
import useSystem from '../hooks/useSystem';
import TitleBar from './TitleBar/TitleBar';

const HomePage = () => {
    const appVersion = useSystem((s) => s.appVersion);
    return (
        <div className="w-full h-screen flex-1 bg-background flex justify-center items-center select-none">
            <TitleBar
                maximizable={false}
                className="fixed top-0 left-0 w-full"
            />
            <div className="w-1/3 h-full flex flex-col justify-center items-center bg-white/20 rounded-l-lg gap-14 drop-shadow shadow-black">
                <div className="relative top-0 left-0 w-32 h-32">
                    <img
                        src={logo}
                        alt="logo"
                        className="w-32 h-32 absolute top-0 left-0 user-drag-none"
                    />
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                    <h2 className="text-lg text-white/80">DashPlayer</h2>
                    <text className="text-white/75">{appVersion}</text>
                </div>
                <div className="w-full h-16" />
            </div>
            <div className="h-full flex-1 flex flex-col justify-center items-center bg-white/10 rounded-r-lg border-l border-background">
                <div className="text-4xl text-white/80">Welcome</div>
                <div className="text-xl text-white/80">
                    Open a video and its corresponding SRT file.
                </div>
            </div>
        </div>
    );
};

export default HomePage;
