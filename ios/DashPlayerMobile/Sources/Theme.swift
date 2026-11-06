import SwiftUI

/// 外观偏好。默认跟随系统，比网页版的浅色/深色二选一更贴近 iOS 习惯。
enum ThemePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    /// UserDefaults 键，全 App 共用。
    static let storageKey = "dashplayer.appearance"

    var id: String { rawValue }

    /// 设置页展示的文案。
    var label: String {
        switch self {
        case .system: return "跟随系统"
        case .light: return "浅色"
        case .dark: return "深色"
        }
    }

    /// 传给 `preferredColorScheme` 的值；跟随系统时为 nil。
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}
