import {useLinkClickHandler, useLocation} from 'react-router';
import {useCompendium} from '../../providers/compendium-provider.jsx';

// Relative hrefs survive deployment at any base path and match the SSR markup.
// Entry documents own their static rules HTML, so crossing that boundary reloads.
export function SiteLink({to, onClick, children, ...props}) {
  const {root} = useCompendium();
  const {pathname} = useLocation();
  const routeClick = useLinkClickHandler(to, {target: props.target});
  const reloadDocument = pathname.startsWith('/content/') || to.startsWith('/content/');
  return <a {...props} href={`${root}${to.replace(/^\//, '')}`} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && !reloadDocument) routeClick(event);
  }}>{children}</a>;
}
