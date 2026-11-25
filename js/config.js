// Configuration Firebase.
// Tant que ces valeurs sont vides, l'appli fonctionne en MODE DÉMONSTRATION
// (données fictives, stockées uniquement dans le navigateur).
// Pour passer en mode réel : suivre GUIDE-MISE-EN-LIGNE.md puis coller ici
// la configuration fournie par la console Firebase (projet créé par l'administratrice).
export const firebaseConfig = {
  apiKey: 'AIzaSyCo3jOm_buBn2lcFchev5lUjG8tUthm89g',
  authDomain: 'animerci-app.firebaseapp.com',
  projectId: 'animerci-app',
  storageBucket: 'animerci-app.firebasestorage.app',
  messagingSenderId: '300879414588',
  appId: '1:300879414588:web:d12319bfb3c0a57c808a39'
};

export const MODE_REEL = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
export const FIREBASE_VERSION = '10.14.1';
// Cache local (mémoire du navigateur) : réduit fortement les lectures facturées au quota gratuit. Mettre false pour le désactiver
// (par exemple sur un ordinateur partagé : voir le guide). « Se déconnecter » efface aussi ce cache.
export const CACHE_LOCAL = true;
