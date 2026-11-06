import SwiftUI

/// 首次启动或断开连接后的地址填写页。
struct ServerSetupView: View {
    @EnvironmentObject private var server: ServerStore
    @State private var address = ""
    @State private var connecting = false
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 10) {
                    Image(systemName: "play.rectangle.on.rectangle")
                        .font(.system(size: 44, weight: .light))
                        .foregroundStyle(.tint)
                    Text("连接电脑上的 DashPlayer")
                        .font(.largeTitle.bold())
                    Text("先在电脑上打开 DashPlayer，进入设置里的「手机访问」，把页面上显示的地址填到这里。两边连同一个 Wi-Fi 就行。")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 32)

                VStack(alignment: .leading, spacing: 12) {
                    Text("服务器地址")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)

                    TextField("192.168.1.5:27182", text: $address)
                        .textFieldStyle(.plain)
                        .font(.body.monospaced())
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .focused($focused)
                        .onSubmit(connect)
                        .padding(14)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))

                    Button(action: connect) {
                        HStack(spacing: 8) {
                            if connecting {
                                ProgressView().controlSize(.small)
                            }
                            Text(connecting ? "连接中…" : "连接")
                                .frame(maxWidth: .infinity)
                        }
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(connecting || address.trimmingCharacters(in: .whitespaces).isEmpty)

                    if let error = server.lastError {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
                .padding(18)
                .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color(.separator), lineWidth: 1)
                )

                Text("端口没写就默认 \(ServerStore.defaultPort)。电脑上显示的地址可以原样粘贴。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Color(.systemGroupedBackground))
        .onAppear { focused = true }
    }

    /// 收起键盘并发起连接。
    private func connect() {
        guard !connecting else { return }
        focused = false
        connecting = true
        Task {
            await server.connect(address)
            connecting = false
        }
    }
}
