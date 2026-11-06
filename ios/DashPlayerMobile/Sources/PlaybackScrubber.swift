import SwiftUI

/// 播放进度条。
///
/// 按系统播放器的观感画：3pt 细轨道，未播放部分半透明，拖动时圆点放大。
/// 系统 `Slider` 的滑块太大，放在视频上不像播放器。
struct PlaybackScrubber: View {
    /// 播放进度，0 到 1。
    @Binding var progress: Double
    /// 开始 / 结束拖动时回调。
    let onEditingChanged: (Bool) -> Void

    @State private var dragging = false

    var body: some View {
        GeometryReader { proxy in
            let width = max(proxy.size.width, 1)
            let knob: CGFloat = dragging ? 16 : 9

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(.white.opacity(0.28))
                    .frame(height: 3)
                Capsule()
                    .fill(.white)
                    .frame(width: max(0, min(width, width * progress)), height: 3)
                Circle()
                    .fill(.white)
                    .frame(width: knob, height: knob)
                    .offset(x: max(0, min(width, width * progress)) - knob / 2)
            }
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if !dragging {
                            dragging = true
                            onEditingChanged(true)
                        }
                        progress = min(1, max(0, value.location.x / width))
                    }
                    .onEnded { _ in
                        dragging = false
                        onEditingChanged(false)
                    }
            )
        }
        .frame(height: 28)
    }
}
