import Foundation

/// 保存当前连接的手机服务地址，并负责地址的补全与校验。
@MainActor
final class ServerStore: ObservableObject {
    /// 已经验证可用的服务地址；nil 表示还没连过，需要先填地址。
    @Published private(set) var baseURL: URL?

    /// 最近一次连接失败的原因，供设置页展示。
    @Published private(set) var lastError: String?

    /// 默认端口与桌面端 `mobileAccess.port` 的默认值保持一致。
    nonisolated static let defaultPort = 27182

    private static let storageKey = "dashplayer.server.baseURL"
    private let defaults: UserDefaults

    /// 创建实例并恢复上次保存的地址。
    ///
    /// - Parameter defaults: 偏好存储，测试时可以换成独立 suite。
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let raw = defaults.string(forKey: Self.storageKey), let url = URL(string: raw) {
            baseURL = url
        }
    }

    /// 校验并连接一个地址，成功后才写入偏好。
    ///
    /// - Parameter input: 用户输入，允许只写 `192.168.1.5` 或带端口的完整地址。
    func connect(_ input: String) async {
        lastError = nil
        guard let url = Self.normalize(input) else {
            lastError = "地址格式不对，写成 192.168.1.5:27182 这样。"
            return
        }
        do {
            _ = try await APIClient(baseURL: url).recent()
        } catch {
            lastError = (error as? APIError)?.message ?? error.localizedDescription
            return
        }
        baseURL = url
        defaults.set(url.absoluteString, forKey: Self.storageKey)
    }

    /// 断开当前连接，下次启动重新填地址。
    func disconnect() {
        baseURL = nil
        lastError = nil
        defaults.removeObject(forKey: Self.storageKey)
    }

    /// 把用户输入整理成规范地址。
    ///
    /// 缺协议时补 `http://`，缺端口时补默认端口，丢掉路径、查询和锚点。
    ///
    /// - Parameter input: 原始输入。
    /// - Returns: 规范地址；主机为空或无法解析时为 nil。
    nonisolated static func normalize(_ input: String) -> URL? {
        var text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        if !text.contains("://") {
            text = "http://" + text
        }
        guard var components = URLComponents(string: text) else { return nil }
        guard let host = components.host, !host.isEmpty else { return nil }
        if components.port == nil {
            components.port = defaultPort
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        return components.url
    }
}
