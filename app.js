// ============================================
// CONFIGURATION FIREBASE
// ============================================

// CLÉS FIREBASE
const firebaseConfig = {

  apiKey: "AIzaSyBA6vhqMvDzuW58w_xYOrz6Xggfl-J6PiU",

  authDomain: "edumanager-2c50d.firebaseapp.com",

  databaseURL: "https://edumanager-2c50d-default-rtdb.europe-west1.firebasedatabase.app",

  projectId: "edumanager-2c50d",

  storageBucket: "edumanager-2c50d.firebasestorage.app",

  messagingSenderId: "641523690384",

  appId: "1:641523690384:web:3d43ad33ad8651fd2e6115"

};



// ============================================
// CONFIGURATION EMAILJS
// ============================================

//EMAILJS CONFIG
const EMAILJS_PUBLIC_KEY = "p0luQqItbyQq1SZWY"; // ← Ta Public Key
const EMAILJS_SERVICE_ID = "service_q5sypzt"; // ← Ton Service ID
const EMAILJS_TEMPLATE_MOTIVATION = "template_8cuvlko"; // ← Template 1
const EMAILJS_TEMPLATE_REVISION = "template_e45t3es"; // ← Template 2

// Initialiser EmailJS (à ajouter APRÈS l'initialisation Firebase)
emailjs.init(EMAILJS_PUBLIC_KEY);

// ============================================
// FONCTIONS D'ENVOI D'EMAILS
// ============================================

// Email de motivation (toutes les 2 semaines)
async function checkMotivationEmail(userData) {
    if (!userData.emailNotifications) return;
    
    const derniere = new Date(userData.derniereMotivation);
    const maintenant = new Date();
    const diffJours = (maintenant - derniere) / (1000 * 60 * 60 * 24);
    
    // Vérifier si ça fait 14 jours
    if (diffJours >= 14) {
        const stats = calculerStatistiques();
        const motivation = getNiveauMotivation(stats.moyenneGenerale, stats.tauxReussite);
        
        const conseils = genererConseils(stats);
        const objectifsTexte = genererObjectifsTexte(stats);
        
        try {
            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_MOTIVATION,
                {
                    prenom: userData.prenom || userData.nom,
                    to_email: userData.email,
                    moyenne: stats.moyenneGenerale,
                    tauxReussite: stats.tauxReussite,
                    heuresRevision: stats.heuresRevision,
                    devoirsFaits: stats.devoirsFaits,
                    totalDevoirs: stats.totalDevoirs,
                    motivation_emoji: motivation.emoji,
                    motivation_message: motivation.message,
                    conseils: conseils,
                    objectifs: objectifsTexte
                }
            );
            
            console.log('✅ Email de motivation envoyé');
            
            // Mettre à jour la date du dernier email
            await database.ref('users/' + currentUser.uid + '/derniereMotivation').set(maintenant.toISOString());
            
        } catch (error) {
            console.error('❌ Erreur envoi email motivation:', error);
        }
    }
}

// Générer les conseils personnalisés
function genererConseils(stats) {
    const conseils = [];
    
    if (parseFloat(stats.moyenneGenerale) < 12) {
        conseils.push('📚 Augmente ton temps de révision de 15 minutes par jour');
        conseils.push('✍️ Fais des fiches de révision pour mieux mémoriser');
    }
    
    if (parseFloat(stats.tauxReussite) < 80) {
        conseils.push('⏰ Planifie tes devoirs dès qu\'ils sont donnés');
        conseils.push('📅 Utilise un agenda pour ne rien oublier');
    }
    
    if (stats.revisionsTerminees < 5) {
        conseils.push('🎯 Fixe-toi 3 sessions de révision par semaine minimum');
    }
    
    if (parseFloat(stats.moyenneGenerale) >= 15) {
        conseils.push('⭐ Excellente performance ! Continue sur cette lancée !');
        conseils.push('🚀 Challenge-toi avec des exercices plus difficiles');
    }
    
    return conseils.length > 0 ? conseils.join('\n') : 'Continue tes efforts !';
}

// Générer le texte des objectifs
function genererObjectifsTexte(stats) {
    const objectifsNonAtteints = objectifs.filter(obj => {
        const moyenneActuelle = obj.matiere === 'Général' 
            ? parseFloat(stats.moyenneGenerale) 
            : calculerMoyenneMatiere(obj.matiere);
        return moyenneActuelle < obj.cible;
    });
    
    if (objectifsNonAtteints.length === 0) {
        return '✅ Tous tes objectifs sont atteints ! Bravo ! 🎉';
    }
    
    return objectifsNonAtteints.slice(0, 3).map(obj => {
        const moyenneActuelle = obj.matiere === 'Général' 
            ? parseFloat(stats.moyenneGenerale) 
            : calculerMoyenneMatiere(obj.matiere);
        const ecart = obj.cible - moyenneActuelle;
        return '• ' + obj.titre + ' - Il te manque ' + ecart.toFixed(1) + ' points';
    }).join('\n');
}

// Alertes de révision (la veille à 20h)
async function checkRevisionAlerts() {
    const userData = (await database.ref('users/' + currentUser.uid).once('value')).val();
    if (!userData.emailNotifications) return;
    
    const maintenant = new Date();
    const heure = maintenant.getHours();
    
    // Vérifier si c'est 20h
    if (heure !== 20) return;
    
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const demainStr = demain.toISOString().split('T')[0];
    
    const revisionsAVenir = revisions.filter(rev => 
        !rev.fait && rev.date === demainStr
    );
    
    if (revisionsAVenir.length > 0) {
        const listeRevisions = revisionsAVenir.map(rev => 
            '• ' + rev.matiere + ' - ' + rev.sujet + ' (' + rev.duree + ' min) à ' + rev.heure
        ).join('\n');
        
        try {
            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_REVISION,
                {
                    prenom: userData.prenom || userData.nom,
                    to_email: userData.email,
                    nombre_revisions: revisionsAVenir.length,
                    liste_revisions: listeRevisions
                }
            );
            
            console.log('✅ Email de révision envoyé');
            
        } catch (error) {
            console.error('❌ Erreur envoi email révision:', error);
        }
    }
}

// Rappel d'objectif (3 jours avant)
async function checkObjectifAlerts() {
    const userData = (await database.ref('users/' + currentUser.uid).once('value')).val();
    if (!userData.emailNotifications) return;
    
    const maintenant = new Date();
    const stats = calculerStatistiques();
    
    for (const obj of objectifs) {
        // Skip si déjà atteint
        const moyenneActuelle = obj.matiere === 'Général' 
            ? parseFloat(stats.moyenneGenerale) 
            : calculerMoyenneMatiere(obj.matiere);
        
        if (moyenneActuelle >= obj.cible) continue;
        
        // Skip si alerte déjà envoyée
        if (obj.alerteEnvoyee) continue;
        
        const dateObjectif = new Date(obj.date);
        const joursRestants = Math.ceil((dateObjectif - maintenant) / (1000 * 60 * 60 * 24));
        
        // Alerte 3 jours avant
        if (joursRestants === 3) {
            const reste = (obj.cible - moyenneActuelle).toFixed(1);
            
            try {
                await emailjs.send(
                    EMAILJS_SERVICE_ID,
                    EMAILJS_TEMPLATE_OBJECTIF,
                    {
                        prenom: userData.prenom || userData.nom,
                        to_email: userData.email,
                        objectif_titre: obj.titre,
                        objectif_cible: obj.cible,
                        progression_actuelle: moyenneActuelle.toFixed(1),
                        reste: reste
                    }
                );
                
                console.log('✅ Email objectif envoyé pour:', obj.titre);
                
                // Marquer comme envoyée
                await database.ref('data/' + currentUser.uid + '/objectifs/' + obj.id + '/alerteEnvoyee').set(true);
                obj.alerteEnvoyee = true;
                
            } catch (error) {
                console.error('❌ Erreur envoi email objectif:', error);
            }
        }
    }
}

// ============================================
// VÉRIFICATION AUTOMATIQUE (TOUTES LES HEURES)
// ============================================

// Lancer les vérifications toutes les heures
setInterval(() => {
    if (currentUser) {
        checkRevisionAlerts();
        checkObjectifAlerts();
    }
}, 3600000); // 1 heure = 3600000 ms

// Vérifier au chargement aussi
window.addEventListener('load', async () => {
    if (currentUser) {
        const userData = (await database.ref('users/' + currentUser.uid).once('value')).val();
        if (userData) {
            await checkMotivationEmail(userData);
            await checkRevisionAlerts();
            await checkObjectifAlerts();
        }
    }
});

// ============================================
// BOUTON TEST EMAIL (OPTIONNEL - pour tester)
// ============================================

async function envoyerEmailTest() {
    const userData = (await database.ref('users/' + currentUser.uid).once('value')).val();
    if (!userData) {
        alert('Erreur : données utilisateur introuvables');
        return;
    }
    
    const stats = calculerStatistiques();
    const motivation = getNiveauMotivation(stats.moyenneGenerale, stats.tauxReussite);
    
    const conseils = genererConseils(stats);
    const objectifsTexte = genererObjectifsTexte(stats);
    
    try {
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_MOTIVATION,
            {
                prenom: userData.prenom || userData.nom,
                to_email: userData.email,
                moyenne: stats.moyenneGenerale,
                tauxReussite: stats.tauxReussite,
                heuresRevision: stats.heuresRevision,
                devoirsFaits: stats.devoirsFaits,
                totalDevoirs: stats.totalDevoirs,
                motivation_emoji: motivation.emoji,
                motivation_message: motivation.message,
                conseils: conseils,
                objectifs: objectifsTexte
            }
        );
        
        alert('✅ Email de test envoyé à ' + userData.email + '\n\nVérifie ta boîte de réception (et les spams) !');
        
    } catch (error) {
        console.error('Erreur:', error);
        alert('❌ Erreur lors de l\'envoi : ' + error.text);
    }
}

console.log('✅ Module EmailJS chargé');



// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// ============================================
// VARIABLES GLOBALES
// ============================================

let currentUser = null;
let matieres = [];
let devoirs = [];
let emploiDuTemps = {};
let revisions = [];
let objectifs = [];

// ============================================
// AUTHENTIFICATION
// ============================================

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

async function register() {
    const nom = document.getElementById('registerNom').value.trim();
    const prenom = document.getElementById('registerPrenom').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const emailNotifications = document.getElementById('emailNotifications').checked;

    if (!nom || !prenom || !email || !password) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    if (password.length < 6) {
        alert('Le mot de passe doit contenir au moins 6 caractères');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await database.ref('users/' + user.uid).set({
            nom: nom,
            prenom: prenom,
            email: email,
            emailNotifications: emailNotifications,
            dateInscription: new Date().toISOString(),
            derniereMotivation: new Date().toISOString()
        });

        console.log('Compte créé avec succès');
    } catch (error) {
        console.error('Erreur inscription:', error);
        let message = '';
        
        switch(error.code) {
            case 'auth/email-already-in-use':
                message = 'Cet email est déjà utilisé';
                break;
            case 'auth/invalid-email':
                message = 'Email invalide';
                break;
            case 'auth/weak-password':
                message = 'Mot de passe trop faible (min 6 caractères)';
                break;
            default:
                message = 'Erreur: ' + error.message;
        }
        alert(message);
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        console.log('Connexion réussie');
    } catch (error) {
        console.error('Erreur connexion:', error);
        let message = '';
        
        switch(error.code) {
            case 'auth/user-not-found':
                message = 'Aucun compte avec cet email';
                break;
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                message = 'Email ou mot de passe incorrect';
                break;
            case 'auth/invalid-email':
                message = 'Email invalide';
                break;
            case 'auth/too-many-requests':
                message = 'Trop de tentatives. Attendez quelques minutes.';
                break;
            default:
                message = 'Erreur: ' + error.message;
        }
        alert(message);
    }
}

async function logout() {
    try {
        await auth.signOut();
        console.log('Déconnexion réussie');
        
        currentUser = null;
        matieres = [];
        devoirs = [];
        emploiDuTemps = {};
        revisions = [];
        objectifs = [];
        
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginPage').style.display = 'flex';
        
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        showLogin();
    } catch (error) {
        console.error('Erreur déconnexion:', error);
        alert('Erreur lors de la déconnexion');
    }
}

async function resetPassword() {
    const email = document.getElementById('loginEmail').value.trim();
    
    if (!email) {
        alert('Veuillez entrer votre email dans le champ ci-dessus');
        return;
    }
    
    try {
        await auth.sendPasswordResetEmail(email);
        alert('Email de réinitialisation envoyé à ' + email);
    } catch (error) {
        console.error('Erreur reset password:', error);
        alert('Erreur: ' + error.message);
    }
}

auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? user.email : 'no user');
    
    if (user) {
        try {
            await loadUserData(user);
        } catch (error) {
            console.error('Erreur chargement données:', error);
            alert('Erreur lors du chargement des données');
        }
    } else {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        currentUser = null;
    }
});

async function loadUserData(user) {
    console.log('Chargement des données pour:', user.email);
    currentUser = user;
    
    try {
        const snapshot = await database.ref('users/' + user.uid).once('value');
        const userData = snapshot.val();
        
        if (!userData) {
            console.error('Pas de données utilisateur');
            await logout();
            alert('Erreur: données utilisateur introuvables');
            return;
        }
        
        console.log('Données utilisateur chargées:', userData);
        
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        const greeting = document.getElementById('userGreeting');
        if (greeting) {
            greeting.textContent = 'Bonjour, ' + (userData.prenom || userData.nom) + ' !';
        }
        
        await loadAllData();
        showTab('dashboard');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        console.log('Interface chargée avec succès');
        
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
        alert('Erreur lors du chargement des données');
    }
}

async function loadAllData() {
    const uid = currentUser.uid;
    console.log('Chargement des données pour UID:', uid);
    
    try {
        const matieresSnap = await database.ref('data/' + uid + '/matieres').once('value');
        matieres = matieresSnap.val() ? Object.values(matieresSnap.val()) : [];
        console.log('Matières chargées:', matieres.length);
        
        const devoirsSnap = await database.ref('data/' + uid + '/devoirs').once('value');
        devoirs = devoirsSnap.val() ? Object.values(devoirsSnap.val()) : [];
        console.log('Devoirs chargés:', devoirs.length);
        
        const emploiSnap = await database.ref('data/' + uid + '/emploi').once('value');
        emploiDuTemps = emploiSnap.val() || {};
        console.log('Emploi du temps chargé');
        
        const revisionsSnap = await database.ref('data/' + uid + '/revisions').once('value');
        revisions = revisionsSnap.val() ? Object.values(revisionsSnap.val()) : [];
        console.log('Révisions chargées:', revisions.length);
        
        const objectifsSnap = await database.ref('data/' + uid + '/objectifs').once('value');
        objectifs = objectifsSnap.val() ? Object.values(objectifsSnap.val()) : [];
        console.log('Objectifs chargés:', objectifs.length);
        
    } catch (error) {
        console.error('Erreur chargement données:', error);
        throw error;
    }
}

// ============================================
// NAVIGATION
// ============================================

function showTab(tabName) {
    console.log('Affichage onglet:', tabName);
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tabElement = document.getElementById(tabName + 'Tab');
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    const navButton = document.querySelector('[data-tab="' + tabName + '"]');
    if (navButton) {
        navButton.classList.add('active');
    }
    
    try {
        switch(tabName) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'matieres':
                renderMatieres();
                break;
            case 'devoirs':
                renderDevoirs();
                break;
            case 'emploi':
                renderEmploi();
                break;
            case 'revisions':
                renderRevisions();
                break;
            case 'objectifs':
                renderObjectifs();
                break;
            case 'stats':
                renderStats();
                break;
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (error) {
        console.error('Erreur affichage onglet:', error);
    }
}

// ============================================
// MATIÈRES
// ============================================

function showAddMatiereForm() {
    const form = document.getElementById('addMatiereForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function ajouterMatiere() {
    const nom = document.getElementById('matiereNom').value.trim();
    const couleur = document.getElementById('matiereCouleur').value;
    const coefficient = parseInt(document.getElementById('matiereCoef').value);
    
    if (!nom) {
        alert('Veuillez entrer un nom de matière');
        return;
    }
    
    const matiere = {
        id: Date.now().toString(),
        nom: nom,
        couleur: couleur,
        coefficient: coefficient
    };
    
    try {
        matieres.push(matiere);
        await database.ref('data/' + currentUser.uid + '/matieres/' + matiere.id).set(matiere);
        
        document.getElementById('matiereNom').value = '';
        document.getElementById('matiereCouleur').value = '#3B82F6';
        document.getElementById('matiereCoef').value = '1';
        
        showAddMatiereForm();
        renderMatieres();
        updateMatiereSelects();
        
        console.log('Matière ajoutée:', matiere);
    } catch (error) {
        console.error('Erreur ajout matière:', error);
        alert('Erreur lors de l\'ajout');
    }
}

async function supprimerMatiere(id) {
    if (!confirm('Supprimer cette matière ?')) return;
    
    try {
        matieres = matieres.filter(m => m.id !== id);
        await database.ref('data/' + currentUser.uid + '/matieres/' + id).remove();
        
        renderMatieres();
        updateMatiereSelects();
    } catch (error) {
        console.error('Erreur suppression:', error);
    }
}

function renderMatieres() {
    const container = document.getElementById('matieresList');
    if (!container) return;
    
    if (matieres.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i data-lucide="book-open" style="width: 48px; height: 48px;"></i><p>Aucune matière</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    container.innerHTML = matieres.map(m => 
        '<div class="matiere-card">' +
        '<div class="matiere-header">' +
        '<div class="matiere-name">' +
        '<div class="color-dot" style="background: ' + m.couleur + ';"></div>' +
        '<h3>' + m.nom + '</h3>' +
        '</div>' +
        '<button onclick="supprimerMatiere(\'' + m.id + '\')" class="btn-danger"><i data-lucide="trash-2"></i></button>' +
        '</div>' +
        '<p style="color: var(--text-secondary); font-size: 14px;">Coefficient: ' + m.coefficient + '</p>' +
        '</div>'
    ).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateMatiereSelects() {
    const selects = ['devoirMatiere', 'coursMatiere', 'revisionMatiere', 'objectifMatiere'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const options = matieres.map(m => '<option value="' + m.nom + '">' + m.nom + '</option>').join('');
        
        if (selectId === 'objectifMatiere') {
            select.innerHTML = '<option value="">Général</option>' + options;
        } else {
            select.innerHTML = '<option value="">Choisir une matière</option>' + options;
        }
    });
}

// ============================================
// DEVOIRS
// ============================================

function showAddDevoirForm() {
    if (matieres.length === 0) {
        alert('Ajoutez d\'abord des matières !');
        return;
    }
    const form = document.getElementById('addDevoirForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    updateMatiereSelects();
}

async function ajouterDevoir() {
    const matiere = document.getElementById('devoirMatiere').value;
    const titre = document.getElementById('devoirTitre').value.trim();
    const date = document.getElementById('devoirDate').value;
    const noteMax = parseInt(document.getElementById('devoirNoteMax').value);
    
    if (!matiere || !titre || !date) {
        alert('Veuillez remplir tous les champs');
        return;
    }
    
    const devoir = {
        id: Date.now().toString(),
        matiere: matiere,
        titre: titre,
        date: date,
        noteMax: noteMax,
        note: null,
        fait: false
    };
    
    try {
        devoirs.push(devoir);
        await database.ref('data/' + currentUser.uid + '/devoirs/' + devoir.id).set(devoir);
        
        document.getElementById('devoirMatiere').value = '';
        document.getElementById('devoirTitre').value = '';
        document.getElementById('devoirDate').value = '';
        document.getElementById('devoirNoteMax').value = '20';
        
        showAddDevoirForm();
        renderDevoirs();
        renderDashboard();
    } catch (error) {
        console.error('Erreur ajout devoir:', error);
    }
}

async function toggleDevoir(id) {
    const devoir = devoirs.find(d => d.id === id);
    if (!devoir) return;
    
    try {
        devoir.fait = !devoir.fait;
        await database.ref('data/' + currentUser.uid + '/devoirs/' + id + '/fait').set(devoir.fait);
        renderDevoirs();
        renderDashboard();
    } catch (error) {
        console.error('Erreur toggle:', error);
    }
}

async function updateNoteDevoir(id, note) {
    const devoir = devoirs.find(d => d.id === id);
    if (!devoir) return;
    
    try {
        devoir.note = note ? parseFloat(note) : null;
        devoir.fait = note !== null && note !== '';
        
        await database.ref('data/' + currentUser.uid + '/devoirs/' + id).update({
            note: devoir.note,
            fait: devoir.fait
        });
        
        renderDevoirs();
        renderDashboard();
    } catch (error) {
        console.error('Erreur update note:', error);
    }
}

function renderDevoirs() {
    const container = document.getElementById('devoirsList');
    if (!container) return;
    
    if (devoirs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="check" style="width: 48px; height: 48px;"></i><p>Aucun devoir</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    container.innerHTML = devoirs.map(d => 
        '<div class="list-item">' +
        '<div class="checkbox-custom ' + (d.fait ? 'checked' : '') + '" onclick="toggleDevoir(\'' + d.id + '\')">' +
        (d.fait ? '<i data-lucide="check" style="width: 14px; height: 14px;"></i>' : '') +
        '</div>' +
        '<div class="list-item-content">' +
        '<div class="list-item-header">' +
        '<span class="badge badge-blue">' + d.matiere + '</span>' +
        '<span style="color: var(--text-secondary); font-size: 14px;">' + d.date + '</span>' +
        '</div>' +
        '<div class="list-item-title ' + (d.fait ? 'completed' : '') + '">' + d.titre + '</div>' +
        '<div class="note-input-group">' +
        '<input type="number" class="note-input" placeholder="Note" value="' + (d.note || '') + '" onchange="updateNoteDevoir(\'' + d.id + '\', this.value)" step="0.5" max="' + d.noteMax + '">' +
        '<span style="color: var(--text-secondary); font-size: 14px;">/ ' + d.noteMax + '</span>' +
        (d.note !== null ? '<span class="text-green" style="font-weight: 600; font-size: 14px;">(' + ((d.note / d.noteMax) * 20).toFixed(1) + '/20)</span>' : '') +
        '</div>' +
        '</div>' +
        '</div>'
    ).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// EMPLOI DU TEMPS
// ============================================

function showAddCoursForm() {
    if (matieres.length === 0) {
        alert('Ajoutez d\'abord des matières !');
        return;
    }
    const form = document.getElementById('addCoursForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    updateMatiereSelects();
}

async function ajouterCours() {
    const jour = document.getElementById('coursJour').value;
    const heure = document.getElementById('coursHeure').value;
    const matiere = document.getElementById('coursMatiere').value;
    const salle = document.getElementById('coursSalle').value;
    
    if (!jour || !heure || !matiere) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    if (!emploiDuTemps[jour]) {
        emploiDuTemps[jour] = [];
    }
    
    const cours = {
        id: Date.now().toString(),
        heure: heure,
        matiere: matiere,
        salle: salle
    };
    
    try {
        emploiDuTemps[jour].push(cours);
        emploiDuTemps[jour].sort((a, b) => a.heure.localeCompare(b.heure));
        
        await database.ref('data/' + currentUser.uid + '/emploi/' + jour).set(emploiDuTemps[jour]);
        
        document.getElementById('coursJour').value = 'Lundi';
        document.getElementById('coursHeure').value = '';
        document.getElementById('coursMatiere').value = '';
        document.getElementById('coursSalle').value = '';
        
        showAddCoursForm();
        renderEmploi();
    } catch (error) {
        console.error('Erreur ajout cours:', error);
    }
}

async function supprimerCours(jour, id) {
    if (!confirm('Supprimer ce cours ?')) return;
    
    try {
        emploiDuTemps[jour] = emploiDuTemps[jour].filter(c => c.id !== id);
        
        if (emploiDuTemps[jour].length === 0) {
            delete emploiDuTemps[jour];
            await database.ref('data/' + currentUser.uid + '/emploi/' + jour).remove();
        } else {
            await database.ref('data/' + currentUser.uid + '/emploi/' + jour).set(emploiDuTemps[jour]);
        }
        
        renderEmploi();
    } catch (error) {
        console.error('Erreur suppression cours:', error);
    }
}

function renderEmploi() {
    const container = document.getElementById('emploiList');
    if (!container) return;
    
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    
    if (Object.keys(emploiDuTemps).length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="calendar" style="width: 48px; height: 48px;"></i><p>Aucun cours</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    container.innerHTML = jours.map(jour => {
        if (!emploiDuTemps[jour] || emploiDuTemps[jour].length === 0) return '';
        
        return '<div class="emploi-day">' +
            '<h3>' + jour + '</h3>' +
            emploiDuTemps[jour].map(c => 
                '<div class="cours-item">' +
                '<div class="cours-info">' +
                '<span class="cours-time">' + c.heure + '</span>' +
                '<span style="font-weight: 600;">' + c.matiere + '</span>' +
                '<span style="color: var(--text-secondary); font-size: 14px;">' + c.salle + '</span>' +
                '</div>' +
                '<button onclick="supprimerCours(\'' + jour + '\', \'' + c.id + '\')" class="btn-danger"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>' +
                '</div>'
            ).join('') +
            '</div>';
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// RÉVISIONS
// ============================================

function showAddRevisionForm() {
    if (matieres.length === 0) {
        alert('Ajoutez d\'abord des matières !');
        return;
    }
    const form = document.getElementById('addRevisionForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    updateMatiereSelects();
}

async function ajouterRevision() {
    const matiere = document.getElementById('revisionMatiere').value;
    const date = document.getElementById('revisionDate').value;
    const heure = document.getElementById('revisionHeure').value;
    const duree = parseInt(document.getElementById('revisionDuree').value);
    const sujet = document.getElementById('revisionSujet').value.trim();
    
    if (!matiere || !date || !heure || !sujet) {
        alert('Veuillez remplir tous les champs');
        return;
    }
    
    const revision = {
        id: Date.now().toString(),
        matiere: matiere,
        date: date,
        heure: heure,
        duree: duree,
        sujet: sujet,
        fait: false
    };
    
    try {
        revisions.push(revision);
        await database.ref('data/' + currentUser.uid + '/revisions/' + revision.id).set(revision);
        
        document.getElementById('revisionMatiere').value = '';
        document.getElementById('revisionDate').value = '';
        document.getElementById('revisionHeure').value = '14:00';
        document.getElementById('revisionDuree').value = '60';
        document.getElementById('revisionSujet').value = '';
        
        showAddRevisionForm();
        renderRevisions();
    } catch (error) {
        console.error('Erreur ajout révision:', error);
    }
}

async function toggleRevision(id) {
    const revision = revisions.find(r => r.id === id);
    if (!revision) return;
    
    try {
        revision.fait = !revision.fait;
        await database.ref('data/' + currentUser.uid + '/revisions/' + id + '/fait').set(revision.fait);
        renderRevisions();
        renderDashboard();
    } catch (error) {
        console.error('Erreur toggle révision:', error);
    }
}

function renderRevisions() {
    const container = document.getElementById('revisionsList');
    if (!container) return;
    
    if (revisions.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="target" style="width: 48px; height: 48px;"></i><p>Aucune révision</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    container.innerHTML = revisions.map(r => 
        '<div class="list-item">' +
        '<div class="checkbox-custom ' + (r.fait ? 'checked' : '') + '" onclick="toggleRevision(\'' + r.id + '\')">' +
        (r.fait ? '<i data-lucide="check" style="width: 14px; height: 14px;"></i>' : '') +
        '</div>' +
        '<div class="list-item-content">' +
        '<div class="list-item-header">' +
        '<span class="badge badge-purple">' + r.matiere + '</span>' +
        '<span style="color: var(--text-secondary); font-size: 14px;">' + r.date + ' à ' + r.heure + '</span>' +
        '<span style="color: var(--text-secondary); font-size: 14px;">' + r.duree + ' min</span>' +
        '</div>' +
        '<div class="list-item-title ' + (r.fait ? 'completed' : '') + '">' + r.sujet + '</div>' +
        '</div>' +
        '</div>'
    ).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// OBJECTIFS
// ============================================

function showAddObjectifForm() {
    const form = document.getElementById('addObjectifForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    updateMatiereSelects();
}

async function ajouterObjectif() {
    const titre = document.getElementById('objectifTitre').value.trim();
    const matiere = document.getElementById('objectifMatiere').value;
    const date = document.getElementById('objectifDate').value;
    const cible = parseFloat(document.getElementById('objectifCible').value);
    
    if (!titre || !date || !cible) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    const objectif = {
        id: Date.now().toString(),
        titre: titre,
        matiere: matiere || 'Général',
        date: date,
        cible: cible,
        atteint: false
    };
    
    try {
        objectifs.push(objectif);
        await database.ref('data/' + currentUser.uid + '/objectifs/' + objectif.id).set(objectif);
        
        document.getElementById('objectifTitre').value = '';
        document.getElementById('objectifMatiere').value = '';
        document.getElementById('objectifDate').value = '';
        document.getElementById('objectifCible').value = '';
        
        showAddObjectifForm();
        renderObjectifs();
    } catch (error) {
        console.error('Erreur ajout objectif:', error);
    }
}

async function supprimerObjectif(id) {
    if (!confirm('Supprimer cet objectif ?')) return;
    
    try {
        objectifs = objectifs.filter(o => o.id !== id);
        await database.ref('data/' + currentUser.uid + '/objectifs/' + id).remove();
        renderObjectifs();
    } catch (error) {
        console.error('Erreur suppression objectif:', error);
    }
}

function renderObjectifs() {
    const container = document.getElementById('objectifsList');
    if (!container) return;
    
    if (objectifs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="flag" style="width: 48px; height: 48px;"></i><p>Aucun objectif</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    const stats = calculerStatistiques();
    
    container.innerHTML = objectifs.map(obj => {
        const moyenneActuelle = obj.matiere === 'Général' ? stats.moyenneGenerale : calculerMoyenneMatiere(obj.matiere);
        const progres = Math.min((moyenneActuelle / obj.cible) * 100, 100);
        const atteint = moyenneActuelle >= obj.cible;
        
        return '<div class="objectif-card">' +
            '<div class="objectif-header">' +
            '<div>' +
            '<h3>' + obj.titre + '</h3>' +
            '<span class="badge ' + (obj.matiere === 'Général' ? 'badge-blue' : 'badge-purple') + '">' + obj.matiere + '</span>' +
            '</div>' +
            '<button onclick="supprimerObjectif(\'' + obj.id + '\')" class="btn-danger"><i data-lucide="trash-2"></i></button>' +
            '</div>' +
            '<p style="color: var(--text-secondary); font-size: 14px; margin: 8px 0;">Date limite: ' + obj.date + '</p>' +
            '<p style="font-size: 18px; font-weight: 600; margin: 8px 0;">' + moyenneActuelle.toFixed(1) + ' / ' + obj.cible + ' ' + (atteint ? '✅' : '') + '</p>' +
            '<div class="progress-bar">' +
            '<div class="progress-fill" style="width: ' + progres + '%; background: ' + (atteint ? 'var(--green)' : 'var(--blue)') + ';"></div>' +
            '</div>' +
            '</div>';
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// STATISTIQUES
// ============================================

function calculerStatistiques() {
    const devoirsAvecNotes = devoirs.filter(d => d.note !== null);
    
    const moyenneGenerale = devoirsAvecNotes.length > 0
        ? devoirsAvecNotes.reduce((acc, d) => acc + (d.note / d.noteMax) * 20, 0) / devoirsAvecNotes.length
        : 0;
    
    const tauxReussite = devoirs.length > 0
        ? (devoirs.filter(d => d.fait).length / devoirs.length) * 100
        : 0;
    
    const revisionsTerminees = revisions.filter(r => r.fait).length;
    const tempsRevisionTotal = revisions.filter(r => r.fait).reduce((acc, r) => acc + r.duree, 0);
    
    return {
        moyenneGenerale: moyenneGenerale.toFixed(2),
        tauxReussite: tauxReussite.toFixed(0),
        revisionsTerminees: revisionsTerminees,
        heuresRevision: Math.floor(tempsRevisionTotal / 60),
        devoirsFaits: devoirs.filter(d => d.fait).length,
        totalDevoirs: devoirs.length,
        tempsRevisionTotal: tempsRevisionTotal
    };
}

function calculerMoyenneMatiere(matiere) {
    const devoirsMatiere = devoirs.filter(d => d.matiere === matiere && d.note !== null);
    if (devoirsMatiere.length === 0) return 0;
    return devoirsMatiere.reduce((acc, d) => acc + (d.note / d.noteMax) * 20, 0) / devoirsMatiere.length;
}

function getNiveauMotivation(moyenne, tauxReussite) {
    const score = parseFloat(moyenne) + parseFloat(tauxReussite) / 5;
    
    if (score >= 18) {
        return { niveau: "Excellent", message: "Continue comme ça, tu es exceptionnel !", emoji: "🌟", color: "text-yellow" };
    } else if (score >= 15) {
        return { niveau: "Très bien", message: "Superbe performance ! Tu es sur la bonne voie !", emoji: "🎯", color: "text-green" };
    } else if (score >= 12) {
        return { niveau: "Bien", message: "Bon travail ! Continue tes efforts !", emoji: "💪", color: "text-blue" };
    } else if (score >= 10) {
        return { niveau: "Peut mieux faire", message: "Allez, tu peux faire mieux ! Courage !", emoji: "📚", color: "text-orange" };
    } else {
        return { niveau: "À améliorer", message: "Ne lâche rien ! Chaque effort compte !", emoji: "🚀", color: "text-red" };
    }
}

// ============================================
// DASHBOARD
// ============================================

function renderDashboard() {
    const stats = calculerStatistiques();
    const motivation = getNiveauMotivation(stats.moyenneGenerale, stats.tauxReussite);
    
    // Message de motivation
    const motivationCard = document.getElementById('motivationCard');
    if (motivationCard) {
        motivationCard.innerHTML = 
            '<h3 class="' + motivation.color + '">' +
            '<span style="font-size: 40px;">' + motivation.emoji + '</span> ' +
            motivation.niveau +
            '</h3>' +
            '<p style="font-size: 18px; margin-top: 8px;">' + motivation.message + '</p>';
    }
    
    // Cartes de statistiques
    const statsCards = document.getElementById('statsCards');
    if (statsCards) {
        statsCards.innerHTML = 
            '<div class="stat-card">' +
            '<div class="stat-header"><span>Moyenne générale</span><i data-lucide="trending-up" class="text-blue"></i></div>' +
            '<div class="stat-value text-blue">' + stats.moyenneGenerale + '/20</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-header"><span>Taux de réussite</span><i data-lucide="check" class="text-green"></i></div>' +
            '<div class="stat-value text-green">' + stats.tauxReussite + '%</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-header"><span>Matières suivies</span><i data-lucide="book-open" class="text-purple"></i></div>' +
            '<div class="stat-value text-purple">' + matieres.length + '</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-header"><span>Heures de révision</span><i data-lucide="clock" class="text-orange"></i></div>' +
            '<div class="stat-value text-orange">' + stats.heuresRevision + 'h</div>' +
            '</div>';
    }
    
    // Prochains devoirs
    const upcomingDevoirs = document.getElementById('upcomingDevoirs');
    if (upcomingDevoirs) {
        const prochainsDevoirs = devoirs.filter(d => !d.fait).slice(0, 3);
        upcomingDevoirs.innerHTML = '<h3 class="mb-4">Prochains devoirs</h3>' +
            (prochainsDevoirs.length > 0 ? prochainsDevoirs.map(d =>
                '<div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">' +
                '<div><span style="font-weight: 600;">' + d.titre + '</span>' +
                '<span style="color: var(--text-secondary); font-size: 14px; margin-left: 12px;">' + d.matiere + '</span></div>' +
                '<span style="color: var(--text-secondary); font-size: 14px;">' + d.date + '</span>' +
                '</div>'
            ).join('') : '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Aucun devoir à venir</p>');
    }
    
    // Guide de démarrage
    const startGuide = document.getElementById('startGuide');
    if (startGuide) {
        if (matieres.length === 0) {
            startGuide.style.display = 'block';
            startGuide.innerHTML = '<h3>🚀 Commencez maintenant !</h3>' +
                '<ol style="margin-top: 16px;">' +
                '<li>Ajoutez vos matières</li>' +
                '<li>Créez votre emploi du temps</li>' +
                '<li>Ajoutez vos devoirs et notes</li>' +
                '<li>Planifiez vos révisions</li>' +
                '<li>Suivez votre progression</li>' +
                '</ol>';
        } else {
            startGuide.style.display = 'none';
        }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// STATISTIQUES DÉTAILLÉES AVEC GRAPHIQUES
// ============================================

function renderStats() {
    const stats = calculerStatistiques();
    const container = document.getElementById('statsContent');
    if (!container) return;
    
    // Carte moyenne générale
    container.innerHTML = 
        '<div style="background: linear-gradient(135deg, #1e40af, #3b82f6); border: 1px solid #2563eb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">' +
        '<h3 style="margin-bottom: 12px;">Moyenne Générale</h3>' +
        '<p style="font-size: 40px; font-weight: bold; color: #93c5fd;">' + stats.moyenneGenerale + ' / 20</p>' +
        '<p style="color: #e5e7eb; margin-top: 8px;">' + devoirs.filter(d => d.note !== null).length + ' devoirs notés</p>' +
        '</div>';
    
    // Graphique d'évolution des notes
    const devoirsAvecNotes = devoirs.filter(d => d.note !== null);
    
    if (devoirsAvecNotes.length > 0) {
        container.innerHTML += '<div class="card"><h3 class="mb-4">📈 Évolution de vos notes</h3>' +
            '<canvas id="evolutionChart" style="max-height: 300px;"></canvas></div>';
        
        // Créer le graphique après l'insertion du canvas
        setTimeout(() => {
            const canvas = document.getElementById('evolutionChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                dessinerGraphiqueEvolution(ctx, devoirsAvecNotes);
            }
        }, 100);
    }
    
    // Diagramme en barres - Moyennes par matière
    const moyennesParMatiere = matieres.map(m => ({
        matiere: m.nom,
        moyenne: calculerMoyenneMatiere(m.nom),
        couleur: m.couleur
    })).filter(m => m.moyenne > 0);
    
    if (moyennesParMatiere.length > 0) {
        container.innerHTML += '<div class="card"><h3 class="mb-4">📊 Moyennes par matière</h3>' +
            '<canvas id="matieresChart" style="max-height: 300px;"></canvas></div>';
        
        setTimeout(() => {
            const canvas = document.getElementById('matieresChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                dessinerDiagrammeBarres(ctx, moyennesParMatiere);
            }
        }, 100);
    }
    
    // Diagramme circulaire - Répartition du temps de révision
    const revisionsParMatiere = {};
    revisions.filter(r => r.fait).forEach(r => {
        if (!revisionsParMatiere[r.matiere]) {
            revisionsParMatiere[r.matiere] = 0;
        }
        revisionsParMatiere[r.matiere] += r.duree;
    });
    
    if (Object.keys(revisionsParMatiere).length > 0) {
        container.innerHTML += '<div class="card"><h3 class="mb-4">⏱️ Temps de révision par matière</h3>' +
            '<div style="display: flex; justify-content: center;"><canvas id="revisionsChart" width="300" height="300"></canvas></div></div>';
        
        setTimeout(() => {
            const canvas = document.getElementById('revisionsChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                dessinerDiagrammeCirculaire(ctx, revisionsParMatiere);
            }
        }, 100);
    }
    
    // Graphique de progression des objectifs
    if (objectifs.length > 0) {
        container.innerHTML += '<div class="card"><h3 class="mb-4">🎯 Progression des objectifs</h3>' +
            '<div style="display: grid; gap: 16px;">' +
            objectifs.map(obj => {
                const moyenneActuelle = obj.matiere === 'Général' ? parseFloat(stats.moyenneGenerale) : calculerMoyenneMatiere(obj.matiere);
                const progres = Math.min((moyenneActuelle / obj.cible) * 100, 100);
                const atteint = moyenneActuelle >= obj.cible;
                
                return '<div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px;">' +
                    '<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">' +
                    '<strong>' + obj.titre + '</strong>' +
                    '<span style="color: ' + (atteint ? 'var(--green)' : 'var(--blue)') + '; font-weight: 600;">' +
                    moyenneActuelle.toFixed(1) + ' / ' + obj.cible + ' ' + (atteint ? '✅' : '') +
                    '</span></div>' +
                    '<div style="width: 100%; height: 24px; background: var(--bg-secondary); border-radius: 12px; overflow: hidden; position: relative;">' +
                    '<div style="height: 100%; width: ' + progres + '%; background: ' + (atteint ? 'linear-gradient(90deg, var(--green), #34d399)' : 'linear-gradient(90deg, var(--blue), #60a5fa)') + '; transition: width 0.3s;"></div>' +
                    '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; font-weight: 600; color: white;">' + progres.toFixed(0) + '%</span>' +
                    '</div></div>';
            }).join('') +
            '</div></div>';
    }
    
    if (devoirsAvecNotes.length === 0 && moyennesParMatiere.length === 0) {
        container.innerHTML += '<div class="empty-state"><i data-lucide="award" style="width: 48px; height: 48px;"></i><p>Ajoutez des notes pour voir vos statistiques</p></div>';
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Dessiner graphique d'évolution (courbe)
function dessinerGraphiqueEvolution(ctx, devoirsAvecNotes) {
    const canvas = ctx.canvas;
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = 300;
    
    // Données
    const notes = devoirsAvecNotes.slice(-10).map(d => (d.note / d.noteMax) * 20);
    const labels = devoirsAvecNotes.slice(-10).map((d, i) => 'D' + (i + 1));
    
    // Marges
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Nettoyer
    ctx.clearRect(0, 0, width, height);
    
    // Couleurs
    ctx.strokeStyle = '#374151';
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px Arial';
    
    // Grille horizontale
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
        // Labels Y
        const value = 20 - (i * 5);
        ctx.fillText(value, padding - 25, y + 5);
    }
    
    // Axe X
    const stepX = chartWidth / (notes.length - 1 || 1);
    labels.forEach((label, i) => {
        const x = padding + stepX * i;
        ctx.fillText(label, x - 10, height - padding + 20);
    });
    
    // Dessiner la courbe
    ctx.beginPath();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 3;
    
    notes.forEach((note, i) => {
        const x = padding + stepX * i;
        const y = padding + chartHeight - (note / 20) * chartHeight;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Points
    notes.forEach((note, i) => {
        const x = padding + stepX * i;
        const y = padding + chartHeight - (note / 20) * chartHeight;
        
        ctx.beginPath();
        ctx.fillStyle = '#3B82F6';
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Valeur au-dessus du point
        ctx.fillStyle = '#F3F4F6';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(note.toFixed(1), x - 12, y - 10);
    });
}

// Dessiner diagramme en barres
function dessinerDiagrammeBarres(ctx, moyennesParMatiere) {
    const canvas = ctx.canvas;
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = 300;
    
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    ctx.clearRect(0, 0, width, height);
    
    // Grille
    ctx.strokeStyle = '#374151';
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px Arial';
    
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
        const value = 20 - (i * 5);
        ctx.fillText(value, padding - 25, y + 5);
    }
    
    // Barres
    const barWidth = chartWidth / moyennesParMatiere.length * 0.7;
    const spacing = chartWidth / moyennesParMatiere.length;
    
    moyennesParMatiere.forEach((m, i) => {
        const x = padding + spacing * i + (spacing - barWidth) / 2;
        const barHeight = (m.moyenne / 20) * chartHeight;
        const y = padding + chartHeight - barHeight;
        
        // Barre
        ctx.fillStyle = m.couleur;
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Valeur au-dessus
        ctx.fillStyle = '#F3F4F6';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(m.moyenne.toFixed(1), x + barWidth / 2 - 12, y - 5);
        
        // Label matière
        ctx.save();
        ctx.translate(x + barWidth / 2, height - padding + 15);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '11px Arial';
        ctx.fillText(m.matiere.substring(0, 8), 0, 0);
        ctx.restore();
    });
}

// Dessiner diagramme circulaire
function dessinerDiagrammeCirculaire(ctx, revisionsParMatiere) {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2 - 20;
    const radius = Math.min(width, height) / 2 - 40;
    
    ctx.clearRect(0, 0, width, height);
    
    const total = Object.values(revisionsParMatiere).reduce((a, b) => a + b, 0);
    
    const couleurs = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    
    let currentAngle = -Math.PI / 2;
    
    Object.entries(revisionsParMatiere).forEach(([matiere, duree], index) => {
        const sliceAngle = (duree / total) * Math.PI * 2;
        const couleur = couleurs[index % couleurs.length];
        
        // Dessiner la part
        ctx.beginPath();
        ctx.fillStyle = couleur;
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();
        
        // Bordure
        ctx.strokeStyle = '#1F2937';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Label
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const pourcentage = ((duree / total) * 100).toFixed(0) + '%';
        ctx.fillText(pourcentage, labelX, labelY);
        
        currentAngle += sliceAngle;
    });
    
    // Légende
    let legendY = height - 10;
    Object.entries(revisionsParMatiere).forEach(([matiere, duree], index) => {
        const couleur = couleurs[index % couleurs.length];
        const heures = Math.floor(duree / 60);
        const minutes = duree % 60;
        
        ctx.fillStyle = couleur;
        ctx.fillRect(10, legendY, 15, 15);
        
        ctx.fillStyle = '#F3F4F6';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(matiere + ' (' + heures + 'h' + (minutes > 0 ? minutes + 'min' : '') + ')', 30, legendY + 12);
        
        legendY -= 20;
    });
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    console.log('App.js chargé');
});