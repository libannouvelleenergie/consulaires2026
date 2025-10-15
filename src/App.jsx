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
    Save, 
    Trash2, 
    UserPlus, 
    Phone, 
    MapPin, 
    Zap, 
    Loader,
    LogIn,
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

// Prioriser la variable globale si elle existe et est valide, sinon utiliser la configuration fournie par l'utilisateur.
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
            .font-sans { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; }
            
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
 * @returns {{db: Firestore | null, auth: Auth | null, userId: string | null, loading: boolean, login: Function, logout: Function, authReady: boolean, isAdmin: boolean}}
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
                setUserId(user.uid);
                // Logique de rôle simplifiée pour la démo
                // EN PRODUCTION: Utiliser user.getIdTokenResult(true) pour lire les customClaims
                setIsAdmin(user.uid === "mock_admin_uid"); 
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
                    await signInAnonymously(authInstance); 
                    console.log("Authenticated anonymously.");
                }
            } catch (error) {
                console.error("Erreur lors de l'authentification initiale:", error);
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

        // Mode Firebase Réel
        try {
            await signInAnonymously(auth);

            if (auth.currentUser) {
                if (type === 'admin') {
                    // Simuler l'accès admin pour le développement
                    setIsAdmin(true); 
                } else {
                    setIsAdmin(false);
                }
            }
            console.log(`Connexion anonyme réussie. Rôle simulé: ${type}`);
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

/**
 * Construit le chemin de la collection de contacts pour l'utilisateur actuel.
 * @param {string} currentUserId L'UID de l'utilisateur.
 * @returns {string} Le chemin Firestore.
 */
const getContactsPath = (currentUserId) => 
    `artifacts/${appId}/users/${currentUserId}/contacts`;

// --- Composants d'Interface Utilisateur (UI) ---

const ContactForm = ({ contact, onSubmit, onCancel, userId, isFirebaseConfigured }) => {
    const isNew = !contact?.id;
    const [formData, setFormData] = useState({
        name: contact?.name || '',
        phone: contact?.phone || '',
        region: contact?.region || '',
        status: contact?.status || 'a_contacter',
        notes: contact?.notes || '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            console.error('Le nom et le téléphone sont obligatoires.');
            return;
        }
        
        const timestamp = isFirebaseConfigured ? serverTimestamp() : new Date();

        onSubmit({
            ...formData,
            id: contact?.id || crypto.randomUUID(), 
            ownerId: userId,
            // Utiliser serverTimestamp pour Firestore, ou Date pour le mode démo.
            createdAt: contact?.createdAt || timestamp, 
            updatedAt: timestamp,
        });
    };

    return (
        <div className="p-4 bg-white rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">{isNew ? 'Nouveau Contact' : 'Modifier Contact'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <InputGroup icon={<Contact className="w-5 h-5 text-indigo-500" />} label="Nom Complet" name="name" value={formData.name} onChange={handleChange} required />
                <InputGroup icon={<Phone className="w-5 h-5 text-indigo-500" />} label="Téléphone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required />
                <InputGroup icon={<MapPin className="w-5 h-5 text-indigo-500" />} label="Région Consulaire" name="region" value={formData.region} onChange={handleChange} />
                <SelectGroup label="Statut de Suivi" name="status" value={formData.status} onChange={handleChange}>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </SelectGroup>
                <div className="flex flex-col">
                    <label htmlFor="notes" className="text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea 
                        id="notes" 
                        name="notes" 
                        value={formData.notes} 
                        onChange={handleChange} 
                        rows="3"
                        className="p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                        placeholder="Détails du contact, historique, etc."
                    ></textarea>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={onCancel} className="flex items-center px-4 py-2 btn-base btn-gray hover:bg-gray-400">
                        Annuler
                    </button>
                    <button type="submit" className="flex items-center px-4 py-2 btn-base btn-indigo hover:bg-indigo-700">
                        <Save className="w-5 h-5 mr-2" />
                        {isNew ? 'Créer' : 'Sauvegarder'}
                    </button>
                </div>
            </form>
        </div>
    );
};

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

const SelectGroup = ({ label, name, value, onChange, children }) => (
    <div className="flex flex-col">
        <label htmlFor={name} className="text-sm font-medium text-gray-700 mb-1">
            {label}
        </label>
        <select
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            className="p-3 border border-gray-300 rounded-lg appearance-none bg-white focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
        >
            {children}
        </select>
    </div>
);

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg flex items-center justify-between transition duration-300 hover:shadow-xl border-t-4 border-indigo-500">
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-8 h-8 text-white" /> {/* Utilisation de l'icône passée en prop */}
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
                <img src={LOGO_URL} alt="Logo" className="h-10 lg:h-12 w-auto mx-auto filter brightness-0 invert lg:ml-0" />
                <div className="text-xl lg:text-2xl font-extrabold text-white ml-3 hidden lg:block">
                    Élections 2026
                </div>
            </div>
            
            <div className="space-y-3 flex flex-col items-center lg:items-stretch">
                <NavItem page="dashboard" icon={Home} label="Tableau de Bord" />
                <NavItem page="contacts" icon={Contact} label="Gestion des Contacts" />
                <NavItem page="projections" icon={BarChart3} label="Projections" />
                <NavItem page="team" icon={Users} label="Équipe (Mock)" /> 
            </div>
            <div className="mt-auto pt-4 border-t border-indigo-700 text-sm text-indigo-300">
                <p className="hidden lg:block mb-2">Connecté en tant que: <span className="font-semibold">{isAdmin ? "Admin" : "Staff"}</span></p>
                <p className="hidden lg:block">Statut: <span className="font-semibold">{isFirebaseConfigured ? "Connecté (Firebase)" : "Mode Démo/Simulé"}</span></p>
                <p className="hidden lg:block">Membre ID (UID):</p>
                <p className="font-mono text-xs break-all mt-1">{userId || "N/A"}</p>
                {/* Style Déconnexion Amélioré */}
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

// --- Logique Métier (Vues) ---

const DashboardView = ({ contacts, userId, isAdmin, isFirebaseConfigured }) => {
    const totalContacts = contacts.length;
    const acquiredContacts = contacts.filter(c => c.status === 'acquis').length; // Ajout du filtre Acquis
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
        
        // Déterminer la couleur du texte pour un meilleur contraste (principalement pour les fonds clairs)
        const isDark = ['acquis', 'a_voter', 'vote_valide'].includes(statusKey);
        const textColor = isDark ? 'text-white' : 'text-gray-900';
        
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
                    <p className="font-bold">Mode Démo/Simulé:</p>
                    <p className="text-sm">Firebase n'est pas configuré. Les données ne sont pas persistantes et sont stockées uniquement dans la session actuelle.</p>
                </div>
            )}
            
            <p className="text-lg text-gray-600 mb-6">
                Connecté en tant que: <span className="font-semibold">{isAdmin ? "Admin" : "Membre du Staff"}</span> 
                (ID: {userId ? userId.substring(0, 8) + '...' : 'N/A'})
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Icônes désormais correctement affichées grâce à la propriété Icon dans StatCard */}
                <StatCard 
                    title="Total Contacts Gérés" 
                    value={totalContacts} 
                    icon={Users} // L'icône est passée comme composant
                    color="bg-indigo-600"
                />
                <StatCard 
                    title="Projection de Votes (Potentiel)" 
                    value={projectedVotes.toFixed(2)} 
                    icon={Zap} // L'icône est passée comme composant
                    color="bg-teal-600"
                />
                <StatCard 
                    title="Contacts Acquis (100%)" 
                    value={acquiredContacts} // Utilise acquiredContacts
                    icon={CheckCircle} // L'icône est passée comme composant
                    color="bg-green-600"
                />
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Statuts Détaillés</h2>
                {/* Changement de la disposition des statuts en mosaïque */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Object.keys(STATUS_LABELS).map((key) => (
                        <StatCardMosaic key={key} statusKey={key} count={statusCounts[key]} />
                    ))}
                </div>
            </div>
        </div>
    );
};

// Utilitaire pour simuler la base de données locale
let contactsInMemory = {};

const ContactsView = ({ db, userId, contacts, setContacts, isAdmin, isFirebaseConfigured }) => {
    const [editingContact, setEditingContact] = useState(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [filter, setFilter] = useState('');
    const [notification, setNotification] = useState(null); 

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000); 
    };

    const handleSaveContact = useCallback(async (contactData) => {
        try {
            if (isFirebaseConfigured) {
                 const contactCollectionRef = collection(db, getContactsPath(userId));
                 const docRef = doc(contactCollectionRef, contactData.id);
                 // Utilise setDoc pour créer ou mettre à jour
                 // On doit s'assurer de ne pas écraser les vraies timestamps de Firestore
                 const dataToSave = {
                    ...contactData,
                    createdAt: contactData.createdAt, // Conserver l'ancienne valeur si elle existe (objet Date ou champ Firestore)
                    updatedAt: serverTimestamp(), // Toujours mettre à jour
                 };
                 // Si c'est une nouvelle entrée, on s'assure que createdAt est aussi serverTimestamp
                 if (contactData.createdAt === contactData.updatedAt) {
                     dataToSave.createdAt = serverTimestamp();
                 }

                 await setDoc(docRef, dataToSave);
                 showNotification(editingContact ? "Contact mis à jour avec succès (Firebase)!" : "Contact créé avec succès (Firebase)!"), 'success';
            } else {
                // Mode Simulé: Stockage en mémoire
                const newContact = { ...contactData, updatedAt: new Date() };
                contactsInMemory[userId] = { 
                    ...(contactsInMemory[userId] || {}), 
                    [contactData.id]: newContact 
                };
                
                // Mettre à jour l'état React manuellement
                const updatedList = Object.values(contactsInMemory[userId]).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setContacts(updatedList);
                showNotification(editingContact ? "Contact mis à jour (Mémoire)!" : "Contact créé (Mémoire)!"), 'success';
            }
            setIsFormVisible(false);
            setEditingContact(null);
        } catch (e) {
            console.error("Erreur lors de l'enregistrement du contact: ", e);
            showNotification("Erreur lors de la sauvegarde du contact.", 'error');
        }
    }, [db, userId, editingContact, isFirebaseConfigured, setContacts]);

    const handleDeleteContact = useCallback(async (contactId) => {
        // Remplacement de window.confirm() par une alerte console + simulation
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce contact ? (Ceci simule un confirm UI)")) {
            try {
                if (isFirebaseConfigured) {
                    const contactCollectionRef = collection(db, getContactsPath(userId));
                    const docRef = doc(contactCollectionRef, contactId);
                    await deleteDoc(docRef);
                    showNotification("Contact supprimé (Firebase).");
                } else {
                    // Mode Simulé: Suppression en mémoire
                    if (contactsInMemory[userId] && contactsInMemory[userId][contactId]) {
                        delete contactsInMemory[userId][contactId];
                        
                        // Mettre à jour l'état React manuellement
                        const updatedList = Object.values(contactsInMemory[userId]).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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

    const handleEditClick = (contact) => {
        setEditingContact(contact);
        setIsFormVisible(true);
    };

    const handleNewClick = () => {
        setEditingContact(null);
        setIsFormVisible(true);
    };

    const handleCancel = () => {
        setIsFormVisible(false);
        setEditingContact(null);
    };

    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(filter.toLowerCase()) || 
        c.phone.includes(filter) ||
        (STATUS_LABELS[c.status] || '').toLowerCase().includes(filter.toLowerCase()) ||
        (c.region || '').toLowerCase().includes(filter.toLowerCase())
    );

    if (isFormVisible) {
        return (
            <div className="p-6">
                <ContactForm 
                    contact={editingContact} 
                    onSubmit={handleSaveContact} 
                    onCancel={handleCancel} 
                    userId={userId} 
                    isFirebaseConfigured={isFirebaseConfigured}
                />
                 {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestion des Contacts ({contacts.length} Total)</h1>
            
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <button 
                    onClick={handleNewClick} 
                    className="flex items-center px-6 py-3 font-semibold rounded-xl shadow-lg transition duration-150 transform hover:scale-[1.02] btn-base btn-indigo"
                >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Ajouter Nouveau Contact
                </button>
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                                        onClick={() => handleEditClick(contact)} 
                                        className="text-indigo-600 hover:text-indigo-900 transition duration-150 p-1 rounded-full hover:bg-indigo-100"
                                        title="Modifier"
                                    >
                                        <Contact className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteContact(contact.id)} 
                                        className="text-red-600 hover:text-red-900 transition duration-150 p-1 rounded-full hover:bg-red-100"
                                        title="Supprimer"
                                    >
                                    <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                                    Aucun contact trouvé. Commencez par en ajouter un!
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

const TeamView = () => (
    <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Section Équipe (Mock)</h1>
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-lg shadow-sm" role="alert">
            <p className="font-bold">Note:</p>
            <p className="text-sm">Cette section présente des données d'équipe simulées. Pour une gestion multi-utilisateurs complète et des rôles Admin/Membre réels, il faudrait une collection publique `artifacts/{appId}/public/data/members` pour lister tous les membres et une logique de vérification de `customClaims` dans Firebase.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
                { name: "Marie Khoury", role: "Coordinatrice Beyrouth", contacts: 45 },
                { name: "Georges Saab", role: "Responsable Nord", contacts: 62 },
                { name: "Lina Fares", role: "Volontaire Mont-Liban", contacts: 28 },
                { name: "Karim Assaf", role: "Analyste de Données", contacts: 10 },
            ].map((member, index) => (
                <div key={index} className="bg-white p-5 rounded-xl shadow-lg border border-gray-100 transition duration-300 hover:shadow-xl">
                    <div className="flex items-center space-x-4">
                        <Users className="w-8 h-8 text-indigo-500" />
                        <div>
                            <p className="text-lg font-semibold text-gray-900">{member.name}</p>
                            <p className="text-sm text-gray-600">{member.role}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-700">
                        Contacts Gérés: <span className="font-bold text-indigo-600">{member.contacts}</span>
                    </p>
                </div>
            ))}
        </div>
    </div>
);

// --- Splash Screen pour l'Authentification ---
const SplashScreen = ({ login, loading, isFirebaseConfigured }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-600 to-purple-800 p-6">
            <div className="bg-white p-10 rounded-2xl shadow-2xl text-center max-w-md w-full animate-fade-in">
                <img src={LOGO_URL} alt="Logo" className="h-20 w-auto mx-auto mb-6" />
                <h1 className="text-4xl font-extrabold text-gray-800 mb-3">Élections Consulaires 2026</h1>
                <p className="text-lg text-gray-600 mb-8">Connectez-vous pour accéder à votre espace.</p>
                
                {!isFirebaseConfigured && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg mb-6" role="alert">
                        <strong className="font-bold">Mode Démo:</strong>
                        <span className="block sm:inline"> La configuration Firebase est absente. Les données ne seront pas sauvegardées.</span>
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
                            Connexion Admin (Développeur)
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

                <p className="text-xs text-gray-400 mt-8">
                    Note: La connexion en **Mode Démo** est simulée.
                </p>
            </div>
        </div>
    );
};


// --- Composant Principal de l'Application ---

const AppContent = ({ db, userId, logout, isAdmin, isFirebaseConfigured }) => {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [contacts, setContacts] = useState([]);
    
    // 1. Abonnement aux données de l'utilisateur actuel
    useEffect(() => {
        if (!userId) return;

        // Si Firebase n'est pas configuré, on utilise le stockage en mémoire
        if (!isFirebaseConfigured || !db) {
            console.log("Using in-memory storage for demo mode.");
            // Charger les données de la mémoire au démarrage
            const initialContacts = Object.values(contactsInMemory[userId] || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setContacts(initialContacts);
            return;
        }

        // Si Firebase est configuré
        console.log(`Setting up snapshot listener for user: ${userId}`);
        const contactsRef = collection(db, getContactsPath(userId));
        
        // Requête pour les contacts de l'utilisateur actuel. 
        const q = query(contactsRef, where('ownerId', '==', userId)); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedContacts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Tri en mémoire (par nom par défaut)
            fetchedContacts.sort((a, b) => (a.name || '').localeCompare(b.name || '')); 
            setContacts(fetchedContacts);
            console.log(`Fetched ${fetchedContacts.length} contacts from Firebase.`);
        }, (error) => {
            console.error("Erreur lors de la récupération des contacts:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isFirebaseConfigured]);

    // Affichage conditionnel des vues
    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <DashboardView contacts={contacts} userId={userId} isAdmin={isAdmin} isFirebaseConfigured={isFirebaseConfigured} />;
            case 'contacts':
                return <ContactsView db={db} userId={userId} contacts={contacts} setContacts={setContacts} isAdmin={isAdmin} isFirebaseConfigured={isFirebaseConfigured} />;
            case 'projections':
                return <ProjectionsView contacts={contacts} />;
            case 'team':
                return <TeamView />;
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
    const { db, auth, userId, loading, login, logout, authReady, isAdmin, isFirebaseConfigured } = useFirebaseInit();

    // 0. Injecter les styles globaux/fallback + le CDN Tailwind
    return (
        <React.Fragment>
            <GlobalStyles /> 
            {/* 1. Afficher l'écran de chargement initial (Uniquement au tout début) */}
            {loading && !authReady && (
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <Loader className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                    <p className="text-lg font-medium text-indigo-700">Initialisation de l'application...</p>
                </div>
            )}
            
            {/* 2. Si l'authentification est prête mais pas d'utilisateur connecté, afficher le splash screen */}
            {authReady && !userId && (
                <SplashScreen login={login} loading={loading} isFirebaseConfigured={isFirebaseConfigured} />
            )}

            {/* 3. Si authentifié (userId est présent), afficher l'application principale */}
            {userId && (
                <AppContent db={db} userId={userId} logout={logout} isAdmin={isAdmin} isFirebaseConfigured={isFirebaseConfigured} />
            )}
            
            {/* Cas d'erreur non géré */}
            {!loading && !userId && !authReady && (
                <div className="flex items-center justify-center h-screen bg-red-900 text-white p-6">
                    <h1 className="text-3xl font-bold mb-4">Erreur Inattendue</h1>
                    <p className="text-lg text-red-300 text-center max-w-lg">
                        Veuillez recharger l'application.
                    </p>
                </div>
            )}
        </React.Fragment>
    );
};

export default App;