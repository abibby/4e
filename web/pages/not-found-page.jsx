import {SiteLink} from '../components/layout/site-link.jsx';
import {usePageTitle} from '../hooks/use-page-title.js';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return <main id="main" className="empty-state"><h1>Page not found</h1>
    <SiteLink to="/index.html">Return to the compendium</SiteLink>
  </main>;
}
