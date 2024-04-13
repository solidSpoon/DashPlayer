import Controller from "@/backend/interfaces/controller";
import registerRoute from "@/common/api/register";

export default class SystemController implements Controller {
    public async isWindows() {
        return process.platform === 'win32';
    }

    public registerRoutes(): void {
        registerRoute('system/is-windows', this.isWindows);
    }
}
