import Foundation

/// Réinjecte les données venues de l'iPhone dans le stock local de la version Mac.
///
/// Le contenu web lit et écrit dans `localStorage`. Sur iPhone ces données vivent dans
/// le conteneur WebKit de l'app ; sur Mac elles vivent dans le dossier WebKit du bundle
/// Mac. Pour que la reprise soit possible après un changement de machine, un fichier
/// `migration.json` peut être déposé dans `~/Library/Application Support/MieuxVivre/`.
/// Il contient un objet JSON `clé → valeur` où chaque valeur est la chaîne exacte
/// à écrire dans `localStorage`.
///
/// Le fichier n'est jamais écrasé et n'est appliqué que pour les clés encore absentes :
/// une donnée déjà présente dans l'app Mac reste prioritaire.
enum Migration {
    static let fileName = "migration.json"

    static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MieuxVivre", isDirectory: true)
    }

    static var fileURL: URL {
        directory.appendingPathComponent(fileName)
    }

    /// Contenu JSON `clé → valeur`, ou nil si aucune migration n'est disponible.
    static func payload() -> [String: String]? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let dictionary = object as? [String: Any] else { return nil }
        var result: [String: String] = [:]
        for (key, value) in dictionary {
            if let text = value as? String {
                result[key] = text
            } else if JSONSerialization.isValidJSONObject(value),
                      let encoded = try? JSONSerialization.data(withJSONObject: value),
                      let text = String(data: encoded, encoding: .utf8) {
                result[key] = text
            }
        }
        return result.isEmpty ? nil : result
    }

    /// Fragment JavaScript injecté au démarrage de la page.
    /// Renvoie une chaîne vide quand aucune migration n'est disponible.
    static func seedScript() -> String {
        guard let payload = payload(),
              let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
              let literal = String(data: data, encoding: .utf8) else { return "" }
        return """
        (function(){ try{ var s = \(literal); \
        Object.keys(s).forEach(function(k){ if(localStorage.getItem(k) === null) localStorage.setItem(k, s[k]); }); \
        }catch(e){} })();
        """
    }
}
