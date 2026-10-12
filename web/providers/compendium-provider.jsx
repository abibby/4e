import {createContext, useContext} from 'react';
import {useCompendiumResources} from '../hooks/use-compendium-resources.js';

const CompendiumContext = createContext(null);

export function CompendiumProvider({root, children}) {
  const resources = useCompendiumResources(root);
  return <CompendiumContext.Provider value={{root, ...resources}}>{children}</CompendiumContext.Provider>;
}

export function useCompendium() {
  const context = useContext(CompendiumContext);
  if (!context) throw new Error('useCompendium must be used within CompendiumProvider');
  return context;
}
