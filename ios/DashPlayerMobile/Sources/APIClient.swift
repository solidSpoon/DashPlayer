import Foundation

/// 接口调用失败。`message` 直接展示给用户，文案来自服务端的 `error` 字段。
struct APIError: LocalizedError {
    /// 可读的失败原因。
    let message: String

    var errorDescription: String? { message }
}

/// 桌面端手机服务（`MobileWebServer`）的 HTTP 客户端。
///
/// 所有路径都是相对路径，统一拼到 `baseURL` 上；服务端返回的错误体形如
/// `{"error": "..."}`，这里把它转成可展示的文案。
struct APIClient {
    /// 手机服务的根地址，例如 `http://192.168.1.5:27182`。
    let baseURL: URL

    /// 把服务端返回的相对路径拼成绝对地址。
    ///
    /// - Parameter path: 服务端返回的路径，可能已经是绝对地址。
    /// - Returns: 绝对地址；路径非法时为 nil。
    func absoluteURL(_ path: String) -> URL? {
        if path.hasPrefix("http://") || path.hasPrefix("https://") {
            return URL(string: path)
        }
        return URL(string: path, relativeTo: baseURL)?.absoluteURL
    }

    /// 读取最近播放列表。
    func recent() async throws -> [RecentItem] {
        struct Payload: Decodable {
            let items: [RecentItem]
        }
        let payload: Payload = try await send("/api/recent")
        return payload.items
    }

    /// 读取播放详情与字幕。
    ///
    /// - Parameter id: 观看记录 ID。
    func watchDetail(id: String) async throws -> WatchDetail {
        try await send("/api/videos/\(id)")
    }

    /// 查询单词释义。
    ///
    /// - Parameter word: 查询词。
    /// - Returns: 词典结果；服务端没有查到释义时为 nil。
    func lookup(word: String) async throws -> DictionaryEntry? {
        struct Payload: Decodable {
            let result: DictionaryEntry?
        }
        let payload: Payload = try await send("/api/dictionary", query: [URLQueryItem(name: "word", value: word)])
        return payload.result
    }

    /// 批量翻译字幕行。
    ///
    /// - Parameter texts: 待翻译文本，最多 50 条。
    /// - Returns: 与入参顺序一致的译文。
    func translate(texts: [String]) async throws -> [String] {
        struct Payload: Decodable {
            let translations: [String]
        }
        struct Body: Encodable {
            let texts: [String]
        }
        let payload: Payload = try await send("/api/translate", method: "POST", body: try JSONEncoder().encode(Body(texts: texts)))
        return payload.translations
    }

    /// 写回播放进度。
    ///
    /// - Parameters:
    ///   - id: 观看记录 ID。
    ///   - position: 播放位置，单位秒。
    func saveProgress(id: String, position: Double) async throws {
        struct Payload: Decodable {
            let ok: Bool
        }
        struct Body: Encodable {
            let position: Double
        }
        let _: Payload = try await send(
            "/api/videos/\(id)/progress",
            method: "POST",
            body: try JSONEncoder().encode(Body(position: position))
        )
    }

    /// 发起一次请求并解码返回值。
    ///
    /// - Parameters:
    ///   - path: 相对路径。
    ///   - method: HTTP 方法。
    ///   - query: 查询参数。
    ///   - body: 请求体。
    private func send<T: Decodable>(_ path: String, method: String = "GET", query: [URLQueryItem] = [], body: Data? = nil) async throws -> T {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError(message: "服务器地址无效")
        }
        components.path = path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else {
            throw APIError(message: "请求地址无效")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError(message: "连不上电脑上的 DashPlayer，确认在同一网络且手机访问已打开。")
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "响应无效")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError(message: Self.errorMessage(from: data) ?? "HTTP \(http.statusCode)")
        }

        do {
            return try Self.decoder.decode(T.self, from: data)
        } catch {
            throw APIError(message: "返回的数据解析失败")
        }
    }

    /// 从错误响应体里取服务端给的文案。
    private static func errorMessage(from data: Data) -> String? {
        struct Payload: Decodable {
            let error: String
        }
        return (try? JSONDecoder().decode(Payload.self, from: data))?.error
    }

    /// 统一配置的解码器；时间同时兼容带毫秒和不带毫秒的 ISO 8601。
    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            let withFraction = ISO8601DateFormatter()
            withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            if let date = withFraction.date(from: text) ?? plain.date(from: text) {
                return date
            }
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "无法解析时间：\(text)")
            )
        }
        return decoder
    }()
}
