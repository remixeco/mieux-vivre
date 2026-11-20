import AppKit
import SwiftUI
import WebKit
import UniformTypeIdentifiers

@main
struct MieuxVivreMacApp: App {
    var body: some Scene {
        WindowGroup {
            LocalProgram()
                .ignoresSafeArea(.container)
        }
        .defaultSize(width: 1120, height: 860)
        .windowToolbarStyle(.unified)
    }
}

// MARK: - Bridge SwiftUI -> WKWebView

struct LocalProgram: NSViewRepresentable {
    func makeNSView(context: Context) -> ProgramView { ProgramView() }
    func updateNSView(_ nsView: ProgramView, context: Context) {}
}

/// Contrôleur de la vue web locale. Même politique que la version iPhone :
/// seul le contenu embarqué est navigable, tout lien externe s'ouvre dans le navigateur.
final class ProgramView: NSView, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let appearanceKey = "mieux-vivre.appearance"
    private var web: WKWebView!
    private var entryURL: URL?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        configure()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        configure()
    }

    private func configure() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "native")
        configureBootstrap(config.userContentController)

        web = WKWebView(frame: bounds, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsMagnification = true
        #if DEBUG
        web.isInspectable = true
        #endif

        let pageColor = NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
                ? NSColor(srgbRed: 17 / 255, green: 26 / 255, blue: 39 / 255, alpha: 1)
                : NSColor(srgbRed: 244 / 255, green: 247 / 255, blue: 251 / 255, alpha: 1)
        }
        web.underPageBackgroundColor = pageColor

        web.translatesAutoresizingMaskIntoConstraints = false
        addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: leadingAnchor),
            web.trailingAnchor.constraint(equalTo: trailingAnchor),
            web.topAnchor.constraint(equalTo: topAnchor),
            web.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])

        applyAppearance()

        guard let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") else {
            web.loadHTMLString("<h1>Mieux vivre</h1><p>Le contenu local est introuvable. Réinstalle l’application.</p>", baseURL: nil)
            return
        }
        let localIndex = index.resolvingSymlinksInPath()
        entryURL = localIndex
        web.loadFileURL(localIndex, allowingReadAccessTo: localIndex.deletingLastPathComponent())
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        applyAppearance()
    }

    // MARK: Apparence

    private enum Appearance: String {
        case system, light, dark

        var nsAppearance: NSAppearance? {
            switch self {
            case .system: return nil
            case .light: return NSAppearance(named: .aqua)
            case .dark: return NSAppearance(named: .darkAqua)
            }
        }
    }

    private var selectedAppearance: Appearance {
        Appearance(rawValue: UserDefaults.standard.string(forKey: appearanceKey) ?? "") ?? .system
    }

    private func applyAppearance() {
        let selected = selectedAppearance.nsAppearance
        web.appearance = selected
        window?.appearance = selected
    }

    private func configureBootstrap(_ controller: WKUserContentController) {
        controller.removeAllUserScripts()
        let source = """
        document.documentElement.setAttribute('data-carnet-native', ''); \
        window.mvAppearance = '\(selectedAppearance.rawValue)'; \
        window.mvHealth = false; \
        \(Migration.seedScript())
        """
        controller.addUserScript(WKUserScript(
            source: source,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
    }

    // MARK: Navigation

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL {
            decisionHandler(url.resolvingSymlinksInPath().path == entryURL?.path ? .allow : .cancel)
            return
        }
        print("MV navigation blocked: \(url.scheme ?? "none")")
        if action.navigationType == .linkActivated, ["https", "tel"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
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
        if let url = action.request.url, ["https", "tel"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    // MARK: Appels depuis la page

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
            // Apple Santé n'existe pas sur macOS : la page reste informée de l'indisponibilité.
            moodResult("unsupported")
            return
        }
        if action == "copy" {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(content, forType: .string)
            return
        }
        guard action == "export", let name = body["name"],
              name == URL(fileURLWithPath: name).lastPathComponent,
              ["json", "mvx", "txt"].contains(URL(fileURLWithPath: name).pathExtension),
              ["mieux-vivre-", "Carnet_A_Mon_Rythme_", "agenda-sommeil-"].contains(where: name.hasPrefix)
        else { return }
        export(content: content, name: name)
    }

    private func export(content: String, name: String) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = name
        panel.canCreateDirectories = true
        panel.title = "Enregistrer l’export"
        let ext = URL(fileURLWithPath: name).pathExtension
        if let type = UTType(filenameExtension: ext) { panel.allowedContentTypes = [type] }
        guard panel.runModal() == .OK, let destination = panel.url else { return }
        do {
            try Data(content.utf8).write(to: destination, options: [.atomic])
        } catch {
            showError("Le fichier n’a pas pu être enregistré. Tes données restent dans l’application.")
        }
    }

    private func moodResult(_ status: String, count: Int = 0) {
        web.evaluateJavaScript("window.MieuxVivreHealthResult?.('\(status)', \(count));", completionHandler: nil)
    }

    // MARK: Alertes

    private func showError(_ text: String) {
        present(alert(title: "Mieux vivre", message: text, buttons: ["Fermer"])) { _ in }
    }

    private func alert(title: String, message: String, buttons: [String]) -> NSAlert {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        for button in buttons { alert.addButton(withTitle: button) }
        return alert
    }

    private func present(_ alert: NSAlert, completion: @escaping (NSApplication.ModalResponse) -> Void) {
        if let window {
            alert.beginSheetModal(for: window) { response in completion(response) }
        } else {
            completion(alert.runModal())
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = self.alert(title: "Mieux vivre", message: message, buttons: ["Fermer"])
        present(alert) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = self.alert(title: "Mieux vivre", message: message, buttons: ["Annuler", "Confirmer"])
        present(alert) { response in completionHandler(response == .alertSecondButtonReturn) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = self.alert(title: "Sauvegarde chiffrée", message: prompt, buttons: ["Annuler", "Continuer"])
        let field = NSSecureTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        field.stringValue = defaultText ?? ""
        alert.accessoryView = field
        present(alert) { response in
            completionHandler(response == .alertSecondButtonReturn ? field.stringValue : nil)
        }
    }
}
