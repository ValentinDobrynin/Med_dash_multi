import { createContext, useContext } from 'react';

// Контекст текущего юзера (/auth/me): { login, name, role, bot: {connected, username, bound} }
export const MeContext = createContext(null);
export const useMe = () => useContext(MeContext);
