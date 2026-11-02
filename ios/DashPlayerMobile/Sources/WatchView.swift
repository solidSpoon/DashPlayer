import SwiftUI

/// 播放页外壳：先拉详情，成功后挂播放器。
struct WatchView: View {
    /// 列表里的条目。
    let item: RecentItem
    /// 服务客户端。
    let api: APIClient

    @State private var detail: WatchDetail?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let detail {
                WatchScreen(detail: detail, api: api)
            } else if let errorMessage {
                ContentUnavailableView {
                    Label("打不开这个视频", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(errorMessage)
                }
            } else {
                ProgressView("正在加载…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(detail?.title ?? item.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard detail == nil else { return }
            do {
                detail = try await api.watchDetail(id: item.id)
            } catch {
                errorMessage = (error as? APIError)?.message ?? error.localizedDescription
            }
        }
    }
}
