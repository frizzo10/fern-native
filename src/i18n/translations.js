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


    // FindScreen
    findSearchPlaceholder: 'What are you craving?',
    findSearchBtn: 'Search',
    findEmptyTitle: 'Find your next favorite meal',
    findEmptySub: "Search by ingredient or craving, and Fern's AI will suggest recipes for you.",
    findLoading: 'Fern is thinking of ideas...',
    findErrorTitle: "Couldn't find recipes",
    findErrorSub: 'Something went wrong — try again.',
    findTryAgain: 'Try Again',
    findSaveBtn: 'Save Recipe',
    findSavedBtn: 'Saved ✓',
    findServings: (n) => `Serves ${n}`,
    findMinutes: (n) => `${n} min`,
    findIngredientsHeader: 'Ingredients',
    findInstructionsHeader: 'Instructions',
    findCloseBtn: 'Close',

    // RecipesScreen (My Recipes)
    myRecipesEmptyTitle: 'No saved recipes yet',
    myRecipesEmptySub: 'Recipes you save from Find will show up here.',
    addToShoppingBtn: 'Add to Shopping List',
    addedToShoppingBtn: 'Added ✓',
    removeBtn: 'Remove',
    removeConfirmTitle: 'Remove this recipe?',
    removeConfirmSub: "This can't be undone.",
    cancel: 'Cancel',
    confirmRemove: 'Remove',

    // ShoppingScreen
    shoppingEmptyTitle: 'Your shopping list is empty',
    shoppingEmptySub: "Add items below, or save a recipe's ingredients from My Recipes.",
    shoppingAddPlaceholder: 'Add an item...',
    shoppingClearChecked: 'Clear Checked',
    shoppingClearAll: 'Clear All',
    shoppingClearAllConfirmTitle: 'Clear your whole shopping list?',

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


    findSearchPlaceholder: '¿Qué se te antoja?',
    findSearchBtn: 'Buscar',
    findEmptyTitle: 'Encuentra tu próxima comida favorita',
    findEmptySub: 'Busca por ingrediente o antojo, y la IA de Fern te sugerirá recetas.',
    findLoading: 'Fern está pensando en ideas...',
    findErrorTitle: 'No se pudieron encontrar recetas',
    findErrorSub: 'Algo salió mal — inténtalo de nuevo.',
    findTryAgain: 'Intentar de Nuevo',
    findSaveBtn: 'Guardar Receta',
    findSavedBtn: 'Guardado ✓',
    findServings: (n) => `${n} porciones`,
    findMinutes: (n) => `${n} min`,
    findIngredientsHeader: 'Ingredientes',
    findInstructionsHeader: 'Instrucciones',
    findCloseBtn: 'Cerrar',

    myRecipesEmptyTitle: 'Aún no tienes recetas guardadas',
    myRecipesEmptySub: 'Las recetas que guardes desde Buscar aparecerán aquí.',
    addToShoppingBtn: 'Añadir a Lista de Compras',
    addedToShoppingBtn: 'Añadido ✓',
    removeBtn: 'Quitar',
    removeConfirmTitle: '¿Quitar esta receta?',
    removeConfirmSub: 'Esto no se puede deshacer.',
    cancel: 'Cancelar',
    confirmRemove: 'Quitar',

    shoppingEmptyTitle: 'Tu lista de compras está vacía',
    shoppingEmptySub: 'Añade artículos abajo, o guarda los ingredientes de una receta desde Mis Recetas.',
    shoppingAddPlaceholder: 'Añadir un artículo...',
    shoppingClearChecked: 'Limpiar Marcados',
    shoppingClearAll: 'Limpiar Todo',
    shoppingClearAllConfirmTitle: '¿Vaciar toda tu lista de compras?',

    days: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    meals: ['Desayuno', 'Almuerzo', 'Cena'],
  },
};

export const SUPPORTED_LOCALES = Object.keys(translations);
export const DEFAULT_LOCALE = 'en';
