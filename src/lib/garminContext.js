import { createContext, useContext } from 'react';
export const GarminContext = createContext(null);
export const useGarmin = () => useContext(GarminContext);
