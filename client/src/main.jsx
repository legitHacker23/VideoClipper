import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppOAuth from './AppOAuth.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppOAuth />
  </StrictMode>,
)
