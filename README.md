# 🎓 EduManager - Gestionnaire Scolaire Complet

## 📋 Description
EduManager est un gestionnaire scolaire complet avec système d'alertes email automatiques pour les révisions et emails de motivation bimensuels.

## ✨ Fonctionnalités

### 🔐 Authentification
- Inscription/Connexion avec Firebase
- Option d'activation des notifications email

### 📚 Gestion des matières
- Ajouter des matières avec couleurs et coefficients
- Supprimer des matières
- Organisation personnalisée

### 📝 Gestion des devoirs
- Ajout de devoirs par matière
- Notes et suivi des devoirs terminés
- Calcul automatique des notes sur 20

### 📅 Emploi du temps
- Création d'emploi du temps personnalisé
- Organisation par jour et heure
- Association aux matières

### 🎯 Planning de révisions
- Planification de sessions de révision
- Durée et sujet des révisions
- **Alertes email la veille à 20h**

### 🏆 Objectifs
- Fixation d'objectifs par matière ou généraux
- Suivi de la progression
- **Alertes 3 jours avant la date limite**

### 📊 Statistiques
- Moyenne générale
- Moyennes par matière
- Évolution des notes
- Temps de révision par matière
- Taux de réussite

### 📧 Emails automatiques
- **Email de motivation toutes les 2 semaines** avec :
  - Statistiques complètes
  - Conseils personnalisés
  - Suivi des objectifs
- **Alertes de révision** la veille à 20h
- **Rappels d'objectifs** 3 jours avant

## 🚀 Installation

### 1. Créer un projet Firebase

1. Va sur [Firebase Console](https://console.firebase.google.com/)
2. Crée un nouveau projet
3. Active **Authentication** → Email/Password
4. Active **Realtime Database**
5. Règles de sécurité à ajouter :

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "data": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

6. Copie la configuration Firebase dans `app.js` (lignes 6-13)

### 2. Configurer SendGrid

1. Crée un compte sur [SendGrid](https://sendgrid.com/)
2. Crée une API Key :
   - Settings → API Keys → Create API Key
   - Nom : "EduManager"
   - Permissions : Full Access
3. Copie la clé dans `app.js` (ligne 16)

**⚠️ IMPORTANT** : Pour utiliser SendGrid depuis le navigateur, tu dois créer un backend (Node.js, Python, PHP) ou utiliser Firebase Cloud Functions.

### Alternative sans backend pour les emails :
Utilise **EmailJS** (plus simple) :
1. Crée un compte sur [EmailJS](https://www.emailjs.com/)
2. Configure un service email (Gmail, Outlook, etc.)
3. Crée des templates pour :
   - Email de motivation
   - Alerte de révision
   - Rappel d'objectif

Remplace les fonctions SendGrid dans `app.js` par :

```javascript
// Remplacer ligne 16 par :
const EMAILJS_SERVICE_ID = "ton_service_id";
const EMAILJS_TEMPLATE_MOTIVATION = "template_motivation";
const EMAILJS_TEMPLATE_REVISION = "template_revision";
const EMAILJS_PUBLIC_KEY = "ta_public_key";

// Ajouter après Firebase :
emailjs.init(EMAILJS_PUBLIC_KEY);

// Remplacer la fonction envoyerEmail :
async function envoyerEmail(destinataire, sujet, contenu) {
    try {
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_MOTIVATION, // ou autre template
            {
                to_email: destinataire,
                subject: sujet,
                message: contenu
            }
        );
        console.log('Email envoyé');
    } catch (error) {
        console.error('Erreur:', error);
    }
}
```

### 3. Hébergement sur GitHub Pages

1. Crée un nouveau repository sur GitHub
2. Upload les 3 fichiers :
   - `index.html`
   - `styles.css`
   - `app.js`
3. Va dans Settings → Pages
4. Source : Deploy from a branch
5. Branch : main → / (root)
6. Clique sur Save
7. Ton site sera disponible sur : `https://ton-username.github.io/ton-repo/`

## 📁 Structure des fichiers

```
edumanager/
├── index.html      # Structure HTML complète
├── styles.css      # Design sombre et professionnel
└── app.js          # Logique JavaScript + Firebase + Emails
```

## 🔧 Configuration

### Personnaliser les horaires d'envoi

Dans `app.js`, modifie :

```javascript
// Email de révision (ligne ~200)
if (revisionsAVenir.length > 0 && new Date().getHours() === 20) {
    // Changer 20 par l'heure voulue
}

// Fréquence emails de motivation (ligne ~150)
if (diffJours >= 14) {
    // Changer 14 par le nombre de jours souhaité
}
```

### Personnaliser les designs d'emails

Les templates HTML sont dans les fonctions :
- `genererEmailMotivation()` (ligne ~170)
- `genererEmailRevision()` (ligne ~220)
- `genererEmailObjectif()` (ligne ~280)

## 📱 Responsive

L'application est 100% responsive :
- Desktop : Vue complète avec tous les éléments
- Mobile : Navigation adaptée avec scroll horizontal
- Tablette : Grilles adaptatives

## 🎨 Personnalisation des couleurs

Dans `styles.css`, modifie les variables CSS (lignes 9-20) :

```css
:root {
    --bg-primary: #111827;    /* Fond principal */
    --bg-secondary: #1F2937;  /* Cartes */
    --blue: #3B82F6;          /* Couleur principale */
    /* etc. */
}
```

## 🔐 Sécurité

- ✅ Authentification Firebase sécurisée
- ✅ Règles de base de données strictes
- ✅ Données isolées par utilisateur
- ⚠️ **IMPORTANT** : Ne jamais exposer tes clés API dans le code en production

### Sécuriser les clés API :

Pour production, utilise des variables d'environnement ou Firebase Functions :

```javascript
// firebase-functions/index.js
const functions = require('firebase-functions');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(functions.config().sendgrid.key);

exports.envoyerEmail = functions.https.onCall((data, context) => {
    // Vérifier que l'utilisateur est authentifié
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
    }
    
    // Envoyer l'email via SendGrid
    return sgMail.send(data.emailData);
});
```

## 🐛 Dépannage

### Firebase ne se connecte pas
- Vérifie que les règles de sécurité sont correctes
- Vérifie que l'authentification Email/Password est activée
- Vérifie ta configuration Firebase dans `app.js`

### Emails ne s'envoient pas
- Vérifie ta clé SendGrid
- Vérifie que tu as vérifié ton domaine sur SendGrid
- Pour EmailJS : vérifie que le service est actif

### Données ne se sauvegardent pas
- Ouvre la console du navigateur (F12)
- Vérifie les erreurs dans l'onglet Console
- Vérifie que Firebase Realtime Database est bien activé

## 📈 Améliorations futures

- [ ] Export des données en PDF
- [ ] Import/Export de l'emploi du temps
- [ ] Synchronisation calendrier Google
- [ ] Mode hors ligne avec Service Workers
- [ ] Notifications push navigateur
- [ ] Partage de ressources entre élèves
- [ ] Application mobile native (React Native)

## 👨‍💻 Développé pour ton portfolio

Ce projet montre mes compétences en :
- ✅ HTML/CSS/JavaScript
- ✅ Firebase (Auth + Database)
- ✅ Intégration API (SendGrid/EmailJS)
- ✅ Design Responsive
- ✅ UX/UI moderne
- ✅ Gestion d'état complexe
- ✅ Automatisation (emails)

## 📞 Support

Pour toute question, n'hésite pas à me demander !
papedjibril07@gmail.com

## 📄 Licence

Ce projet est libre d'utilisation pour ton portfolio et tes projets personnels.
---

**Nexor-agency bay pape Djibril Ndiaye EduManager ! 🚀**