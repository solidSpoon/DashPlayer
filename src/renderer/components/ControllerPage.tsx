import { twMerge } from 'tailwind-merge';
import { useShallow } from 'zustand/react/shallow';
import Switch from './Switch';
import usePlayerController from '../hooks/usePlayerController';

const ControllerPage = () => {
    const {
        showEn,
        showCn,
        showWordLevel,
        singleRepeat,
        changeShowEn,
        changeShowCn,
        changeShowWordLevel,
        changeSingleRepeat,
        changePopType,
    } = usePlayerController(
        useShallow((s) => ({
            showEn: s.showEn,
            showCn: s.showCn,
            showWordLevel: s.showWordLevel,
            changeShowEn: s.changeShowEn,
            changeShowCn: s.changeShowCn,
            changeShowWordLevel: s.changeShowWordLevel,
            singleRepeat: s.singleRepeat,
            changeSingleRepeat: s.changeSingleRepeat,
            changePopType: s.changePopType,
        }))
    );

    return (
        <div
            onClick={() => {
                changePopType('none');
            }}
            className={twMerge(
                'fixed left-0 top-0 flex flex-col items-center justify-center z-50 w-full h-full'
            )}
        >
            <div className="h-7 w-full" />

            <div className="flex-1 flex w-full bg-black/50">
                <div
                    className={twMerge('w-36 h-full bg-white/90')}
                    onClick={(e) => e.stopPropagation()}
                />
                <div
                    className={twMerge(
                        'flex-1 h-full flex items-center justify-center'
                    )}
                >
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        className={twMerge(
                            'flex flex-col gap-2 items-start justify-center p-10 bg-white rounded-lg'
                        )}
                    >
                        <Switch
                            checked={showEn}
                            onChange={() => changeShowEn()}
                            title="展示英文字幕"
                        />
                        <Switch
                            checked={showCn}
                            onChange={() => changeShowCn()}
                            title="展示中文字幕"
                        />
                        <Switch
                            checked={showWordLevel}
                            onChange={() => changeShowWordLevel()}
                            title="展示生词翻译"
                        />
                        <Switch
                            checked={singleRepeat}
                            onChange={() => changeSingleRepeat()}
                            title="单句循环"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControllerPage;
