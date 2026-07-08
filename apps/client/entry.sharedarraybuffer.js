/**
 * entry.sharedarraybuffer.js
 * MUST run before expo-router/entry
 */
import 'react-native-gesture-handler'; // TONTON_SCROLL_HOTFIX: gesture-handler must be first import
require("./polyfills");
require("expo-router/entry");
