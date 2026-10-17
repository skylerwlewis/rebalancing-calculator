import { createContext } from 'react';
import { InputUrlParams } from './InputUrlParams';

export interface UrlParamInputContextState {
  baseUrl: string;
  queryStrings: string;
  urlParamsInput: InputUrlParams;
}

const initialInputState: UrlParamInputContextState = {
  baseUrl: '',
  queryStrings: '',
  urlParamsInput: {}
};

export const UrlParamInputContext = createContext<UrlParamInputContextState>(initialInputState);
