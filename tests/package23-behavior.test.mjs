import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSelectedChurchHeaderTitle } from '../lib/church/header-identity.ts';
import {
  contrastRatio,
  createNavigationThemeColors,
  futureDarkAppTheme,
  lightAppTheme,
} from '../lib/ui/app-theme.ts';
import { calculateHeaderTitleLaneWidth } from '../lib/ui/header-typography.ts';
import { getModalLayout } from '../lib/ui/modal-presentation.ts';

const themes = [lightAppTheme, futureDarkAppTheme];

test('light and future-dark themes expose the same complete semantic contract', () => {
  assert.deepEqual(
    Object.keys(lightAppTheme).sort(),
    Object.keys(futureDarkAppTheme).sort(),
  );
  assert.deepEqual(
    Object.keys(lightAppTheme.colors).sort(),
    Object.keys(futureDarkAppTheme.colors).sort(),
  );
  assert.deepEqual(
    Object.keys(lightAppTheme.status).sort(),
    ['error', 'info', 'success', 'warning'],
  );

  for (const theme of themes) {
    assert.equal(theme.header.gradient.length, 3);
    assert.ok(theme.spacing.md > theme.spacing.sm);
    assert.ok(theme.radii.header > theme.radii.control);
    assert.ok(theme.iconTile.size >= 44);
    assert.ok(theme.interaction.pressedOpacity < 1);
  }
});

test('semantic text and status combinations meet normal-text contrast', () => {
  for (const theme of themes) {
    const pairs = [
      [theme.colors.textPrimary, theme.colors.surface],
      [theme.colors.textSecondary, theme.colors.surface],
      [theme.colors.textTertiary, theme.colors.surface],
      [theme.strongSurface.foreground, theme.colors.surfaceStrong],
      [theme.strongSurface.mutedForeground, theme.colors.surfaceStrong],
      [theme.serviceMetadata.foreground, theme.serviceMetadata.surface],
      [theme.serviceMetadata.mutedForeground, theme.serviceMetadata.surface],
      [theme.modalHeader.foreground, theme.modalHeader.surface],
      [theme.modalHeader.mutedForeground, theme.modalHeader.surface],
      [theme.inputHighlight.foreground, theme.inputHighlight.surface],
      [theme.brandMark.foreground, theme.brandMark.surface],
      [theme.colors.navigationSelectedForeground, theme.colors.navigationSelected],
      [theme.colors.navigationInactive, theme.colors.navigationOpaqueSurface],
      ...Object.values(theme.status).map(status => (
        [status.foreground, status.surface]
      )),
    ];

    for (const [foreground, background] of pairs) {
      assert.ok(
        contrastRatio(foreground, background) >= 4.5,
        `${theme.mode}: ${foreground} on ${background}`,
      );
    }

    for (const gradientStop of theme.header.gradient) {
      assert.ok(contrastRatio(theme.header.title, gradientStop) >= 4.5);
    }
    assert.ok(
      contrastRatio(theme.header.subtitle, theme.header.gradient[2]) >= 4.5,
    );
    assert.ok(
      contrastRatio(theme.header.eyebrow, theme.header.gradient[2]) >= 4.5,
    );
  }
});

test('navigation colors derive from semantic tokens without a second palette', () => {
  const navigation = createNavigationThemeColors(lightAppTheme);

  assert.equal(navigation.background, lightAppTheme.colors.canvas);
  assert.equal(navigation.card, lightAppTheme.colors.surface);
  assert.equal(navigation.primary, lightAppTheme.colors.accent);
  assert.equal(navigation.notification, lightAppTheme.status.error.foreground);
});

test('the Church header renders only the matching ready membership identity', () => {
  const church = { id: 'church-a', name: '  Grace Community Church  ' };
  const membership = {
    church_id: 'church-a',
    member_id: 'account-a',
    is_admin: true,
  };

  assert.equal(resolveSelectedChurchHeaderTitle({
    accountId: 'account-a',
    church,
    membership,
    sessionStatus: 'ready',
  }), 'Grace Community Church');

  for (const input of [
    { accountId: 'account-b', church, membership, sessionStatus: 'ready' },
    { accountId: 'account-a', church, membership, sessionStatus: 'selecting-church' },
    {
      accountId: 'account-a',
      church,
      membership: { ...membership, church_id: 'church-b' },
      sessionStatus: 'ready',
    },
  ]) {
    assert.equal(
      resolveSelectedChurchHeaderTitle(input),
      'Church Management',
    );
  }
});

test('header, modal, and narrow-device geometry remain characterized', () => {
  assert.equal(calculateHeaderTitleLaneWidth({
    windowWidth: 320,
    trailingWidth: 54,
  }), 214);
  assert.equal(calculateHeaderTitleLaneWidth({
    windowWidth: 430,
    trailingWidth: 54,
  }), 324);

  const modal = getModalLayout({
    width: 320,
    restingHeight: 568,
    topInset: 24,
    bottomInset: 16,
    fontScale: 1,
    variant: 'long-content',
  });
  assert.equal(modal.maxWidth, 296);
  assert.ok(modal.maxHeight < 568 - 24 - 16);
});
