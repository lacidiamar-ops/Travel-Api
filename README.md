# OM PRO Travel

Espace mobile sécurisé pour les déplacements de l'équipe restauration OM PRO.

## Principe d'architecture

L'application reste isolée des autres applications OM. Elle agrège en lecture les tables `travel_*` et ouvre les applications dédiées sans modifier leurs données. Chaque utilisateur ne voit que ses missions grâce aux politiques RLS Supabase. Aucune source validée n'est écrasée silencieusement.

## Version actuelle

Fonctions :
- connexion simple par profil et PIN Travel personnel ;
- comptes Travel dédiés, séparés des comptes des autres applications ;
- quatre espaces : Amar Lacidi, Igal Settbon, Bastien Florido et Damien Cau ;
- planning des binômes et fiche détaillée par déplacement ;
- feuilles de route, billets, hôtel et documents reçus par mail ;
- météo à l'approche du déplacement ;
- accès directs à Audit Hôtel et Cahier des charges ;
- rubrique de demandes et devis reçus par mail pour les traiteurs, pizzas et sushi ;
- Travel Inbox réservée au manager ;
- interface responsive iPhone et Android.
- identité visuelle API Travel et icônes d’accueil iPhone/Android via le manifeste web.

## Déploiement

Application statique compatible Vercel. La clé Supabase publiée côté client est une clé publique ; les données restent protégées par authentification et RLS.
