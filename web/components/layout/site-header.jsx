import {Wordmark} from './wordmark.jsx';
import {SearchForm} from '../search/search-form.jsx';

export function SiteHeader({detail = false}) {
  return <header className={`site-header${detail ? ' detail-header' : ''}`}>
    <Wordmark/>
    <SearchForm/>
  </header>;
}
