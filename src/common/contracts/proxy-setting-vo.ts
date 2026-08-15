/**
 * 代理设置详情 VO。
 */
export interface ProxySettingDetailVO {
    /** 代理模式：system 跟随系统 / custom 自定义 / none 不使用。 */
    mode: 'system' | 'custom' | 'none';
    /** 自定义代理地址，仅在 custom 模式下使用。 */
    url: string;
    /** 代理绕过规则，仅在 custom 模式下使用。 */
    bypassRules: string;
}

/**
 * 代理设置保存值对象。
 *
 * 当前与详情结构一致，单独导出是为了保持接口语义清晰。
 */
export interface ProxySettingSaveVO {
    /** 代理模式：system 跟随系统 / custom 自定义 / none 不使用。 */
    mode: ProxySettingDetailVO['mode'];
    /** 自定义代理地址，仅在 custom 模式下使用。 */
    url: string;
    /** 代理绕过规则，仅在 custom 模式下使用。 */
    bypassRules: string;
}
