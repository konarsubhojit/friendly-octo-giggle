import Header from '@/components/layout/Header'

/**
 * Renders the public site Header.
 *
 * This is a server component — admin routes intentionally live outside the
 * `(public)` route group and therefore never mount this wrapper. Keeping it as
 * a server component avoids dragging the entire header tree into the client
 * bundle of routes (e.g. SSG marketing pages) that only need its static markup
 * in the initial HTML.
 */
const HeaderWrapper = () => <Header />

export default HeaderWrapper
