/**
 * Sign-in and the signed-in user's teams.
 * Cognito managed login (auth code + PKCE) in the system browser. The refresh token lives in the
 * keychain/keystore (SecureStore); the short-lived access token only in memory.
 */
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createApiClient } from '@exo/api-client';

WebBrowser.maybeCompleteAuthSession();

// Public values; EXPO_PUBLIC_* in apps/mobile/.env.local overrides them for local work.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://v25ydrgx4xddvk50.sd3.lambda-web.us-east-2.on.aws';
const DOMAIN = process.env.EXPO_PUBLIC_COGNITO_DOMAIN ?? 'https://exo-709664800643.auth.us-east-2.amazoncognito.com';
const CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '4t67itkf2m3sesi801jn4ou92l';
/** Web app origin, for invite links (players accept them in any browser). */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://main.d14a3j7ogm6gq.amplifyapp.com';

const discovery = {
  authorizationEndpoint: `${DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `${DOMAIN}/oauth2/token`,
  revocationEndpoint: `${DOMAIN}/oauth2/revoke`,
};
const redirectUri = AuthSession.makeRedirectUri({ scheme: 'exoultimate', path: 'auth/callback' });
const KEY = { refresh: 'exo_rt', team: 'exo_team' };

let access: { token: string; expires: number } | null = null;
let refreshing: Promise<string | null> | null = null;
let onSignedOut = () => {};

/** A valid access token, refreshed when needed; null once the session is gone. */
async function getToken(): Promise<string | null> {
  if (access && access.expires > Date.now() + 60_000) return access.token;
  // One refresh at a time: parallel requests share it.
  refreshing ??= (async () => {
    const refreshToken = await SecureStore.getItemAsync(KEY.refresh);
    if (!refreshToken) return null;
    try {
      const res = await AuthSession.refreshAsync({ clientId: CLIENT_ID, refreshToken }, discovery);
      access = { token: res.accessToken, expires: Date.now() + (res.expiresIn ?? 3600) * 1000 };
      return access.token;
    } catch {
      await SecureStore.deleteItemAsync(KEY.refresh); // revoked or expired
      access = null;
      onSignedOut();
      return null;
    }
  })().finally(() => (refreshing = null));
  return refreshing;
}

export const api = createApiClient(API_URL, undefined, getToken);

type Team = { id: string; name: string; division: 'mixed' | 'women' | 'open'; role: 'owner' | 'coach' | 'stat_keeper' | 'player' };
type Me = { id: string; email: string; name: string | null };
type Session = {
  status: 'loading' | 'signedOut' | 'signedIn';
  me: Me | null;
  teams: Team[];
  team: Team | null;
  signIn: () => Promise<string | null>;
  signOut: () => Promise<void>;
  setTeam: (id: string) => void;
  reload: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);
export const useSession = () => useContext(Ctx)!;
export const isStaff = (role?: string) => role === 'owner' || role === 'coach';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Session['status']>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId: CLIENT_ID, redirectUri, scopes: ['openid', 'email', 'profile'], usePKCE: true },
    discovery,
  );

  const reload = useCallback(async () => {
    const [m, t, saved] = await Promise.all([api.GET('/v1/me'), api.GET('/v1/teams'), SecureStore.getItemAsync(KEY.team)]);
    if (!m.data || !t.data) return setStatus('signedOut');
    setMe(m.data);
    setTeams(t.data);
    setTeamId((cur) => cur ?? saved);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    onSignedOut = () => setStatus('signedOut');
    getToken().then((tok) => (tok ? reload() : setStatus('signedOut')));
  }, [reload]);

  const signIn = useCallback(async () => {
    // Private browser session: no Cognito cookie outlives sign-out, so sign-out needs no browser trip.
    const res = await promptAsync({ preferEphemeralSession: true });
    if (res.type !== 'success' || !request?.codeVerifier) return res.type === 'cancel' || res.type === 'dismiss' ? null : 'Sign-in failed.';
    try {
      const tokens = await AuthSession.exchangeCodeAsync(
        { clientId: CLIENT_ID, code: res.params.code!, redirectUri, extraParams: { code_verifier: request.codeVerifier } },
        discovery,
      );
      if (!tokens.refreshToken) return 'Sign-in failed.';
      await SecureStore.setItemAsync(KEY.refresh, tokens.refreshToken);
      access = { token: tokens.accessToken, expires: Date.now() + (tokens.expiresIn ?? 3600) * 1000 };
      await reload();
      return null;
    } catch {
      return 'Sign-in failed.';
    }
  }, [promptAsync, reload, request]);

  const signOut = useCallback(async () => {
    const refreshToken = await SecureStore.getItemAsync(KEY.refresh);
    if (refreshToken) await AuthSession.revokeAsync({ clientId: CLIENT_ID, token: refreshToken }, discovery).catch(() => {});
    await Promise.all([SecureStore.deleteItemAsync(KEY.refresh), SecureStore.deleteItemAsync(KEY.team)]);
    access = null;
    setMe(null);
    setTeams([]);
    setTeamId(null);
    setStatus('signedOut');
  }, []);

  const setTeam = useCallback((id: string) => {
    setTeamId(id);
    SecureStore.setItemAsync(KEY.team, id);
  }, []);

  const team = teams.find((t) => t.id === teamId) ?? teams[0] ?? null;
  return (
    <Ctx.Provider value={{ status, me, teams, team, signIn, signOut, setTeam, reload }}>
      {children}
    </Ctx.Provider>
  );
}
