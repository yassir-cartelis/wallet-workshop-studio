# Guide d'atelier (1–2 sessions)

Objectif : sortir d'un atelier avec un **pack technique complet** permettant aux devs de démarrer sans aller-retour infinis.

## Session 1 — Cadrage (90–120 min)

### 1) Contexte & périmètre
- Objectif produit (1 phrase)
- Périmètre (ce qui est IN / OUT)
- OS cibles (iOS / Android)
- Langues (FR/EN…)
- Fuseau horaire (UTC par défaut, préciser si différent)

### 2) Parcours & canaux
- Touchpoints (email, sms, web, QR…)
- Contextes :
  - authentifié (email/sms/web)
  - non-authentifié (PDV / RS / print via QR)
- Desktop → landing + QR ?

### 3) Entrypoints
- accountId / projectId / campaignId
- Paramètre pivot (ex: `user[identifier]`)
- Conventions `channel` et `tag` (tracking)

### 4) Sécurité URL
- aucun / SHA256 signature / AES-256-CBC
- Où calcule-t-on la signature / le chiffrement ? (serveur recommandé)
- Secrets : mode de partage + rotation + stockage

👉 Livrable : URL templates validées + décision de sécurité + liste des canaux.

## Session 2 — Tech & recette (90–150 min)

### 5) Data contract
- Liste des champs, types, formats, exemples
- Champs requis vs optionnels
- Enumérations (ex: statuts)
- Gouvernance timezone + dates

### 6) Flux & interfaces
- Init : CW -> API Source (GetCustomer)
- Opt-in : CW -> Source (API ou SFTP)
- Updates : Source -> CW (API standard PUT ou webhook)
- Anonymisation : Source -> CW (void + délai)
- Fusion : Source -> CW

### 7) Notifications
- Triggers + messages (150 chars max, pas de lien)

### 8) Erreurs & runbook
- Codes d'erreur + messages FR/EN
- Retry & backoff
- Observabilité (logs / métriques / alertes)

### 9) Plan de tests
- Cas nominaux + edge cases
- Jeux de données / comptes de test

👉 Livrable : export **Dev Pack (.zip)** depuis l'outil.

