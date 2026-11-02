import Foundation

/// 字幕时间轴索引。
///
/// 与桌面端 `SrtTender` 同一套思路：按 10 秒分桶，缓存上次命中的下标，
/// 每句的有效范围延伸到下一句开头，句间空隙仍算上一句。
struct SubtitleIndex {
    /// 时间桶宽度。
    private static let bucketSeconds = 10.0

    private let lines: [SubtitleLine]
    private var buckets: [Int: [Int]] = [:]
    /// 上次命中的下标，连续推进时可直接复用。
    private var cachedIndex: Int?
    /// 没有命中任何一句时退回的下标。
    private var backupIndex = 0

    /// 建索引并预先分桶。
    ///
    /// - Parameter lines: 已按时间排序的字幕行。
    init(lines: [SubtitleLine]) {
        self.lines = lines
        for index in lines.indices {
            let low = floor(min(start(index), nextStart(index)) / Self.bucketSeconds)
            let high = floor(max(end(index), nextStart(index)) / Self.bucketSeconds)
            var bucket = Int(low)
            while Double(bucket) <= high {
                // 后写入的放前面：时间重叠时优先较晚的那一句。
                buckets[bucket, default: []].insert(index, at: 0)
                bucket += 1
            }
        }
    }

    /// 查找某个时间点对应的字幕下标。
    ///
    /// - Parameter time: 播放时间，单位秒。
    /// - Returns: 字幕下标；没有字幕时返回 -1。
    mutating func index(at time: Double) -> Int {
        guard !lines.isEmpty else { return -1 }

        if let cachedIndex, isCurrent(cachedIndex, at: time) {
            backupIndex = cachedIndex
            return cachedIndex
        }

        for index in buckets[Int(floor(time / Self.bucketSeconds))] ?? [] where isCurrent(index, at: time) {
            cachedIndex = index
            backupIndex = index
            return index
        }
        return backupIndex
    }

    /// 句子的起始时间，兼容 start/end 写反的数据。
    private func start(_ index: Int) -> Double {
        min(lines[index].start, lines[index].end)
    }

    /// 句子的结束时间，兼容 start/end 写反的数据。
    private func end(_ index: Int) -> Double {
        max(lines[index].start, lines[index].end)
    }

    /// 下一句的起始时间；最后一句取自身起始时间。
    private func nextStart(_ index: Int) -> Double {
        start(min(index + 1, lines.count - 1))
    }

    /// 判断某句在时间上是否覆盖当前播放位置。
    private func isCurrent(_ index: Int, at time: Double) -> Bool {
        let low = min(start(index), end(index), nextStart(index))
        let high = max(start(index), end(index), nextStart(index))
        return time >= low && time <= high
    }
}
