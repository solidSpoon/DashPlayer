import SwiftUI
import UIKit

/// 一段英文，单词可以点。
///
/// 用 UITextView 是为了拿到系统算好的排版（换行、字距、断行）。点击由自己的
/// 手势按字符位置命中，系统选择、编辑和长按菜单全部关掉——否则点单词会弹出
/// “拷贝 / 查询 / 翻译”那个气泡。
struct WordText: UIViewRepresentable {
    /// 要显示的句子。
    let text: String
    /// 字号。
    let fontSize: CGFloat
    /// 字重，主字幕用 medium。
    let weight: UIFont.Weight
    /// 点到某个单词时回调。
    let onWord: (String) -> Void
    /// 点到空白处时回调；用来收查词条。
    let onBlankTap: () -> Void

    func makeUIView(context: Context) -> WordTextView {
        let view = WordTextView()
        view.onWord = onWord
        view.onBlankTap = onBlankTap
        return view
    }

    func updateUIView(_ uiView: WordTextView, context: Context) {
        uiView.onWord = onWord
        uiView.onBlankTap = onBlankTap
        uiView.apply(text: text, fontSize: fontSize, weight: weight)
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: WordTextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width > 0 else { return nil }
        let size = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: ceil(size.height))
    }
}

/// 只负责排版和单词命中的只读文本视图。
///
/// 关掉了可编辑、可选中和选择菜单，所以长按不会弹系统气泡；点击用
/// `NSLayoutManager` 反查字符下标，落在字形范围内才算命中。
final class WordTextView: UITextView {
    /// 点到单词时的回调。
    var onWord: ((String) -> Void)?
    /// 点到空白处时的回调。
    var onBlankTap: (() -> Void)?

    /// 每个单词在文本里的范围。
    private var wordRanges: [(range: NSRange, word: String)] = []
    /// 判定点击落点是否压在字形上的外扩量，手指按不准时给一点容差。
    private let hitTolerance: CGFloat = 2

    init() {
        super.init(frame: .zero, textContainer: nil)
        isEditable = false
        isSelectable = false
        isScrollEnabled = false
        backgroundColor = .clear
        textContainerInset = .zero
        textContainer.lineFragmentPadding = 0
        contentInset = .zero
        // 链接和选择都关掉之后，文本视图只剩排版，交互由下面的手势接管。
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap(_:))))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("不支持从 storyboard 创建")
    }

    /// 任何系统菜单都不响应，兜底防止选择菜单冒出来。
    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        false
    }

    /// 不允许成为第一响应者，避免键盘和选择手柄。
    override var canBecomeFirstResponder: Bool {
        false
    }

    /// 设置文本并记录每个单词的字符范围。
    ///
    /// - Parameters:
    ///   - text: 句子原文。
    ///   - fontSize: 字号。
    ///   - weight: 字重。
    func apply(text: String, fontSize: CGFloat, weight: UIFont.Weight) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 4
        // 主字幕整段居中，和网页版 text-align: center 一致。
        paragraph.alignment = .center
        // 不用纯黑纯白：留一点灰，长句压满屏时更耐看。
        let attributed = NSMutableAttributedString(
            string: text,
            attributes: [
                .font: UIFont.systemFont(ofSize: fontSize, weight: weight),
                .foregroundColor: UIColor.label.withAlphaComponent(0.92),
                .paragraphStyle: paragraph,
            ]
        )
        attributedText = attributed
        wordRanges = Self.wordRanges(in: text)
    }

    /// 点按命中：只有压到字符才查词，点在行间空白处不响应。
    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        guard let word = word(at: gesture.location(in: self)) else {
            onBlankTap?()
            return
        }
        onWord?(word)
    }

    /// 把屏幕坐标换成单词。
    ///
    /// - Parameter point: 点击位置，视图坐标系。
    /// - Returns: 命中的单词；没压在字上时为 nil。
    private func word(at point: CGPoint) -> String? {
        guard textStorage.length > 0 else { return nil }
        let containerPoint = CGPoint(
            x: point.x - textContainerInset.left,
            y: point.y - textContainerInset.top
        )
        let manager = layoutManager
        let index = manager.characterIndex(
            for: containerPoint,
            in: textContainer,
            fractionOfDistanceBetweenInsertionPoints: nil
        )
        guard index < textStorage.length else { return nil }

        let glyphRange = manager.glyphRange(
            forCharacterRange: NSRange(location: index, length: 1),
            actualCharacterRange: nil
        )
        let rect = manager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
        guard rect.insetBy(dx: -hitTolerance, dy: -hitTolerance).contains(containerPoint) else {
            return nil
        }
        return wordRanges.first { NSLocationInRange(index, $0.range) }?.word
    }

    /// 找出句子里所有英文单词及其字符范围。
    ///
    /// - Parameter text: 句子原文。
    /// - Returns: 单词范围列表。
    private static func wordRanges(in text: String) -> [(range: NSRange, word: String)] {
        guard let regex = try? NSRegularExpression(pattern: "[A-Za-z]+(?:['’-][A-Za-z]+)*") else {
            return []
        }
        let source = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: source.length)).map {
            (range: $0.range, word: source.substring(with: $0.range))
        }
    }
}
