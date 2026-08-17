import { Configuration } from "@azure/msal-browser";

export const msalConfig: Configuration = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
        authority:
            "https://login.microsoftonline.com/" +
            process.env.NEXT_PUBLIC_TENANT_ID,
        redirectUri: "http://localhost:3000",
    },
};

export const loginRequest = {
    scopes: ["User.Read"],
};