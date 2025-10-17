import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged,
    signOut
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    setDoc, 
    deleteDoc,
    serverTimestamp,
    setLogLevel
} from 'firebase/firestore';
import { 
    Home, 
    Users, 
    Contact, 
    BarChart3, 
    Trash2, 
    Phone, 
    MapPin, 
    Zap, 
    Loader,
    LogOut,
    User,
    Shield,
    XCircle,
    CheckCircle
} from 'lucide-react';

// --- CONFIGURATION FIREBASE (Utilise la configuration de l'utilisateur comme défaut) ---
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBy_3k0dPsPCN5b_iOfZl22eJoq8BWbaRo",
  authDomain: "elecmanager-6f50a.firebaseapp.com",
  projectId: "elecmanager-6f50a",
  storageBucket: "elecmanager-6f50a.appspot.com",
  messagingSenderId: "872950170067",
  appId: "1:872950170067:web:dc23cc105538d3e88baf26",
  measurementId: "G-GXP88CTD96"
};

// Variables globales (fournies par l'environnement Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 

// Prioriser la variable globale si elle existe et est valide, sinon utiliser la configuration par défaut.
const firebaseConfig = typeof __firebase_config !== 'undefined' && Object.keys(__firebase_config).length > 0
    ? (typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config) 
    : DEFAULT_FIREBASE_CONFIG;
// --- FIN CONFIGURATION FIREBASE ---

// URL du logo
const LOGO_URL = "https://www.unenouvelleenergie.fr/app/uploads/2025/08/logo.svg"; 

// Définition des poids de projection pour chaque statut (en %)
const PROJECTION_WEIGHTS = {
    'a_contacter': 0, // 0%
    'a_convaincre': 30, // 30%
    'probable': 50, // 50%
    'acquis': 100, // 100%
    'a_voter': 100, // 100% (Jour J, en attente de validation)
    'vote_valide': 100, // 100% (Vote confirmé)
};

const STATUS_LABELS = {
    'a_contacter': 'À Contacter (0%)',
    'a_convaincre': 'À Convaincre (30%)',
    'probable': 'Probable (50%)',
    'acquis': 'Acquis (100%)',
    'a_voter': 'À Voter (100% - Jour J)',
    'vote_valide': 'Vote Validé (100%)',
};

const STATUS_COLORS = {
    'a_contacter': 'bg-gray-400 text-gray-800',
    'a_convaincre': 'bg-yellow-400 text-yellow-900',
    'probable': 'bg-blue-400 text-blue-900',
    'acquis': 'bg-green-500 text-white',
    'a_voter': 'bg-indigo-500 text-white',
    'vote_valide': 'bg-purple-600 text-white',
};

// --- UTILS FIREBASE PATHS ---

/**
 * Construit le chemin de la collection de contacts de l'utilisateur.
 * @param {string} currentUserId L'UID de l'utilisateur.
 * @returns {string} Le chemin Firestore.
 */
const getContactsPath = (currentUserId) => 
    `artifacts/${appId}/users/${currentUserId}/contacts`;

/**
 * Construit le chemin de la collection publique des membres du staff.
 * @returns {string} Le chemin Firestore.
 */
const getStaffPath = () => 
    `artifacts/${appId}/public/data/staff_members`;

// --- Composant pour charger Tailwind CSS et gérer les styles de secours ---
const GlobalStyles = () => {
    useEffect(() => {
        // Tente de charger le CDN de Tailwind si non chargé
        if (!document.querySelector('script[data-tailwind-cdn]')) {
            const script = document.createElement('script');
            script.src = "https://cdn.tailwindcss.com";
            script.setAttribute('data-tailwind-cdn', 'true');
            document.head.appendChild(script);
        }
    }, []);

    // Styles de secours pour les navigateurs ou environnements qui bloqueraient le CDN
    return (
        <style>
            {`
            /* --- Réinitialisation et Polices --- */
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .animate-spin { animation: spin 1s linear infinite; }
            .font-sans { font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; }
            
            /* --- Layout Général --- */
            .h-screen { height: 100vh; }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .flex-grow { flex-grow: 1; }
            .flex-shrink-0 { flex-shrink: 0; }
            .items-center { align-items: center; }
            .justify-center { justify-content: center; }
            .justify-end { justify-content: flex-end; }
            .justify-between { justify-content: space-between; }
            .justify-start { justify-content: flex-start; }
            .overflow-y-auto { overflow-y: auto; }
            .p-4 { padding: 1rem; }
            .p-6 { padding: 1.5rem; }
            .mb-8 { margin-bottom: 2rem; }
            .mb-6 { margin-bottom: 1.5rem; }
            .space-x-4 > * + *, .space-y-4 > * + * { margin: 0; }
            .space-x-4 > * + * { margin-left: 1rem; }
            .space-y-4 > * + * { margin-top: 1rem; }
            .gap-4 { gap: 1rem; }
            .gap-6 { gap: 1.5rem; }

            /* --- Couleurs et Ombres de Base --- */
            .bg-gray-100 { background-color: #f3f4f6; }
            .bg-white { background-color: #fff; }
            .bg-indigo-800 { background-color: #3730a3; } /* Navigation */
            .text-indigo-200 { color: #a5b4fc; }
            .text-indigo-300 { color: #818cf8; }
            .text-white { color: #fff; }
            .text-gray-800 { color: #1f2937; }
            .text-gray-600 { color: #4b5563; }
            .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
            .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }

            /* --- Conteneurs et Cartes --- */
            .rounded-xl { border-radius: 0.75rem; }
            .rounded-lg { border-radius: 0.5rem; }
            .border { border: 1px solid #e5e7eb; }
            .border-t-4 { border-top-width: 4px; }
            .border-indigo-500 { border-color: #6366f1; }
            .grid { display: grid; }
            
            /* --- Navigation Sidebar --- */
            .w-20 { width: 5rem; }
            @media (min-width: 1024px) { /* lg:w-64 */
                .lg\\:w-64 { width: 16rem; }
                .hidden.lg\\:block { display: block; }
                .hidden.lg\\:inline { display: inline; }
            }
            .lg\\:justify-start { justify-content: flex-start; }

            /* --- Navigation Item (Boutons) --- */
            .nav-item-base {
                display: flex;
                align-items: center;
                transition-duration: 200ms;
                width: 100%;
                font-weight: 500;
                border-radius: 0.75rem;
                padding: 0.75rem;
                cursor: pointer;
            }
            .nav-item-inactive {
                color: #a5b4fc;
                background-color: transparent;
            }
            .nav-item-inactive:hover {
                background-color: #4f46e5; /* indigo-700 */
                color: #fff;
            }
            .nav-item-active {
                background-color: #4f46e5; /* indigo-600 */
                color: #fff;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06);
            }

            /* --- Boutons Généraux --- */
            .btn-base {
                padding: 0.5rem 1rem;
                font-weight: 500;
                border-radius: 0.5rem;
                transition-duration: 150ms;
                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            .btn-indigo {
                background-color: #4f46e5; /* indigo-600 */
                color: #fff;
            }
            .btn-indigo:hover {
                background-color: #4338ca; /* indigo-700 */
            }
            .btn-gray {
                background-color: #e5e7eb; /* gray-200 */
                color: #4b5563; /* gray-700 */
            }
            .btn-gray:hover {
                background-color: #d1d5db; /* gray-300 */
            }

            /* Bouton Deconnexion Spécifique */
            .btn-logout {
                background-color: #fca5a5; /* Red-300 */
                color: #991b1b; /* Red-800 */
            }
            .btn-logout:hover {
                background-color: #f87171; /* Red-400 */
                color: #fff;
            }
            
            /* --- Responsive pour les Cartes/Grille (Dashboard) --- */
            @media (min-width: 768px) { /* md:grid-cols-3 */
                .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (min-width: 1024px) { /* lg:grid-cols-3 */
                .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            }
            @media (min-width: 1280px) { /* xl:grid-cols-4 */
                .xl\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            }
            
            /* --- Override spécifique des icônes pour la navigation --- */
            .nav-item-base .lucide-icon { margin-right: 0; }
            @media (min-width: 1024px) {
                .nav-item-base .lucide-icon { margin-right: 0.5rem; }
            }

            /* --- Couleurs de Statut et Texte --- */
            .bg-gray-400 { background-color: #9ca3af; }
            .bg-yellow-400 { background-color: #facc15; }
            .bg-blue-400 { background-color: #60a5fa; }
            .bg-green-500 { background-color: #10b981; }
            .bg-indigo-500 { background-color: #6366f1; }
            .bg-purple-600 { background-color: #7c3aed; }
            .text-gray-900 { color: #111827; }
            .text-gray-500 { color: #6b7280; }
            .text-yellow-900 { color: #78350f; }
            .text-blue-900 { color: #1e3a8a; }
            .text-red-600 { color: #dc2626; }
            .text-indigo-600 { color: #4f46e5; }
            .text-teal-600 { color: #0d9488; }
            .text-green-600 { color: #059669; }
            .rounded-full { border-radius: 9999px; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
            .text-xs { font-size: 0.75rem; }
            .leading-5 { line-height: 1.25rem; }
            .font-semibold { font-weight: 600; }
            .font-bold { font-weight: 700; }
            .text-xl { font-size: 1.25rem; }
            .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
        `}
        </style>
    );
};
// --- FIN Composant pour charger Tailwind CSS et gérer les styles de secours ---


// --- Hooks Firebase et Utilitaires ---

/**
 * Initialise Firebase et gère l'authentification.
 * @returns {{db: Firestore | null, auth: Auth | null, userId: string | null, loading: boolean, login: Function, logout: Function, authReady: boolean, isAdmin: boolean, isFirebaseConfigured: boolean}}
 */
const useFirebaseInit = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authReady, setAuthReady] = useState(false); 
    const [isAdmin, setIsAdmin] = useState(false); 
    
    // Vérifie si la configuration est suffisante pour initialiser Firebase
    const isFirebaseConfigured = useMemo(() => Object.keys(firebaseConfig).length > 0 && !!firebaseConfig.apiKey, []);

    // Initialisation de l'application
    const app = useMemo(() => {
        if (!isFirebaseConfigured) {
            console.warn("Firebase config is missing or incomplete. Application will run in simulated/unauthenticated mode.");
            return null; 
        }
        try {
            setLogLevel('debug'); 
            return initializeApp(firebaseConfig);
        } catch (error) {
            console.error("Erreur d'initialisation Firebase:", error);
            return null;
        }
    }, [isFirebaseConfigured]); 

    // Initialisation des services et gestion de l'état d'authentification
    useEffect(() => {
        // Mode Simulé/Hors Ligne (pas de config Firebase ou échec d'init)
        if (!isFirebaseConfigured || !app) {
            // Créer un utilisateur temporaire pour le mode démo/simulé
            const simulatedId = initialAuthToken || crypto.randomUUID();
            setUserId(simulatedId);
            setLoading(false);
            setAuthReady(true);
            return;
        }
        
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);

        setDb(firestore);
        setAuth(authInstance);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                // Simuler le rôle Admin si l'UID est le mock admin
                const isUserAdmin = user.uid === "mock_admin_uid";
                setUserId(user.uid);
                setIsAdmin(isUserAdmin); 
            } else {
                setUserId(null);
                setIsAdmin(false);
            }
            setLoading(false); 
            setAuthReady(true);
        });

        const tryInitialAuth = async () => {
            if (!authInstance) return; 

            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(authInstance, initialAuthToken);
                    console.log("Authenticated with custom token.");
                } else if (!authInstance.currentUser) {
                    // Tente de se connecter anonymement si non authentifié par token
                    await signInAnonymously(authInstance); 
                    console.log("Authenticated anonymously.");
                }
            } catch (error) {
                console.error("Erreur lors de l'authentification initiale:", error);
                // Si l'authentification échoue, on assure un état authReady
                setAuthReady(true);
                setLoading(false);
            }
        };

        tryInitialAuth();

        return () => unsubscribe();
    }, [app, initialAuthToken, isFirebaseConfigured]);

    const login = useCallback(async (type) => {
        setLoading(true);
        
        // Mode Simulé: Simuler une connexion réussie et un UID généré
        if (!isFirebaseConfigured || !auth) {
            const simulatedId = type === 'admin' ? 'mock_admin_uid' : crypto.randomUUID();
            setUserId(simulatedId);
            setIsAdmin(type === 'admin');
            setLoading(false);
            console.log(`Connexion ${type} simulée en mode démo.`);
            return;
        }

        // Mode Firebase Réel: Utilise signInAnonymously pour obtenir un UID si nécessaire
        try {
            let user = auth.currentUser;
            if (!user) {
                const result = await signInAnonymously(auth);
                user = result.user;
            }
            
            // Simuler la logique de rôle après connexion/identification
            if (user) {
                // Utilise l'UID réel de Firebase
                let finalUid = user.uid;
                let finalIsAdmin = false;
                
                // Si l'utilisateur clique sur Admin, nous forçons l'UID du mock admin pour la démo
                if (type === 'admin') {
                    finalUid = 'mock_admin_uid';
                    finalIsAdmin = true;
                }
                
                setUserId(finalUid);
                setIsAdmin(finalIsAdmin);
                console.log(`Connexion réussie via Firebase. Rôle simulé: ${type}`);
            }
        } catch (error) {
            console.error("Erreur lors de la connexion:", error);
            setUserId(null);
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    }, [auth, isFirebaseConfigured]);

    const logout = useCallback(async () => {
        // Mode Firebase Réel
        if (auth) {
            await signOut(auth);
        }
        
        // Mode Simulé ou Réel
        setUserId(null);
        setIsAdmin(false);
    }, [auth]);

    return { db, auth, userId, loading, login, logout, authReady, isAdmin, isFirebaseConfigured };
};

// --- Composants d'Interface Utilisateur (UI) ---

const InputGroup = ({ icon, label, name, type = 'text', value, onChange, required = false }) => (
    <div className="flex flex-col">
        <label htmlFor={name} className="text-sm font-medium text-gray-700 mb-1 flex items-center">
            {icon}
            <span className="ml-2">{label} {required && <span className="text-red-500">*</span>}</span>
        </label>
        <input
            type={type}
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            className="p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
        />
    </div>
);

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg flex items-center justify-between transition duration-300 hover:shadow-xl border-t-4 border-indigo-500">
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-8 h-8 text-white" />
        </div>
    </div>
);

const Notification = ({ message, type, onClose }) => {
    const icon = type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />;
    const color = type === 'error' ? 'bg-red-500' : 'bg-green-500';

    return (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg text-white shadow-xl flex items-center space-x-3 ${color} transition-opacity duration-300`}>
            {icon}
            <p className="font-medium">{message}</p>
            <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition">
                <XCircle className="w-4 h-4" />
            </button>
        </div>
    );
};


const Navigation = ({ currentPage, setCurrentPage, userId, logout, isAdmin, isFirebaseConfigured }) => {
    const NavItem = ({ page, icon: Icon, label }) => (
        <button
            onClick={() => setCurrentPage(page)}
            className={`nav-item-base ${currentPage === page ? 'nav-item-active' : 'nav-item-inactive'}
                /* Fallback pour le petit écran: centrage des icônes */
                justify-center lg:justify-start
            `}
        >
            <Icon className="w-5 h-5 lucide-icon" />
            <span className="hidden lg:inline ml-2">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-indigo-800 p-4 shadow-2xl">
            <div className="flex items-center justify-center lg:justify-start mb-8">
                <img src={LOGO_URL} alt="Logo de Campagne" className="h-10 w-auto" />
            </div>
            
            <div className="space-y-3 flex flex-col items-center lg:items-stretch">
                <NavItem page="dashboard" icon={Home} label="Tableau de Bord" />
                <NavItem page="contacts" icon={Contact} label="Gestion des Contacts" />
                <NavItem page="projections" icon={BarChart3} label="Projections" />
                <NavItem page="team" icon={Users} label="Équipe" /> 
            </div>
            <div className="mt-auto pt-4 border-t border-indigo-700 text-sm text-indigo-300">
                <p className="hidden lg:block mb-2">Connecté en tant que: <span className="font-semibold">{isAdmin ? "Admin" : "Staff"}</span></p>
                <p className="hidden lg:block">Statut: <span className="font-semibold">{isFirebaseConfigured ? "Firebase Actif" : "Mode Démo/Simulé"}</span></p>
                <p className="hidden lg:block">Membre ID (UID):</p>
                <p className="font-mono text-xs break-all mt-1">{userId || "N/A"}</p>
                <button 
                    onClick={logout} 
                    className="flex items-center justify-center lg:justify-start px-3 py-2 mt-4 btn-base btn-logout font-medium rounded-lg hover:bg-red-400 hover:text-white w-full shadow-md"
                >
                    <LogOut className="w-5 h-5 mr-0 lg:mr-2" />
                    <span className="hidden lg:inline">Déconnexion</span>
                </button>
            </div>
        </div>
    );
};

// Utilitaire pour simuler la base de données locale (uniquement si Firebase échoue)
// Clé: userId, Valeur: { contactId: contactObject }
let contactsInMemory = {};

const DashboardView = ({ contacts, userId, isAdmin, isFirebaseConfigured }) => {
    const totalContacts = contacts.length;
    // Les contacts acquis incluent 'acquis' et 'vote_valide' (les deux sont à 100% de poids)
    const acquiredContacts = contacts.filter(c => c.status === 'acquis' || c.status === 'vote_valide').length; 
    
    const projectedVotes = contacts.reduce((sum, contact) => {
        const weight = PROJECTION_WEIGHTS[contact.status] / 100 || 0;
        return sum + weight;
    }, 0);

    const statusCounts = contacts.reduce((acc, contact) => {
        acc[contact.status] = (acc[contact.status] || 0) + 1;
        return acc;
    }, {});

    const StatCardMosaic = ({ statusKey, count }) => {
        const label = STATUS_LABELS[statusKey];
        const color = STATUS_COLORS[statusKey];
        
        const isDarkBackground = ['acquis', 'a_voter', 'vote_valide'].includes(statusKey);
        const textColor = isDarkBackground ? 'text-white' : 'text-gray-900';
        
        return (
            <div className={`p-4 rounded-xl shadow-md ${color} transition duration-200 transform hover:scale-[1.02] border border-gray-100`}>
                <p className={`text-sm font-medium ${textColor} opacity-90`}>{label}</p>
                <p className={`text-2xl font-bold mt-1 ${textColor}`}>{count || 0}</p>
            </div>
        );
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-3">Tableau de Bord</h1>
            
            {!isFirebaseConfigured && (
                 <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-lg shadow-sm" role="alert">
                    <p className="font-bold">Mode Démo Actif:</p>
                    <p className="text-sm">La configuration Firebase est incomplète ou a échoué. Les données ne sont pas persistantes.</p>
                </div>
            )}
            
            <p className="text-lg text-gray-600 mb-6">
                Connecté en tant que: <span className="font-semibold">{isAdmin ? "Admin" : "Membre du Staff"}</span> 
                (ID: <span className="text-xs font-mono break-all">{userId || 'N/A'}</span>)
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    title="Total Contacts Gérés" 
                    value={totalContacts} 
                    icon={Users}
                    color="bg-indigo-600"
                />
                <StatCard 
                    title="Projection de Votes (Potentiel)" 
                    value={projectedVotes.toFixed(2)} 
                    icon={Zap}
                    color="bg-teal-600"
                />
                <StatCard 
                    title="Contacts Acquis (100%)" 
                    value={acquiredContacts}
                    icon={CheckCircle}
                    color="bg-green-600"
                />
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Statuts Détaillés</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Object.keys(STATUS_LABELS).map((key) => (
                        <StatCardMosaic key={key} statusKey={key} count={statusCounts[key]} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const ContactsView = ({ db, userId, contacts, setContacts, isFirebaseConfigured }) => {
    const [filter, setFilter] = useState('');
    const [notification, setNotification] = useState(null); 

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000); 
    };

    const handleDeleteContact = useCallback(async (contactId) => {
        // Remplacement de window.confirm() par un message console + simulation
        console.log("CONFIRMATION REQUISE: Êtes-vous sûr de vouloir supprimer ce contact ? (Simulé)");
        const isConfirmed = true; 
        
        if (isConfirmed) {
            try {
                if (isFirebaseConfigured && db) {
                    const contactCollectionRef = collection(db, getContactsPath(userId));
                    const docRef = doc(contactCollectionRef, contactId);
                    await deleteDoc(docRef);
                    showNotification("Contact supprimé (Firebase).");
                } else {
                    // Mode Simulé: Suppression en mémoire
                    if (contactsInMemory[userId] && contactsInMemory[userId][contactId]) {
                        delete contactsInMemory[userId][contactId];
                        
                        const updatedList = Object.values(contactsInMemory[userId] || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                        setContacts(updatedList);
                        showNotification("Contact supprimé (Mémoire).");
                    }
                }
            } catch (e) {
                console.error("Erreur lors de la suppression du contact: ", e);
                showNotification("Erreur lors de la suppression du contact.", 'error');
            }
        } else {
            console.log("Suppression annulée par l'utilisateur (via simulation de confirm).");
        }
    }, [db, userId, isFirebaseConfigured, setContacts]);


    const filteredContacts = contacts.filter(c => 
        (c.name || '').toLowerCase().includes(filter.toLowerCase()) || 
        (c.phone || '').includes(filter) ||
        (STATUS_LABELS[c.status] || '').toLowerCase().includes(filter.toLowerCase()) ||
        (c.region || '').toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-3">Gestion des Contacts ({contacts.length} Total)</h1>
            <p className="text-gray-600 mb-6 border-l-4 border-indigo-400 pl-3 py-1 bg-indigo-50 rounded-lg">
                Les contacts sont gérés et importés directement depuis la base de données Firebase. 
                Cette interface est dédiée à la consultation et au nettoyage des données.
            </p>
            
            <div className="flex justify-end items-center mb-6 flex-wrap gap-4">
                <input
                    type="text"
                    placeholder="Filtrer par nom, téléphone, statut, région..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="p-3 border border-gray-300 rounded-lg w-full md:w-80 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                />
            </div>

            <div className="overflow-x-auto bg-white rounded-xl shadow-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Région</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supprimer</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredContacts.length > 0 ? filteredContacts.map((contact) => (
                            <tr key={contact.id} className="hover:bg-indigo-50 transition duration-100">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{contact.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{contact.phone}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{contact.region || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[contact.status]}`}>
                                        {STATUS_LABELS[contact.status]}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    <button 
                                        onClick={() => handleDeleteContact(contact.id)} 
                                        className="text-red-600 hover:text-red-900 transition duration-150 p-1 rounded-full hover:bg-red-100"
                                        title="Supprimer le contact (Nettoyage des données)"
                                    >
                                    <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                                    Aucun contact trouvé. Les contacts sont chargés depuis Firebase.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
        </div>
    );
};

const ProjectionsView = ({ contacts }) => {
    const projectionData = useMemo(() => {
        let totalContacts = 0;
        let totalProjection = 0;
        const statusDetails = {};

        // Initialiser les détails de statut
        Object.keys(STATUS_LABELS).forEach(key => {
            statusDetails[key] = {
                count: 0,
                projection: 0,
                weight: PROJECTION_WEIGHTS[key],
                label: STATUS_LABELS[key]
            };
        });

        contacts.forEach(contact => {
            totalContacts++;
            const statusKey = contact.status;
            const weight = PROJECTION_WEIGHTS[statusKey] / 100 || 0;
            
            statusDetails[statusKey].count++;
            statusDetails[statusKey].projection += weight;
            totalProjection += weight;
        });

        const projectionArray = Object.entries(statusDetails)
            .sort(([, a], [, b]) => b.weight - a.weight) // Trier par poids décroissant
            .map(([key, data]) => ({
                key,
                ...data,
                projection: data.projection.toFixed(2),
                percentage: totalContacts > 0 ? ((data.count / totalContacts) * 100).toFixed(1) : 0,
                color: STATUS_COLORS[key]
            }));

        return { totalContacts, totalProjection: totalProjection.toFixed(2), projectionArray };
    }, [contacts]);

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Projections de Votes</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    title="Total Contacts Analysés" 
                    value={projectionData.totalContacts} 
                    icon={Users} 
                    color="bg-indigo-600"
                />
                <StatCard 
                    title="Projection Totale (Votes)" 
                    value={projectionData.totalProjection} 
                    icon={BarChart3} 
                    color="bg-purple-600"
                />
                <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-yellow-500">
                    <p className="text-sm font-medium text-gray-500">Projection Basée sur:</p>
                    <ul className="text-sm mt-1 space-y-1">
                        <li>Acquis / Validé: 100%</li>
                        <li>Probable: 50%</li>
                        <li>À Convaincre: 30%</li>
                        <li>À Contacter: 0%</li>
                    </ul>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Détails par Statut</h2>
                <div className="space-y-4">
                    {projectionData.projectionArray.map(item => (
                        <div key={item.key} className="relative p-4 rounded-lg border border-gray-100 shadow-sm transition duration-200 hover:shadow-md">
                            <div className="flex justify-between items-center mb-2">
                                <p className={`font-semibold text-sm ${item.color.includes('text-white') ? 'text-gray-800' : 'text-gray-800'}`}>
                                    {item.label}
                                </p>
                                <div className="text-right">
                                    <span className="text-2xl font-bold text-indigo-600">{item.count}</span>
                                    <span className="text-gray-500 text-sm ml-2">({item.percentage}%)</span>
                                </div>
                            </div>
                            
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                    className={`${item.color} h-2.5 rounded-full`} 
                                    style={{ width: `${item.percentage}%` }}
                                ></div>
                            </div>
                            <p className="text-sm mt-2 text-gray-600">
                                Projection de votes: <span className="font-bold text-green-600">{item.projection}</span>
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Vue Équipe (Gestion Admin du Staff) ---
const TeamView = ({ db, isAdmin, staffMembers, isFirebaseConfigured }) => {
    const [name, setName] = useState('');
    const [staffId, setStaffId] = useState('');
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [notification, setNotification] = useState(null); 

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000); 
    };
    
    const handleAddStaff = async (e) => {
        e.preventDefault();
        if (!name.trim() || !staffId.trim()) {
            showNotification("Le nom et l'ID du staff sont obligatoires.", 'error');
            return;
        }

        if (!isFirebaseConfigured || !db) {
            showNotification("Action impossible: Firebase non configuré.", 'error');
            return;
        }
        
        try {
            const staffRef = collection(db, getStaffPath());
            // Utilise le staffId comme ID du document pour la traçabilité et l'unicité
            await setDoc(doc(staffRef, staffId), {
                name: name.trim(),
                staffId: staffId.trim(),
                role: 'staff',
                createdAt: serverTimestamp(),
            });

            showNotification(`Membre du staff '${name}' ajouté avec succès!`, 'success');
            setName('');
            setStaffId('');
            setIsFormVisible(false);
        } catch (error) {
            console.error("Erreur lors de l'ajout du staff: ", error);
            showNotification("Erreur lors de l'ajout du membre du staff.", 'error');
        }
    };
    
    const handleDeleteStaff = async (id, staffName) => {
        // Simulation de confirmation
        console.log(`CONFIRMATION REQUISE: Supprimer le staff ${staffName}? (Simulé)`);
        const isConfirmed = true; 
        
        if (!isConfirmed) return;
        
        if (!isFirebaseConfigured || !db) {
            showNotification("Action impossible: Firebase non configuré.", 'error');
            return;
        }

        try {
            const docRef = doc(db, getStaffPath(), id);
            await deleteDoc(docRef);
            showNotification(`Membre '${staffName}' supprimé.`, 'success');
        } catch (error) {
            console.error("Erreur lors de la suppression du staff: ", error);
            showNotification("Erreur lors de la suppression du membre du staff.", 'error');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                <Users className="w-8 h-8 mr-3 text-indigo-600" />
                Gestion de l'Équipe
            </h1>
            
            {!isFirebaseConfigured && (
                 <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-lg shadow-sm" role="alert">
                    <p className="font-bold">Mode Démo Actif:</p>
                    <p className="text-sm">La gestion d'équipe nécessite une configuration **Firebase** et n'est pas disponible en mode démo in-memory.</p>
                </div>
            )}
            
            {isAdmin && isFirebaseConfigured && (
                <div className="mb-6">
                    <button 
                        onClick={() => setIsFormVisible(prev => !prev)}
                        className={`flex items-center px-6 py-3 font-semibold rounded-xl shadow-lg transition duration-150 transform hover:scale-[1.02] btn-base ${isFormVisible ? 'btn-gray' : 'btn-indigo'}`}
                    >
                        <User className="w-5 h-5 mr-2" />
                        {isFormVisible ? 'Annuler Ajout' : 'Ajouter un Membre Staff'}
                    </button>
                    
                    {isFormVisible && (
                        <div className="mt-4 p-4 bg-white rounded-xl shadow-lg border border-indigo-100">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Nouveau Membre du Staff</h3>
                            <form onSubmit={handleAddStaff} className="space-y-4">
                                <InputGroup icon={<User className="w-5 h-5 text-indigo-500" />} label="Nom du Staff" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
                                <InputGroup icon={<Shield className="w-5 h-5 text-indigo-500" />} label="Identifiant (UID)" name="staffId" value={staffId} onChange={(e) => setStaffId(e.target.value)} required />
                                <button type="submit" className="w-full flex items-center justify-center px-4 py-2 btn-base btn-indigo">
                                    <User className="w-5 h-5 mr-2" />
                                    Ajouter l'Utilisateur
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
            
            {isAdmin && !isFirebaseConfigured && (
                 <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-sm" role="alert">
                    <p className="font-bold">Accès Admin (Simulé) - Action Impossible:</p>
                    <p className="text-sm">La gestion d'équipe nécessite la persistance Firebase (public data) pour fonctionner correctement.</p>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Membres Actuels ({staffMembers.length})</h2>
                {staffMembers.length === 0 ? (
                    <p className="text-gray-500">Aucun membre du staff n'a été ajouté à cette équipe.</p>
                ) : (
                    <div className="space-y-3">
                        {staffMembers.map((member) => (
                            <div key={member.staffId} className="flex justify-between items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-indigo-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-800">{member.name}</p>
                                    <p className="text-xs font-mono text-gray-500 break-all">ID: {member.staffId}</p>
                                    <p className="text-xs text-indigo-600 font-semibold">{member.role === 'admin' ? 'Administrateur' : 'Membre Staff'}</p>
                                </div>
                                {isAdmin && isFirebaseConfigured && member.staffId !== 'mock_admin_uid' && (
                                    <button 
                                        onClick={() => handleDeleteStaff(member.staffId, member.name)}
                                        className="text-red-600 hover:text-red-800 p-2 rounded-full transition duration-150 hover:bg-red-100"
                                        title="Supprimer le membre"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
        </div>
    );
};


// --- Splash Screen pour l'Authentification ---
const SplashScreen = ({ login, loading, isFirebaseConfigured }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-600 to-purple-800 p-6">
            <div className="bg-white p-10 rounded-2xl shadow-2xl text-center max-w-md w-full animate-fade-in">
                <img src={LOGO_URL} alt="Logo" className="h-14 w-auto mx-auto mb-6" />
                <h1 className="text-4xl font-extrabold text-gray-800 mb-3">Élections Consulaires 2026</h1>
                <p className="text-lg text-gray-600 mb-8">Connectez-vous pour accéder à votre espace de gestion des contacts.</p>
                
                {!isFirebaseConfigured && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg mb-6" role="alert">
                        <strong className="font-bold">Mode Démo Actif:</strong>
                        <span className="block sm:inline"> La configuration Firebase est absente. Les données ne sont pas persistantes.</span>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader className="w-7 h-7 animate-spin text-indigo-600 mr-3" />
                        <span className="text-indigo-700 font-medium">Connexion en cours...</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <button 
                            onClick={() => login('admin')}
                            className={`w-full flex items-center justify-center px-6 py-3 font-semibold rounded-xl shadow-lg transition duration-200 transform bg-red-600 text-white hover:bg-red-700 hover:scale-[1.02]`}
                        >
                            <Shield className="w-5 h-5 mr-3" />
                            Connexion Administrateur (Mock)
                        </button>
                        <button 
                            onClick={() => login('staff')}
                            className={`w-full flex items-center justify-center px-6 py-3 font-semibold rounded-xl shadow-lg transition duration-200 transform bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02]`}
                        >
                            <User className="w-5 h-5 mr-3" />
                            Connexion Membre du Staff
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Composant Principal de l'Application ---

const AppContent = ({ db, userId, logout, isAdmin, isFirebaseConfigured }) => {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [contacts, setContacts] = useState([]);
    const [staffMembers, setStaffMembers] = useState([]); // Nouveau state pour les membres du staff

    // 1. Abonnement aux données de l'utilisateur actuel (Contacts Privés)
    useEffect(() => {
        if (!userId) return;

        // Si Firebase n'est pas configuré, on utilise le stockage en mémoire
        if (!isFirebaseConfigured || !db) {
            console.log("Using in-memory storage for contacts (demo mode).");
            // S'assurer que le contactsInMemory est initialisé pour cet utilisateur
            if (!contactsInMemory[userId]) {
                 contactsInMemory[userId] = {};
            }
            const initialContacts = Object.values(contactsInMemory[userId]).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setContacts(initialContacts);
            return;
        }

        // Si Firebase est configuré, on s'abonne à la collection
        console.log(`Setting up snapshot listener for user contacts: ${userId}`);
        const contactsRef = collection(db, getContactsPath(userId));
        
        const q = query(contactsRef); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedContacts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            fetchedContacts.sort((a, b) => (a.name || '').localeCompare(b.name || '')); 
            setContacts(fetchedContacts);
            console.log(`Fetched ${fetchedContacts.length} contacts from Firebase.`);
        }, (error) => {
            console.error("Erreur lors de la récupération des contacts (onSnapshot):", error);
        });

        return () => unsubscribe();
    }, [db, userId, isFirebaseConfigured]);

    // 2. Abonnement aux données du Staff (Liste Partagée / Public)
    useEffect(() => {
        if (!isFirebaseConfigured || !db) {
            setStaffMembers([]); 
            return;
        }

        console.log(`Setting up snapshot listener for staff members.`);
        const staffRef = collection(db, getStaffPath());
        
        const q = query(staffRef); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedStaff = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            fetchedStaff.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            // Simuler l'ajout de l'admin par défaut pour qu'il apparaisse dans la liste
            const staffList = [{ staffId: 'mock_admin_uid', name: 'Administrateur (Mock)', role: 'admin' }, ...fetchedStaff];
            
            // Filtrer les doublons si l'admin mock a été accidentellement ajouté à la base
            const uniqueStaff = Array.from(new Set(staffList.map(a => a.staffId)))
                .map(staffId => staffList.find(a => a.staffId === staffId));

            setStaffMembers(uniqueStaff.filter(m => m.staffId)); // Filtre les entrées nulles ou vides
            console.log(`Fetched ${fetchedStaff.length} staff members from Firebase.`);
        }, (error) => {
            console.error("Erreur lors de la récupération des membres du staff (onSnapshot):", error);
        });

        return () => unsubscribe();
    }, [db, isFirebaseConfigured]);


    // Affichage conditionnel des vues
    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <DashboardView contacts={contacts} userId={userId} isAdmin={isAdmin} isFirebaseConfigured={isFirebaseConfigured} />;
            case 'contacts':
                // Passage de setContacts pour la suppression en mode démo
                return <ContactsView db={db} userId={userId} contacts={contacts} setContacts={setContacts} isFirebaseConfigured={isFirebaseConfigured} />;
            case 'projections':
                return <ProjectionsView contacts={contacts} />;
            case 'team':
                return <TeamView 
                            db={db} 
                            isAdmin={isAdmin} 
                            staffMembers={staffMembers} 
                            isFirebaseConfigured={isFirebaseConfigured}
                        />;
            default:
                return <DashboardView contacts={contacts} userId={userId} isAdmin={isAdmin} isFirebaseConfigured={isFirebaseConfigured} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <div className="w-20 lg:w-64 flex-shrink-0">
                <Navigation 
                    currentPage={currentPage} 
                    setCurrentPage={setCurrentPage} 
                    userId={userId} 
                    logout={logout}
                    isAdmin={isAdmin} 
                    isFirebaseConfigured={isFirebaseConfigured}
                />
            </div>
            <main className="flex-grow overflow-y-auto">
                {renderPage()}
            </main>
        </div>
    );
};

const App = () => {
    const { db, userId, loading, login, logout, authReady, isAdmin, isFirebaseConfigured } = useFirebaseInit();

    return (
        <React.Fragment>
            <GlobalStyles /> 
            {loading && !userId && (
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <Loader className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                    <p className="text-lg font-medium text-indigo-700">Initialisation de l'application...</p>
                </div>
            )}
            
            {authReady && !userId && (
                <SplashScreen login={login} loading={loading} isFirebaseConfigured={isFirebaseConfigured} />
            )}

            {userId && (
                <AppContent db={db} userId={userId} logout={logout} isAdmin={isAdmin} isFirebaseConfigured={isFirebaseConfigured} />
            )}
            
            {!loading && !userId && !authReady && (
                <div className="flex items-center justify-center h-screen bg-red-900 text-white p-6">
                    <h1 className="text-3xl font-bold mb-4">Erreur Inattendue</h1>
                    <p className="text-lg text-red-300 text-center max-w-lg">
                        Veuillez recharger l'application ou vérifier la configuration Firebase.
                    </p>
                </div>
            )}
        </React.Fragment>
    );
};

export default App;