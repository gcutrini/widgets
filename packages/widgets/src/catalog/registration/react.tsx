'use client';

import { createManifestWidget } from '../../mount/create-widget-component';
import { registrationManifest } from './manifest';

/** registration on the host React, from its full manifest. */
export default createManifestWidget(registrationManifest);
