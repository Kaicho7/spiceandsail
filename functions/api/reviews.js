import * as mod from '../../src/lib/api/reviews.js';
import adapter from '../../src/lib/cf/adapter.js';
export const onRequest = adapter.makeOnRequest(mod);
