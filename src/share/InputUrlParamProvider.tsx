import { useContext } from 'react';
import { createContext, PropsWithChildren, useMemo } from 'react';
import { InputContext } from '../input/InputProvider';
import LZString from 'lz-string';
import { InputUrlParams, toInputUrlParams } from './InputUrlParams';

type InputUrlParamContextState = {
  input: InputUrlParams[];
  inputUrlJsonString: string;
}

const initialInputState: InputUrlParamContextState = {
  input: [],
  inputUrlJsonString: ''
};

export const InputUrlParamContext = createContext<InputUrlParamContextState>(initialInputState);

const InputUrlParamProvider = ({ children }: PropsWithChildren<{}>) => {

  const { fundInputItems } = useContext(InputContext);

  const urlParams: InputUrlParams[] = useMemo(() => fundInputItems.map(toInputUrlParams), [fundInputItems]);

  const jsonString = useMemo(() => LZString.compressToEncodedURIComponent(JSON.stringify(urlParams)), [urlParams]);

  return (
    <InputUrlParamContext.Provider
      value={{
        input: urlParams,
        inputUrlJsonString: jsonString
      }}>
      {children}
    </InputUrlParamContext.Provider>
  );

};

export default InputUrlParamProvider;