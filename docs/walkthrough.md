# One decision, end to end

A live question answered on the sample data in the Cost & sales tool, the way it would be answered on a bar's own data. The sample is synthetic (see `docs/sample-data.md`), so the numbers illustrate the method, not any real restaurant. Time to answer: about three minutes, no documentation needed.

## The question

The distributor has just put Casamigos Blanco up 15%. Guests call it on a $4.00 up-charge. **Should the call up-charge move?**

## Home → What to do

Home opens on what needs attention in the latest month. The second card reads *Call up-charges covering their cost · All covered*: every call brand keeps at least 25% of what the guest pays. Hovering a margin shows the formula (up-charge − incremental cost), the values (Casamigos pour $2.04, the well tequila it replaces $1.45, so $0.59 incremental against $4.00) and the source file. Click **What to do →**, pick *A bottle cost changed*, choose Casamigos Blanco, type 15, and click **Find the best moves**.

## The situation

The tiles read: Casamigos $2.04 → $2.34 a pour; 852 pours used in September; pour cost 20.8% → 20.9%; **−$260** of gross profit in September if nothing changes. The reading says the same in a sentence and notes it touches the well & call orders that call Casamigos and the margaritas guests ask for with it.

## The moves

One move clears the bar: **Raise the Casamigos Blanco up-charge to $4.50**, +$119 against the new cost. Its reasons: margin per call $3.41 → $3.61 after the cost rise, 10% fewer calls assumed, and no menu drink lists Casamigos in its spec, so the ladder does not move. The 10% rests on the demand assumption shown on step 1 (elasticity −0.8: a 10% price rise loses 8% of volume); set it to 0 to see the no-volume-loss case, or −1.5 for a pessimistic one. Calls and margin figures are marked amber because they depend on it; margin per call is not, because it is arithmetic on the data.

Step 3 verifies the plan with a full engine run: +$119 against the new cost, −$141 against today, pour cost back under 20.9%.

## Checking it in Price change

Click **Open prices in Price change**. The flow opens on step 2 with Casamigos selected and the new up-charge filled in. The row shows margin per call $3.41 → $3.91, calls 852 → 767, margin on the up-charge $2,905 → $2,998 in September. Step 3 checks the ladder: *This change does not touch the ladder*, because no menu drink is specced with Casamigos. Step 4 saves the option; try $5.00 as a second option (+$101 on a 20% call loss) and compare them side by side, then *Open the summary* for a one-page write-up with the assumption stated.

## The answer

Raise the call to $4.50 and leave it there. $5.00 earns about the same only if a 20% drop in Casamigos calls is believable; at −0.8 elasticity the $4.50 option keeps more guests on the brand for almost the same money. The cost rise itself is not recovered by the up-charge alone, which is the point: the other $141 sits in the margaritas and well & call orders that use the house tequila, and the Monthly review shows where (step 2: +0.64 points of pour cost from bottle costs in September, blanco tequila $1.26 → $1.41 first among them).

## What would make this real

1. Actual call elasticity from a past up-charge change, replacing the −0.8 assumption.
2. The waste log and bottle counts for tequila (Explore → Operations → Theoretical vs actual): an over-poured 2 fl oz is a cost problem no up-charge fixes.
3. The reconciliation test passing for the month (Home shows the latest verdict), so the base numbers are trusted.

## A second example · from what guests already order

Home's last card: *Best new-drink candidate · 27/restaurant-week*. Click **New drink ideas →**. The top candidate is the well & call order guests make most that no menu drink matches: blanco tequila and soda, ordered 1,075 times in the quarter (27 per restaurant-week), 23.7% pour cost at the $11.80 guests already pay (over the 22% target; $12.75 would hit it), both bottles already at volume, and only 33% alike to anything listed. The "why" lists each of those reasons; hovering any figure shows its formula.

**Evaluate as a new drink →** opens Menu change at step 3 with the spec, the price and the observed volume filled in. Step 4 shows the ripple with the assumptions flagged (27 units per restaurant-week, 70% pulled from the other cocktails): what a listed tequila-soda at a proper price and a lime wheel would add, which bottles it needs (none new), and which drinks it would take orders from. Save it, compare it with a limited-time version, export.
