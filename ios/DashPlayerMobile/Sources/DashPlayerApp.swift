import AVFoundation
import SwiftUI

/// 应用入口。
@main
struct DashPlayerMobileApp: App {
    @StateObject private var server = ServerStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(server)
                .task {
                    AudioSession.activate()
                }
        }
    }
}

/// 根据是否已经连上服务决定进入列表页还是地址填写页。
struct RootView: View {
    @EnvironmentObject private var server: ServerStore
    @AppStorage(ThemePreference.storageKey) private var themeRaw = ThemePreference.system.rawValue

    var body: some View {
        Group {
            if let baseURL = server.baseURL {
                RecentListView(api: APIClient(baseURL: baseURL))
                    .id(baseURL)
            } else {
                ServerSetupView()
            }
        }
        .preferredColorScheme(ThemePreference(rawValue: themeRaw)?.colorScheme)
    }
}

/// 后台播放所需的音频会话。
enum AudioSession {
    /// 打开播放类别，让视频在锁屏和切后台后继续出声。
    static func activate() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .moviePlayback)
        try? session.setActive(true)
    }
}
