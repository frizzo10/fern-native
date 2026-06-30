// src/i18n/translations.js
//
// Lightweight translation dictionary for the Fern native app.
// Mirrors the pattern used by the web app's FERN_LOCALES system
// (myaifern.com / app.clickpickandcook.com index.html) so the two stay
// conceptually consistent, without pulling in a translation library.
//
// To add a language: add a new top-level key below with the same shape
// as `en`, then add its code to SUPPORTED_LOCALES in LocaleContext.js.

export const translations = {
  en: {
    // Greetings
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',

    // HomeScreen
    weekAtGlance: "Here's your week at a glance",
    proMaxBadge: '✦✦ PRO MAX',
    syncingData: 'Syncing your data...',
    today: 'TODAY',
    addMeal: '+ Add',
    thinking: 'Thinking...',
    listening: 'Listening...',
    askFern: 'Ask Fern',
    statDinners: 'Dinners',
    statActivities: 'Activities',
    statShopping: 'Shopping',
    statRecipes: 'Recipes',
    itemsCount: (n) => `${n} items`,
    cookbooksCount: (n) => `📚 ${n} Cookbooks`,
    recipesCount: (n) => `·  ${n} Recipes`,

    // LoginScreen
    loginMissingFields: 'Please enter email and password',
    loginFailed: 'Login failed',
    logoTagline: 'Weekly ad to dinner table',
    signIn: 'Sign in',
    email: 'Email',
    password: 'Password',
    signInToFern: 'Sign in to Fern',
    loginFooter: 'Use the same account as app.clickpickandcook.com',

    // App.js — tabs + arrival banner
    tabHome: 'Home',
    tabFind: 'Find',
    tabShop: 'Shop',
    tabRecipes: 'Recipes',
    arrivedTitle: (storeName) => `${storeName} — you've arrived`,
    arrivedSub: 'Ready to shop with Fern?',
    shopBtn: 'Shop',

    // Stub screens
    findRecipesTitle: 'Find Recipes',
    myRecipesTitle: 'My Recipes',
    shoppingListTitle: '🛒 Shopping List',
    comingSoon: 'Coming soon',

    // Days (short) and meal slots — used as arrays, see DAYS/MEALS below
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    meals: ['Breakfast', 'Lunch', 'Dinner'],
  },

  es: {
    goodMorning: 'Buenos días',
    goodAfternoon: 'Buenas tardes',
    goodEvening: 'Buenas noches',

    weekAtGlance: 'Aquí está tu semana de un vistazo',
    proMaxBadge: '✦✦ PRO MAX',
    syncingData: 'Sincronizando tus datos...',
    today: 'HOY',
    addMeal: '+ Añadir',
    thinking: 'Pensando...',
    listening: 'Escuchando...',
    askFern: 'Preguntar a Fern',
    statDinners: 'Cenas',
    statActivities: 'Actividades',
    statShopping: 'Compras',
    statRecipes: 'Recetas',
    itemsCount: (n) => `${n} artículos`,
    cookbooksCount: (n) => `📚 ${n} Libros de cocina`,
    recipesCount: (n) => `·  ${n} Recetas`,

    loginMissingFields: 'Introduce tu correo y contraseña',
    loginFailed: 'Error al iniciar sesión',
    logoTagline: 'Del folleto semanal a la mesa',
    signIn: 'Iniciar sesión',
    email: 'Correo electrónico',
    password: 'Contraseña',
    signInToFern: 'Iniciar sesión en Fern',
    loginFooter: 'Usa la misma cuenta que app.clickpickandcook.com',

    tabHome: 'Inicio',
    tabFind: 'Buscar',
    tabShop: 'Compras',
    tabRecipes: 'Recetas',
    arrivedTitle: (storeName) => `${storeName} — has llegado`,
    arrivedSub: '¿Listo para comprar con Fern?',
    shopBtn: 'Comprar',

    findRecipesTitle: 'Buscar Recetas',
    myRecipesTitle: 'Mis Recetas',
    shoppingListTitle: '🛒 Lista de Compras',
    comingSoon: 'Próximamente',

    days: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    meals: ['Desayuno', 'Almuerzo', 'Cena'],
  },
};

export const SUPPORTED_LOCALES = Object.keys(translations);
export const DEFAULT_LOCALE = 'en';
