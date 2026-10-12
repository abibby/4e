import {SiteHeader} from '../components/layout/site-header.jsx';

// The build emits the original rules fragment outside the hydrated root. Keeping
// it static preserves legacy markup and reading without JavaScript.
export function EntryPage() {
  return <SiteHeader detail/>;
}
