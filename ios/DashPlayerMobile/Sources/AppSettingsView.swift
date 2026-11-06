import SwiftUI

/// 列表页的设置面板：服务器地址、外观、断开连接。
struct AppSettingsView: View {
    @EnvironmentObject private var server: ServerStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage(ThemePreference.storageKey) private var themeRaw = ThemePreference.system.rawValue

    @State private var address = ""
    @State private var connecting = false
    @State private var connected = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("192.168.1.5:27182", text: $address)
                        .font(.body.monospaced())
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button {
                        reconnect()
                    } label: {
                        HStack {
                            Text(connecting ? "连接中…" : "连接")
                            Spacer()
                            if connecting {
                                ProgressView().controlSize(.small)
                            } else if connected {
                                Image(systemName: "checkmark").foregroundStyle(.green)
                            }
                        }
                    }
                    .disabled(connecting)
                } header: {
                    Text("服务器")
                } footer: {
                    if let error = server.lastError {
                        Text(error).foregroundStyle(.red)
                    } else if connected {
                        Text("已连接")
                    } else {
                        Text("电脑上 DashPlayer 设置里的「手机访问」页会显示这个地址。")
                    }
                }

                Section("外观") {
                    Picker("主题", selection: $themeRaw) {
                        ForEach(ThemePreference.allCases) { preference in
                            Text(preference.label).tag(preference.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    Button("断开连接", role: .destructive) {
                        server.disconnect()
                        dismiss()
                    }
                }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
            .onAppear {
                address = server.baseURL?.absoluteString ?? ""
            }
        }
    }

    /// 保存并验证新地址。
    private func reconnect() {
        connecting = true
        connected = false
        Task {
            await server.connect(address)
            connecting = false
            connected = server.lastError == nil
            if connected {
                address = server.baseURL?.absoluteString ?? address
            }
        }
    }
}
