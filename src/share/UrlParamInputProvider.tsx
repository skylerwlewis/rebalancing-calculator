import { createContext, PropsWithChildren, useMemo, } from 'react';
import { useLocation } from 'react-router-dom';
import LZString from 'lz-string';
import { fromMinifiedInputUrlParams, InputUrlParams, MinifiedInputUrlParams } from './InputUrlParams';
import JSON5 from 'json5'
import escapeStringRegexp from 'escape-string-regexp';

type UrlParamInputContextState = {
  baseUrl: string;
  queryStrings: string;
  urlParamsInput: InputUrlParams;
}

const initialInputState: UrlParamInputContextState = {
  baseUrl: '',
  queryStrings: '',
  urlParamsInput: {}
};

const getParsedInput = (urlParamsInputString: string | null): MinifiedInputUrlParams => {
  if (!urlParamsInputString) {
    return {};
  }
  try {
    const decompressedJsonString = LZString.decompressFromEncodedURIComponent(urlParamsInputString);
    return decompressedJsonString === null ? {} : JSON5.parse(decompressedJsonString);
  } catch (error) {
    return {};
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
  const urlParamsInput: InputUrlParams = useMemo(() => fromMinifiedInputUrlParams(getParsedInput(urlParamsInputStringValue)), [urlParamsInputStringValue]);

  const queryStrings = useMemo(() => {
    const queryString = locationSearch.replace(!urlParamsInputStringValue ? '' : 'input=' + urlParamsInputStringValue, '').replace('&&', '&').replace('?', '');
    return !!queryString && !queryString.endsWith('&') ? queryString + '&' : queryString;
  }, [locationSearch, urlParamsInputStringValue]);

  const baseUrl = useMemo(() => windowLocationHref.replace(new RegExp(escapeStringRegexp(locationSearch) + '$'), '').replace(new RegExp(escapeStringRegexp(locationPathName) + '$'), ''), [windowLocationHref, locationSearch, locationPathName]);

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