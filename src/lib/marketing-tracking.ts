import { getSharedTrackingClient, trackingDeniedByBrowser } from './shared-tracking-client.mjs';

interface TrackingState {
  choice: 'accepted' | 'rejected' | null;
  generation: string | null;
  expiresAt: number | null;
  revision: number;
}

interface AssociationClient {
  state: TrackingState;
  associate(generation: string, options: { timeoutMs: number }): Promise<{
    state: TrackingState;
    deviceId?: string;
  }>;
}

export function marketingTrackingUrl(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('PUBLIC_MAUTIC_URL must be an HTTPS Mautic URL with no path, credentials, query or fragment.');
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PUBLIC_MAUTIC_URL must be an HTTPS Mautic URL with no path, credentials, query or fragment.');
  }
  return url.origin;
}

export async function getConsentedTrackingAssociation(environment: {
  client?: AssociationClient;
  navigator?: Pick<Navigator, 'doNotTrack'> & { globalPrivacyControl?: boolean };
} = {}): Promise<{ deviceId: string; generation: string } | undefined> {
  if (trackingDeniedByBrowser({ navigator: environment.navigator ?? globalThis.navigator })) return undefined;
  const client = environment.client ?? getSharedTrackingClient() as AssociationClient;
  const before = client.state;
  if (before.choice !== 'accepted' || !before.generation) return undefined;
  try {
    // Attribution is optional. A bridge that is blocked, not yet ready, or too
    // slow must never delay or prevent the ordinary unlinked request.
    const association = await client.associate(before.generation, { timeoutMs: 750 });
    const current = client.state;
    if (association.state.choice !== 'accepted' ||
        association.state.generation !== before.generation ||
        current.choice !== 'accepted' || current.generation !== before.generation ||
        !/^[a-z0-9]{23}$/.test(association.deviceId ?? '')) return undefined;
    return { deviceId: association.deviceId as string, generation: before.generation };
  } catch {
    return undefined;
  }
}
