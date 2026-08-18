import { Configuration } from "@azure/msal-browser";

const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;
const tenantId = process.env.NEXT_PUBLIC_TENANT_ID;
const redirectUri =
    process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000";

export const msalConfig: Configuration = {
    auth: {
        clientId: clientId ?? "",
        authority:
            "https://login.microsoftonline.com/" + (tenantId ?? ""),
        redirectUri,
        postLogoutRedirectUri: redirectUri,
    },
};

export const loginRequest = {
    scopes: ["User.Read"],
};

export const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";