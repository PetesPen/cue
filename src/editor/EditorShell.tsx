import { Inspector } from './Inspector';
import { Logo } from './Logo';
import './shell.css';

/**
 * The empty editor shell in the Studio layout (design/screenshots/Main.png): top bar, slide rail,
 * canvas, notes strip and inspector. Tools, slides and actions arrive with their stories.
 */
export function EditorShell() {
  return (
    <div className="shell">
      <header className="top-bar">
        <Logo />
        <h1 className="app-name">Cue</h1>
      </header>

      <aside className="slide-rail" aria-label="Slides">
        <div className="rail-header">
          <span className="section-label">Slides</span>
        </div>
      </aside>

      <main className="canvas" aria-label="Canvas">
        <div className="slide-frame" />
      </main>

      <section className="notes" aria-label="Speaker notes">
        <div className="notes-header">
          <span className="section-label">Speaker notes</span>
          <span className="caption">Shown in presenter view</span>
        </div>
      </section>

      <Inspector />
    </div>
  );
}
