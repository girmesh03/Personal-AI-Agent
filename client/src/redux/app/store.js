/**
 * @module redux/app/store
 * @description Central Redux Toolkit store configuration with redux-persist and RTK Query apiSlice.
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';

import authReducer from '../features/authSlice.js';
import { apiSlice } from './apiSlice.js';

/**
 * Standard asynchronous storage engine for redux-persist, directly interfacing
 * with window.localStorage to guarantee zero ESM/CommonJS bundler mismatch errors.
 *
 * @constant
 * @type {{ getItem: (key: string) => Promise<string|null>, setItem: (key: string, value: string) => Promise<void>, removeItem: (key: string) => Promise<void> }}
 */
const persistStorage = {
  getItem: (key) => {
    try {
      return Promise.resolve(
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(key)
          : null
      );
    } catch (err) {
      return Promise.reject(err);
    }
  },
  setItem: (key, value) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  },
  removeItem: (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  },
};

/**
 * Persistence configuration for the authentication slice.
 * @constant
 * @type {import('redux-persist').PersistConfig}
 */
const authPersistConfig = {
  key: 'auth',
  storage: persistStorage,
  whitelist: ['user', 'isAuthenticated'],
};

/**
 * Root reducer combining persisted authentication state and RTK Query API slice reducer.
 * @constant
 * @type {import('@reduxjs/toolkit').Reducer}
 */
const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  [apiSlice.reducerPath]: apiSlice.reducer,
});

/**
 * Configured central Redux Toolkit store with redux-persist serializable middleware checks.
 * @constant
 * @type {import('@reduxjs/toolkit').EnhancedStore}
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(apiSlice.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

/**
 * Redux persistor instance handling client session rehydration.
 * @constant
 * @type {import('redux-persist').Persistor}
 */
export const persistor = persistStore(store);

export default store;
