import logging

import jwt as pyjwt

from django.conf import settings

logger = logging.getLogger(__name__)

DISCOVERY_URI_TMPL = (
    "https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"
)
ISSUER_TMPL = "https://login.microsoftonline.com/{tenant}/v2.0"


class AzureTokenValidationError(Exception):
    pass


class AzureTokenValidator:

    _cliente = None

    @classmethod
    def _obtener_cliente(cls):

        if cls._cliente is None:
            cls._cliente = pyjwt.PyJWKClient(
                DISCOVERY_URI_TMPL.format(
                    tenant=settings.AZURE_TENANT_ID
                ),
                cache_keys=True,
            )

        return cls._cliente

    @classmethod
    def _extraer_claims(cls, token):

        try:
            clave = cls._obtener_cliente().get_signing_key_from_jwt(token)

            return pyjwt.decode(
                token,
                clave.key,
                algorithms=["RS256"],
                audience=settings.AZURE_CLIENT_ID,
                issuer=ISSUER_TMPL.format(
                    tenant=settings.AZURE_TENANT_ID
                ),
                options={
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True,
                },
            )
        except pyjwt.ExpiredSignatureError as e:
            raise AzureTokenValidationError(
                "El token de Azure ha expirado."
            ) from e
        except pyjwt.InvalidAudienceError as e:
            raise AzureTokenValidationError(
                "El token no corresponde a esta aplicación."
            ) from e
        except pyjwt.InvalidIssuerError as e:
            raise AzureTokenValidationError(
                "El emisor del token no es válido."
            ) from e
        except pyjwt.PyJWTError as e:
            raise AzureTokenValidationError(
                "El token de Azure no es válido."
            ) from e
        except TypeError as e:
            raise AzureTokenValidationError(
                "El token de Azure no es válido."
            ) from e

    @classmethod
    def validar(cls, token):

        claims = cls._extraer_claims(token)

        oid = claims.get("oid") or claims.get("sub")

        email = (
            claims.get("preferred_username")
            or claims.get("email")
            or oid
        )

        if email and "@" in email:
            email = email.lower()

        if oid:
            oid = str(oid)

        dominios_permitidos = settings.AZURE_ALLOWED_DOMAINS

        if dominios_permitidos:
            dominio = (
                email.rsplit("@", 1)[-1]
                if email and "@" in email
                else None
            )

            if dominio not in dominios_permitidos:
                raise AzureTokenValidationError(
                    f"El dominio del correo '{dominio}' no está permitido."
                )

        return {
            "azure_id": oid,
            "email": email,
            "nombres": claims.get("name"),
        }