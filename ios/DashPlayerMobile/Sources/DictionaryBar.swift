import SwiftUI

/// 顶部查词条。
///
/// 和网页版一样是压在画面顶部的一条，不做弹窗、不做动画；点条本身或点别处收起。
struct DictionaryBar: View {
    /// 当前查词状态。
    let state: DictionaryState
    /// 点条收起。
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(state.word)
                    .font(.headline)
                if !phonetic.isEmpty {
                    Text(phonetic)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            Text(definitions)
                .font(.callout)
                .foregroundStyle(state.loading || state.error != nil ? .secondary : .primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color(.separator))
                .frame(height: 0.5)
        }
        .contentShape(Rectangle())
        .onTapGesture { onClose() }
    }

    /// 音标，统一成 `/.../`。
    private var phonetic: String {
        guard let raw = state.entry?.phonetic else { return "" }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return trimmed.isEmpty ? "" : "/\(trimmed)/"
    }

    /// 释义文本：最多两条，词性和释义拼在一起。
    private var definitions: String {
        if state.loading {
            return "查询中…"
        }
        if let error = state.error {
            return "查询失败：\(error)"
        }
        guard let entry = state.entry, !entry.definitions.isEmpty else {
            return "没有查到释义"
        }
        let parts = entry.definitions.prefix(2).compactMap { definition -> String? in
            let meaning = definition.meaning.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !meaning.isEmpty else { return nil }
            let partOfSpeech = definition.partOfSpeech
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "."))
            return partOfSpeech.isEmpty ? meaning : "\(partOfSpeech). \(meaning)"
        }
        return parts.isEmpty ? "没有查到释义" : parts.joined(separator: "；")
    }
}
