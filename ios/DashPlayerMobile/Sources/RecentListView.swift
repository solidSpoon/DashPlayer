import SwiftUI

/// 最近播放列表页。
struct RecentListView: View {
    /// 当前连接的服务客户端。
    let api: APIClient

    @State private var items: [RecentItem] = []
    @State private var phase: Phase = .loading
    @State private var loadedOnce = false
    @State private var settingsOpen = false
    @State private var helpOpen = false

    /// 列表的三种状态。
    private enum Phase: Equatable {
        case loading
        case loaded
        case failed(String)
    }

    var body: some View {
        NavigationStack {
            content
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: RecentItem.self) { item in
                    WatchView(item: item, api: api)
                }
                .sheet(isPresented: $settingsOpen) {
                    AppSettingsView()
                }
                .sheet(isPresented: $helpOpen) {
                    HelpView()
                }
        }
        .task {
            await load()
        }
        .onAppear {
            // 从播放页回来时进度变了，静默刷新一次列表。
            if loadedOnce {
                Task { await load(silent: true) }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .loading:
            ProgressView("正在读取…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            ContentUnavailableView {
                Label("加载失败", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("重试") {
                    Task { await load() }
                }
                .buttonStyle(.borderedProminent)
            }
        case .loaded where items.isEmpty:
            ContentUnavailableView(
                "还没有播放记录",
                systemImage: "film.stack",
                description: Text("先在电脑上的 DashPlayer 里打开一个视频，手机上就能接着看。")
            )
        case .loaded:
            List {
                ForEach(items) { item in
                    NavigationLink(value: item) {
                        RecentRow(item: item, api: api)
                    }
                }
            }
            .listStyle(.plain)
            .modifier(SoftTopEdge())
            .safeAreaInset(edge: .top, spacing: 0) { header }
            .refreshable {
                await load(silent: true)
            }
        }
    }

    /// 顶部标题区，按相册的做法：标题和副标题在左，玻璃按钮在右。
    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("最近播放")
                .font(.largeTitle.bold())
            Spacer(minLength: 0)
            HStack(spacing: 10) {
                glassIcon("questionmark", label: "使用说明") { helpOpen = true }
                glassIcon("gearshape", label: "设置") { settingsOpen = true }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 18)
        .background {
            // 渐变磨玻璃：往上盖住状态栏，往下多铺一截专门留给渐变，
            // 这样淡出能拉得很长，不会在标题下面硬切一刀。
            Rectangle()
                .fill(.ultraThinMaterial)
                .padding(.bottom, -64)
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .black, location: 0),
                            .init(color: .black, location: 0.62),
                            .init(color: .clear, location: 1),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .ignoresSafeArea(edges: .top)
        }
    }

    /// 圆形玻璃图标按钮。
    ///
    /// - Parameters:
    ///   - symbol: SF Symbol 名字。
    ///   - label: 无障碍文案。
    ///   - action: 点击回调。
    private func glassIcon(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 40, height: 40)
                .modifier(CircleGlass())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    /// 拉取最近播放列表。
    ///
    /// - Parameter silent: 静默刷新时不显示加载态，失败也保留旧数据。
    private func load(silent: Bool = false) async {
        if !silent {
            phase = .loading
        }
        do {
            let next = try await api.recent()
            items = next
            phase = .loaded
            loadedOnce = true
        } catch {
            let message = (error as? APIError)?.message ?? error.localizedDescription
            if silent && loadedOnce {
                return
            }
            phase = .failed(message)
        }
    }
}

/// 列表里的一行。
private struct RecentRow: View {
    let item: RecentItem
    let api: APIClient

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.headline)
                    .lineLimit(2)
                if !item.subtitle.isEmpty {
                    Text(item.subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                HStack(spacing: 6) {
                    Text(Format.relative(item.updatedAt))
                    if item.position > 0 {
                        Text("·")
                        Text(item.isAudio ? "听到 \(Format.clock(item.position))" : "看到 \(Format.clock(item.position))")
                    }
                }
                .font(.caption)
                .foregroundStyle(.tertiary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }

    /// 列表大图；音频条目和加载失败的条目用占位图标。
    @ViewBuilder
    private var thumbnail: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(.tertiarySystemFill))
            if item.isAudio {
                Image(systemName: "waveform")
                    .font(.system(size: 22))
                    .foregroundStyle(.secondary)
            } else if let url = api.absoluteURL(item.thumbnailUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ProgressView()
                }
            } else {
                Image(systemName: "film")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 104, height: 66)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

/// 列表页顶部按钮的圆形玻璃底。
private struct CircleGlass: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(), in: Circle())
        } else {
            content.background(.regularMaterial, in: Circle())
        }
    }
}

/// 列表顶部的柔和边缘：内容滚到表头下面时按系统的方式虚化。
private struct SoftTopEdge: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.scrollEdgeEffectStyle(.soft, for: .top)
        } else {
            content
        }
    }
}
