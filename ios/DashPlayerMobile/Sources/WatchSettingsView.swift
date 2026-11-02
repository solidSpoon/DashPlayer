import SwiftUI

/// 播放设置面板。
struct WatchSettingsView: View {
    @ObservedObject var model: WatchModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("字幕") {
                    Toggle("英文原文", isOn: $model.showEnglish)
                    Toggle("中文翻译", isOn: $model.showTranslation)
                }

                Section {
                    Toggle("循环当前句", isOn: $model.repeatLine)
                    Toggle("每句自动暂停", isOn: $model.autoPause)
                } header: {
                    Text("学习")
                } footer: {
                    Text("循环适合反复磨一句；自动暂停方便跟着读。")
                }

                Section("播放") {
                    Picker("倍速", selection: $model.speed) {
                        ForEach(WatchModel.speedOptions, id: \.self) { option in
                            Text(label(for: option)).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }

            }
            .navigationTitle("播放设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }

    /// 倍速文案，整数不带小数点。
    private func label(for option: Double) -> String {
        option == option.rounded() ? "\(Int(option))×" : "\(option)×"
    }
}
