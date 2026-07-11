// LINE configuration
//
// Set this value to enable LINE sign-in.
// Android/iOS native setup is also required; see README or provider docs.

const LINE_CHANNEL_ID_DEBUG = '2009889872';
const LINE_CHANNEL_ID_RELEASE = '2009652652';

export const LINE_CHANNEL_ID = __DEV__ ? LINE_CHANNEL_ID_DEBUG : LINE_CHANNEL_ID_RELEASE;
