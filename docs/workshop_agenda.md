# Agenda atelier (suggestion)

## Atelier 1 — Cadrage (60–90 min)

1. **Objectif & périmètre**
   - Quel cas d'usage, quel wallet, quelles contraintes (RGPD, SLA, équipes) ?
2. **Parcours**
   - Canaux: email / web / QR / sms
   - Contextes: connecté / non connecté
   - Desktop: landing + QR ? alternatives ?
3. **Entrypoints**
   - accountId / projectId / campaigns
   - Paramètres URL (identifier, channel, tag)
4. **Sécurité**
   - Aucun / SHA256 / AES256-CBC
   - Où calcule-t-on (serveur recommandé)
5. **Data contract (version 0)**
   - Liste des champs + types + formats + enums
6. **Plan de recette (version 0)**
   - Cas de test minimum + erreurs principales
7. **Sorties**
   - Export ZIP Dev Pack
   - Liste des TBD + owners + dates

## Atelier 2 — Technique (60–120 min)

1. **API Source → Wallet**
   - Endpoints / auth / timeouts / retry
2. **Opt-in Wallet → Source**
   - Endpoint à exposer, payload, sécurisation
3. **Update**
   - Standard vs Webhook mode, choix final
4. **Anonymize & Merge**
   - Règles métier (void campaign, purge)
5. **SFTP (si besoin)**
   - Format fichiers, horaires, retry, idempotence
6. **Observabilité**
   - Logs, request-id, métriques (succès/échec, latence)
7. **Recette finale**
   - Jeux de données + exécution + go/no-go
