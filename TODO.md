# To-do – App modulable & templates

ATTENTION : chaque étape doit préserver les fonctionnalités existantes (Pomodoro, Timer, synchronisation Firebase, notifications). Tester et valider à chaque migration pour éviter de tout faire planter.

## Préparation
- [x] Créer une branche Git dédiée (ex. `feature/modular-workspace`) pour isoler tous les travaux de refonte et y faire les tests.
- [ ] Configurer un projet Firestore “test” ou un environnement séparé (nouveau fichier `google-services` + variables d’env) afin d’expérimenter la couche templates/layouts sans impacter les données actuelles.
- [ ] Préparer un script d’export/import (gcloud ou Node) pour cloner les données entre prod/test si nécessaire.

## Architecture & Modèle de données
- [ ] Définir un schéma unique décrivant l’interface (sections, widgets, champs config). Inclure les types TypeScript (`Section`, `Widget`, `TemplateConfig`, `WidgetProps`) en se basant sur les composants concrets déjà présents (`HomeScreen`, `PomodoroScreen`, `TimerScreen`, cartes de tâches, etc.).
- [ ] Créer un store/hook central (`useWorkspaceLayout`) pour charger, modifier et persister ces configurations. Ce hook devra composer avec `useSettings`, `usePomodoroTimer`, `useDurationField` pour ne pas casser la logique actuelle liée aux timers et aux entrées Firebase.
- [ ] Gérer la compatibilité multi-utilisateur (un document/config par user) et la notion de “workspace”. Clarifier comment associer les workspaces aux utilisateurs déjà stockés dans Firestore.
- [ ] Documenter des règles de tolérance (si un widget est inconnu, ignorer avec un placeholder plutôt que faire planter l’écran).

## Persistance & Services
- [ ] Étendre la couche Firestore existante : collections `templates`, `workspaces`, `userLayouts` avec règles de sécurité mises à jour (`firestore.rules`).
- [ ] Implémenter des services dédiés (`templatesService`, `workspaceService`) pour CRUD des layouts et duplication d’un template vers un utilisateur. Respecter les conventions actuelles (`services/firebase.ts`, `useToast`) pour les retours d’erreurs.
- [ ] Ajouter une synchro hors-ligne inspirée de `services/pomodoroPersistence` : cache AsyncStorage + stratégie de merge (timestamp dernière écriture) afin que l’édition de layout ne bloque pas sans réseau.
- [ ] Prévoir un script/migration pour convertir la config statique actuelle (sections codées en dur dans `HomeScreen`) en templates “officiels” stockés en base, sans écraser les données utilisateurs actuelles.

## Flux Templates
- [ ] Créer un flow “Bienvenue” (nouvelle route dans `types/navigation.ts`) avec choix : démarrer vide ou appliquer un template.
- [ ] Mettre en place une liste des templates disponibles (nom, description, tags, preview des widgets inclus) alimentée par `templatesService`.
- [ ] Implémenter l’action “Utiliser ce template” : copier la config dans le workspace utilisateur, afficher un toast via `useToast`, rediriger vers `HomeScreen`, et gérer un rollback si la copie échoue.
- [ ] Permettre à l’utilisateur d’enregistrer sa config courante comme “template perso” (nom, visibilité, éventuels tags). Stocker `ownerId` pour filtrer.
- [ ] Ajouter une fonction “revenir à un template précédent” avec sauvegarde automatique ou snapshot avant remplacement.

## UI modulable
- [ ] Refactorer `HomeScreen` pour rendre dynamiquement les sections depuis la config (plus de JSX statique). Conserver les styles (`styles/global`, `styles/home`) en injectant les valeurs depuis le layout.
- [ ] Créer des composants génériques (`SectionRenderer`, `WidgetRenderer`) qui traduisent un type de widget en composant concret (Pomodoro, tâches, stats, raccourcis). Vérifier que chaque widget reçoit tout ce dont il a besoin (ex. `stageOptions`, `linkedTaskCardId`).
- [ ] Gérer l’état initial vide : afficher un CTA “Ajouter une section” + raccourci vers le choix de template lorsque `sections.length === 0`. Vérifier que le `ScrollView` et les `SafeAreaView` actuels restent fonctionnels.
- [ ] Implémenter un éditeur de sections : ajouter/renommer/réordonner/supprimer avec confirmations pour éviter de supprimer un widget Pomodoro actif. Sauvegarder chaque modification via `useWorkspaceLayout`.
- [ ] Autoriser la personnalisation d’apparence (titres, icônes, couleurs) tout en s’appuyant sur les constantes déjà en place (`colors`, `layout`, `fontSizes`) pour éviter les incohérences.
- [ ] Prévoir un mécanisme de fallback : si un widget configuré n’est plus supporté, afficher une carte “Widget indisponible” et proposer de le supprimer ou le remplacer.

## Pomodoro & autres modules existants
- [ ] Isoler le widget Pomodoro : extraire le JSX et la logique propre à `PomodoroScreen` dans un composant `PomodoroWidget` plug-and-play, alimenté par la config. Garantir que les hooks (`usePomodoroTimer`, `usePomodoroNotifications`, `usePomodoroAppStateSync`) fonctionnent même lorsque le widget vit dans `HomeScreen`.
- [ ] Créer des adaptateurs pour passer les réglages (`workDuration`, `autoStartBreaks`, `selectedStage`, `categorie`, `subCategory`, `linkedTaskCardId`) via la config du widget.
- [ ] Vérifier la compatibilité avec la persistance actuelle (`savePomodoroState`, `loadPomodoroState`) : décider si plusieurs widgets Pomodoro peuvent coexister ou s’il faut verrouiller à un seul, et documenter l’option retenue.
- [ ] Répéter la démarche pour les autres outils (Timer simple, listes de tâches, statistiques) afin que chaque module puisse être instancié via le layout sans duplication de code.

## Expérience utilisateur & onboarding
- [ ] Ajouter un tutoriel/contextuel (overlay ou carrousel) au premier lancement expliquant comment ajouter des sections, appliquer un template, renommer des widgets. Réutiliser les composants de modales existants pour cohérence.
- [ ] Enregistrer les derniers templates utilisés / favoris par utilisateur pour les suggérer rapidement (stockage dans `userLayouts` + cache local).
- [ ] Implémenter un undo/redo léger (ou à défaut une confirmation) avant la suppression d’une section complète, surtout si elle contient des modules critiques (Pomodoro en cours, statistiques liées).
- [ ] Ajouter des garde-fous : empêcher la suppression d’un widget qui a un état actif (Pomodoro lancé, entrée de temps en cours) tant que l’action n’est pas terminée.

## Tests & Qualité
- [ ] Couvrir les nouveaux services (duplication de template, persistance de layout, migration) avec des tests unitaires en mockant Firestore.
- [ ] Ajouter des tests UI (Jest + React Native Testing Library) pour le rendu dynamique, l’éditeur de sections et le flow de sélection de template. Inclure des cas de régression pour la fonction Pause du Pomodoro.
- [ ] Écrire/automatiser la migration des utilisateurs existants : script pour sauvegarder la config statique actuelle en tant que template par défaut, vérification que rien n’est perdu dans `addEntreeTemps` ou les entrées liées aux stages.
- [ ] Effectuer des tests manuels iOS/Android pour confirmer la continuité des notifications (`usePomodoroNotifications`) et de la gestion d’état (`usePomodoroAppStateSync`).

## Suivi & Analytics
- [ ] Instrumenter l’app pour savoir quels templates sont utilisés, quelles sections sont ajoutées/supprimées, et si des erreurs surviennent lors de l’édition. Utiliser Firebase Analytics ou un service équivalent tout en respectant le consentement utilisateur.
- [ ] Ajouter des logs événementiels sur les actions critiques (application d’un template, création/suppression de section, sauvegarde d’un layout) afin de diagnostiquer rapidement les plantages ou régressions.
