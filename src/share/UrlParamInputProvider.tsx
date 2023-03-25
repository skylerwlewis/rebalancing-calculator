import { createContext, PropsWithChildren, useMemo, } from 'react';
import { useLocation } from 'react-router-dom';
import LZString from 'lz-string';
import { InputUrlParams } from './InputUrlParams';

type UrlParamInputContextState = {
  baseUrl: string;
  queryStrings: string;
  urlParamsInput: InputUrlParams[];
}

const initialInputState: UrlParamInputContextState = {
  baseUrl: '',
  queryStrings: '',
  urlParamsInput: []
};

const getParsedInput = (urlParamsInputString: string | null): InputUrlParams[] => {
  if (!urlParamsInputString) {
    return [];
  }
  try {
    const decompressedJsonString = LZString.decompressFromEncodedURIComponent(urlParamsInputString);
    return decompressedJsonString === null ? {} : JSON.parse(decompressedJsonString);
  } catch (error) {
    return [];
  }

}

export const UrlParamInputContext = createContext<UrlParamInputContextState>(initialInputState);

const UrlParamInputProvider = ({ children }: PropsWithChildren<{}>) => {

  const windowLocationHref = window.location.href;
  const locationSearch = useLocation().search;
  const locationPathName = useLocation().pathname;

  const urlParamsInputStringValue = useMemo(() => {
    const inputString = new URLSearchParams(locationSearch).get('input');
    return !inputString ? null : inputString.replaceAll(' ', '+');
  }, [locationSearch]);
  const urlParamsInput: InputUrlParams[] = useMemo(() => getParsedInput(urlParamsInputStringValue), [urlParamsInputStringValue]);

  const queryStrings = useMemo(() => {
    const queryString = locationSearch.replace(!urlParamsInputStringValue ? '' : 'input=' + urlParamsInputStringValue, '').replace('&&', '&').replace('?', '');
    return !!queryString && !queryString.endsWith('&') ? queryString + '&' : queryString;
  }, [locationSearch, urlParamsInputStringValue]);

  const baseUrl = useMemo(() => windowLocationHref.replace(locationSearch, '').replace(locationPathName, ''), [windowLocationHref, locationSearch, locationPathName]);

  return (
    <UrlParamInputContext.Provider
      value={{
        baseUrl,
        queryStrings,
        urlParamsInput
      }}>
      {children}
    </UrlParamInputContext.Provider>
  );

};

export default UrlParamInputProvider;