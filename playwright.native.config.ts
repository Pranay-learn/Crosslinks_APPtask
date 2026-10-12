import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'tests/native-web',workers:1,retries:0,reporter:'list',use:{...devices['Pixel 7'],baseURL:'http://127.0.0.1:8090/Crosslinks_APPtask/native/',trace:'retain-on-failure'},webServer:{command:'node scripts/serve-built.mjs',url:'http://127.0.0.1:8090/Crosslinks_APPtask/native/',reuseExistingServer:false}});
