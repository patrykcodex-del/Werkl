const ERROR_MESSAGES: Record<string, string> = {
    AccessDenied:
        "You're not invited to Werkl yet. Workers join by Invite only — please contact the operator if you believe this is a mistake.",
    OAuthCallback: 'Something went wrong during sign-in. Please try again.',
    OAuthSignin: 'Could not start the sign-in flow. Please try again.',
    OAuthCreateAccount: 'Could not create your account. Please try again.',
    Callback: 'Sign-in callback failed. Please try again.',
    Default: 'An unexpected error occurred. Please try again.',
};

export function resolveAuthErrorMessage(code: string | null | undefined): string | null {
    if (!code) return null;
    return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.Default;
}
