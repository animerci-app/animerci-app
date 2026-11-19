// Configuration Firebase.
// Tant que ces valeurs sont vides, l'appli fonctionne en MODE DÉMONSTRATION
// (données fictives, stockées uniquement dans le navigateur).
// Pour passer en mode réel : suivre GUIDE-MISE-EN-LIGNE.md puis coller ici
// la configuration fournie par la console Firebase (projet créé par l'administratrice).
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

export const MODE_REEL = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
export const FIREBASE_VERSION = '10.14.1';
// Cache local (mémoire du navigateur) : réduit fortement les lectures facturées au quota gratuit. Mettre false pour le désactiver
// (par exemple sur un ordinateur partagé : voir le guide). « Se déconnecter » efface aussi ce cache.
export const CACHE_LOCAL = true;
