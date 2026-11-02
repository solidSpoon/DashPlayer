import SwiftUI

/// 主字幕区：当前句放大居中，单词可点，下面一行译文。
///
/// 不做卡片、不加灰底，只用一条细分隔线和下面的列表分开；整块高度固定，
/// 内容在块内垂直居中，换句时不会改变布局。
struct SentenceCard: View {
    /// 当前句；没有字幕时为 nil。
    let line: SubtitleLine?
    /// 当前句译文。
    let translation: String
    /// 是否显示英文。
    let showEnglish: Bool
    /// 是否显示译文。
    let showTranslation: Bool
    /// 点单词查词。
    let onWord: (String) -> Void
    /// 点空白处，用来收查词条。
    let onBlankTap: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            if let line, showEnglish, !line.en.isEmpty {
                WordText(
                    text: line.en,
                    fontSize: Self.englishSize(for: line.en),
                    weight: .medium,
                    onWord: onWord,
                    onBlankTap: onBlankTap
                )
                .frame(maxWidth: .infinity)
            } else if line == nil {
                Text("这个视频没有匹配到字幕。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if showTranslation, !translation.isEmpty {
                Text(translation)
                    .font(.system(size: 16))
                    .lineSpacing(3)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.primary.opacity(0.72))
                    .frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.secondarySystemBackground))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color(.separator))
                .frame(height: 0.5)
        }
        .contentShape(Rectangle())
    }

    /// 英文按句子长度分档，长句自动收小，避免在固定高度里挤出边界。
    ///
    /// - Parameter text: 句子原文。
    /// - Returns: 该用的字号。
    private static func englishSize(for text: String) -> CGFloat {
        switch text.count {
        case ...60: return 22
        case ...110: return 20
        default: return 18
        }
    }
}
