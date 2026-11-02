import SwiftUI

/// 字幕列表的滚动状态。
///
/// 用引用类型存几何信息，滚动过程中更新它不会触发 SwiftUI 重绘；只有
/// “是否显示回到当前”这种需要上屏的结论才走状态。
final class SubtitleListGeometry {
    /// 列表框在命名坐标系里的大小，原点固定为 (0, 0)。
    var viewport: CGRect = .zero
    /// 当前句所在行的位置；行没被渲染时为 nil。
    var currentFrame: CGRect?
    /// 判定“完整可见”时留的边距，和网页版一致。
    var margin: CGFloat = 8

    /// 当前句是否整行落在可视区内。
    var isCurrentVisible: Bool {
        guard let currentFrame, viewport.height > 0 else { return false }
        return currentFrame.minY >= viewport.minY + margin && currentFrame.maxY <= viewport.maxY - margin
    }
}

/// 当前句所在行的位置，只由当前句所在行上报。
struct CurrentRowFrameKey: PreferenceKey {
    static var defaultValue: CGRect?

    static func reduce(value: inout CGRect?, nextValue: () -> CGRect?) {
        if let next = nextValue() {
            value = next
        }
    }
}

/// 字幕列表。
///
/// 跟随规则照搬手机网页：当前句完整可见就不动，看不见才滚，滚到当前句贴住
/// 列表顶部；用户手动翻动后，等手停下来再判断——当前句回到视野就恢复跟随，
/// 没回来才显示「回到当前」。
struct SubtitleListView: View {
    /// 全部字幕行。
    let lines: [SubtitleLine]
    /// 当前播放句的下标。
    let currentIndex: Int
    /// 点某一行时跳到该句。
    let onSeek: (Int) -> Void
    /// 用户碰列表（点行、开始拖动）时回调，用来收查词条。
    var onInteract: () -> Void = {}
    /// 底部被悬浮按钮盖住的高度：内容要留白，可见性判断也要扣掉。
    var bottomInset: CGFloat = 0

    @State private var geometry = SubtitleListGeometry()
    @State private var browsing = false
    @State private var showFollow = false
    @State private var settleTask: Task<Void, Never>?

    /// 命名坐标系，行位置相对列表框计算。
    private let space = "subtitle-list"
    /// 用户停下滚动多久之后判定一次（毫秒转秒）。
    private let settleDelay: TimeInterval = 0.4

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(lines.indices, id: \.self) { index in
                        row(index)
                            .id(index)
                    }
                }
                .padding(.top, 6)
                .padding(.bottom, 6 + bottomInset)
                .padding(.horizontal, 10)
            }
            .coordinateSpace(name: space)
            .scrollIndicators(.hidden)
            .background(viewportReader)
            .onPreferenceChange(CurrentRowFrameKey.self) { frame in
                geometry.currentFrame = frame
            }
            .simultaneousGesture(
                DragGesture(minimumDistance: 8).onChanged { _ in
                    onInteract()
                    beginBrowsing()
                }
            )
            .onChange(of: currentIndex) { _, index in
                handleIndexChange(index, proxy: proxy)
            }
            .overlay(alignment: .bottom) {
                if showFollow {
                    followButton(proxy)
                }
            }
        }
        .onDisappear {
            settleTask?.cancel()
            settleTask = nil
        }
    }

    /// 一行字幕；只有当前句上报位置。
    private func row(_ index: Int) -> some View {
        let line = lines[index]
        let active = index == currentIndex
        return SubtitleRowText(text: line.en, active: active) {
            onInteract()
            resetFollow()
            onSeek(index)
        }
        .equatable()
        .background(alignment: .topLeading) {
            if active {
                GeometryReader { proxy in
                    Color.clear.preference(
                        key: CurrentRowFrameKey.self,
                        value: proxy.frame(in: .named(space))
                    )
                }
            }
        }
        .id(index)
    }

    /// 记录列表框大小，供可见性判断使用。
    private var viewportReader: some View {
        GeometryReader { proxy in
            Color.clear
                .onAppear {
                    updateViewport(proxy.size)
                }
                .onChange(of: proxy.size) { _, size in
                    updateViewport(size)
                }
        }
    }

    /// 记录可视区高度，扣掉底部悬浮按钮占的部分。
    ///
    /// - Parameter size: 列表框尺寸。
    private func updateViewport(_ size: CGSize) {
        geometry.viewport = CGRect(
            origin: .zero,
            size: CGSize(width: size.width, height: max(0, size.height - bottomInset))
        )
    }

    /// 「回到当前」按钮。
    private func followButton(_ proxy: ScrollViewProxy) -> some View {
        Button {
            resetFollow()
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            scrollToCurrent(proxy, animated: false)
        } label: {
            Label("回到当前", systemImage: "arrow.down.to.line")
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .modifier(FollowGlass())
        }
        .buttonStyle(.plain)
        .padding(.bottom, bottomInset + 6)
        // 出现：从下方 dock 的位置往上冒、同时放大，像被那条玻璃吐出来；
        // 收起：缩回去并淡出。
        .transition(
            .asymmetric(
                insertion: .offset(y: 54)
                    .combined(with: .scale(scale: 0.7, anchor: .bottom))
                    .combined(with: .opacity),
                removal: .offset(y: 38)
                    .combined(with: .opacity)
            )
        )
    }

    /// 当前句变化：跟随时确保它可见，翻动时交给停顿判定。
    private func handleIndexChange(_ index: Int, proxy: ScrollViewProxy) {
        guard index >= 0 else { return }
        if browsing {
            // 停顿判定已经跑完且当前句回到视野，就恢复跟随。
            if settleTask == nil && geometry.isCurrentVisible {
                browsing = false
                showFollow = false
            }
            return
        }
        showFollow = false
        ensureCurrentVisible(proxy, index: index)
    }

    /// 当前句看不见时才滚动，滚到贴住列表顶部。
    private func ensureCurrentVisible(_ proxy: ScrollViewProxy, index: Int) {
        if geometry.isCurrentVisible {
            return
        }
        proxy.scrollTo(index, anchor: .top)
    }

    /// 滚回当前句，用于「回到当前」。
    private func scrollToCurrent(_ proxy: ScrollViewProxy, animated: Bool) {
        guard currentIndex >= 0 else { return }
        if animated {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(currentIndex, anchor: .top)
            }
        } else {
            proxy.scrollTo(currentIndex, anchor: .top)
        }
    }

    /// 用户开始翻动：进入浏览态，并起一个停顿计时。
    private func beginBrowsing() {
        browsing = true
        settleTask?.cancel()
        settleTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(settleDelay * 1_000_000_000))
            guard !Task.isCancelled else { return }
            settleTask = nil
            guard browsing else { return }
            if geometry.isCurrentVisible {
                browsing = false
                withAnimation(.easeOut(duration: 0.18)) {
                    showFollow = false
                }
            } else {
                withAnimation(.spring(response: 0.32, dampingFraction: 0.68)) {
                    showFollow = true
                }
            }
        }
    }

    /// 回到跟随态：清掉计时器和按钮。
    private func resetFollow() {
        settleTask?.cancel()
        settleTask = nil
        browsing = false
        withAnimation(.easeOut(duration: 0.18)) {
            showFollow = false
        }
    }
}

/// 「回到当前」的液态玻璃底。
///
/// iOS 26 上用 `materialize`，玻璃从无到有地凝出来；低版本退回毛玻璃胶囊。
private struct FollowGlass: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content
                .glassEffect(.regular.interactive(), in: Capsule())
                .glassEffectTransition(.materialize)
        } else {
            content.background(.regularMaterial, in: Capsule())
        }
    }
}

/// 列表里的一行文字。
///
/// 单独抽成 `Equatable` 视图：切句时只有前后两行的 `active` 变化，其余行直接跳过
/// 重算，长字幕（几千行）下滚动和跟句都不会被整表重绘拖慢。
private struct SubtitleRowText: View, Equatable {
    /// 该行字幕原文。
    let text: String
    /// 是否是当前句。
    let active: Bool
    /// 点击回调；不参与相等比较。
    let onTap: () -> Void

    static func == (lhs: SubtitleRowText, rhs: SubtitleRowText) -> Bool {
        lhs.text == rhs.text && lhs.active == rhs.active
    }

    var body: some View {
        Button(action: onTap) {
            // 当前句只换颜色加下划线，不动字重也不加底色，行高保持恒定。
            Text(text)
                .font(.system(size: 16))
                .foregroundStyle(active ? Color.accentColor : Color.primary)
                .underline(active, color: Color.accentColor.opacity(0.6))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }
}
