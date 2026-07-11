// Use Web OAuth client ID as primary for requestIdToken.
// Android OAuth clients are included only as fallback candidates.
const GOOGLE_WEB_CLIENT_ID_PRIMARY = '958400614224-8c46vra49fdtcgobusorbfq08hmlk9nc.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID_DEBUG = '958400614224-l01ifp7jcsmme8vsmub3tsl8h2qkia2k.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID_RELEASE = '958400614224-42pu0m808cb55asd095dvms9g5n9lm9b.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID_PLAY_SIGNED = '958400614224-sc5uae7b8le60lbti0m4vbjs0d9qu2q8.apps.googleusercontent.com';

export const GOOGLE_SIGNIN_CLIENT_IDS = Array.from(new Set([
	GOOGLE_WEB_CLIENT_ID_PRIMARY,
	__DEV__ ? GOOGLE_ANDROID_CLIENT_ID_DEBUG : GOOGLE_ANDROID_CLIENT_ID_RELEASE,
	GOOGLE_ANDROID_CLIENT_ID_PLAY_SIGNED,
].filter(Boolean)));

export const GOOGLE_WEB_CLIENT_ID = GOOGLE_WEB_CLIENT_ID_PRIMARY;
