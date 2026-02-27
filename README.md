# Wallet Workshop Studio

Un studio "atelier" (métiers + tech) pour cadrer un projet Wallet (Apple Wallet / Google Wallet) et **générer automatiquement un pack de spécifications techniques** prêt pour lancer le développement.

Ce repo contient une **web-app 100% front** (Vue 3 + Tailwind via CDN) :
- saisie guidée (champs essentiels + avancés)
- validations / complétude
- preview live (URLs d'encartement, payloads, data contract, erreurs, etc.)
- export JSON / HTML / **pack dev (.zip)** / lien de partage (URL)

> Référence fonctionnelle/technique : cette version reprend et structure les points clés du PDF Colissimo fourni (URLs d'encartement, sécurisation, mapping, flux update/opt-in/anonymize/merge, SFTP, plan de recette, erreurs).

## Démarrage

### Option 1 — ultra simple (recommandé pour ateliers)
Ouvre `index.html` dans un navigateur récent.

### Option 2 — via un serveur statique (évite certains blocages navigateur)
```bash
python -m http.server 8080
# puis http://localhost:8080
```

## Utilisation en atelier

1. Remplir l'onglet **Contexte & Parcours** (périmètre, canaux, OS, contextes authentifié / non-authentifié).
2. Définir **Entrypoints** (accountId / projectId / campaignId, paramètres `user[identifier]`, `channel`, `tag`, etc.)
3. Choisir **Sécurité URL** (aucune / SHA256 signature / AES-256-CBC) et acter **où** se fait le calcul (serveur recommandé).
4. Compléter le **Data contract** (mapping, types, formats, règles métier).
5. Définir les **Flux & Interfaces** (GetCustomer, update, opt-in, anonymisation, fusion, SFTP).
6. Formaliser **Notifications** + **Playbook erreurs**.
7. Ajouter les **Décisions / Questions / Actions** du workshop.
8. Exporter **Dev Pack (.zip)** : tu obtiens un dossier de docs (Markdown + OpenAPI stub + Mermaid) + spec JSON.

## Exportés par le Dev Pack

Le `.zip` exporté contient typiquement :
- `spec.json` (source de vérité)
- `SPEC.html` (doc imprimable / PDF)
- `SPEC.md` (doc lisible & versionnable)
- `data_contract.csv`
- `openapi_stub.yaml`
- `architecture.mmd` (Mermaid)
- `notifications.md`
- `error_playbook.md`
- `test_plan.md`

## Sécurité / données

- **Sauvegarde locale** uniquement (localStorage).
- Aucun envoi réseau.
- Le mode "preview" SHA/AES sert à valider les formats. En prod, privilégier un calcul côté serveur / ETL.

## Licence
MIT (voir `LICENSE`).
