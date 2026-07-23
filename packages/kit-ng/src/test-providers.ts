import { provideZonelessChangeDetection } from '@angular/core';

// Global providers for the TestBed environment. The service is signal-based and
// the tests read signals synchronously, so a zoneless setup is enough — no
// zone.js polyfill required.
export default [provideZonelessChangeDetection()];
