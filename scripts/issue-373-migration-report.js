#!/usr/bin/env node

// Migration report generator for Issue #373
const fs = require('fs');
const path = require('path');

// List of files that need to be updated for semantic token adoption
const filesToUpdate = [
  'components/page-header.tsx',
  'components/notification-bell.tsx',
  'components/cloak-banner.tsx',
  'components/lang-switcher.tsx',
  'components/list-filter-bar.tsx',
  'components/reservation-card.tsx',
  'components/trip-card.tsx',
  'components/fuel-card.tsx',
  'components/grouped-list.tsx',
  'components/location-picker.tsx',
  'components/pick-calendar.tsx',
  'components/modal-sheet.tsx',
  'components/offline-badge.tsx',
  'components/pending-badge.tsx',
  'components/shimmer.tsx',
  'components/time-picker.tsx',
  'components/year-select.tsx',
  'components/car-badge.tsx',
  'components/error-boundary.tsx',
  'components/car-toggle.tsx',
  'components/bottom-tab-bar.tsx',
  'components/cost-coverage-screen.tsx',
  'components/receipt-upload.tsx',
  'app/user/[id]/edit/page.tsx',
  'app/trips/page.tsx',
  'app/calendar/page.tsx',
  'app/notifications/page.tsx',
  'app/admin/members/page.tsx',
  'app/admin/vehicles/page.tsx',
  'app/admin/settings/page.tsx',
  'app/fuel/fuel-form.tsx',
  'app/expenses/expense-form.tsx',
  'app/calendar/reservation-form.tsx',
  'app/login/login-form.tsx',
  'app/forgot/forgot-form.tsx',
  'app/layout.tsx',
];

console.log('=== Issue #373 Migration Report ===\n');

console.log('Files identified for semantic token adoption:');
filesToUpdate.forEach(file => {
  console.log(`  • ${file}`);
});

console.log('\nRecommended approach:');
console.log('1. Update components to use paper.semanticPaper structure');
console.log('2. Replace hardcoded colors with theme tokens');
console.log('3. Run ESLint with custom rule to prevent future hardcoded colors');
console.log('4. Test all components with demo database');

console.log('\nTokens to be mapped:');
console.log('  paper.paper → paper.background.primary');
console.log('  paper.paperDeep → paper.background.secondary'); 
console.log('  paper.paperDark → paper.background.tertiary');
console.log('  paper.ink → paper.text.primary');
console.log('  paper.inkDim → paper.text.secondary');
console.log('  paper.inkMute → paper.text.tertiary');
console.log('  paper.accent → paper.accent.primary');
console.log('  paper.green → paper.accent.success');
console.log('  paper.blue → paper.accent.info');
console.log('  paper.amber → paper.accent.warning');

console.log('\nHardcoded colors to replace:');
console.log('  "#fff" → paper.text.primary');
console.log('  "#c0392b" → paper.accent.primary');
console.log('  "#8a6d3b" → paper.text.secondary');
console.log('  "#fcf3e3" → paper.background.secondary');
console.log('  "#e8d9b5" → paper.background.tertiary');
console.log('  "#b45309" → paper.accent.warning');
console.log('  "#fffbeb" → paper.background.secondary');
console.log('  "#fde68a" → paper.accent.warning');
console.log('  "#2d7a2d" → paper.accent.success');