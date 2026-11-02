import Foundation

/// 时间与文本格式化工具。
enum Format {
    /// 把秒数格式化为 `m:ss` 或 `h:mm:ss`。
    ///
    /// - Parameter seconds: 秒数，负数按 0 处理。
    static func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.isFinite ? seconds : 0))
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let rest = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, rest)
        }
        return String(format: "%d:%02d", minutes, rest)
    }

    /// 把日期格式化为「刚刚 / 今天 10:20 / 昨天 10:20 / 3 天前 / 10 月 2 日」。
    ///
    /// - Parameter date: 目标日期。
    static func relative(_ date: Date) -> String {
        let now = Date()
        let interval = now.timeIntervalSince(date)
        if interval < 60 {
            return "刚刚"
        }
        if interval < 3600 {
            return "\(Int(interval / 60)) 分钟前"
        }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "今天 \(dayTime(date))"
        }
        if calendar.isDateInYesterday(date) {
            return "昨天 \(dayTime(date))"
        }
        if interval < 7 * 24 * 3600 {
            return "\(Int(interval / 86_400)) 天前"
        }
        let components = calendar.dateComponents([.month, .day], from: date)
        return "\(components.month ?? 1) 月 \(components.day ?? 1) 日"
    }

    /// 格式化时分，补零到两位。
    private static func dayTime(_ date: Date) -> String {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", components.hour ?? 0, components.minute ?? 0)
    }
}
