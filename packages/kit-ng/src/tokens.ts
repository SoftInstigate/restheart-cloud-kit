import { InjectionToken } from '@angular/core';
import type { AuthConfig } from '@restheart-cloud/kit';

export const RH_AUTH_CONFIG = new InjectionToken<AuthConfig>('RH_AUTH_CONFIG');
