# QUESTIONS.md — Corner Mobile ERP

## Open Questions (need user input)

1. **ICE / IF / RC / CNSS / patente** réels de Corner Mobile — nécessaires pour facturation conforme DGI. Actuellement placeholder.
2. **Capital social** Corner Mobile + **RIB** — pour mentions légales factures.
3. **Compte Sentry** — DSN à fournir pour activer error tracking. Code prêt mais DSN placeholder.
4. **Compte Upstash Redis** — URL + token. Rate limiting fonctionne en mémoire pour l'instant, Redis recommandé pour multi-instance.
5. **Taux de commission par défaut** — % sur marge ? Paliers ? Actuellement configurable par store via commission_rules.
6. **Séquence numérotation factures** — `INV-YYYY-NNNNNN` par défaut. Confirmer le format souhaité.
7. **Taux TVA par défaut pour ventes** — 20% standard appliqué. Corner Mobile est-il assujetti à la TVA ?
8. **ERP_MASTER_SPEC.md** — fichier référencé dans le brief mais absent du repo. Travail basé sur le brief inline.

## Resolved

- ~~Fallback JWT secret~~ → Supprimé, NEXTAUTH_SECRET obligatoire (commit f01e8f0)
- ~~RLS partielle~~ → Migration 006 appliquée, migration 007 en cours pour couverture complète
- ~~Passwords SHA-256~~ → Migré vers bcrypt (12 rounds) avec migration auto
- ~~IMEI Scanner~~ → @zxing/browser intégré avec scan caméra
- ~~Offline POS~~ → localStorage queue avec sync auto implémenté
- ~~Retours produits~~ → Module returns complet avec flux retour/échange
- ~~WhatsApp~~ → wa.me fallback implémenté, API Business en attente approbation Meta

## Historical Decisions

1. **Auth**: JWT custom (jose) — Supabase Auth ne gère pas nativement les rôles multi-tenant
2. **Passwords**: bcrypt (12 rounds) côté serveur, migration auto depuis SHA-256
3. **IMEI Scanner**: @zxing/browser avec caméra + saisie manuelle
4. **Impression étiquettes**: window.print() + bwip-js pour barcodes
5. **Offline POS**: localStorage queue + sync auto
6. **WhatsApp**: wa.me links (fallback), API Business en attente
