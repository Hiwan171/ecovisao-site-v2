import Image from "next/image";
import { SECTION_LINKS } from "../nav/section-links";
import "./footer.css";

/**
 * The page's last word. It follows the closing section in the normal flow, on the same
 * dark ground, so the pin lets go without a seam: the rings go on, faintly, and the
 * name of the company rises out of the bottom edge as it comes into view.
 */
export function Footer() {
  return (
    <footer id="footer" className="ft" aria-label="Rodapé">
      <svg className="ft__rings" viewBox="0 0 800 800" aria-hidden="true">
        {[120, 200, 290, 390, 500, 620].map((r) => (
          <circle key={r} cx="400" cy="400" r={r} />
        ))}
      </svg>

      <div className="ft__mid">
        <nav className="ft__nav" aria-label="Seções do site">
          <p>Navegação</p>
          <ul>
            {SECTION_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} data-goto={link.goto}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ft__focus">
          <p>Atuação</p>
          <ul>
            <li>Gestão</li>
            <li>Estratégia</li>
            <li>PGRSS</li>
          </ul>
        </div>

        <a className="ft__up" href="#top">
          <span>Voltar ao topo</span>
          <i aria-hidden="true">↑</i>
        </a>
      </div>

      <div className="ft__brand">
        <Image
          className="ft__mark"
          src="/brand/ecovisao-wordmark-on-dark.svg"
          alt="Ecovisão Consultoria"
          width={473}
          height={134}
          unoptimized
        />
      </div>

      <p className="ft__legal">© {new Date().getFullYear()} Ecovisão Consultoria. Todos os direitos reservados.</p>
    </footer>
  );
}
