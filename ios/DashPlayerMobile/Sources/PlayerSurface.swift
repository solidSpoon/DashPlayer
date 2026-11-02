import AVFoundation
import SwiftUI

/// 只负责显示画面的 AVPlayerLayer 容器。
///
/// 播放控制由 SwiftUI 自己画：AVKit 的 `AVPlayerViewController` 内嵌在这种
/// 半屏布局里会隐藏状态栏、控制条也不出来，所以不用它。
struct PlayerSurface: UIViewRepresentable {
    /// 要显示画面的播放器。
    let player: AVPlayer

    func makeUIView(context: Context) -> PlayerView {
        let view = PlayerView()
        view.backgroundColor = .black
        view.playerLayer.videoGravity = .resizeAspect
        view.playerLayer.player = player
        return view
    }

    func updateUIView(_ uiView: PlayerView, context: Context) {
        if uiView.playerLayer.player !== player {
            uiView.playerLayer.player = player
        }
    }

    /// 承载 AVPlayerLayer 的 UIView。
    final class PlayerView: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }

        /// 视图的图层，实际类型是 AVPlayerLayer。
        var playerLayer: AVPlayerLayer {
            // layerClass 已经固定成 AVPlayerLayer，这里不会失败。
            layer as! AVPlayerLayer
        }
    }
}
