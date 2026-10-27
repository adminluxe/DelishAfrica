import { equal, throws } from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeFranceCourierWeeklyGuarantee,
  computeFranceCourierWeeklyGuarantees,
  minimumGuaranteedIncomeCents,
} from './france-weekly-guarantee';

test('19 €/activity-hour weekly floor excludes tips from covered income', () => {
  const result = computeFranceCourierWeeklyGuarantee([
    {
      courierId: 'courier-1',
      missionId: 'mission-1',
      weekKey: '2026-W44',
      estimatedActivitySeconds: 3600,
      activityIncomeCents: 1800,
      tipsCents: 500,
    },
  ]);

  equal(result.minimumGuaranteedIncomeCents, 1900);
  equal(result.coveredIncomeCents, 1800);
  equal(result.tipsExcludedCents, 500);
  equal(result.differentialDueCents, 100);
  equal(result.guaranteeSatisfied, false);
  equal(result.differentialPaymentDelayDays, 7);
});

test('weekly aggregation uses cumulative estimated activity duration', () => {
  const result = computeFranceCourierWeeklyGuarantee([
    {
      courierId: 'courier-1',
      missionId: 'mission-1',
      weekKey: '2026-W44',
      estimatedActivitySeconds: 1800,
      activityIncomeCents: 950,
    },
    {
      courierId: 'courier-1',
      missionId: 'mission-2',
      weekKey: '2026-W44',
      estimatedActivitySeconds: 1800,
      activityIncomeCents: 950,
    },
  ]);

  equal(result.coveredActivitySeconds, 3600);
  equal(result.minimumGuaranteedIncomeCents, 1900);
  equal(result.differentialDueCents, 0);
  equal(result.guaranteeSatisfied, true);
});

test('minimum guarantee rounds upward to the next cent', () => {
  equal(minimumGuaranteedIncomeCents(1), 1);
  equal(minimumGuaranteedIncomeCents(1800), 950);
  equal(minimumGuaranteedIncomeCents(3600), 1900);
});

test('records are grouped by courier and week', () => {
  const results = computeFranceCourierWeeklyGuarantees([
    {
      courierId: 'courier-b',
      missionId: 'mission-3',
      weekKey: '2026-W44',
      estimatedActivitySeconds: 3600,
      activityIncomeCents: 1700,
    },
    {
      courierId: 'courier-a',
      missionId: 'mission-1',
      weekKey: '2026-W44',
      estimatedActivitySeconds: 1800,
      activityIncomeCents: 900,
    },
    {
      courierId: 'courier-a',
      missionId: 'mission-2',
      weekKey: '2026-W44',
      estimatedActivitySeconds: 1800,
      activityIncomeCents: 1000,
    },
  ]);

  equal(results.length, 2);
  equal(results[0].courierId, 'courier-a');
  equal(results[0].differentialDueCents, 0);
  equal(results[1].courierId, 'courier-b');
  equal(results[1].differentialDueCents, 200);
});

test('mixed courier/week inputs are rejected by single-week calculation', () => {
  throws(
    () =>
      computeFranceCourierWeeklyGuarantee([
        {
          courierId: 'courier-1',
          missionId: 'mission-1',
          weekKey: '2026-W44',
          estimatedActivitySeconds: 100,
          activityIncomeCents: 100,
        },
        {
          courierId: 'courier-2',
          missionId: 'mission-2',
          weekKey: '2026-W44',
          estimatedActivitySeconds: 100,
          activityIncomeCents: 100,
        },
      ]),
    /MIXED_COURIERS/,
  );

  throws(
    () =>
      computeFranceCourierWeeklyGuarantee([
        {
          courierId: 'courier-1',
          missionId: 'mission-1',
          weekKey: '2026-W44',
          estimatedActivitySeconds: 100,
          activityIncomeCents: 100,
        },
        {
          courierId: 'courier-1',
          missionId: 'mission-2',
          weekKey: '2026-W45',
          estimatedActivitySeconds: 100,
          activityIncomeCents: 100,
        },
      ]),
    /MIXED_WEEKS/,
  );
});

test('negative or unsafe numeric values are rejected', () => {
  throws(
    () =>
      computeFranceCourierWeeklyGuarantee([
        {
          courierId: 'courier-1',
          missionId: 'mission-1',
          weekKey: '2026-W44',
          estimatedActivitySeconds: -1,
          activityIncomeCents: 100,
        },
      ]),
    /INVALID_ESTIMATEDACTIVITYSECONDS/,
  );
});
