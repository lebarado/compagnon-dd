import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './styles-moteur.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import './styles-theme.css'

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
