declare module 'lru-cache' {
  class LRUCache<K, V> {
    constructor(options?: {
      max?: number;
      maxSize?: number;
      ttl?: number;
      sizeCalculation?: (value: V, key: K) => number;
    });
    get(key: K): V | undefined;
    set(key: K, value: V): this;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    size: number;
  }
  export = LRUCache;
}