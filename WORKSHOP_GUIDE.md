# Workshop guide

Ce guide décrit **comment animer** 1 à 2 ateliers pour sortir une spéc prête pour lancer le dev à partir de *Wallet Workshop Studio*.

## Avant l'atelier

- Partager le lien de l'outil (index.html) + un `spec.json` existant si vous en avez un.
- Préparer :
  - une liste de statuts / enums (métier),
  - 2–3 identifiants de test (valide / invalide),
  - les contraintes de sécurité (SHA / AES / none),
  - le choix update `standard` vs `webhook` (si connu).

## Pendant l'atelier

### Règles

- Toute décision = ajout dans **Workshop log** (Décision / Question / Action).
- Tout champ ajouté au pass = ajouté dans **Data contract**.
- Tout endpoint/API = précisé dans **Flux & Interfaces** (baseUrl, auth, timeouts).

### Sorties à obtenir

- URLs d'encartement **PREPROD** et **PROD** validées
- Mode de sécurisation validé (+ paramètres signature/data)
- Data contract complet (champs + formats + enums)
- Choix des transports (API/SFTP) pour update/opt-in/anonymize/merge
- Plan de recette (AC + cas de test + erreurs)
- Export **Dev Pack ZIP** (pour lancer le dev)

## Après l'atelier

- Exporter le **Dev Pack ZIP**
- Le commit dans un repo interne (ou le joindre à un ticket)
- Maintenir un cycle : *change request* → atelier court → export nouvelle version

## Conseils pratiques

- Garder les secrets (clé AES, salt…) hors de l’export si vous devez partager le pack largement.
- Toujours mettre un **request-id** (ou corrélation) dans les logs et, si possible, dans les payloads.
- Prévoir une stratégie d'idempotence (surtout update webhook / SFTP).
