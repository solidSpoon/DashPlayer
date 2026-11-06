import SwiftUI

/// 播放页主体：画面、主字幕卡、字幕列表和悬浮的三键。
///
/// 布局按网页版的思路固定：画面高度由屏宽算出来（最多占 40% 屏高），主字幕卡
/// 固定高度，只有字幕列表吃剩下的空间。这样换句、翻译晚到都不会把画面挤小。
///
/// 这一页不要系统标题栏：返回和设置做成压在画面上的玻璃圆钮，把整条导航栏
/// 的高度让给内容。
struct WatchScreen: View {
    @StateObject private var model: WatchModel
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dismiss) private var dismiss

    @State private var settingsOpen = false
    @State private var showControls = false
    @State private var hideTask: Task<Void, Never>?

    /// 底部悬浮三键占的高度，列表和「回到当前」都按它让位。
    private let controlsInset: CGFloat = 116

    /// 玻璃条高度，撑起来才放得下大圆角。
    private static let barHeight: CGFloat = 88
    /// 玻璃条圆角，约为高度的四成，接近 Dock 的比例。
    private static let barCornerRadius: CGFloat = 38
    /// 条内图标大小。
    private static let iconSize: CGFloat = 26

    /// 用详情创建播放模型。
    ///
    /// - Parameters:
    ///   - detail: 播放详情。
    ///   - api: 服务客户端。
    init(detail: WatchDetail, api: APIClient) {
        _model = StateObject(wrappedValue: WatchModel(detail: detail, api: api))
    }

    var body: some View {
        ZStack(alignment: .top) {
            // 状态栏那条垫黑：整页还是跟随主题，只有顶部这一条变黑。
            Color.black.ignoresSafeArea(edges: .top)
            content
                .background(
                    Rectangle()
                        .fill(Color(.systemBackground))
                        .ignoresSafeArea(edges: .bottom)
                )
        }
        .ignoresSafeArea(edges: .bottom)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $settingsOpen) {
            WatchSettingsView(model: model)
        }
        .task {
            model.start()
        }
        .onDisappear {
            hideTask?.cancel()
            model.stop()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                model.saveNow()
            }
        }
        // 标题栏收起来后系统右滑返回也跟着没了，这里补一条贴左边的手势。
        .simultaneousGesture(
            DragGesture(minimumDistance: 20).onEnded { value in
                guard value.startLocation.x < 24, value.translation.width > 80,
                      abs(value.translation.height) < 80 else { return }
                dismiss()
            }
        )
    }

    /// 页面主体。
    private var content: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let videoHeight = min(size.width * aspect, size.height * 0.4)
            let cardHeight = max(104, min(146, size.height * 0.19))

            VStack(spacing: 0) {
                playerArea
                    .frame(height: videoHeight)
                SentenceCard(
                    line: model.currentLine,
                    translation: model.currentTranslation,
                    showEnglish: model.showEnglish,
                    showTranslation: model.showTranslation,
                    onWord: { word in
                        Self.tapFeedback()
                        model.lookup(word)
                    },
                    onBlankTap: { model.dismissDictionary() }
                )
                .frame(height: cardHeight)
                SubtitleListView(
                    lines: model.detail.subtitles,
                    currentIndex: model.currentIndex,
                    onSeek: { index in
                        Self.tapFeedback()
                        model.seek(toLine: index)
                    },
                    onInteract: { model.dismissDictionary() },
                    bottomInset: controlsInset
                )
            }
            .frame(width: size.width, height: size.height, alignment: .top)
            .overlay(alignment: .bottom) { controlBar }
        }
    }

    /// 顶部圆钮和底部进度条是否露出：暂停时常驻，播放时靠点画面唤出。
    private var chromeVisible: Bool {
        showControls || !model.isPlaying
    }

    /// 画面宽高比；纯音频用一块矮一些的占位。
    private var aspect: CGFloat {
        model.detail.isAudio ? 0.44 : 9.0 / 16.0
    }

    // MARK: - 画面

    /// 视频画面、顶部圆钮、查词条和播放控制条。
    private var playerArea: some View {
        ZStack {
            Color.black

            if model.detail.isAudio {
                audioPlaceholder
            } else {
                PlayerSurface(player: model.player)
            }

            if let error = model.playbackError {
                VStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 26, weight: .light))
                    Text(error)
                        .font(.callout)
                        .multilineTextAlignment(.center)
                }
                .foregroundStyle(.white.opacity(0.85))
                .padding(24)
            }

            VStack {
                if chromeVisible {
                    topChrome
                }
                Spacer(minLength: 0)
                if chromeVisible {
                    controlBarOverlay
                }
            }
        }
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
        .onTapGesture { toggleControls() }
        .overlay(alignment: .top) { dictionaryOverlay }
    }

    /// 顶部两个按钮：返回和播放设置。
    ///
    /// 和系统播放器一样，白图标直接压在画面顶部的渐变压暗上，不加圆形底。
    private var topChrome: some View {
        HStack(spacing: 0) {
            chromeButton(symbol: "chevron.left", label: "返回") {
                dismiss()
            }
            Spacer(minLength: 0)
            chromeButton(symbol: "gearshape", label: "播放设置") {
                settingsOpen = true
            }
        }
        .padding(.horizontal, 14)
    }

    /// 画面上的液态玻璃按钮：标准 44 点大小，不压深色底。
    ///
    /// - Parameters:
    ///   - symbol: SF Symbol 名字。
    ///   - label: 无障碍文案。
    ///   - action: 点击回调。
    private func chromeButton(symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .modifier(GlassCircle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    /// 纯音频的占位画面。
    private var audioPlaceholder: some View {
        VStack(spacing: 12) {
            Image(systemName: "waveform")
                .font(.system(size: 40, weight: .light))
            Text(model.detail.title)
                .font(.headline)
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
        .foregroundStyle(.white.opacity(0.85))
        .padding(.horizontal, 28)
    }

    // MARK: - 播放控制

    /// 画面底部的播放控制：播放键、细进度条、两端时间。
    ///
    /// 按系统播放器的观感画：细轨道 + 拖动时放大的小圆点，配底部渐变压暗，
    /// 不用滑块那种大白点。
    private var controlBarOverlay: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            HStack(spacing: 14) {
                Button {
                    model.dismissDictionary()
                    model.togglePlayPause()
                } label: {
                    Image(systemName: model.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(model.isPlaying ? "暂停" : "播放")

                PlaybackScrubber(
                    progress: Binding(
                        get: { model.duration > 0 ? min(1, max(0, model.currentTime / model.duration)) : 0 },
                        set: { model.scrub(to: $0 * model.duration) }
                    ),
                    onEditingChanged: { editing in
                        model.isScrubbing = editing
                        if !editing {
                            model.saveNow()
                        }
                    }
                )

                Text(Format.clock(model.currentTime))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white)
                Text(Format.clock(model.duration))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
            .padding(.top, 24)
            .background(
                LinearGradient(
                    colors: [.black.opacity(0), .black.opacity(0.6)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .allowsHitTesting(true)
    }

    /// 点画面切换控制条；播放中 3.5 秒后自动收起。
    private func toggleControls() {
        model.dismissDictionary()
        showControls.toggle()
        hideTask?.cancel()
        guard showControls, model.isPlaying else { return }
        hideTask = Task {
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.2)) {
                showControls = false
            }
        }
    }

    // MARK: - 悬浮三键

    /// 压在字幕列表上的一条玻璃条，三个图标等宽排在里面。
    ///
    /// 做成一条而不是三个独立按钮，是为了拿到 Dock 那种大圆角：圆角半径不能超过
    /// 高度的一半，单颗按钮只有 48 高，半径最多 24，看起来就不够大。
    private var controlBar: some View {
        barBackground {
            HStack(spacing: 0) {
                stepButton(symbol: "backward.end.fill", label: "上一句") {
                    Self.tapFeedback()
                    model.stepLine(-1)
                }
                replayButton
                stepButton(symbol: "forward.end.fill", label: "下一句") {
                    Self.tapFeedback()
                    model.stepLine(1)
                }
            }
            .frame(height: Self.barHeight)
            .padding(.horizontal, 10)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 18)
    }

    /// 玻璃条底。系统低于 iOS 26 时退回毛玻璃材质。
    ///
    /// - Parameter content: 条里的内容。
    @ViewBuilder
    private func barBackground<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Self.barCornerRadius, style: .continuous)
        if #available(iOS 26.0, *) {
            content().glassEffect(.regular.interactive(), in: shape)
        } else {
            content().background(.regularMaterial, in: shape)
        }
    }

    /// 中间的重播按钮，图标用强调色区分。
    private var replayButton: some View {
        Button {
            Self.tapFeedback()
            model.replayCurrent()
        } label: {
            Image(systemName: "arrow.counterclockwise")
                .font(.system(size: Self.iconSize, weight: .semibold))
                .foregroundStyle(Color.accentColor)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("重播这句")
        .disabled(model.detail.subtitles.isEmpty)
    }

    /// 左右两个跳句按钮。
    private func stepButton(symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: Self.iconSize, weight: .semibold))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .disabled(model.detail.subtitles.isEmpty)
    }

    /// 轻震动反馈，和网页版点按的手感对齐。
    private static func tapFeedback() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    // MARK: - 查词条

    /// 顶部悬浮的查词条。
    @ViewBuilder
    private var dictionaryOverlay: some View {
        if let dictionary = model.dictionary {
            DictionaryBar(state: dictionary) {
                model.dismissDictionary()
            }
            .transition(.opacity)
        }
    }
}

/// 圆形液态玻璃底；系统低于 iOS 26 时退回半透明黑底。
private struct GlassCircle: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(), in: Circle())
        } else {
            content.background(.black.opacity(0.35), in: Circle())
        }
    }
}
