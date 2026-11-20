import SwiftUI
import WebKit
import HealthKit
import UniformTypeIdentifiers

@main
struct MieuxVivreApp: App {
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            ZStack {
                LocalProgram().ignoresSafeArea(.container)
                if scenePhase == .background {
                    Color(red: 37/255, green: 79/255, blue: 130/255).ignoresSafeArea()
                        .overlay(Text("Mieux vivre").font(.title2).foregroundStyle(.white))
                }
            }
        }
    }
}

struct LocalProgram: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> ProgramController { ProgramController() }
    func updateUIViewController(_ controller: ProgramController, context: Context) {}
}

final class ProgramController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let appearanceKey = "mieux-vivre.appearance"
    private let health = HKHealthStore()
    private var sendingMood = false
    private var web: WKWebView!
    private var entryURL: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "native")
        configureBootstrap(config.userContentController)
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        #if DEBUG
        web.isInspectable = true
        #endif
        let pageColor = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 17/255, green: 26/255, blue: 39/255, alpha: 1)
                : UIColor(red: 244/255, green: 247/255, blue: 251/255, alpha: 1)
        }
        web.backgroundColor = pageColor
        web.underPageBackgroundColor = pageColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        view = web
        applyAppearance()
        guard let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") else {
            web.loadHTMLString("<h1>Mieux vivre</h1><p>Le contenu local est introuvable. Réinstalle l’application sans supprimer ses données.</p>", baseURL: nil)
            return
        }
        let localIndex = index.resolvingSymlinksInPath()
        entryURL = localIndex
        web.loadFileURL(localIndex, allowingReadAccessTo: localIndex.deletingLastPathComponent())
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        applyAppearance()
    }

    private enum Appearance: String {
        case system, light, dark

        var style: UIUserInterfaceStyle {
            switch self {
            case .system: .unspecified
            case .light: .light
            case .dark: .dark
            }
        }
    }

    private var appearance: Appearance {
        Appearance(rawValue: UserDefaults.standard.string(forKey: appearanceKey) ?? "") ?? .system
    }

    private func applyAppearance() {
        overrideUserInterfaceStyle = appearance.style
        view.window?.overrideUserInterfaceStyle = appearance.style
    }

    private func configureBootstrap(_ controller: WKUserContentController) {
        let supportsMood: Bool
        if #available(iOS 18, *) { supportsMood = HKHealthStore.isHealthDataAvailable() }
        else { supportsMood = false }
        controller.removeAllUserScripts()
        controller.addUserScript(WKUserScript(
            source: "document.documentElement.setAttribute('data-carnet-native', ''); window.mvAppearance = '\(appearance.rawValue)'; window.mvHealth = \(supportsMood);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
    }

    // Only bundled files can navigate inside the app. External resources open explicitly in Safari.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL {
            decisionHandler(url.resolvingSymlinksInPath().path == entryURL?.path ? .allow : .cancel)
            return
        }
        print("MV navigation blocked: \(url.scheme ?? "none")")
        if action.navigationType == .linkActivated, ["https", "tel"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("MV local content loaded")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("MV load failed: \(error.localizedDescription)")
        showError("Le contenu local n’a pas pu être chargé. \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("MV navigation failed: \(error.localizedDescription)")
        showError("Le chargement a été interrompu. \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, ["https", "tel"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        return nil
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let origin = message.frameInfo.request.url, origin.isFileURL,
              origin.resolvingSymlinksInPath().path == entryURL?.path,
              let body = message.body as? [String: String],
              let action = body["action"], let content = body["content"], content.utf8.count <= 5_000_000 else { return }
        if action == "appearance", let selected = Appearance(rawValue: content) {
            UserDefaults.standard.set(selected.rawValue, forKey: appearanceKey)
            applyAppearance()
            configureBootstrap(controller)
            return
        }
        if action == "health-mood" {
            if #available(iOS 18, *) { sendMood(content) }
            else { moodResult("unsupported") }
            return
        }
        if action == "copy" { UIPasteboard.general.string = content; return }
        guard action == "export", let name = body["name"],
              name == URL(fileURLWithPath: name).lastPathComponent,
              ["json", "mvx", "txt"].contains(URL(fileURLWithPath: name).pathExtension),
              ["mieux-vivre-", "Carnet_A_Mon_Rythme_", "agenda-sommeil-"].contains(where: name.hasPrefix)
        else { return }
        do {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let file = dir.appendingPathComponent(name)
            try Data(content.utf8).write(to: file, options: [.atomic, .completeFileProtection])
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: dir) }
            sheet.popoverPresentationController?.sourceView = view
            sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            present(sheet, animated: true)
        } catch { showError("Le fichier n’a pas pu être créé. Tes données restent dans l’application.") }
    }

    private struct DailyMood: Decodable {
        let day: String
        let mood: Int
    }

    @available(iOS 18, *)
    private func sendMood(_ content: String) {
        guard !sendingMood else { return }
        guard HKHealthStore.isHealthDataAvailable() else {
            moodResult("unsupported")
            return
        }
        guard content.utf8.count <= 90_000,
              let entries = try? JSONDecoder().decode([DailyMood].self, from: Data(content.utf8)),
              (1...1500).contains(entries.count),
              Set(entries.map(\.day)).count == entries.count
        else {
            moodResult("invalid")
            return
        }
        let dates = DateFormatter()
        dates.locale = Locale(identifier: "en_US_POSIX")
        dates.calendar = Calendar(identifier: .gregorian)
        dates.timeZone = .current
        dates.dateFormat = "yyyy-MM-dd"
        let version = Int(Date().timeIntervalSince1970 * 1000)
        var samples: [HKStateOfMind] = []
        for entry in entries {
            guard let date = dates.date(from: entry.day), dates.string(from: date) == entry.day,
                  date <= Date(), (0...4).contains(entry.mood)
            else {
                moodResult("invalid")
                return
            }
            let sample = HKStateOfMind(
                date: date, kind: .dailyMood, valence: Double(entry.mood - 2) / 2,
                labels: [], associations: [], metadata: [
                    HKMetadataKeySyncIdentifier: "com.remi.mieuxvivre.daily-mood.\(entry.day)",
                    HKMetadataKeySyncVersion: version,
                    HKMetadataKeyWasUserEntered: true
                ]
            )
            samples.append(sample)
        }
        sendingMood = true
        Task { @MainActor in
            defer { sendingMood = false }
            do {
                let type = HKObjectType.stateOfMindType()
                try await health.requestAuthorization(toShare: [type], read: [])
                guard health.authorizationStatus(for: type) == .sharingAuthorized else {
                    moodResult("denied")
                    return
                }
                try await health.save(samples)
                moodResult("saved", count: samples.count)
            } catch {
                moodResult("failed")
            }
        }
    }

    private func moodResult(_ status: String, count: Int = 0) {
        web.evaluateJavaScript("window.MieuxVivreHealthResult?.('\(status)', \(count));", completionHandler: nil)
    }

    private func showError(_ text: String) {
        let alert = UIAlertController(title: "Mieux vivre", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Fermer", style: .default))
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "Mieux vivre", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Fermer", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "Mieux vivre", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Confirmer", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: "Sauvegarde chiffrée", message: prompt, preferredStyle: .alert)
        alert.addTextField { field in
            field.isSecureTextEntry = true
            field.text = defaultText
            field.autocorrectionType = .no
            field.textContentType = .newPassword
        }
        alert.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "Continuer", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        present(alert, animated: true)
    }
}
