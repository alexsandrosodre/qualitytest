import { createRoot } from 'react-dom/client';

import { Popup } from './Popup';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento raiz #root não encontrado no popup da extensão.');
}

createRoot(container).render(<Popup />);
