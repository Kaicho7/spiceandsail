import * as mod from '../../src/lib/api/catalogue.js';
import adapter from '../../src/lib/cf/adapter.js';
export const onRequest = adapter.makeOnRequest(mod);
