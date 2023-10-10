import { useEffect, useState } from 'react';
import { logo } from '../../pic/img';

const api = window.electron;

const HomePage = () => {
    const [version, setVersion] = useState<string>('');
    useEffect(() => {
        const fun = async () => {
            const v = await api.appVersion();
            setVersion(v);
        };
        fun();
    }, []);

    return (
        <div className="w-full flex-1 bg-background flex justify-center items-center select-none">
            <div className="w-[800px] h-[600px] rounded flex flex-shrink">
                <div className="w-1/3 h-full flex flex-col justify-center items-center bg-white/5 rounded-l-lg">
                    <img src={logo} alt="logo" className="" />
                    <div className="flex items-end gap-2">
                        <h2 className="text-lg text-white/80">DashPlayer</h2>
                        <text className="text-white/75">v {version}</text>
                    </div>
                </div>
                <div className="h-full flex-1 flex flex-col justify-center items-center bg-white/10 rounded-r-lg">
                    <div className="text-4xl text-white/80">Welcome</div>
                    <div className="text-xl text-white/80">
                        Open a video and its corresponding SRT file.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
