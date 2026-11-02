import AVFoundation
import Combine
import MediaPlayer

/// 查词状态。
struct DictionaryState {
    /// 查询词原文。
    let word: String
    /// 词典结果；加载中或失败时为 nil。
    let entry: DictionaryEntry?
    /// 是否还在查询。
    let loading: Bool
    /// 失败原因。
    let error: String?
}

/// 播放页的全部状态：播放器、字幕索引、循环与自动暂停、查词和进度回写。
///
/// 视图只读这里的发布状态，所有播放器操作都从这里走，避免视图层直接和
/// AVPlayer 的异步状态纠缠。
@MainActor
final class WatchModel: ObservableObject {
    /// 播放详情。
    let detail: WatchDetail
    /// 视频播放器，视图层直接挂 `AVPlayerLayer`。
    let player = AVPlayer()

    /// 当前字幕下标；-1 表示还没定位到字幕。
    @Published private(set) var currentIndex = -1
    /// 是否正在播放。
    @Published private(set) var isPlaying = false
    /// 当前播放位置，单位秒。每整秒左右刷新一次，够进度条和时钟用。
    @Published private(set) var currentTime: Double = 0
    /// 视频总时长，单位秒；未知时为 0。
    @Published private(set) var duration: Double = 0
    /// 播放失败提示；nil 表示正常。
    @Published private(set) var playbackError: String?
    /// 当前查词条；nil 表示没有在查词。
    @Published private(set) var dictionary: DictionaryState?
    /// 逐句翻译缓存，键是字幕下标。
    @Published private(set) var translations: [Int: String] = [:]

    /// 是否显示英文。
    @Published var showEnglish: Bool {
        didSet { defaults.set(showEnglish, forKey: Keys.showEnglish) }
    }
    /// 是否显示中文翻译。
    @Published var showTranslation: Bool {
        didSet {
            defaults.set(showTranslation, forKey: Keys.showTranslation)
            if showTranslation {
                requestTranslations(around: max(currentIndex, 0))
            }
        }
    }
    /// 是否循环当前句。
    @Published var repeatLine: Bool {
        didSet { defaults.set(repeatLine, forKey: Keys.repeatLine) }
    }
    /// 是否每句结束自动暂停。
    @Published var autoPause: Bool {
        didSet { defaults.set(autoPause, forKey: Keys.autoPause) }
    }
    /// 播放倍速。
    @Published var speed: Double {
        didSet {
            defaults.set(speed, forKey: Keys.speed)
            player.defaultRate = Float(speed)
            if isPlaying {
                player.rate = Float(speed)
            }
            updateNowPlaying()
        }
    }

    /// 用户是否正在拖进度条；这期间不让时间回调覆盖位置。
    var isScrubbing = false

    /// 可选倍速，和网页版保持一致。
    static let speedOptions: [Double] = [0.75, 1, 1.25, 1.5]

    private let api: APIClient
    private let defaults = UserDefaults.standard
    private var index: SubtitleIndex

    /// 循环判定的时间容差，秒。
    private let loopEpsilon = 0.1
    /// 跳句时提前起播的时间，避免切掉第一个音。
    private let seekPreroll = 0.2

    private var started = false
    private var resumeApplied = false
    private var seekInFlight = false
    private var autoPauseArmed = true
    /// 程序化跳句的目标下标；预卷期间当前句先停在这里。
    private var seekTargetIndex: Int?
    private var lastSavedSecond: Double = -1
    private var tickCount = 0

    private var attemptedTranslations: Set<Int> = []
    private var translationCoveredUntil = -1
    private var dictionaryCache: [String: DictionaryEntry?] = [:]
    private var dictionaryTask: Task<Void, Never>?
    private var dismissTask: Task<Void, Never>?

    private var timeObserver: Any?
    private var cancellables: Set<AnyCancellable> = []
    private var remoteTargets: [(MPRemoteCommand, Any)] = []

    /// 偏好存储键。
    private enum Keys {
        static let showEnglish = "dashplayer.showEnglish"
        static let showTranslation = "dashplayer.showTranslation"
        static let repeatLine = "dashplayer.repeatLine"
        static let autoPause = "dashplayer.autoPause"
        static let speed = "dashplayer.speed"
    }

    /// 创建播放模型。
    ///
    /// - Parameters:
    ///   - detail: 播放详情。
    ///   - api: 用来回写进度、查词和翻译的客户端。
    init(detail: WatchDetail, api: APIClient) {
        self.detail = detail
        self.api = api
        self.index = SubtitleIndex(lines: detail.subtitles)
        self.showEnglish = Self.storedBool(Keys.showEnglish, fallback: true)
        self.showTranslation = Self.storedBool(Keys.showTranslation, fallback: true)
        self.repeatLine = Self.storedBool(Keys.repeatLine, fallback: false)
        self.autoPause = Self.storedBool(Keys.autoPause, fallback: false)
        let storedSpeed = UserDefaults.standard.object(forKey: Keys.speed) as? Double
        self.speed = storedSpeed.flatMap { Self.speedOptions.contains($0) ? $0 : nil } ?? 1
    }

    /// 当前句。
    ///
    /// 还没定位到任何一句时退回第一句，和网页版一致：否则片头那几百毫秒会
    /// 显示成“没有匹配到字幕”。
    var currentLine: SubtitleLine? {
        if detail.subtitles.indices.contains(currentIndex) {
            return detail.subtitles[currentIndex]
        }
        return detail.subtitles.first
    }

    /// 当前句要显示的译文：优先字幕自带的中文，其次用翻译结果。
    var currentTranslation: String {
        guard let line = currentLine else { return "" }
        if !line.zh.isEmpty { return line.zh }
        return translations[max(currentIndex, 0)] ?? ""
    }

    /// 开始加载视频并挂上各种观察者。重复调用无副作用。
    func start() {
        guard !started else { return }
        started = true
        prepareItem()
        addObservers()
        configureRemoteCommands()
    }

    /// 离开播放页时收尾：停播、写回进度、摘掉观察者。
    func stop() {
        saveProgress(force: true)
        player.pause()
        if let timeObserver {
            player.removeTimeObserver(timeObserver)
            self.timeObserver = nil
        }
        cancellables.removeAll()
        for (command, target) in remoteTargets {
            command.removeTarget(target)
        }
        remoteTargets.removeAll()
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    /// 播放。
    func play() {
        player.rate = Float(speed)
    }

    /// 暂停，并立即写回进度。
    func pause() {
        player.pause()
        saveProgress(force: true)
    }

    /// 播放 / 暂停。
    func togglePlayPause() {
        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    /// 跳到某一句开头。
    ///
    /// - Parameters:
    ///   - index: 目标字幕下标。
    ///   - play: 跳转后是否继续播放。
    func seek(toLine index: Int, play: Bool = true) {
        guard detail.subtitles.indices.contains(index) else { return }
        let line = detail.subtitles[index]
        seekTargetIndex = index
        seekInFlight = true
        autoPauseArmed = false
        dictionary = nil
        seek(to: max(0, line.start - seekPreroll)) { [weak self] finished in
            guard let self else { return }
            self.seekInFlight = false
            self.autoPauseArmed = true
            if finished {
                self.apply(index)
            } else {
                self.seekTargetIndex = nil
            }
        }
        if play {
            self.play()
        }
    }

    /// 按句前后跳。
    ///
    /// - Parameter delta: -1 上一句，1 下一句。
    func stepLine(_ delta: Int) {
        guard !detail.subtitles.isEmpty else { return }
        let base = currentIndex >= 0 ? currentIndex : index.index(at: currentTime)
        let target = min(detail.subtitles.count - 1, max(0, (base < 0 ? -1 : base) + delta))
        seek(toLine: target)
    }

    /// 重播当前句。
    func replayCurrent() {
        guard !detail.subtitles.isEmpty else { return }
        let base = currentIndex >= 0 ? currentIndex : index.index(at: currentTime)
        seek(toLine: max(0, base))
    }

    /// 拖动进度条。
    ///
    /// - Parameter seconds: 目标位置，单位秒。
    func scrub(to seconds: Double) {
        currentTime = seconds
        seekTargetIndex = nil
        seekInFlight = true
        seek(to: seconds) { [weak self] finished in
            guard let self else { return }
            self.seekInFlight = false
            self.autoPauseArmed = true
            guard finished else { return }
            let next = self.index.index(at: seconds)
            if next != self.currentIndex {
                self.apply(next)
            }
        }
    }

    /// 立即写回进度，切后台和离开页面时调用。
    func saveNow() {
        saveProgress(force: true)
    }

    /// 查询单词。
    ///
    /// - Parameter raw: 点击到的单词原文，带标点也可以。
    func lookup(_ raw: String) {
        let trimmed = raw.trimmingCharacters(in: CharacterSet(charactersIn: " \t\n.,!?;:\"'“”‘’()[]{}<>—-"))
        guard !trimmed.isEmpty else { return }
        let key = trimmed.lowercased()

        if let cached = dictionaryCache[key] {
            dictionary = DictionaryState(word: trimmed, entry: cached, loading: false, error: nil)
            scheduleDismiss(after: 9)
            return
        }

        dictionaryTask?.cancel()
        dictionary = DictionaryState(word: trimmed, entry: nil, loading: true, error: nil)
        dismissTask?.cancel()
        dictionaryTask = Task { [weak self] in
            guard let self else { return }
            do {
                let entry = try await api.lookup(word: trimmed)
                guard !Task.isCancelled else { return }
                dictionaryCache[key] = entry
                guard dictionary?.word == trimmed else { return }
                dictionary = DictionaryState(word: trimmed, entry: entry, loading: false, error: nil)
                scheduleDismiss(after: 9)
            } catch {
                guard !Task.isCancelled else { return }
                guard dictionary?.word == trimmed else { return }
                let message = (error as? APIError)?.message ?? error.localizedDescription
                dictionary = DictionaryState(word: trimmed, entry: nil, loading: false, error: message)
                scheduleDismiss(after: 12)
            }
        }
    }

    /// 收起查词条。
    func dismissDictionary() {
        dismissTask?.cancel()
        dictionaryTask?.cancel()
        dictionary = nil
    }

    // MARK: - 播放器

    /// 创建播放条目并挂到播放器上。
    private func prepareItem() {
        guard let url = api.absoluteURL(detail.streamUrl) else {
            playbackError = "视频地址无效"
            return
        }
        let item = AVPlayerItem(url: url)
        item.preferredForwardBufferDuration = 5
        player.replaceCurrentItem(with: item)
        player.actionAtItemEnd = .pause
        player.defaultRate = Float(speed)
        observeItem(item)
    }

    /// 监听条目状态，载入成功后按上次位置续播。
    private func observeItem(_ item: AVPlayerItem) {
        item.publisher(for: \.status)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                MainActor.assumeIsolated {
                    self?.handle(status: status)
                }
            }
            .store(in: &cancellables)
    }

    /// 处理条目状态变化。
    private func handle(status: AVPlayerItem.Status) {
        switch status {
        case .readyToPlay:
            let seconds = player.currentItem?.duration.seconds ?? 0
            duration = seconds.isFinite && seconds > 0 ? seconds : 0
            guard !resumeApplied else { return }
            let target = detail.currentPosition
            if target > 3 {
                seekInFlight = true
                seek(to: min(target, max(duration - 2, 0))) { [weak self] _ in
                    guard let self else { return }
                    self.seekInFlight = false
                    self.resumeApplied = true
                    self.apply(self.index.index(at: self.currentTime))
                }
            } else {
                resumeApplied = true
            }
        case .failed:
            playbackError = "这个格式放不了。回电脑上用「播放修复」转成 MP4 再试。"
        default:
            break
        }
    }

    /// 挂上时间回调、播放状态和播放结束通知。
    private func addObservers() {
        let interval = CMTime(seconds: 0.2, preferredTimescale: 600)
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            MainActor.assumeIsolated {
                self?.handleTick(time.seconds)
            }
        }

        player.publisher(for: \.timeControlStatus)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    let playing = status == .playing
                    if playing != self.isPlaying {
                        self.isPlaying = playing
                        self.updateNowPlaying()
                    }
                }
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime, object: player.currentItem)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    self.isPlaying = false
                    self.saveProgress(force: true)
                }
            }
            .store(in: &cancellables)
    }

    /// 每次时间回调做的事：刷新时钟、循环、自动暂停和字幕定位。
    private func handleTick(_ time: Double) {
        guard !isScrubbing else { return }
        if abs(time - currentTime) >= 0.9 {
            currentTime = time
        }
        guard resumeApplied else { return }

        tickCount += 1
        if tickCount % 25 == 0 {
            updateNowPlaying()
        }

        let line = currentLine
        if repeatLine, !seekInFlight, let line, time >= line.end - loopEpsilon {
            seekTargetIndex = currentIndex >= 0 ? currentIndex : nil
            seekInFlight = true
            seek(to: max(0, line.start - seekPreroll)) { [weak self] finished in
                guard let self else { return }
                self.seekInFlight = false
                if !finished {
                    self.seekTargetIndex = nil
                }
            }
            return
        }

        if autoPause, autoPauseArmed, let line, time >= line.end - loopEpsilon {
            autoPauseArmed = false
            pause()
            return
        }

        let next = resolveIndex(time)
        if next != currentIndex {
            apply(next)
        }
        saveProgress(force: false)
    }

    /// 计算时间点对应的字幕下标，跳句预卷期间优先停在目标句。
    ///
    /// 目标句只在“时间真正越过它的开头”后才交还给时间轴索引，并且 seek 未落地
    /// 之前一律不算越过——AVPlayer 的 seek 是异步的，完成前时间回调还在报旧位置，
    /// 提前交还就会让高亮先退到上一句再弹回来。
    private func resolveIndex(_ time: Double) -> Int {
        if let target = seekTargetIndex, detail.subtitles.indices.contains(target) {
            if seekInFlight || time < detail.subtitles[target].start {
                return target
            }
            seekTargetIndex = nil
        }
        return index.index(at: time)
    }

    /// 应用新的当前句，并补齐这段的翻译。
    private func apply(_ index: Int) {
        guard index != currentIndex else { return }
        currentIndex = index
        autoPauseArmed = true
        if index >= 0, showTranslation {
            requestTranslations(around: index)
        }
    }

    /// 发起一次 seek。
    ///
    /// 无论成功失败都会回调，调用方必须自己收尾：seek 失败时若不清掉
    /// `seekInFlight`，字幕会一直卡在目标句上。
    ///
    /// - Parameters:
    ///   - seconds: 目标位置，单位秒。
    ///   - completion: 结果回调，参数为 seek 是否成功。
    private func seek(to seconds: Double, completion: ((Bool) -> Void)? = nil) {
        let time = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero) { finished in
            Task { @MainActor in
                completion?(finished)
            }
        }
    }

    /// 写回播放位置，两次之间至少隔 5 秒。
    ///
    /// - Parameter force: 忽略间隔立即写入。
    private func saveProgress(force: Bool) {
        guard resumeApplied else { return }
        let second = max(0, currentTime.rounded(.down))
        if !force, lastSavedSecond >= 0, abs(second - lastSavedSecond) < 5 {
            return
        }
        lastSavedSecond = second
        let id = detail.id
        let api = self.api
        Task.detached {
            try? await api.saveProgress(id: id, position: second)
        }
    }

    // MARK: - 翻译

    /// 为当前句附近的一小段字幕请求翻译。
    ///
    /// 只翻字幕文件里没有中文的行，同一窗口请求过就不再重复请求。
    ///
    /// - Parameter index: 当前字幕下标。
    private func requestTranslations(around index: Int) {
        let lines = detail.subtitles
        guard !lines.isEmpty else { return }
        if index < translationCoveredUntil - 5 { return }

        let start = max(0, index - 2)
        let end = min(lines.count, start + 20)
        translationCoveredUntil = max(translationCoveredUntil, end)

        var indexes: [Int] = []
        var texts: [String] = []
        for lineIndex in start..<end {
            let line = lines[lineIndex]
            if !line.zh.isEmpty || line.en.trimmingCharacters(in: .whitespaces).isEmpty { continue }
            if attemptedTranslations.contains(lineIndex) { continue }
            if !(translations[lineIndex] ?? "").isEmpty { continue }
            attemptedTranslations.insert(lineIndex)
            indexes.append(lineIndex)
            texts.append(line.en)
        }
        guard !texts.isEmpty else { return }

        Task { [weak self] in
            guard let self else { return }
            guard let result = try? await api.translate(texts: texts) else { return }
            for (offset, lineIndex) in indexes.enumerated() where offset < result.count {
                translations[lineIndex] = result[offset]
            }
        }
    }

    // MARK: - 查词条收起

    /// 安排查词条自动收起。
    ///
    /// - Parameter seconds: 延迟秒数。
    private func scheduleDismiss(after seconds: Double) {
        dismissTask?.cancel()
        dismissTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard !Task.isCancelled else { return }
            self?.dictionary = nil
        }
    }

    // MARK: - 锁屏与耳机控制

    /// 把播放状态同步到锁屏播放器。
    private func updateNowPlaying() {
        var info: [String: Any] = [:]
        info[MPMediaItemPropertyTitle] = detail.title
        info[MPMediaItemPropertyArtist] = detail.subtitle
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? speed : 0
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    /// 注册锁屏和耳机的播放、暂停、上下句。
    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        register(center.playCommand) { $0.play() }
        register(center.pauseCommand) { $0.pause() }
        register(center.togglePlayPauseCommand) { $0.togglePlayPause() }
        register(center.nextTrackCommand) { $0.stepLine(1) }
        register(center.previousTrackCommand) { $0.stepLine(-1) }
    }

    /// 给一个远程命令挂处理函数并记录，销毁时好摘掉。
    private func register(_ command: MPRemoteCommand, action: @escaping (WatchModel) -> Void) {
        let target = command.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            Task { @MainActor in
                action(self)
            }
            return .success
        }
        remoteTargets.append((command, target))
    }

    /// 读取布尔偏好，没存过时用默认值。
    private static func storedBool(_ key: String, fallback: Bool) -> Bool {
        guard UserDefaults.standard.object(forKey: key) != nil else { return fallback }
        return UserDefaults.standard.bool(forKey: key)
    }
}
