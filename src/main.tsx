import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log('Starting application initialization...');

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('Root element not found!');
} else {
  console.log('Root element found, creating React root...');
  const root = createRoot(rootElement);
  console.log('Rendering app...');
  root.render(<App />);
  console.log('App rendered');
}
