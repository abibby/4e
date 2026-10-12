import {renderToString} from 'react-dom/server';
import {StaticRouter} from 'react-router';
import {App} from './app.jsx';

export function render({root, pathname}) {
  return renderToString(<StaticRouter location={pathname}>
    <App root={root}/>
  </StaticRouter>);
}
