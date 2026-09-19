/* Browser QA for Urgent Clean Kamloops. Run from the repo root with
   `npm run qa:browser`, or from this directory with `npm test`.
   First run on a new machine: `npm run qa:browser:install`. */
'use strict';
const { defineConfig } = require('@playwright/test');
const { HOST_RESOLVER_RULES } = require('./helpers/analytics-guard');

const PORT = Number(process.env.QA_PORT || 4321);

module.exports = defineConfig({
  testDir: './specs',
  fullyParallel: true,
  workers: process.env.QA_WORKERS ? Number(process.env.QA_WORKERS) : 4,
  timeout: 90_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    // Layer 2 of the analytics guard: Google's analytics hosts (and the
    // production site) cannot even be resolved by this browser.
    launchOptions: { args: [`--host-resolver-rules=${HOST_RESOLVER_RULES}`] },
    // A service worker could otherwise bypass request interception.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node helpers/server.js',
    url: `http://127.0.0.1:${PORT}/`,
    // Never reuse a server already on the port: it could be serving a
    // different copy of the site and the results would silently be wrong.
    reuseExistingServer: false,
    env: { QA_PORT: String(PORT), ...(process.env.QA_SITE_ROOT ? { QA_SITE_ROOT: process.env.QA_SITE_ROOT } : {}) },
    timeout: 30_000,
  },
});
