import {SearchForm} from '../components/search/search-form.jsx';
import {usePageTitle} from '../hooks/use-page-title.js';

export function HomePage() {
  usePageTitle('Compendium');
  return <main id="main" className="home"><div className="home-inner">
    <h1>D&amp;D <span>4e</span><small>COMPENDIUM</small></h1>
    <SearchForm/>
  </div></main>;
}
