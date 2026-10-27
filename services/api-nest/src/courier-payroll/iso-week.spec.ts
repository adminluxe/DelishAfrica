import { equal, throws } from 'node:assert/strict';
import { test } from 'node:test';
import { assertSingleIsoWeek, isoWeekKey } from './iso-week';

test('Belgium payroll week uses Europe/Brussels local date, not UTC date', () => {
  equal(
    isoWeekKey('2026-01-04T23:30:00.000Z', 'Europe/Brussels'),
    '2026-W02',
  );
  equal(
    isoWeekKey('2026-01-04T23:30:00.000Z', 'UTC'),
    '2026-W01',
  );
});

test('Belgium DST transition keeps local calendar week stable', () => {
  equal(
    isoWeekKey('2026-03-29T00:30:00.000Z', 'Europe/Brussels'),
    '2026-W13',
  );
  equal(
    isoWeekKey('2026-03-29T01:30:00.000Z', 'Europe/Brussels'),
    '2026-W13',
  );
});

test('single-week assertion rejects a mission crossing local ISO week', () => {
  throws(
    () =>
      assertSingleIsoWeek(
        [
          '2026-01-04T22:30:00.000Z',
          '2026-01-04T23:30:00.000Z',
        ],
        'Europe/Brussels',
      ),
    /MISSION_SPANS_WEEK_BOUNDARY_UNSUPPORTED/,
  );
});

test('invalid payroll time zone is rejected', () => {
  throws(
    () => isoWeekKey('2026-10-27T10:00:00.000Z', 'Mars/Olympus'),
    /TIME_ZONE_INVALID/,
  );
});
