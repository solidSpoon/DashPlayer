/**
 * 首次使用引导（onboarding）的当前内容版本号。
 *
 * 语义：引导页内容或步骤发生变化、且希望老用户再看一次时，手动 +1。
 * 不要使用应用版本号做比较基准：patch 版本每次发版都会变，会导致每次升级都重新弹引导。
 */
export const ONBOARDING_VERSION = 1;

/** 引导完成标记在系统配置表（dp_sys_conf）中的存储键。 */
export const ONBOARDING_COMPLETED_VERSION_KEY = 'onboarding.completedVersion';

/** 引导状态查询结果。 */
export interface OnboardingStatusVO {
    /** 引导内容的当前版本号，与 ONBOARDING_VERSION 一致。 */
    currentVersion: number;
    /** 用户已完成引导的版本号；从未完成过时为 0。 */
    completedVersion: number;
    /** 是否需要展示引导（completedVersion < currentVersion）。 */
    shouldShow: boolean;
}
