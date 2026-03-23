const Footer = () => (
  <footer
    aria-label="Site footer"
    className="border-t border-[var(--border-warm)] bg-[var(--surface)] py-4"
  >
    <p className="text-center text-sm text-[var(--text-secondary)]">
      © {new Date().getFullYear()} The Kiyon Store. All rights reserved.
    </p>
  </footer>
);

export default Footer;
