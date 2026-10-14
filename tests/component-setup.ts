/// <reference types="vite/client" />
// Component tests run in a real browser with the same tokens, fonts and base styles as the app
// (src/main.tsx), so layout, sizes and visibility mean what they do for a user.
import '../design/tokens.css';
import '@/fonts/fonts.css';
import '@/styles/base.css';

// The app's root fills the window; give each test's container the same height.
const style = document.createElement('style');
style.textContent = 'body > div { height: 100%; }';
document.head.append(style);
