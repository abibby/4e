import {hydrateRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import {App} from './app.jsx';

const root = document.querySelector('meta[name="app-root"]').content;
const basename = new URL(root, window.location.href).pathname;

hydrateRoot(document.getElementById('root'), <BrowserRouter basename={basename}>
  <App root={root}/>
</BrowserRouter>);
