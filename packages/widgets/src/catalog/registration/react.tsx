'use client';

import { createReactComponentWidget } from '../../mount/createWidgetComponent';
import { registrationManifest } from './manifest';

/** registration on the host React, from its full manifest. */
export default createReactComponentWidget(registrationManifest);
