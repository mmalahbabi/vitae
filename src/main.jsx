import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Vitae from './Vitae.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Vitae />
  </StrictMode>,
)
