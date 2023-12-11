import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
const api = window.electron;
type UseLayoutState = {
    showSideBar: boolean;
    titleBarHeight: number;
};

type UseLayoutActions = {
    changeSideBar: (show: boolean) => void;
};

const useLayout = create(
    subscribeWithSelector<UseLayoutState & UseLayoutActions>((set) => ({
        showSideBar: false,
        titleBarHeight: 0,
        changeSideBar: (show: boolean) => {
            set({ showSideBar: show });
        },
    }))
);
api.isWindows().then((isWindows) => {
    if (isWindows) {
        useLayout.setState({ titleBarHeight: 28 });
    } else {
        useLayout.setState({ titleBarHeight: 0 });
    }
});


export default useLayout;
