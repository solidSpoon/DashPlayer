/**
 * 跨进程传输的标签。
 */
export interface Tag {
    /** 标签数据库编号。 */
    id: number;
    /** 标签名称。 */
    name: string;
    /** UTC 创建时间。 */
    created_at: string;
    /** UTC 更新时间。 */
    updated_at: string;
}
