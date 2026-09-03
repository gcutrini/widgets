'use client';

/**
 * uicore's clock context, re-exported as this package's clock surface. uicore
 * reads the time-service URL from the config the host hands it via
 * configureUicore (see uicore-host).
 */
export {
  ClockProvider,
  useClock,
  useClockSelector,
} from 'openstack-uicore-foundation/lib/components/clock-context';
