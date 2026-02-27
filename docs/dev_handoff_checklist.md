# Dev handoff checklist

## Entrypoints

- [ ] accountId / projectId confirmés
- [ ] campaignId principal confirmé
- [ ] campagne **void** (anonymize) confirmée (si applicable)
- [ ] URL PREPROD et PROD validées
- [ ] Desktop fallback (landing + QR) validé

## Sécurité URL

- [ ] Mode choisi (none / sha256 / aes256cbc)
- [ ] Paramètres d'URL (signature/data) confirmés
- [ ] **Calcul côté serveur** (recommandé) validé
- [ ] Règles d'encoding (URL encoding) confirmées
- [ ] Si AES: padding et payloadTemplate confirmés

## Data contract

- [ ] Liste des champs complète
- [ ] Types + formats validés (ex: dates)
- [ ] Enums finalisés (ex: statuts)
- [ ] Exemples de valeurs disponibles

## Interfaces & flux

- [ ] OAuth CW: urls DEV/PROD confirmées + scope
- [ ] Source system: baseUrl + auth + SLA timeout
- [ ] Update: mode standard vs webhook choisi
- [ ] Opt-in: endpoint côté source défini + payload validé
- [ ] Merge: endpoint / payload validés
- [ ] Anonymize: endpoint / void campaign / purge validés
- [ ] SFTP: host/port/dirs + format + cadence (si applicable)

## Notifications

- [ ] Triggers validés
- [ ] Messages FR/EN < 150 chars
- [ ] Pas de liens (http/https)
- [ ] Cas de test push (si push utilisé)

## Recette

- [ ] Jeux de données (identifiants valides/invalides)
- [ ] Cas d'erreur couverts (ER0/ER1/ER2/ER3…)
- [ ] Observabilité: logs + request-id + métriques
- [ ] Plan de rollback / fallback
