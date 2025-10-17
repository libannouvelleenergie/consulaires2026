import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { setLogLevel, getFirestore, collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
    Home, Users, Contact, BarChart3, Trash2, Phone, MapPin, Zap, Loader, LogOut, User, Shield, XCircle, CheckCircle, Mail, PlusCircle, Save
} from 'lucide-react';

// --- Configuration Firebase (Utilisation des variables globales de l'environnement) ---

// Récupération sécurisée des variables d'environnement
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Configuration Firebase par défaut pour le mode démo si aucune configuration n'est fournie
const DEFAULT_FIREBASE_CONFIG = { apiKey: 'demo-key', authDomain: 'demo.firebaseapp.com', projectId: 'demo-project' };
const firebaseConfig = typeof __firebase_config !== 'undefined' && Object.keys(__firebase_config).length > 0
    ? (typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config)
    : DEFAULT_FIREBASE_CONFIG;

// URL du logo (placeholder)
const LOGO_URL = "https://placehold.co/150x40/3730a3/ffffff?text=ELEC+CAMPAIGN";

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

// Utilitaire pour simuler la base de données locale (uniquement si Firebase échoue)
// Clé: userId, Valeur: { contactId: contactObject }
let contactsInMemory = {};

/**
 * Construit le chemin de la collection de contacts de l'utilisateur.
 * @param {string} currentUserId L'UID de l'utilisateur.
 * @returns {string} Le chemin Firestore.
 */
const getContactsPath = (currentUserId) =>
    `artifacts/${appId}/users/${currentUserId}/contacts`;

/**
 * Construit le chemin de la collection publique des membres du staff (pour le futur).
 * @returns {string} Le chemin Firestore.
 */
const getStaffPath = () =>
    `artifacts/${appId}/public/data/staff_members`;

// --- HOOK D'INITIALISATION FIREBASE ET AUTHENTIFICATION ---

/**
 * Gère l'initialisation de Firebase et l'état d'authentification.
 */
const useFirebaseInit = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authReady, setAuthReady] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Vérifie si la configuration est suffisante pour initialiser Firebase
    const isFirebaseConfigured = useMemo(() => Object.keys(firebaseConfig).length > 0 && !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'demo-key', []);

    // 1. Initialisation des services
    const app = useMemo(() => {
        if (!isFirebaseConfigured) return null;
        try {
            setLogLevel('debug');
            return initializeApp(firebaseConfig);
        } catch (error) {
            console.error("Erreur d'initialisation Firebase:", error);
            return null;
        }
    }, [isFirebaseConfigured]);

    // 2. Gestion de l'état d'authentification et de la connexion initiale
    useEffect(() => {
        if (!isFirebaseConfigured || !app) {
            // Mode Simulé/Hors Ligne: Créer un utilisateur temporaire
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
                const isUserAdmin = user.uid === "mock_admin_uid" || user.uid === initialAuthToken; // Permet de tester l'admin via le token
                setUserId(user.uid);
                setIsAdmin(isUserAdmin);
            } else {
                setUserId(null);
                setIsAdmin(false);
            }
            setLoading(false);
            setAuthReady(true);
        });

        // Tente la connexion initiale
        const tryInitialAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(authInstance, initialAuthToken);
                } else if (!authInstance.currentUser) {
                    await signInAnonymously(authInstance);
                }
            } catch (error) {
                console.error("Erreur lors de l'authentification initiale (token/anonyme):", error);
                // L'onAuthStateChanged finira par se déclencher même en cas d'échec pour setAuthReady(true)
            }
        };

        tryInitialAuth();

        return () => unsubscribe();
    }, [app, initialAuthToken, isFirebaseConfigured]);

    // Fonction de connexion (utilisée ici pour simuler les rôles ou se reconnecter)
    const login = useCallback(async (type) => {
        setLoading(true);

        if (!isFirebaseConfigured || !auth) {
            const simulatedId = type === 'admin' ? 'mock_admin_uid' : crypto.randomUUID();
            setUserId(simulatedId);
            setIsAdmin(type === 'admin');
            setLoading(false);
            return;
        }

        // En mode Firebase réel, on utilise signInAnonymously pour obtenir un UID si nécessaire
        try {
            let user = auth.currentUser;
            if (!user) {
                const result = await signInAnonymously(auth);
                user = result.user;
            }

            if (user) {
                let finalUid = user.uid;
                let finalIsAdmin = false;

                if (type === 'admin') {
                    finalUid = 'mock_admin_uid'; // Forcer l'UID de l'admin pour la démo
                    finalIsAdmin = true;
                }

                setUserId(finalUid);
                setIsAdmin(finalIsAdmin);
            }
        } catch (error) {
            console.error("Erreur lors de la connexion simulée/réelle:", error);
            setUserId(null);
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    }, [auth, isFirebaseConfigured]);

    const logout = useCallback(async () => {
        if (auth) {
            await signOut(auth);
        }
        setUserId(null);
        setIsAdmin(false);
    }, [auth]);

    return { db, auth, userId, loading, login, logout, authReady, isAdmin, isFirebaseConfigured };
};

// --- Composants d'Interface Utilisateur (UI) ---

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
            
            /* Styles de base générés par Tailwind pour assurer la réactivité et l'esthétique */
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
            .btn-indigo { background-color: #4f46e5; color: #fff; }
            .btn-indigo:hover { background-color: #4338ca; }
            .btn-gray { background-color: #e5e7eb; color: #4b5563; }
            .btn-gray:hover { background-color: #d1d5db; }
            .btn-logout { background-color: #fca5a5; color: #991b1b; }
            .btn-logout:hover { background-color: #f87171; color: #fff; }

            /* Responsive pour le menu de navigation */
            .w-20 { width: 5rem; }
            @media (min-width: 1024px) { /* lg:w-64 */
                 .lg\\:w-64 { width: 16rem; }
                 .hidden.lg\\:block { display: block; }
                 .hidden.lg\\:inline { display: inline; }
            }
            
            /* Responsive pour la grille du tableau de bord (réduit pour la concision) */
             @media (min-width: 768px) { .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
             @media (min-width: 1280px) { .xl\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
            `}
        </style>
    );
};

const InputGroup = ({ icon: Icon, label, name, type = 'text', value, onChange, required = false, isSelect = false, options = [] }) => {
    const inputClasses = "p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 w-full";
    return (
        <div className="flex flex-col">
            <label htmlFor={name} className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="ml-2">{label} {required && <span className="text-red-500">*</span>}</span>
            </label>
            {isSelect ? (
                <select
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required={required}
                    className={inputClasses}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required={required}
                    className={inputClasses}
                />
            )}
        </div>
    );
};

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

    // Utilisation de z-50 pour s'assurer que la notification est au-dessus de tout
    return (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg text-white shadow-xl flex items-center space-x-3 ${color} transition duration-300 ease-out transform translate-y-0`}>
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
                justify-center lg:justify-start
            `}
        >
            <Icon className="w-5 h-5 lucide-icon" />
            <span className="hidden lg:inline ml-2">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-indigo-800 p-4 shadow-2xl flex-shrink-0 w-20 lg:w-64">
            <div className="flex items-center justify-center lg:justify-start mb-8">
                <img src={LOGO_URL} alt="Logo de Campagne" className="h-10 w-auto" />
            </div>

            <div className="space-y-3 flex flex-col items-center lg:items-stretch">
                <NavItem page="dashboard" icon={Home} label="Tableau de Bord" />
                <NavItem page="contacts" icon={Contact} label="Gestion des Contacts" />
                <NavItem page="projections" icon={BarChart3} label="Projections" />
                {isAdmin && (
                     <NavItem page="team" icon={Users} label="Équipe (Admin)" />
                )}
            </div>
            <div className="mt-auto pt-4 border-t border-indigo-700 text-sm text-indigo-300">
                <p className="hidden lg:block mb-2">Connecté en tant que: <span className="font-semibold">{isAdmin ? "Admin" : "Staff"}</span></p>
                <p className="hidden lg:block">Statut: <span className="font-semibold">{isFirebaseConfigured ? "Firebase Actif" : "Mode Démo"}</span></p>
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

const DashboardView = ({ contacts, userId, isAdmin, isFirebaseConfigured }) => {
    const totalContacts = contacts.length;
    // Contacts acquis incluent 'acquis' et 'vote_valide' (les deux sont à 100% de poids)
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
        const colorClass = STATUS_COLORS[statusKey].split(' ').filter(c => c.startsWith('bg-')).join(' ');
        
        const textColor = ['acquis', 'a_voter', 'vote_valide'].some(k => STATUS_COLORS[k].includes(colorClass)) ? 'text-white' : 'text-gray-900';

        return (
            <div className={`p-4 rounded-xl shadow-md ${colorClass} transition duration-200 transform hover:scale-[1.02] border border-gray-100`}>
                <p className={`text-sm font-medium ${textColor} opacity-90`}>{label}</p>
                <p className={`text-2xl font-bold mt-1 ${textColor}`}>{count || 0}</p>
            </div>
        );
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-3">Tableau de Bord Personnel</h1>

            {!isFirebaseConfigured && (
                 <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-lg shadow-sm" role="alert">
                    <p className="font-bold">Mode Démo Actif:</p>
                    <p className="text-sm">La configuration Firebase est incomplète ou a échoué. Les données ne sont pas persistantes. L'ID de l'utilisateur est visible pour simuler le multijoueur.</p>
                </div>
            )}

            <p className="text-lg text-gray-600 mb-6">
                Statistiques de votre portefeuille de contacts.
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

const defaultNewContact = {
    name: '',
    phone: '',
    email: '',
    status: 'a_contacter',
    location: '',
    notes: '',
};

const ContactsView = ({ db, userId, contacts, isFirebaseConfigured, showNotification, setContacts }) => {
    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentContact, setCurrentContact] = useState(null); // Pour édition (objet) ou ajout (null)

    const statusOptions = Object.keys(STATUS_LABELS).map(key => ({
        value: key,
        label: STATUS_LABELS[key]
    }));

    const filteredContacts = contacts.filter(contact =>
        (contact.name?.toLowerCase() || '').includes(filter.toLowerCase()) ||
        (contact.location?.toLowerCase() || '').includes(filter.toLowerCase()) ||
        (contact.status?.toLowerCase() || '').includes(filter.toLowerCase())
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const handleOpenModal = (contact = defaultNewContact) => {
        setCurrentContact(contact);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setCurrentContact(null);
        setIsModalOpen(false);
    };

    const handleChange = (e) => {
        setCurrentContact({
            ...currentContact,
            [e.target.name]: e.target.value
        });
    };

    const handleDeleteContact = useCallback(async (contactId) => {
        // Remplacement de window.confirm()
        console.log(`[ACTION REQUÊTE] Confirmation de la suppression du contact ID: ${contactId}`);
        const isConfirmed = window.confirm("Êtes-vous sûr de vouloir supprimer ce contact ? (Ceci est un remplacement de modal)");

        if (isConfirmed) {
            try {
                if (isFirebaseConfigured && db && userId) {
                    const docRef = doc(db, getContactsPath(userId), contactId);
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
        }
    }, [db, userId, isFirebaseConfigured, showNotification, setContacts]);

    const handleSaveContact = async (e) => {
        e.preventDefault();
        const contactToSave = { ...currentContact };
        delete contactToSave.id; // L'ID n'est pas stocké dans le document, il sert à la référence

        if (!contactToSave.name) {
            showNotification("Le nom est obligatoire.", 'error');
            return;
        }

        try {
            if (isFirebaseConfigured && db && userId) {
                const contactCollectionRef = collection(db, getContactsPath(userId));

                if (currentContact.id && currentContact.id !== 'new') {
                    // Mise à jour
                    const docRef = doc(contactCollectionRef, currentContact.id);
                    await updateDoc(docRef, contactToSave);
                    showNotification("Contact mis à jour (Firebase).");
                } else {
                    // Ajout
                    await addDoc(contactCollectionRef, contactToSave);
                    showNotification("Nouveau contact ajouté (Firebase).");
                }
            } else {
                // Mode Simulé: Ajout/Mise à jour en mémoire
                if (!contactsInMemory[userId]) {
                    contactsInMemory[userId] = {};
                }
                const isNew = !currentContact.id || currentContact.id === 'new' || currentContact.id === defaultNewContact.id;
                const finalId = isNew ? crypto.randomUUID() : currentContact.id;

                contactsInMemory[userId][finalId] = { id: finalId, ...contactToSave };

                const updatedList = Object.values(contactsInMemory[userId] || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setContacts(updatedList);
                showNotification(`Contact ${isNew ? 'ajouté' : 'mis à jour'} (Mémoire).`);
            }
            handleCloseModal();
        } catch (e) {
            console.error("Erreur lors de la sauvegarde du contact: ", e);
            showNotification("Erreur de sauvegarde du contact.", 'error');
        }
    };


    const ContactCard = ({ contact }) => {
        const statusLabel = STATUS_LABELS[contact.status] || 'Inconnu';
        const statusClass = STATUS_COLORS[contact.status] || 'bg-gray-200 text-gray-800';

        return (
            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:-translate-y-1 border border-gray-100 flex flex-col">
                <div className="flex items-start mb-4 justify-between">
                    <div className="flex items-center">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mr-4">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">{contact.name}</h2>
                            <p className={`text-xs font-semibold px-3 py-1 rounded-full ${statusClass} inline-block mt-1`}>
                                {statusLabel}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 text-gray-600 border-t pt-4 mt-2 flex-grow">
                    <div className="flex items-center text-sm">
                        <Phone className="w-4 h-4 mr-3 text-gray-500" />
                        <span>{contact.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center text-sm">
                        <Mail className="w-4 h-4 mr-3 text-gray-500" />
                        <span>{contact.email || 'N/A'}</span>
                    </div>
                     <div className="flex items-start text-sm">
                        <MapPin className="w-4 h-4 mt-1 mr-3 text-gray-500 flex-shrink-0" />
                        <span className="break-words">{contact.location || 'Non spécifié'}</span>
                    </div>
                    <div className="text-xs pt-2 text-gray-500 italic">
                        Notes: {contact.notes || "Aucune note."}
                    </div>
                </div>

                <div className="flex justify-end space-x-2 mt-4 border-t pt-4">
                    <button
                        onClick={() => handleOpenModal(contact)}
                        className="btn-base btn-indigo text-xs"
                    >
                        Éditer
                    </button>
                    <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="btn-base bg-red-100 text-red-600 hover:bg-red-200 text-xs"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    const ContactModal = () => {
        if (!currentContact) return null;

        return (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
                        {currentContact.id && currentContact.id !== defaultNewContact.id ? 'Éditer le Contact' : 'Ajouter un Nouveau Contact'}
                    </h2>
                    <form onSubmit={handleSaveContact} className="space-y-4">
                        <InputGroup
                            icon={User}
                            label="Nom Complet"
                            name="name"
                            value={currentContact.name}
                            onChange={handleChange}
                            required
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup
                                icon={Phone}
                                label="Téléphone"
                                name="phone"
                                value={currentContact.phone}
                                onChange={handleChange}
                                type="tel"
                            />
                            <InputGroup
                                icon={Mail}
                                label="Email"
                                name="email"
                                value={currentContact.email}
                                onChange={handleChange}
                                type="email"
                            />
                        </div>
                        <InputGroup
                            icon={MapPin}
                            label="Localisation / Quartier"
                            name="location"
                            value={currentContact.location}
                            onChange={handleChange}
                        />
                         <InputGroup
                            icon={Shield}
                            label="Statut de Vote"
                            name="status"
                            value={currentContact.status}
                            onChange={handleChange}
                            isSelect
                            options={statusOptions}
                            required
                        />
                        <div className="flex flex-col">
                             <label htmlFor="notes" className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <span className="ml-2">Notes</span>
                            </label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={currentContact.notes}
                                onChange={handleChange}
                                rows="3"
                                className="p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 w-full"
                            ></textarea>
                        </div>

                        <div className="flex justify-end space-x-4 pt-4">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="btn-base btn-gray"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                className="btn-base btn-indigo"
                            >
                                <Save className="w-5 h-5 mr-2" />
                                Enregistrer
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestion de Mes Contacts</h1>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
                <input
                    type="text"
                    placeholder="Filtrer par nom, localisation ou statut..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="p-3 border border-gray-300 rounded-xl w-full sm:w-80 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-md"
                />
                <button
                    onClick={() => handleOpenModal()}
                    className="btn-base btn-indigo text-lg shadow-xl"
                >
                    <PlusCircle className="w-6 h-6 mr-2" />
                    Ajouter un Contact
                </button>
            </div>

            <p className="text-gray-600 mb-4">{filteredContacts.length} contacts trouvés (sur {contacts.length} totaux)</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredContacts.length > 0 ? (
                    filteredContacts.map(contact => (
                        <ContactCard key={contact.id} contact={contact} />
                    ))
                ) : (
                    <p className="col-span-full text-center py-10 text-gray-500">
                        Aucun contact trouvé. Commencez par en ajouter un !
                    </p>
                )}
            </div>

            <ContactModal />
        </div>
    );
};

const ProjectionsView = () => (
    <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Analyse et Projections (Vue Détaillée)</h1>
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <p className="text-gray-600 mb-4">Cette section afficherait des graphiques avancés (ex: Répartition par statut, par géographie, tendance d'acquisition). Le calcul de base se trouve dans le Tableau de Bord.</p>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 font-bold">
                [Zone de Graphique D3 ou Recharts]
            </div>
            <p className="mt-4 text-sm text-indigo-600">Pour une implémentation complète, nous utiliserions D3.js pour des visualisations dynamiques ici.</p>
        </div>
    </div>
);

const TeamView = () => (
    <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestion d'Équipe (Vue Admin)</h1>
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-sm" role="alert">
            <p className="font-bold">Accès Restreint:</p>
            <p className="text-sm">Cette vue est réservée aux Administrateurs et n'est pas encore implémentée. Elle nécessiterait une collection publique (`/public/data/staff_members`) pour partager les données des membres.</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <p className="text-gray-600">Ici, un Admin pourrait voir les UID de tous les membres connectés et leurs statistiques agrégées (total contacts, total acquis, etc.).</p>
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <h3 className="font-semibold text-gray-700">Utilisateurs Simulés:</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
                    <li>**Admin (Mock):** `mock_admin_uid`</li>
                    <li>**Staff (Votre ID):** L'UID affiché dans la barre latérale.</li>
                </ul>
            </div>
        </div>
    </div>
);


// --- Composant Principal App ---

const App = () => {
    // Utilisation du hook centralisé pour la gestion de Firebase/Auth
    const { db, auth, userId, loading: authLoading, logout, authReady, isAdmin, isFirebaseConfigured } = useFirebaseInit();

    // États locaux pour les données et l'UI
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true); // État de chargement des données (différent de l'auth)
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [notification, setNotification] = useState(null);

    const showNotification = useCallback((message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    }, []);


    // Récupération des données en temps réel (onSnapshot)
    useEffect(() => {
        // 1. Attendre que l'authentification soit prête
        if (!authReady || !userId) return;

        // 2. Mode Démo (sans Firebase)
        if (!isFirebaseConfigured) {
            const initialContacts = [
                { id: 'c1', name: 'Marie Dubois', phone: '0612345678', email: 'marie.d@example.com', status: 'acquis', location: 'Paris 18ème', notes: 'Rencontrée au marché, très engagée.' },
                { id: 'c2', name: 'Jean Dupont', phone: '0700000000', email: 'jean.d@example.com', status: 'probable', location: 'Paris 10ème', notes: 'Hésite encore avec le vote blanc.' },
                { id: 'c3', name: 'Aicha Benali', phone: '0699887766', email: 'aicha.b@example.com', status: 'a_convaincre', location: 'Saint-Denis', notes: 'Sensible aux thèmes sociaux.' },
                { id: 'c4', name: 'Paul LeFevre', phone: '0655443322', email: 'paul.l@example.com', status: 'a_contacter', location: 'Pantin', notes: 'Nouvel habitant, à contacter avant le J-10.' },
            ];
            // Initialisation de la mémoire si nécessaire
            if (!contactsInMemory[userId]) {
                contactsInMemory[userId] = initialContacts.reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
            }
            const currentDemoContacts = Object.values(contactsInMemory[userId] || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setContacts(currentDemoContacts);
            setLoading(false);
            return;
        }

        // 3. Mode Firebase Réel
        if (!db) return;

        setLoading(true);
        const contactPath = getContactsPath(userId);
        const q = query(collection(db, contactPath));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const contactsList = [];
            snapshot.forEach((doc) => {
                contactsList.push({ id: doc.id, ...doc.data() });
            });
            setContacts(contactsList.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            setLoading(false);
        }, (err) => {
            console.error("Firestore onSnapshot Error (Data Fetch):", err);
            showNotification(`Erreur de permission ou de réseau: ${err.message}`, 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, authReady, userId, isFirebaseConfigured, showNotification]);

    // Rendu des vues basées sur la navigation
    const renderContent = () => {
        if (authLoading || loading) {
            return (
                <div className="flex flex-col items-center justify-center flex-grow bg-gray-100">
                    <Loader className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                    <p className="text-lg text-gray-600">Chargement des {authLoading ? "utilisateurs" : "données"}...</p>
                </div>
            );
        }

        switch (currentPage) {
            case 'dashboard':
                return <DashboardView contacts={contacts} userId={userId} isAdmin={isAdmin} isFirebaseConfigured={isFirebaseConfigured} />;
            case 'contacts':
                return <ContactsView db={db} userId={userId} contacts={contacts} isFirebaseConfigured={isFirebaseConfigured} showNotification={showNotification} setContacts={setContacts} />;
            case 'projections':
                return <ProjectionsView />;
            case 'team':
                if (isAdmin) {
                    return <TeamView />;
                }
                return <h1 className="p-6 text-red-600">Accès Refusé. Réservé aux administrateurs.</h1>;
            default:
                return <DashboardView contacts={contacts} userId={userId} isAdmin={isAdmin} isFirebaseConfigured={isFirebaseConfigured} />;
        }
    };

    return (
        <div className="font-sans flex h-screen bg-gray-100 overflow-hidden">
            <GlobalStyles />
            <Navigation
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                userId={userId}
                logout={logout}
                isAdmin={isAdmin}
                isFirebaseConfigured={isFirebaseConfigured}
            />
            <main className="flex-grow overflow-y-auto">
                {renderContent()}
            </main>
            {notification && (
                <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
            )}
        </div>
    );
};

export default App;
