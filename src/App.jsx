import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  onSnapshot
} from 'firebase/firestore';
import { User, Phone, Mail, Loader2 } from 'lucide-react';

// --- Configuration Firebase (Utilisation des variables globales de l'environnement) ---

// Récupération sécurisée des variables d'environnement
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Définition du chemin de la collection (en utilisant le chemin PUBLIC pour la collaboration)
// Le chemin sera: /artifacts/{appId}/public/data/contacts
const CONTACTS_COLLECTION_NAME = 'contacts';
const getCollectionPath = () => 
  `artifacts/${appId}/public/data/${CONTACTS_COLLECTION_NAME}`;

// Vos règles de sécurité Firestore sont correctes et devraient permettre la lecture:
/*
match /artifacts/{appId}/public/data/{collection}/{docId} {
  allow read, write: if request.auth != null;
}
*/


// Composant principal de l'application
const App = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // 1. Initialisation de Firebase et Authentification
  useEffect(() => {
    try {
      if (Object.keys(firebaseConfig).length === 0) {
        setError("Erreur de configuration Firebase : La configuration est manquante ou vide.");
        setLoading(false);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authInstance = getAuth(app);
      
      setDb(firestore);
      setAuth(authInstance);

      // Effectue la connexion initiale (token ou anonyme)
      const authenticate = async () => {
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(authInstance, initialAuthToken);
            } else {
                await signInAnonymously(authInstance);
            }
        } catch (err) {
            console.error("Erreur lors de la tentative d'authentification initiale:", err);
            // En cas d'échec du token, on essaie l'anonyme comme fallback
            await signInAnonymously(authInstance);
        }
      }

      // Écoute de l'état d'authentification pour définir userId et isAuthReady
      const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          setUserId(null); // L'utilisateur est déconnecté
        }
        setIsAuthReady(true); // Confirme que l'état d'auth a été vérifié
      });
      
      authenticate(); // Lance la tentative d'authentification
      
      return () => unsubscribe();
    } catch (e) {
      console.error("Erreur d'initialisation de Firebase:", e);
      setError("Erreur d'initialisation: " + e.message);
      setLoading(false);
    }
  }, []);

  // 2. Récupération des données en temps réel (onSnapshot)
  useEffect(() => {
    // Attend que la DB soit initialisée ET que l'état d'authentification soit vérifié (isAuthReady=true)
    if (!db || !isAuthReady) return;
    
    // Si isAuthReady est vrai mais userId est null, l'authentification a échoué
    if (!userId) {
        setError("L'authentification a échoué. Accès aux données impossible. Vérifiez le statut de votre token d'auth.");
        setLoading(false);
        return;
    }

    setLoading(true);
    setError(null); // Réinitialise l'erreur avant de réessayer

    try {
      const q = query(collection(db, getCollectionPath()));
      
      // Met en place l'écoute en temps réel
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const contactsList = [];
        snapshot.forEach((doc) => {
          // Évite d'inclure les documents de métadonnées
          if (doc.id !== 'initial-setup') {
            contactsList.push({ id: doc.id, ...doc.data() });
          }
        });

        setContacts(contactsList.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error("Erreur Firestore (onSnapshot):", err);
        
        // Gestion des erreurs de permission
        if (err.code === 'permission-denied') {
            setError(
                "Échec de la récupération des contacts : Permission refusée. Vos règles de sécurité SONT correctes, " + 
                "mais assurez-vous que l'utilisateur est bien authentifié (userId non null) avant cette requête."
            );
        } else {
            setError("Échec de la récupération des contacts : " + err.message);
        }
        setLoading(false);
      });

      // Fonction de nettoyage (très importante pour onSnapshot)
      return () => unsubscribe();
    } catch (e) {
      console.error("Erreur de setup onSnapshot:", e);
      setError("Erreur de configuration de l'écoute des données.");
      setLoading(false);
    }
  }, [db, isAuthReady, userId]);


  // Composant de carte de contact
  const ContactCard = ({ contact }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:-translate-y-1 border border-gray-100">
      <div className="flex items-center mb-4">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-full mr-4">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{contact.name}</h2>
          <p className="text-sm text-blue-500 font-medium">{contact.role || 'Contact Général'}</p>
        </div>
      </div>
      
      <div className="space-y-2 text-gray-600">
        <div className="flex items-center text-sm">
          <Phone className="w-4 h-4 mr-3 text-gray-400" />
          <span>{contact.phone || 'Non spécifié'}</span>
        </div>
        <div className="flex items-center text-sm">
          <Mail className="w-4 h-4 mr-3 text-gray-400" />
          <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline truncate">
            {contact.email || 'Non spécifié'}
          </a>
        </div>
      </div>
    </div>
  );

  // Affichage du composant
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <header className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">
          <span className="text-blue-600">Afficheur</span> de Contacts Firebase
        </h1>
        <p className="text-gray-500 text-md">Données synchronisées en temps réel via Firestore</p>
        <div className="mt-2 p-2 bg-gray-200 text-sm text-gray-700 rounded-lg inline-block">
            Statut d'authentification: <span className="font-mono text-xs text-green-700 break-all">{userId ? `Connecté (UID: ${userId})` : 'Déconnexion...'}</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="p-4 mb-6 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
            {error}
          </div>
        )}

        {/* Espace pour maintenir le layout */}
        <div className="mb-8 h-4"></div> 

        {/* Affichage des Contacts */}
        {loading && (
          <div className="flex justify-center items-center h-40 text-blue-600">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            Chargement des contacts...
          </div>
        )}

        {!loading && contacts.length === 0 && !error && (
          <div className="text-center p-10 bg-white rounded-xl shadow-inner text-gray-500">
            <p className="text-lg">
                Aucun contact trouvé dans votre base de données. 
                Veuillez vérifier que l'authentification est réussie (ID utilisateur affiché ci-dessus).
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      </div>
      <footer className="mt-12 text-center text-xs text-gray-400">
          <p>Chemin de la Collection: /{getCollectionPath()}</p>
      </footer>
    </div>
  );
};

export default App;