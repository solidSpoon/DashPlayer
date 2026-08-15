import { WindowState } from '@/common/types/Types';

export default interface WindowPort {
    changeWindowSize(state: WindowState): void;
    windowState(): WindowState;
    setWindowButtonsVisible(visible: boolean): void;
}

