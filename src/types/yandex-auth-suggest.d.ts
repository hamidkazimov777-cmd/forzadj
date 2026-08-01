interface YandexTokenPayload {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface YaAuthSuggestInitResult {
  status: "ok" | "error";
  handler?: () => Promise<YandexTokenPayload>;
  code?: string;
}

interface YaAuthSuggestButtonParams {
  view: "button";
  parentId?: string;
  buttonView?: "main" | "additional" | "icon" | "iconBG";
  buttonTheme?: "light" | "dark";
  buttonSize?: "xs" | "s" | "m" | "l" | "xl" | "xxl";
  buttonBorderRadius?: string | number;
  buttonIcon?: "ya" | "yaEng";
}

interface Window {
  YaAuthSuggest?: {
    init: (
      oauthQueryParams: {
        client_id: string;
        response_type: string;
        redirect_uri: string;
      },
      tokenPageOrigin: string,
      suggestParams?: YaAuthSuggestButtonParams,
    ) => Promise<YaAuthSuggestInitResult>;
  };
  YaSendSuggestToken?: (origin: string, extraData?: Record<string, unknown>) => void;
}
