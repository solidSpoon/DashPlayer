import Nedb from 'nedb';
import BaseCacheEntity from './BaseCacheEntity';
import { BaseCacheConfig } from './CacheConfig';

/**
 * 公共缓存类
 */
export default class BaseCache<E extends BaseCacheEntity<E>> {
    private db: Nedb<E>;

    constructor(config: BaseCacheConfig) {
        this.db = new Nedb<E>({
            filename: config.filename,
            autoload: true,
        });
    }

    /**
     * 插入或新增
     * @param entity 实体类
     * @return 影响行数
     */
    public insertOrUpdate(entity: E): Promise<number> {
        if (entity === undefined) {
            throw new Error('can not insert or update undefined');
        }
        const query = {
            hash: entity.hash,
        };
        const options: Nedb.UpdateOptions = {
            upsert: true,
            multi: true,
        };
        return new Promise((resolve, reject) => {
            this.db.update(query, entity, options, (error, num) => {
                if (error !== null) {
                    console.log(error);
                    reject(error);
                } else {
                    console.log(`insert or update ${entity}, count: ${num}`);
                    resolve(num);
                }
            });
        });
    }

    /**
     * 根据 hash 删除
     * @param entity 实体类
     * @return 影响行数
     */
    public delete(entity: E): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.remove(
                {
                    hash: entity.hash,
                },
                { multi: true },
                (error, count) => {
                    if (error !== null) {
                        console.log(error);
                        reject(error);
                    } else {
                        console.log(`delete ${entity}, count: ${count}`);
                        resolve(count);
                    }
                }
            );
        });
    }

    /**
     * 根据 hash 批量删除
     * @param entities 实体类数组
     * @return 影响行数
     */
    public deleteBatch(entities: E[]): Promise<number> {
        if (entities === undefined || entities.length === 0) {
            throw new Error(`can not batch delete ${entities}`);
        }
        const query = {
            hash: {
                $in: entities.map((item) => item.hash),
            },
        };
        const option: Nedb.RemoveOptions = {
            multi: true,
        };
        return new Promise((resolve, reject) => {
            this.db.remove(query, option, (err, count) => {
                if (err !== null) {
                    console.log(err);
                    reject(err);
                } else {
                    console.log(`batch delete ${entities}, count: ${count}`);
                    resolve(count);
                }
            });
        });
    }

    /**
     * 查询 hash 对应的缓存
     * @param entity 查询条件 entity
     * @return 查询结果
     */
    public loadCache(entity: E): Promise<E[]> {
        const query = {
            hash: entity.hash,
        };
        return new Promise<E[]>((resolve, reject) => {
            this.db.find(query, (err: Error | null, docs: E[]) => {
                if (err !== null) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(docs);
                }
            });
        });
    }

    /**
     * 批量根据 hash 查询缓存
     * @param entities 查询条件
     * @return 查询结果
     */
    public loadBatch(entities: E[]): Promise<E[]> {
        if (entities === undefined || entities.length === 0) {
            throw new Error(`can not batch query ${entities}`);
        }
        const query = {
            hash: {
                $in: entities.map((entity) => entity.hash),
            },
        };
        return new Promise<E[]>((resolve, reject) => {
            this.db.find(
                query,
                (err: null | Error, docs: E[] | PromiseLike<E[]>) => {
                    if (err !== null) {
                        console.log(err);
                        reject(err);
                    } else {
                        console.log(`batch load ${entities}`);
                        resolve(docs);
                    }
                }
            );
        });
    }

    /**
     * 批量插入
     * @param entities 实体类数组
     * @return 插入后的实体类
     */
    public insertBatch(entities: E[]): Promise<E[]> {
        if (entities === undefined || entities.length === 0) {
            throw new Error(`can not batch insert: ${entities}`);
        }
        return new Promise((resolve, reject) =>
            this.db.insert(entities, (err, documents) => {
                if (err !== null) {
                    console.log(err);
                    reject(err);
                } else {
                    console.log('insert batch:', entities);
                    resolve(documents);
                }
            })
        );
    }
}
