import * as functions from 'firebase-functions';
import fetch from 'node-fetch';
export const secureApi = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }
    const { service, path, method, headers, body } = data || {};
    if (!service || (service !== 'openai' && service !== 'gist')) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid or missing "service"');
    }
    const config = functions.config();
    let baseUrl = '';
    let token = '';
    let finalPath = path ?? '';
    if (service === 'openai') {
        baseUrl = 'https://api.openai.com';
        token = config?.external?.openai_api_key;
    }
    else {
        baseUrl = 'https://api.github.com';
        token = config?.external?.gist_key;
        if (!finalPath) {
            const defaultGistId = config?.external?.gist_id;
            if (!defaultGistId) {
                throw new functions.https.HttpsError('failed-precondition', 'Missing external.gist_id config.');
            }
            finalPath = `/gists/${defaultGistId}`;
        }
    }
    if (!token) {
        throw new functions.https.HttpsError('failed-precondition', `Missing token for ${service}.`);
    }
    const url = baseUrl + (finalPath || '');
    const requestHeaders = {
        ...(service === 'gist'
            ? { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
            : { Authorization: `Bearer ${token}`, Accept: 'application/json' }),
        ...(headers || {})
    };
    const requestInit = {
        method: (method || (body !== undefined ? 'POST' : 'GET')).toUpperCase(),
        headers: requestHeaders
    };
    if (body !== undefined) {
        const hasContentType = 'Content-Type' in requestHeaders || 'content-type' in requestHeaders;
        if (!hasContentType && typeof body !== 'string') {
            requestHeaders['Content-Type'] = 'application/json';
        }
        requestInit.body =
            typeof body === 'string' ? body : JSON.stringify(body);
    }
    try {
        const response = await fetch(url, requestInit);
        const status = response.status;
        const text = await response.text();
        let parsed;
        try {
            parsed = text ? JSON.parse(text) : null;
        }
        catch {
            parsed = { raw: text };
        }
        // Always return status and data; do not throw on non-2xx so client can handle gracefully
        return { status, data: parsed };
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', err?.message || 'Request failed');
    }
});
