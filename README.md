# Mieux vivre

Prototype de soutien quotidien en santé mentale, en français, pour adulte. Il complète une prise
en charge et ne remplace pas un professionnel. Il n'a pas reçu de validation clinique ni
d'évaluation indépendante de sécurité.

Deux applications partagent le même contenu : une app iPhone et une app macOS.

## Dépôt

| Dossier | Contenu |
| --- | --- |
| `MieuxVivre/` | App iPhone (SwiftUI + WebKit), version 4.9 (build 17) |
| `MieuxVivre/Web/` | Contenu hors ligne embarqué, identique sur iPhone et sur Mac |
| `MieuxVivreMac/` | App macOS (SwiftUI + WebKit), même contenu |
| `mieux-vivre-sources.zip` | Archive des sources, pour transmission |
| `mieux-vivre.bundle` | Historique Git des sources d'origine |

## iPhone

1. Ouvrir `MieuxVivre/MieuxVivre.xcodeproj` dans Xcode.
2. Choisir son équipe dans *Signing & Capabilities* (`DEVELOPMENT_TEAM`).
3. Sélectionner l'iPhone branché et lancer le projet.

Avec un compte Apple personnel gratuit, la signature dure sept jours. Recompiler et réinstaller
avec le même identifiant conserve le contenu de l'app : ne pas désinstaller entre deux
renouvellements. Voir [le mode d'emploi détaillé](MieuxVivre/LISEZ-MOI.md).

## macOS

```sh
cd MieuxVivreMac
xcodegen generate
open MieuxVivreMac.xcodeproj
```

Le projet est signé en ad-hoc : il se lance sur la machine qui le compile, sans compte
développeur. Pour une distribution à d'autres Mac, signer avec un certificat Developer ID et
notariser.

Le contenu embarqué est le même que sur iPhone. Apple Santé n'existe pas sur macOS : la page
signale la fonction comme indisponible. Les exports (`.json`, `.mvx`, `.txt`) passent par une
fenêtre d'enregistrement.

### Reprendre les données d'un iPhone

Le contenu lit et écrit dans `localStorage`. Sur Mac, ces données vivent dans
`~/Library/WebKit/com.remi.mieuxvivre.mac/`. Pour reprendre un état venu d'un iPhone, déposer un
fichier `migration.json` dans `~/Library/Application Support/MieuxVivre/` :

```json
{
  "mieux-vivre:local:v2": "{\"version\":3,\"guided\":{…}}",
  "mieux-vivre:exercices-favoris:v1": "[]"
}
```

Les valeurs sont les chaînes exactes stockées sur l'iPhone. Elles ne sont écrites que si la clé
est encore absente sur le Mac : une donnée déjà présente reste prioritaire.

## Régénérer le contenu embarqué

`MieuxVivre/Web/` est produit par `MieuxVivre/pack-carnet.py`, qui lit le portail du site. Le
dossier est versionné pour que ce dépôt se compile seul ; le script ne sert qu'à le
régénérer depuis le dépôt du site.

## Web

Servir `MieuxVivre/Web` en HTTPS pour une installation depuis Safari. Ne pas publier les
réponses ni les exports personnels.

## Limites connues

Les réponses sont stockées dans le stockage local de WebKit, sans chiffrement propre à
l'application. Une suppression de l'app ou un effacement du stockage peut les perdre. Utiliser
l'export chiffré `.mvx` pour les sauvegardes.
