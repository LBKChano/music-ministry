import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScheduleView,
  buildScheduleSections,
  buildScheduleServiceSummary,
  canManageScheduleSong,
  countActiveScheduleViewFilters,
  getVisibleScheduleSongs,
  shouldStackScheduleTeamRows,
} from '../lib/schedules/schedule-view.ts';
import { resolveScheduleListState } from '../lib/schedules/schedule-state.ts';
import {
  createResponsiveCopyLayout,
  RESPONSIVE_COPY_CONTRACTS,
} from '../lib/ui/responsive-copy.ts';
import {
  SCHEDULE_MINIMUM_TARGET_SIZE,
  shouldAnimateScheduleDisclosure,
} from '../lib/ui/schedule-interaction.ts';

const services = [
  {
    id: 'service-1',
    date: '2026-01-05',
    service_type: 'Sunday',
    assignments: [{ member_id: 'member-a', role: 'Piano' }],
  },
  {
    id: 'service-2',
    date: '2026-01-20',
    service_type: 'Midweek',
    assignments: [{ member_id: 'member-b', role: 'Vocals' }],
  },
  {
    id: 'service-3',
    date: '2026-02-20',
    service_type: 'Sunday',
    assignments: [{ member_id: null, role: 'Piano' }],
  },
  {
    id: 'service-4',
    date: '2026-04-01',
    service_type: 'Sunday',
    assignments: [
      { member_id: 'member-a', role: 'Vocals' },
      { member_id: 'member-a', role: 'Guitar' },
    ],
  },
];

const requests = [
  {
    service_id: 'service-2',
    status: 'pending',
    requesting_member_id: 'member-b',
    role_name: ' Vocals ',
  },
  {
    service_id: 'service-3',
    status: 'pending',
    requesting_member_id: 'member-a',
    role_name: 'Piano',
  },
  {
    service_id: 'service-4',
    status: 'accepted',
    requesting_member_id: 'member-a',
    role_name: 'Vocals',
  },
];

test('All Services preserves source order while separating relevant attention', () => {
  const result = buildScheduleView({
    services,
    fillInRequests: requests,
    currentMemberId: 'member-a',
    currentMemberRoleNames: new Set(['vocals']),
    isAdmin: false,
    mode: 'all',
  });

  assert.deepEqual(result.attentionServices.map(service => service.id), [
    'service-2',
    'service-3',
  ]);
  assert.deepEqual(result.regularServices.map(service => service.id), [
    'service-1',
    'service-4',
  ]);
});

test('My Schedule shows assignments without duplicating Needs Attention', () => {
  const result = buildScheduleView({
    services,
    fillInRequests: requests,
    currentMemberId: 'member-a',
    currentMemberRoleNames: new Set(['VOCALS']),
    isAdmin: false,
    mode: 'mine',
  });

  assert.equal(result.personalServiceCount, 2);
  assert.deepEqual(result.attentionServices.map(service => service.id), [
    'service-2',
    'service-3',
  ]);
  assert.deepEqual(result.regularServices.map(service => service.id), [
    'service-1',
    'service-4',
  ]);
});

test('irrelevant, completed, and unknown fill-ins do not appear as attention', () => {
  const result = buildScheduleView({
    services,
    fillInRequests: [
      ...requests,
      {
        service_id: 'missing-service',
        status: 'pending',
        requesting_member_id: 'member-z',
        role_name: 'Vocals',
      },
    ],
    currentMemberId: 'member-c',
    currentMemberRoleNames: new Set(['Sound']),
    isAdmin: false,
    mode: 'mine',
  });

  assert.deepEqual(result.attentionServices, []);
  assert.deepEqual(result.regularServices, []);
  assert.equal(result.personalServiceCount, 0);
});

test('admins retain visibility of every pending request without duplicate services', () => {
  const result = buildScheduleView({
    services,
    fillInRequests: [requests[0], requests[0], requests[1], requests[2]],
    currentMemberId: 'admin-member',
    currentMemberRoleNames: new Set(),
    isAdmin: true,
    mode: 'all',
  });

  assert.deepEqual(result.attentionServices.map(service => service.id), [
    'service-2',
    'service-3',
  ]);
  assert.equal(
    result.attentionServices.length + result.regularServices.length,
    services.length,
  );
});

test('service type, role, and date filters compose against loaded services only', () => {
  const filters = {
    serviceType: ' sunday ',
    roleName: 'PIANO',
    dateRangeDays: 90,
  };
  const result = buildScheduleView({
    services,
    fillInRequests: requests,
    currentMemberId: 'member-a',
    currentMemberRoleNames: new Set(['Vocals']),
    isAdmin: false,
    mode: 'all',
    filters,
    now: new Date(2026, 0, 1),
  });

  assert.equal(countActiveScheduleViewFilters(filters), 3);
  assert.deepEqual(result.attentionServices.map(service => service.id), ['service-3']);
  assert.deepEqual(result.regularServices.map(service => service.id), ['service-1']);
});

test('schedule sections use local calendar months and deterministic service order', () => {
  const sections = buildScheduleSections({
    attentionServices: [
      { id: 'attention-late', date: '2026-02-05', time: '10:00', assignments: [] },
      { id: 'attention-early', date: '2026-02-05', time: '09:00', assignments: [] },
    ],
    regularServices: [
      { id: 'feb-b', date: '2026-02-01', time: '10:00', assignments: [] },
      { id: 'jan-b', date: '2026-01-31', time: '09:00', assignments: [] },
      { id: 'feb-a', date: '2026-02-01', time: '08:00', assignments: [] },
      { id: 'jan-a', date: '2026-01-05', time: null, assignments: [] },
    ],
    locale: 'en-US',
  });

  assert.deepEqual(sections.map(section => section.key), [
    'attention',
    'month-2026-01',
    'month-2026-02',
  ]);
  assert.deepEqual(sections[0].data.map(service => service.id), [
    'attention-early',
    'attention-late',
  ]);
  assert.deepEqual(sections[1].data.map(service => service.id), ['jan-a', 'jan-b']);
  assert.deepEqual(sections[2].data.map(service => service.id), ['feb-a', 'feb-b']);
  assert.equal(sections[1].title, 'January 2026');
});

test('service summaries keep personal roles ordered and combine counts once', () => {
  const summary = buildScheduleServiceSummary({
    assignments: [
      { member_id: 'member-a', role: 'Vocals' },
      { member_id: 'member-b', role: 'Piano' },
      { member_id: 'member-a', role: 'Guitar' },
      { member_id: null, role: 'Sound' },
    ],
    orderedRoleNames: ['Piano', 'Guitar', 'Vocals', 'Sound'],
    currentMemberId: 'member-a',
    songCount: 4,
    pendingFillInCount: 1,
  });

  assert.deepEqual(summary.personalRoleNames, ['Guitar', 'Vocals']);
  assert.equal(summary.assignedCount, 3);
  assert.equal(summary.totalAssignmentCount, 4);
  assert.equal(summary.songCount, 4);
  assert.equal(summary.pendingFillInCount, 1);
});

test('team rows respond to compact width or Larger Text without platform branching', () => {
  assert.equal(shouldStackScheduleTeamRows({ width: 390, fontScale: 1 }), true);
  assert.equal(shouldStackScheduleTeamRows({ width: 700, fontScale: 1.3 }), true);
  assert.equal(shouldStackScheduleTeamRows({ width: 700, fontScale: 1 }), false);
});

test('song previews stay bounded while reorder and Show All expose every song', () => {
  const songs = ['one', 'two', 'three', 'four', 'five', 'six'];

  assert.deepEqual(getVisibleScheduleSongs({
    songs,
    showAll: false,
    reordering: false,
  }), songs.slice(0, 4));
  assert.equal(getVisibleScheduleSongs({
    songs,
    showAll: true,
    reordering: false,
  }), songs);
  assert.equal(getVisibleScheduleSongs({
    songs,
    showAll: false,
    reordering: true,
  }), songs);
});

test('song management stays limited to admins and the matching author', () => {
  assert.equal(canManageScheduleSong({
    isAdmin: false,
    currentMemberId: 'member-a',
    authorMemberId: 'member-a',
  }), true);
  assert.equal(canManageScheduleSong({
    isAdmin: true,
    currentMemberId: 'admin-member',
    authorMemberId: 'member-a',
  }), true);
  assert.equal(canManageScheduleSong({
    isAdmin: false,
    currentMemberId: 'member-b',
    authorMemberId: 'member-a',
  }), false);
});

test('Schedule empty and recovery states remain distinct and permission-aware', () => {
  const base = {
    activeFilterCount: 0,
    hasCachedServices: false,
    isAdmin: false,
    isOffline: false,
    setupIncomplete: false,
    serviceRangeError: false,
    viewMode: 'all',
    visibleServiceCount: 0,
  };

  assert.equal(resolveScheduleListState({
    ...base,
    visibleServiceCount: 2,
  }), 'content');
  assert.equal(resolveScheduleListState({
    ...base,
    activeFilterCount: 1,
    hasCachedServices: true,
  }), 'filtered-empty');
  assert.equal(resolveScheduleListState({
    ...base,
    hasCachedServices: true,
    viewMode: 'mine',
  }), 'personal-empty');
  assert.equal(resolveScheduleListState({
    ...base,
    isOffline: true,
    serviceRangeError: true,
  }), 'offline-empty');
  assert.equal(resolveScheduleListState({
    ...base,
    serviceRangeError: true,
  }), 'range-error');
  assert.equal(resolveScheduleListState({
    ...base,
    isAdmin: true,
    setupIncomplete: true,
  }), 'setup-incomplete');
  assert.equal(resolveScheduleListState({
    ...base,
    setupIncomplete: true,
  }), 'no-services');
});

test('responsive Schedule copy is deterministic across supported widths and font scales', () => {
  const widths = [320, 360, 375, 390, 430, 768, 1024];
  const fontScales = [1, 1.15, 1.35, 1.55];
  const fixtures = [
    ['serviceType', 'Sunday Worship Celebration'],
    ['memberName', "María-José O'Connor 🙏"],
    ['memberName', 'عبد الرحمن الموسيقي'],
    ['roleName', 'Lead Acoustic Guitar and Vocals'],
    ['songTitle', "Église de l'Espérance"],
    ['notificationTitle', 'A fill-in request still needs your attention'],
    ['monthLabel', 'September 2026'],
    ['actionLabel', 'Aceptar solicitud de reemplazo'],
    ['compactLabel', 'Show All Scheduled Songs'],
  ];

  for (const width of widths) {
    for (const fontScale of fontScales) {
      for (const [variant, sourceText] of fixtures) {
        const contract = RESPONSIVE_COPY_CONTRACTS[variant];
        const layout = createResponsiveCopyLayout({
          text: sourceText,
          variant,
          availableWidth: Math.max(96, width - 180),
          fontScale,
        });

        assert.equal(layout.sourceText, sourceText);
        assert.ok(layout.lines.length <= contract.maxLines);
        assert.ok(layout.fontSize >= contract.minimumSize);
        assert.ok(layout.fontSize <= contract.preferredSize);
        assert.deepEqual(
          createResponsiveCopyLayout({
            text: sourceText,
            variant,
            availableWidth: Math.max(96, width - 180),
            fontScale,
          }),
          layout,
        );
      }
    }
  }
});

test('responsive copy preserves complete words and exact source text before visual ellipsis', () => {
  const sourceText = "  St. John's   Worship-Center Église 🙏  ";
  const layout = createResponsiveCopyLayout({
    text: sourceText,
    variant: 'memberName',
    availableWidth: 116,
    fontScale: 1.35,
  });

  assert.equal(layout.sourceText, sourceText);
  assert.equal(layout.displayText, "St. John's Worship-Center Église 🙏");
  for (const token of layout.displayText.split(' ')) {
    assert.ok(layout.lines.some(line => line.includes(token)));
  }
  assert.equal(layout.truncated, true);

  const overlongToken = 'ExtraordinarilyLongUnbrokenMemberNameForAccessibility';
  const overflow = createResponsiveCopyLayout({
    text: overlongToken,
    variant: 'memberName',
    availableWidth: 90,
    fontScale: 1.55,
  });
  assert.deepEqual(overflow.lines, [overlongToken]);
  assert.equal(overflow.sourceText, overlongToken);
  assert.equal(overflow.fontSize, RESPONSIVE_COPY_CONTRACTS.memberName.minimumSize);
  assert.equal(overflow.truncated, true);
});

test('duplicate display names receive identical layouts without identity mutation', () => {
  const first = createResponsiveCopyLayout({
    text: 'Alex Rivera',
    variant: 'memberName',
    availableWidth: 140,
    fontScale: 1.2,
  });
  const second = createResponsiveCopyLayout({
    text: 'Alex Rivera',
    variant: 'memberName',
    availableWidth: 140,
    fontScale: 1.2,
  });

  assert.deepEqual(first, second);
  assert.equal(first.sourceText, 'Alex Rivera');
});

test('Schedule disclosure motion follows the operating-system preference', () => {
  assert.equal(shouldAnimateScheduleDisclosure(false), true);
  assert.equal(shouldAnimateScheduleDisclosure(true), false);
  assert.equal(SCHEDULE_MINIMUM_TARGET_SIZE, 44);
});

test('meaningful Schedule foreground colors meet normal-text contrast', () => {
  const contrastRatio = (foreground, background) => {
    const luminance = hex => {
      const channels = hex.slice(1).match(/.{2}/g).map(value => {
        const channel = Number.parseInt(value, 16) / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return (0.2126 * channels[0])
        + (0.7152 * channels[1])
        + (0.0722 * channels[2]);
    };
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };

  assert.ok(contrastRatio('#1A202C', '#FFFFFF') >= 4.5);
  assert.ok(contrastRatio('#64748B', '#FFFFFF') >= 4.5);
  assert.ok(contrastRatio('#2563EB', '#FFFFFF') >= 4.5);
  assert.ok(contrastRatio('#FFFFFF', '#1E3A8A') >= 4.5);
});
