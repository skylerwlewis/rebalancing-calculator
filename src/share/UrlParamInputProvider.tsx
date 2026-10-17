import { PropsWithChildren, useMemo, } from 'react';
import { useLocation } from 'react-router-dom';
import LZString from 'lz-string';
import { fromMinifiedInputUrlParams, InputUrlParams, MinifiedInputUrlParams } from './InputUrlParams';
import { UrlParamInputContext } from './UrlParamInputContext';
import JSON5 from 'json5'
import escapeStringRegexp from 'escape-string-regexp';

const getParsedInput = (urlParamsInputString: string | null): MinifiedInputUrlParams => {
  if (!urlParamsInputString) {
    return {};
  }
  try {
    // lz-string returns null for malformed input even though its typings declare `string`.
    const decompressedJsonString = LZString.decompressFromEncodedURIComponent(urlParamsInputString) as string | null;
    return decompressedJsonString === null ? {} : JSON5.parse(decompressedJsonString);
  } catch {
    return {};
  }
}

const UrlParamInputProvider = ({ children }: PropsWithChildren) => {

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