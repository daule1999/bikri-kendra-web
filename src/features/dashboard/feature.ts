import { ROUTES } from '@/core/config';
import { PERMISSIONS } from '@/core/auth';
import { defineFeature } from '@/core/features';

export const dashboardFeature = defineFeature({
  key: 'dashboard',
  label: 'Dashboard',
  description: 'Overview and quick access to every module',
  href: ROUTES.dashboard,
  icon: 'home',
  tone: 'indigo',
  permission: PERMISSIONS.dashboardView,
  status: 'available',
  order: 0,
  showOnDashboard: false,
});
