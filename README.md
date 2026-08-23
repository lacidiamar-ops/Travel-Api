# OM PRO OPS HUB

Cockpit opérationnel pour la restauration de l'équipe professionnelle : calendrier, actions, routines, Match Center, inbox et reporting 360°.

## Principe d'architecture

Cette application reste isolée des applications OM existantes. Les futures connexions vers Travel Team Pro, Effectif Repas, Audit Hôtel, Repas Après-Match, e-mail professionnel et imports WhatsApp doivent fonctionner en lecture ou via événements contrôlés. Aucune source validée ne doit être écrasée silencieusement.

## Version actuelle

Prototype fonctionnel front-end autonome :
- dashboard quotidien ;
- calendrier opérationnel ;
- actions partagées ou privées ;
- Match Center avec préparation ;
- inbox de signaux externes ;
- reporting 360° ;
- routines relatives au match ;
- persistance locale des actions et mémos.

## Déploiement

Application statique compatible Vercel, sans secret dans le dépôt.
