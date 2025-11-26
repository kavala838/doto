import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

type ServiceName = 'openai' | 'gist';

interface SecureApiOptions {
  service: ServiceName;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

export async function callSecureApi<T = any>(options: SecureApiOptions): Promise<T> {
  const functions = getFunctions(app, 'us-central1');
  const secureApiFn = httpsCallable(functions, 'secureApi');
  const res = await secureApiFn(options);
  const { data } = res as any;
  return data?.data as T;
}


