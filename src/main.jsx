import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
// Board fonts a game can pick (src/lib/theme.js). Browsers only download one when it's used.
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '@fontsource-variable/fredoka/wght.css';
import '@fontsource-variable/oswald/wght.css';
import '@fontsource-variable/playfair-display/wght.css';
import '@fontsource/bungee/400.css';
import './styles.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
