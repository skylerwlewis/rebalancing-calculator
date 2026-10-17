import { createContext } from 'react';
import { InputUrlParams } from './InputUrlParams';

export interface InputUrlParamContextState {
  input: InputUrlParams;
  inputUrlJsonString: string;
}

const initialInputState: InputUrlParamContextState = {
  input: {},
  inputUrlJsonString: ''
};

export const InputUrlParamContext = createContext<InputUrlParamContextState>(initialInputState);
