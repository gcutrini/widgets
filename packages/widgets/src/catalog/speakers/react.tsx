'use client';

import { createReactComponentWidget } from '../../mount/create-widget-component';
import { speakersManifest } from './manifest';

/** speakers on the host React, from its full manifest. */
export default createReactComponentWidget(speakersManifest);
