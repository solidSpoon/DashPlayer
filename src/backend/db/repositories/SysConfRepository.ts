export default interface SysConfRepository {
    getValue(key: string): Promise<string | null>;
    setValue(key: string, value: string): Promise<void>;
}

