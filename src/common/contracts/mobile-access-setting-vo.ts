/**
 * 手机访问设置详情。
 *
 * 该设置只在主进程生效：开启后会在指定端口监听 HTTP 服务，
 * 供同一局域网或通过异地组网工具访问的手机打开手机版页面。
 */
export interface MobileAccessSettingDetailVO {
    /** 用户是否开启手机访问。 */
    enabled: boolean;
    /** 监听端口；配置非法时为 0。 */
    port: number;
    /** HTTP 服务当前是否正在监听。 */
    running: boolean;
    /** 可用的局域网访问地址，形如 http://192.168.1.2:8765。 */
    lanUrls: string[];
    /** 最近一次启动失败的原因；没有失败时为 null。 */
    lastError: string | null;
}

/**
 * 手机访问设置保存值。
 */
export interface MobileAccessSettingSaveVO {
    /** 是否开启手机访问。 */
    enabled: boolean;
    /** 监听端口，取值 1-65535。 */
    port: number;
}
