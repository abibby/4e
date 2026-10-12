import {useEffect} from 'react';

export function usePageTitle(title) {
  useEffect(() => { document.title = `${title} · D&D 4e`; }, [title]);
}
