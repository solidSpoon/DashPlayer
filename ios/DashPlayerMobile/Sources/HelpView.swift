import SwiftUI

/// 使用说明。把网页版的示意图换成了 iOS 上的操作清单。
struct HelpView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    section(
                        title: "播放页",
                        symbol: "hand.tap",
                        lines: [
                            "点主字幕里的单词查词，再点别处收起。",
                            "点下面列表里的句子，从这一句开始播。",
                            "底部三键：上一句、重播这句、下一句。",
                            "点画面唤出进度条，可以拖动。"
                        ]
                    )
                    section(
                        title: "播放设置",
                        symbol: "slider.horizontal.3",
                        lines: [
                            "右上角齿轮里可以关掉英文或翻译。",
                            "循环当前句适合反复听一句。",
                            "每句自动暂停，方便跟读。",
                            "倍速 0.75× 到 1.5×。"
                        ]
                    )
                    section(
                        title: "放不了某些视频",
                        symbol: "exclamationmark.triangle",
                        lines: [
                            "MKV、AVI 这类容器 iOS 解不了。",
                            "在电脑上用「播放修复」生成 MP4 再试。"
                        ]
                    )
                    section(
                        title: "连不上电脑",
                        symbol: "wifi",
                        lines: [
                            "手机和电脑要连同一个 Wi-Fi。",
                            "电脑上要打开「手机访问」开关。",
                            "地址里的端口和电脑上显示的一致。"
                        ]
                    )
                }
                .padding(20)
            }
            .navigationTitle("使用说明")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }

    /// 一段带图标的说明。
    private func section(title: String, symbol: String, lines: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: symbol)
                .font(.headline)
            ForEach(lines, id: \.self) { line in
                Text(line)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
