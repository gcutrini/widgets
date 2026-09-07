'use client';

import { createManifestWidget } from '../../mount/create-widget-component';
import { speakersManifest } from './manifest';

/** speakers on the host React, from its full manifest. */
export default createManifestWidget(speakersManifest);
