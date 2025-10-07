# OAuth Configuration Guide

The auth service supports optional OAuth providers (Google and Microsoft). The service will start and run normally even if OAuth is not configured.

## Configuration

OAuth providers are configured through environment variables. If the required environment variables are not present, the OAuth strategies will be disabled.

### Google OAuth

Required environment variables:
- `GOOGLE_CLIENT_ID` - Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth client secret

Optional:
- `GOOGLE_CALLBACK_URL` - Callback URL (default: `/auth/google/callback`)

### Microsoft OAuth

Required environment variables:
- `MICROSOFT_CLIENT_ID` - Your Microsoft OAuth client ID
- `MICROSOFT_CLIENT_SECRET` - Your Microsoft OAuth client secret

Optional:
- `MICROSOFT_CALLBACK_URL` - Callback URL (default: `/auth/microsoft/callback`)
- `MICROSOFT_TENANT` - Microsoft tenant ID (default: `common`)

## Checking OAuth Status

You can check which OAuth providers are enabled by calling:

```
GET /auth/providers
```

Response:
```json
{
  "providers": {
    "google": {
      "enabled": false,
      "loginUrl": null
    },
    "microsoft": {
      "enabled": false,
      "loginUrl": null
    }
  }
}
```

## Behavior When OAuth is Not Configured

1. The auth service will start normally without OAuth configuration
2. OAuth login endpoints (`/auth/google`, `/auth/microsoft`) will return a 503 Service Unavailable error
3. The strategies will log warnings to indicate they are not configured
4. All other authentication methods (username/password, API keys) will work normally

## Example .env Configuration

```env
# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# Microsoft OAuth (optional)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_CALLBACK_URL=http://localhost:3001/auth/microsoft/callback
MICROSOFT_TENANT=common
```

## Implementation Details

The OAuth strategies use a dummy configuration when environment variables are not provided, allowing the service to start without errors. The strategies check their configuration status and reject authentication attempts if not properly configured.