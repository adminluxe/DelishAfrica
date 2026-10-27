# Belgium Sensitivity Findings — LAB

All numbers in this file are laboratory assumptions, not approved production economics.

## Economic sweep

Variables swept:
- employer courier cost: 26–34 EUR / paid hour;
- contribution available before Courier: 9–14 EUR / delivery;
- target residual contribution: 2 EUR / delivery.

At 30 EUR employer cost per paid hour:

| Contribution before Courier | Break-even deliveries/h | Deliveries/h for 2 EUR residual/order |
| ---: | ---: | ---: |
| 9 EUR | 3.33 | 4.29 |
| 10 EUR | 3.00 | 3.75 |
| 11 EUR | 2.73 | 3.33 |
| 12 EUR | 2.50 | 3.00 |
| 13 EUR | 2.31 | 2.73 |
| 14 EUR | 2.14 | 2.50 |

The implication is structural: contribution per order and delivery density are coupled. There is no single universal viable density.

## Waiting-time sensitivity

Illustrative operational assumption:
- 17 min base travel/handling per delivery;
- employer cost 30 EUR/h;
- contribution before Courier 12 EUR/delivery.

Without batching:

| Merchant wait/order | Deliveries/h | Residual/h |
| ---: | ---: | ---: |
| 0 min | 3.53 | +12.35 EUR |
| 3 min | 3.00 | +6.00 EUR |
| 6 min | 2.61 | +1.30 EUR |
| 9 min | 2.31 | -2.31 EUR |
| 12 min | 2.07 | -5.17 EUR |

With a LAB batch-efficiency multiplier of 1.20:

| Merchant wait/order | Deliveries/h | Residual/h |
| ---: | ---: | ---: |
| 0 min | 4.24 | +20.82 EUR |
| 3 min | 3.60 | +13.20 EUR |
| 6 min | 3.13 | +7.57 EUR |
| 9 min | 2.77 | +3.23 EUR |
| 12 min | 2.48 | -0.21 EUR |

## Interpretation

Merchant waiting can erase the economics of a fair-pay fleet even when courier pay itself is correctly designed.

Therefore Merchant readiness is not merely UX. It is part of Payroll viability.

Batching can recover capacity, but it must never be treated as permission to overload or create unsafe route pressure.

## Required pilot measurements

Before accepting these laboratory thresholds:
- actual employer cost;
- actual contribution before Courier;
- real merchant wait distribution;
- actual non-wait cycle time;
- achievable safe batching;
- cancellation/incident effect;
- demand profile by 15/30-minute interval.

The simulator must be recalibrated with observed pilot data.
