import type { AppLocale } from '@/lib/i18n/config'

export const messages = {
  en: {
    common: {
      storeName: 'The Kiyon Store',
      skipToContent: 'Skip to main content',
    },
    header: {
      userMenu: 'User menu',
      account: 'My Account',
      orders: 'My Orders',
      wishlist: 'My Wishlist',
      admin: 'Admin Dashboard',
      signOut: 'Sign Out',
      signingOut: 'Signing out…',
      home: 'Home',
      shop: 'Shop',
      about: 'About',
      contact: 'Contact',
      login: 'Login',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      language: 'Language',
      languageEnglish: 'English',
      languageSpanish: 'Español',
    },
    hero: {
      title: 'Handmade With Love',
      categories: 'Crochet • Flowers • Bags • Accessories',
      description:
        'Discover our collection of crocheted flowers, hair accessories, keyrings, scarves, and cozy wearables — each piece lovingly crafted, one stitch at a time.',
      cta: 'Explore Shop',
      statHandmade: 'Handmade',
      statProducts: 'Products',
      statLove: 'Made with love',
      badgeFlowers: 'Crochet flowers',
      badgeHair: 'Hair accessories',
      badgeKnitwear: 'Handmade knitwear',
      badgeShipping: 'Free shipping',
      illustrationLabel:
        'Illustration placeholder: girl crocheting by a window',
      atelierMood: 'atelier mood',
      illustrationText: 'Illustration: Girl crocheting by a window',
    },
  },
  es: {
    common: {
      storeName: 'La Tienda Kiyon',
      skipToContent: 'Saltar al contenido principal',
    },
    header: {
      userMenu: 'Menú de usuario',
      account: 'Mi cuenta',
      orders: 'Mis pedidos',
      wishlist: 'Mi lista de deseos',
      admin: 'Panel de administración',
      signOut: 'Cerrar sesión',
      signingOut: 'Cerrando sesión…',
      home: 'Inicio',
      shop: 'Tienda',
      about: 'Acerca de',
      contact: 'Contacto',
      login: 'Iniciar sesión',
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      language: 'Idioma',
      languageEnglish: 'English',
      languageSpanish: 'Español',
    },
    hero: {
      title: 'Hecho a mano con amor',
      categories: 'Crochet • Flores • Bolsos • Accesorios',
      description:
        'Descubre nuestra colección de flores tejidas, accesorios para el cabello, llaveros, bufandas y prendas acogedoras: cada pieza está hecha con cariño, puntada a puntada.',
      cta: 'Explorar tienda',
      statHandmade: 'Hecho a mano',
      statProducts: 'Productos',
      statLove: 'Hecho con amor',
      badgeFlowers: 'Flores de crochet',
      badgeHair: 'Accesorios para el cabello',
      badgeKnitwear: 'Prendas tejidas a mano',
      badgeShipping: 'Envío gratis',
      illustrationLabel:
        'Marcador de ilustración: chica tejiendo junto a una ventana',
      atelierMood: 'ambiente de taller',
      illustrationText: 'Ilustración: chica tejiendo junto a una ventana',
    },
  },
} as const

type Messages = typeof messages
type Namespace = keyof Messages['en']

type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never

type NestedKeys<T> = {
  [K in keyof T]: T[K] extends Record<string, string>
    ? Join<K & string, keyof T[K] & string>
    : never
}[keyof T]

export type MessageKey = NestedKeys<Messages['en']>

export const getMessage = (locale: AppLocale, key: MessageKey): string => {
  const [namespace, leaf] = key.split('.') as [Namespace, string]
  const entry = messages[locale]?.[namespace]
  if (!entry) return key
  const localized = entry[leaf as keyof typeof entry]
  if (typeof localized === 'string') return localized

  const fallback =
    messages.en[namespace][
      leaf as keyof (typeof messages.en)[typeof namespace]
    ]
  return typeof fallback === 'string' ? fallback : key
}
