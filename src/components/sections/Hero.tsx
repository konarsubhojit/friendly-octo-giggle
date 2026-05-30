'use client'

import Link from 'next/link'
import {
  ScatteredFlowers,
  VineDivider,
} from '@/components/ui/DecorativeElements'
import { useLocale } from '@/contexts/LocaleContext'

const HeroTextColumn = () => {
  const { t, localizePath } = useLocale()
  const stats = [
    { num: '100%', label: t('hero.statHandmade'), decorative: false },
    { num: '50+', label: t('hero.statProducts'), decorative: false },
    { num: '❤️', label: t('hero.statLove'), decorative: true },
  ] as const

  return (
    <div className="flex-1 max-w-xl animate-fade-in-up">
      <h1
        id="hero-heading"
        className="font-cursive text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-[var(--foreground)] mb-6"
      >
        {t('hero.title')}
      </h1>
      <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-[var(--text-muted)] mb-8">
        {t('hero.categories')}
      </p>
      <p className="text-base sm:text-lg text-[var(--text-secondary)] mb-8 leading-relaxed animate-fade-in-up animation-delay-100">
        {t('hero.description')}
      </p>
      <Link
        href={localizePath('/shop')}
        className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--btn-primary)] text-white rounded-full font-bold hover:bg-[var(--btn-primary-hover)] transition-all duration-300 shadow-warm hover:shadow-warm-lg hover:scale-105 focus-warm animate-fade-in-up animation-delay-200"
      >
        {t('hero.cta')} <span aria-hidden="true">→</span>
      </Link>
      <div className="flex flex-wrap gap-6 mt-10 pt-8 border-t border-[var(--border-warm)] animate-fade-in-up animation-delay-300">
        {stats.map(({ num, label, decorative }) => (
          <div key={label} className="flex flex-col">
            <span
              className="text-2xl font-bold font-display text-[var(--hero-stat)]"
              aria-hidden={decorative || undefined}
            >
              {num}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const HeroIllustration = () => {
  const { t } = useLocale()
  return (
    <div className="flex-1 w-full max-w-lg lg:max-w-none animate-fade-in-up animation-delay-200">
      <div
        className="relative flex min-h-[400px] w-full items-center justify-center overflow-hidden rounded-[2rem] border border-[var(--border-warm)] bg-theme-panel shadow-warm-lg"
        role="img"
        aria-label={t('hero.illustrationLabel')}
      >
        <div
          className="absolute left-6 top-6 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] glass-card text-[var(--text-secondary)]"
          aria-hidden="true"
        >
          {t('hero.atelierMood')}
        </div>
        <div
          className="absolute -right-10 top-10 h-28 w-28 rounded-full blur-3xl"
          style={{ backgroundColor: 'var(--hero-orb-primary)' }}
          aria-hidden="true"
        />
        <div
          className="absolute -left-8 bottom-6 h-24 w-24 rounded-full blur-3xl"
          style={{ backgroundColor: 'var(--hero-orb-secondary)' }}
          aria-hidden="true"
        />
        <div className="relative text-center p-8">
          <span className="text-6xl block mb-4" aria-hidden="true">
            🧶
          </span>
          <p className="text-sm text-[var(--foreground)] font-medium">
            {t('hero.illustrationText')}
          </p>
        </div>
      </div>
    </div>
  )
}

const FeatureBadges = () => {
  const { t } = useLocale()
  const featureBadges = [
    { icon: '🌸', text: t('hero.badgeFlowers') },
    { icon: '🎀', text: t('hero.badgeHair') },
    { icon: '🧶', text: t('hero.badgeKnitwear') },
    { icon: '🚚', text: t('hero.badgeShipping') },
  ] as const

  return (
    <div className="flex flex-wrap gap-4 justify-center mt-6 animate-fade-in-up animation-delay-400">
      {featureBadges.map(({ icon, text }) => (
        <div
          key={text}
          className="glass-card flex items-center gap-2.5 rounded-full border border-[var(--border-warm)] px-5 py-2.5 shadow-warm animate-float-gentle"
        >
          <span className="text-base" aria-hidden="true">
            {icon}
          </span>
          <span className="text-sm font-semibold text-[var(--text-secondary)]">
            {text}
          </span>
        </div>
      ))}
    </div>
  )
}

const Hero = () => (
  <section
    className="relative flex flex-col justify-center overflow-hidden bg-hero-gradient py-12 lg:py-20"
    aria-labelledby="hero-heading"
  >
    <ScatteredFlowers />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        <HeroTextColumn />
        <HeroIllustration />
      </div>
      <VineDivider />
      <FeatureBadges />
    </div>
    <div
      className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl opacity-25 animate-float-slow pointer-events-none"
      style={{ backgroundColor: 'var(--hero-orb-primary)' }}
      aria-hidden="true"
    />
    <div
      className="absolute bottom-10 right-10 w-96 h-96 rounded-full blur-3xl opacity-20 animate-float-slow animation-delay-300 pointer-events-none"
      style={{ backgroundColor: 'var(--hero-orb-secondary)' }}
      aria-hidden="true"
    />
  </section>
)

export default Hero
