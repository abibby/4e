import {Outlet} from 'react-router';
import {SiteHeader} from './site-header.jsx';

export function SiteLayout() {
  return <><SiteHeader/><Outlet/></>;
}
