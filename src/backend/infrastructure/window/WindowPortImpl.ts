import { inject, injectable } from 'inversify';
import { BrowserWindow } from 'electron';
import WindowPort from '@/backend/services/gateways/window/WindowPort';
import TYPES from '@/backend/ioc/types';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';
import { WindowState } from '@/common/types/Types';
import { getMainLogger } from '@/backend/infrastructure/logger';

/** 首页的设计尺寸，与 src/main.ts 创建窗口时的初始尺寸保持一致。 */
const HOME_WIDTH = 1200;
const HOME_HEIGHT = 800;
/** 尺寸判定中，最后一次 resize 事件之后多久视为稳定。 */
const SIZE_SETTLE_MS = 200;
/** 尺寸判定的最长等待：窗口管理器把尺寸摆到位可能要等一次往返（unmaximize 的恢复、平铺布局的落位）。 */
const SIZE_WAIT_TIMEOUT_MS = 800;
/** 锁死后的观察时长：窗口管理器若在这段时间内改走尺寸，说明几何归它管，锁死必须撤销。 */
const LOCK_WATCH_MS = 800;

@injectable()
export default class WindowPortImpl implements WindowPort {
    @inject(TYPES.MainWindowRegistry)
    private mainWindowRegistry!: MainWindowRegistry;

    private readonly logger = getMainLogger('WindowPort');

    /** 首页尺寸判定的序号：每次状态切换都自增，用于作废尚未完成的异步收尾。 */
    private homeResolveToken = 0;

    private tryGetWindow() {
        return this.mainWindowRegistry.tryGetMainWindow();
    }

    /**
     * 切换窗口状态。
     *
     * home 状态是异步收尾：要先看窗口管理器给我们的尺寸再决定是否锁死（见 applyHomeWindowMode），
     * 因此这里为每次切换分配序号，供过期的判定自行作废。
     */
    public changeWindowSize(state: WindowState): void {
        const win = this.tryGetWindow();
        if (!win) {
            return;
        }

        this.homeResolveToken += 1;

        switch (state) {
            case 'normal':
                win.unmaximize();
                win.setFullScreen(false);
                break;
            case 'maximized':
                win.maximize();
                break;
            case 'minimized':
                win.minimize();
                break;
            case 'fullscreen':
                win.setFullScreen(true);
                break;
            case 'closed':
                win.close();
                break;
            case 'home':
                void this.applyHomeWindowMode(win, this.homeResolveToken);
                break;
            case 'player':
                win.setResizable(true);
                win.setMaximizable(true);
                win.maximize();
                break;
            default:
                break;
        }
    }

    /**
     * 应用首页窗口模式：只有几何确实由应用主导时才把窗口锁死。
     *
     * 判定必须发生在任何 setSize 之前：Wayland 下客户端无权决定自己的窗口尺寸，Electron 会把
     * 自己请求的尺寸原样回读（setSize 之后 getSize / getContentSize / 渲染进程视口全部变成请求值），
     * 所以"请求是否落地"在请求之后无法观测；只有窗口管理器主动配置给我们的尺寸才说明几何归它管。
     * 平铺式窗口管理器忽略应用的尺寸请求、按布局摆放窗口，据此后让路；常规浮动桌面维持原有锁死行为。
     *
     * @param win 主窗口。
     * @param token 本次请求的序号；等待期间再次切换状态（序号过期）或窗口已销毁时不再收尾。
     */
    private async applyHomeWindowMode(win: BrowserWindow, token: number): Promise<void> {
        win.unmaximize();

        const observed = await this.waitForStableSize(win);
        if (token !== this.homeResolveToken || win.isDestroyed()) {
            return;
        }

        if (observed[0] !== HOME_WIDTH || observed[1] !== HOME_HEIGHT) {
            // 窗口管理器在管几何：让路——不请求尺寸，并显式释放约束，
            // 因为 setResizable 在部分实现下本身会留下临时约束
            win.setResizable(true);
            win.setMaximizable(true);
            this.logger.info('home window mode applied', { locked: false, reason: 'size-imposed', size: observed });
            return;
        }

        win.setSize(HOME_WIDTH, HOME_HEIGHT);
        win.setResizable(false);
        win.setMaximizable(false);

        // 迟到的 configure：窗口管理器若在锁死之后才把尺寸摆成它要的值，说明它才是几何的主导者，
        // 此时必须撤销锁死，否则窗口会被设计尺寸钉住
        const overridden = await this.waitForSizeOverride(win, LOCK_WATCH_MS);
        if (token !== this.homeResolveToken || win.isDestroyed()) {
            return;
        }
        if (overridden) {
            win.setResizable(true);
            win.setMaximizable(true);
            this.logger.info('home window mode applied', { locked: false, reason: 'late-resize', size: this.readSize(win) });
        } else {
            this.logger.info('home window mode applied', { locked: true, reason: 'size-stable' });
        }
    }

    /**
     * 等待窗口尺寸稳定，返回稳定后的尺寸。
     *
     * 必须在调用 setSize 之前使用（原因见 applyHomeWindowMode）。等待期间收到 resize 事件就以
     * SIZE_SETTLE_MS 的静默期作为稳定点，这样窗口管理器的多次调整都会被收齐；一直没有事件则等满上限。
     *
     * @param win 主窗口。
     * @returns 稳定后的窗口尺寸；窗口在等待期间被销毁时返回 [0, 0]。
     */
    private waitForStableSize(win: BrowserWindow): Promise<[number, number]> {
        return new Promise((resolve) => {
            let settleTimer: ReturnType<typeof setTimeout> | undefined;
            let finished = false;

            const finish = () => {
                if (finished) {
                    return;
                }
                finished = true;
                if (settleTimer) {
                    clearTimeout(settleTimer);
                }
                clearTimeout(capTimer);
                win.removeListener('resize', onResize);
                resolve(this.readSize(win));
            };

            const onResize = () => {
                if (settleTimer) {
                    clearTimeout(settleTimer);
                }
                settleTimer = setTimeout(finish, SIZE_SETTLE_MS);
            };

            const capTimer = setTimeout(finish, SIZE_WAIT_TIMEOUT_MS);
            win.on('resize', onResize);
        });
    }

    /**
     * 观察一段时间内窗口尺寸是否被窗口管理器改成了设计尺寸之外的值。
     *
     * 锁死后使用。与设计尺寸相同的重复 configure 不算改尺寸——那是我们自己 setResizable 的回声。
     *
     * @param win 主窗口。
     * @param ms 观察时长。
     * @returns 观察到尺寸被改成设计尺寸之外的值返回 true。
     */
    private waitForSizeOverride(win: BrowserWindow, ms: number): Promise<boolean> {
        return new Promise((resolve) => {
            let finished = false;

            const finish = (overridden: boolean) => {
                if (finished) {
                    return;
                }
                finished = true;
                clearTimeout(timer);
                win.removeListener('resize', onResize);
                resolve(overridden);
            };

            const onResize = () => {
                const [w, h] = this.readSize(win);
                if (w === HOME_WIDTH && h === HOME_HEIGHT) {
                    return;
                }
                finish(true);
            };

            const timer = setTimeout(() => finish(false), ms);
            win.on('resize', onResize);
        });
    }

    /** 读取窗口当前尺寸；窗口已销毁时返回 [0, 0]。 */
    private readSize(win: BrowserWindow): [number, number] {
        if (win.isDestroyed()) {
            return [0, 0];
        }
        const [w, h] = win.getSize();
        return [w, h];
    }

    public windowState(): WindowState {
        const win = this.mainWindowRegistry.getMainWindow();
        if (win.isMaximized()) {
            return 'maximized';
        } else if (win.isMinimized()) {
            return 'minimized';
        } else if (win.isFullScreen()) {
            return 'fullscreen';
        } else {
            return 'normal';
        }
    }

    public setWindowButtonsVisible(visible: boolean): void {
        const win = this.tryGetWindow();
        if (!win) {
            return;
        }
        if (process.platform !== 'darwin') {
            return;
        }
        win.setWindowButtonVisibility(visible);
    }
}
