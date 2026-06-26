import { STORE_NAME } from '@/lib/constants/store'

const Footer = () => (
  <footer
    aria-label="Site footer"
    className="border-t border-[var(--border-warm)] bg-[var(--surface)] py-4"
  >
    <p className="text-center text-sm text-[var(--text-secondary)]">
      © 2024–Present {STORE_NAME}. All rights reserved.
    </p>
  </footer>
)

export default Footer
