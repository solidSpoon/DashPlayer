import { twMerge } from 'tailwind-merge';
import { useShallow } from 'zustand/react/shallow';
import Switch from '../Switch';
import usePlayerController from '../../hooks/usePlayerController';

const ControlCenter = () => {
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
            onClick={(e) => {
                e.stopPropagation();
            }}
            className={twMerge(
                'w-full h-full flex flex-col gap-2 items-start justify-center p-10'
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
    );
};

export default ControlCenter;
