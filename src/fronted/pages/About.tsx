import React from 'react';
import {FaGithub} from 'react-icons/fa';
import {cn} from "@/fronted/lib/utils";
import AboutBg from '@/fronted/components/bg/AboutBg';
import Separator from '@/fronted/components/Separtor';
import logoLight from '../../../assets/logo-light.png';
import useSystem from '@/fronted/hooks/useSystem';

const api = window.electron;
const About = () => {
    const appVersion = useSystem((s) => s.appVersion);
    return (
        <div className={cn('w-full h-full bg-white/80 flex flex-col')}>
            <div className={cn('pl-10 pt-16')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>About</h1>
                <h2 className={cn('text-xl text-neutral-500 mt-2 mb-4')}>
                    Dash Player
                </h2>
            </div>
            <div className="w-full h-32 ">
                <AboutBg/>
            </div>
            <div className={cn('flex w-full justify-center items-start')}>
                <div
                    className={cn(
                        'bg-white w-28 h-28 -translate-y-12 rounded-3xl border drop-shadow-lg grid place-content-center'
                    )}
                >
                    <img
                        src={logoLight}
                        alt="logo"
                        className="w-24 h-24 user-drag-none"
                    />
                </div>
            </div>
            <div className={cn('w-full text-center text-5xl text-neutral-500')}>
                DashPlayer
            </div>
            <div
                className={cn(
                    'w-full text-center text-xl text-neutral-500 mt-4'
                )}
            >
                {appVersion}
            </div>
            <div className={cn('mt-auto w-full bg-black/5')}>
                <div
                    className={cn(
                        'w-full h-24 flex items-center gap-3 text-neutral-500 translate-y-5'
                    )}
                >
                    <Separator orientation="horizontal"/>
                    solidSpoon
                    <Separator orientation="horizontal"/>
                </div>
                <div className={cn('flex justify-end p-3')}>
                    <FaGithub
                        onClick={async () => {
                            await api.call('system/open-url',
                                'https://github.com/solidSpoon/DashPlayer'
                            );
                        }}
                        className="fill-neutral-500 w-5 h-5 cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );
};

export default About;
