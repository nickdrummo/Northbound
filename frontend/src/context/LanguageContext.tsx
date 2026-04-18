import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';

/** Supported languages. `flag` is a country flag emoji used by the switcher UI. */
export const LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇺🇸' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'zh', label: '中文',      flag: '🇨🇳' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/**
 * Every translatable string in the app is keyed here.
 * Keys that are not translated for a given language fall back to English.
 */
type TranslationDict = Record<string, string>;

const EN: TranslationDict = {
  // Brand / chrome
  'brand.name': 'Northbound',

  // Sidebar
  'nav.dashboard': 'Dashboard',
  'nav.myOrders': 'My Orders',
  'nav.orders': 'Orders',
  'nav.receivedOrders': 'Received Orders',
  'nav.templates': 'Templates',
  'nav.analytics': 'Analytics',
  'nav.settings': 'Settings',
  'nav.buyerAccount': 'Buyer account',
  'nav.sellerAccount': 'Seller account',

  // Dashboard
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle.buyer': 'Purchase order management for your business',
  'dashboard.subtitle.seller': 'Seller overview — track the orders coming in from your buyers',
  'dashboard.totalOrders': 'Total Orders',
  'dashboard.ordersReceived': 'Orders Received',
  'dashboard.totalSpend': 'Total Spend',
  'dashboard.totalRevenue': 'Total Revenue',
  'dashboard.pendingOrders': 'Pending Orders',
  'dashboard.ordersShipped': 'Orders Shipped',
  'dashboard.recurringTemplates': 'Recurring Templates',
  'dashboard.recentOrders': 'Recent Orders',
  'dashboard.recentReceivedOrders': 'Recent Received Orders',
  'dashboard.quickActions': 'Quick Actions',
  'dashboard.createOrder': 'Create Order',
  'dashboard.newTemplate': 'New Template',
  'dashboard.viewAllReceived': 'View All Received Orders',
  'dashboard.completeProfilePrompt': 'Complete your profile to unlock buyer/seller features.',
  'dashboard.setUpProfile': 'Set up profile',

  // Settings
  'settings.title': 'Settings',
  'settings.subtitle': 'Account and platform preferences',
  'settings.account': 'Account',
  'settings.partyIdentity': 'Party Identity',
  'settings.role': 'Role',
  'settings.preferences': 'Preferences',
  'settings.platform': 'Platform',
  'settings.language': 'Language',
  'settings.buyerProfile': 'Buyer Profile',

  // Common buttons
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.logout': 'Log Out',
};

const ES: TranslationDict = {
  'brand.name': 'Northbound',
  'nav.dashboard': 'Panel',
  'nav.myOrders': 'Mis Pedidos',
  'nav.orders': 'Pedidos',
  'nav.receivedOrders': 'Pedidos Recibidos',
  'nav.templates': 'Plantillas',
  'nav.analytics': 'Analítica',
  'nav.settings': 'Configuración',
  'nav.buyerAccount': 'Cuenta de comprador',
  'nav.sellerAccount': 'Cuenta de vendedor',

  'dashboard.title': 'Panel',
  'dashboard.subtitle.buyer': 'Gestión de órdenes de compra para tu negocio',
  'dashboard.subtitle.seller': 'Vista del vendedor — sigue los pedidos que llegan de tus compradores',
  'dashboard.totalOrders': 'Pedidos Totales',
  'dashboard.ordersReceived': 'Pedidos Recibidos',
  'dashboard.totalSpend': 'Gasto Total',
  'dashboard.totalRevenue': 'Ingresos Totales',
  'dashboard.pendingOrders': 'Pedidos Pendientes',
  'dashboard.ordersShipped': 'Pedidos Enviados',
  'dashboard.recurringTemplates': 'Plantillas Recurrentes',
  'dashboard.recentOrders': 'Pedidos Recientes',
  'dashboard.recentReceivedOrders': 'Pedidos Recibidos Recientes',
  'dashboard.quickActions': 'Acciones Rápidas',
  'dashboard.createOrder': 'Crear Pedido',
  'dashboard.newTemplate': 'Nueva Plantilla',
  'dashboard.viewAllReceived': 'Ver Todos los Pedidos Recibidos',
  'dashboard.completeProfilePrompt': 'Completa tu perfil para desbloquear funciones de comprador/vendedor.',
  'dashboard.setUpProfile': 'Configurar perfil',

  'settings.title': 'Configuración',
  'settings.subtitle': 'Preferencias de cuenta y plataforma',
  'settings.account': 'Cuenta',
  'settings.partyIdentity': 'Identidad de la Parte',
  'settings.role': 'Rol',
  'settings.preferences': 'Preferencias',
  'settings.platform': 'Plataforma',
  'settings.language': 'Idioma',
  'settings.buyerProfile': 'Perfil del Comprador',

  'common.cancel': 'Cancelar',
  'common.save': 'Guardar',
  'common.logout': 'Cerrar Sesión',
};

const FR: TranslationDict = {
  'brand.name': 'Northbound',
  'nav.dashboard': 'Tableau de bord',
  'nav.myOrders': 'Mes Commandes',
  'nav.orders': 'Commandes',
  'nav.receivedOrders': 'Commandes Reçues',
  'nav.templates': 'Modèles',
  'nav.analytics': 'Analytique',
  'nav.settings': 'Paramètres',
  'nav.buyerAccount': 'Compte acheteur',
  'nav.sellerAccount': 'Compte vendeur',

  'dashboard.title': 'Tableau de bord',
  'dashboard.subtitle.buyer': 'Gestion des bons de commande pour votre entreprise',
  'dashboard.subtitle.seller': 'Aperçu vendeur — suivez les commandes de vos acheteurs',
  'dashboard.totalOrders': 'Total des Commandes',
  'dashboard.ordersReceived': 'Commandes Reçues',
  'dashboard.totalSpend': 'Dépense Totale',
  'dashboard.totalRevenue': 'Revenu Total',
  'dashboard.pendingOrders': 'Commandes en Attente',
  'dashboard.ordersShipped': 'Commandes Expédiées',
  'dashboard.recurringTemplates': 'Modèles Récurrents',
  'dashboard.recentOrders': 'Commandes Récentes',
  'dashboard.recentReceivedOrders': 'Commandes Reçues Récentes',
  'dashboard.quickActions': 'Actions Rapides',
  'dashboard.createOrder': 'Créer une Commande',
  'dashboard.newTemplate': 'Nouveau Modèle',
  'dashboard.viewAllReceived': 'Voir Toutes les Commandes Reçues',
  'dashboard.completeProfilePrompt': 'Complétez votre profil pour débloquer les fonctionnalités acheteur/vendeur.',
  'dashboard.setUpProfile': 'Configurer le profil',

  'settings.title': 'Paramètres',
  'settings.subtitle': 'Préférences du compte et de la plateforme',
  'settings.account': 'Compte',
  'settings.partyIdentity': 'Identité de la Partie',
  'settings.role': 'Rôle',
  'settings.preferences': 'Préférences',
  'settings.platform': 'Plateforme',
  'settings.language': 'Langue',
  'settings.buyerProfile': 'Profil Acheteur',

  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.logout': 'Déconnexion',
};

const DE: TranslationDict = {
  'brand.name': 'Northbound',
  'nav.dashboard': 'Übersicht',
  'nav.myOrders': 'Meine Bestellungen',
  'nav.orders': 'Bestellungen',
  'nav.receivedOrders': 'Eingegangene Bestellungen',
  'nav.templates': 'Vorlagen',
  'nav.analytics': 'Analyse',
  'nav.settings': 'Einstellungen',
  'nav.buyerAccount': 'Käuferkonto',
  'nav.sellerAccount': 'Verkäuferkonto',

  'dashboard.title': 'Übersicht',
  'dashboard.subtitle.buyer': 'Bestellverwaltung für Ihr Unternehmen',
  'dashboard.subtitle.seller': 'Verkäuferübersicht — verfolgen Sie eingehende Bestellungen',
  'dashboard.totalOrders': 'Bestellungen gesamt',
  'dashboard.ordersReceived': 'Erhaltene Bestellungen',
  'dashboard.totalSpend': 'Gesamtausgaben',
  'dashboard.totalRevenue': 'Gesamtumsatz',
  'dashboard.pendingOrders': 'Offene Bestellungen',
  'dashboard.ordersShipped': 'Versendete Bestellungen',
  'dashboard.recurringTemplates': 'Wiederkehrende Vorlagen',
  'dashboard.recentOrders': 'Letzte Bestellungen',
  'dashboard.recentReceivedOrders': 'Letzte eingegangene Bestellungen',
  'dashboard.quickActions': 'Schnellaktionen',
  'dashboard.createOrder': 'Bestellung erstellen',
  'dashboard.newTemplate': 'Neue Vorlage',
  'dashboard.viewAllReceived': 'Alle erhaltenen Bestellungen anzeigen',
  'dashboard.completeProfilePrompt': 'Vervollständigen Sie Ihr Profil, um Käufer-/Verkäuferfunktionen freizuschalten.',
  'dashboard.setUpProfile': 'Profil einrichten',

  'settings.title': 'Einstellungen',
  'settings.subtitle': 'Konto- und Plattformeinstellungen',
  'settings.account': 'Konto',
  'settings.partyIdentity': 'Parteiidentität',
  'settings.role': 'Rolle',
  'settings.preferences': 'Einstellungen',
  'settings.platform': 'Plattform',
  'settings.language': 'Sprache',
  'settings.buyerProfile': 'Käuferprofil',

  'common.cancel': 'Abbrechen',
  'common.save': 'Speichern',
  'common.logout': 'Abmelden',
};

const ZH: TranslationDict = {
  'brand.name': 'Northbound',
  'nav.dashboard': '仪表板',
  'nav.myOrders': '我的订单',
  'nav.orders': '订单',
  'nav.receivedOrders': '收到的订单',
  'nav.templates': '模板',
  'nav.analytics': '分析',
  'nav.settings': '设置',
  'nav.buyerAccount': '买家账户',
  'nav.sellerAccount': '卖家账户',

  'dashboard.title': '仪表板',
  'dashboard.subtitle.buyer': '为您的企业管理采购订单',
  'dashboard.subtitle.seller': '卖家概览 — 跟踪来自买家的订单',
  'dashboard.totalOrders': '订单总数',
  'dashboard.ordersReceived': '收到的订单',
  'dashboard.totalSpend': '总支出',
  'dashboard.totalRevenue': '总收入',
  'dashboard.pendingOrders': '待处理订单',
  'dashboard.ordersShipped': '已发货订单',
  'dashboard.recurringTemplates': '周期性模板',
  'dashboard.recentOrders': '最近订单',
  'dashboard.recentReceivedOrders': '最近收到的订单',
  'dashboard.quickActions': '快捷操作',
  'dashboard.createOrder': '创建订单',
  'dashboard.newTemplate': '新建模板',
  'dashboard.viewAllReceived': '查看全部收到的订单',
  'dashboard.completeProfilePrompt': '完善您的个人资料以解锁买家/卖家功能。',
  'dashboard.setUpProfile': '设置资料',

  'settings.title': '设置',
  'settings.subtitle': '账户和平台偏好',
  'settings.account': '账户',
  'settings.partyIdentity': '身份信息',
  'settings.role': '角色',
  'settings.preferences': '偏好',
  'settings.platform': '平台',
  'settings.language': '语言',
  'settings.buyerProfile': '买家资料',

  'common.cancel': '取消',
  'common.save': '保存',
  'common.logout': '退出登录',
};

const DICTIONARIES: Record<LanguageCode, TranslationDict> = {
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
  zh: ZH,
};

const STORAGE_KEY = 'northbound_language';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function loadLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (stored && DICTIONARIES[stored]) return stored;
  } catch {
    // localStorage unavailable
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(loadLanguage);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // silently fail
    }
  }, []);

  // Reflect the active language on <html lang="..."> for accessibility
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: string): string => {
      const dict = DICTIONARIES[language] ?? EN;
      return dict[key] ?? EN[key] ?? key;
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
