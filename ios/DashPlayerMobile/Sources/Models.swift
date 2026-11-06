import Foundation

/// 最近播放条目，对应桌面端 `/api/recent` 返回的一项。
struct RecentItem: Codable, Identifiable, Hashable {
    /// 观看记录 ID，播放页用它拉取详情。
    let id: String
    /// 主标题：普通视频取文件名，目录记录取目录名。
    let title: String
    /// 副标题：普通视频取所在目录名。
    let subtitle: String
    /// 是否为目录集合记录。
    let isFolder: Bool
    /// 是否为纯音频。
    let isAudio: Bool
    /// 最近播放时间。
    let updatedAt: Date
    /// 上次播放到的位置，单位秒。
    let position: Double
    /// 列表大图地址，相对路径。
    let thumbnailUrl: String
}

/// 一条字幕。时间已由桌面端应用过用户的时间轴调整。
struct SubtitleLine: Codable, Hashable {
    /// 开始时间，单位秒。
    let start: Double
    /// 结束时间，单位秒。
    let end: Double
    /// 英文字幕原文。
    let en: String
    /// 字幕文件自带的中文；缺失时为空字符串。
    let zh: String
}

/// 播放详情，对应 `/api/videos/{id}`。
struct WatchDetail: Codable {
    /// 观看记录 ID。
    let id: String
    /// 主标题。
    let title: String
    /// 副标题。
    let subtitle: String
    /// 是否为纯音频。
    let isAudio: Bool
    /// 视频流地址，相对路径，支持 Range 请求。
    let streamUrl: String
    /// 上次播放位置，单位秒。
    let currentPosition: Double
    /// 字幕行；没有匹配到字幕时为空数组。
    let subtitles: [SubtitleLine]
    /// 字幕与视频疑似不匹配，用于页面提示。
    let subtitleMismatchSuspected: Bool
}

/// 词典释义项。例句等字段用不到，解码时忽略。
struct DictionaryDefinition: Codable {
    /// 词性，如 noun / verb，未知时为空字符串。
    let partOfSpeech: String
    /// 中文释义。
    let meaning: String
}

/// 单词卡。词库元信息字段用不到，解码时忽略。
struct DictionaryEntry: Codable {
    /// 查询词。
    let word: String
    /// 音标，未知时为空字符串。
    let phonetic: String
    /// 释义列表。
    let definitions: [DictionaryDefinition]
}
