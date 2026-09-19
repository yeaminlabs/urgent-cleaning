/* Every spec imports `test` and `expect` from here, never from @playwright/test
   directly. The overridden `context` fixture installs the analytics guard
   before any page exists, and fails the test afterwards if a single request
   escaped it or a request was aimed at the production site. */
'use strict';
const base = require('@playwright/test');
const { installAnalyticsGuard, escapedRequests } = require('./analytics-guard');

const logs = new WeakMap();

const test = base.test.extend({
  context: async ({ context }, use, testInfo) => {
    const log = await installAnalyticsGuard(context);
    logs.set(context, log);
    await use(context);

    const escaped = await escapedRequests(log);
    await testInfo.attach('analytics-guard.json', {
      contentType: 'application/json',
      body: JSON.stringify({ intercepted: log.intercepted, escaped, productionRefused: log.productionRefused }, null, 2),
    });
    if (escaped.length) {
      throw new Error(`ANALYTICS LEAK: ${escaped.length} external request(s) were not intercepted (possible real traffic to Google or another third party):\n  ${escaped.join('\n  ')}`);
    }
    if (log.productionRefused.length) {
      throw new Error(`Test tried to reach the production site:\n  ${log.productionRefused.join('\n  ')}`);
    }
  },
  /* The guard log for the test's context, for tests that assert on it. */
  analyticsGuard: async ({ context }, use) => { await use(logs.get(context)); },
});

module.exports = { test, expect: base.expect };
