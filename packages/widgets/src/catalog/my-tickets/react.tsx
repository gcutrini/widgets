'use client';

import { createReactComponentWidget } from '../../mount/create-widget-component';
import { myTicketsManifest } from './manifest';

/** my-tickets on the host React, from its full manifest. */
export default createReactComponentWidget(myTicketsManifest);
