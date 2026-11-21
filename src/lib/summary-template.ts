import { formatUgx } from "./money";
import type { DebtBalance, MoneyTotals } from "./types";

export function templateSummary(input: {
  dateLabel: string;
  totals: MoneyTotals;
  outstanding: number;
  topDebtor: DebtBalance | null;
}): { summary: string; tips: string[] } {
  const { totals, outstanding, dateLabel, topDebtor } = input;
  const recordWord = totals.count === 1 ? "record" : "records";
  const debtSentence =
    outstanding > 0
      ? `Customers still owe you ${formatUgx(outstanding)} in total, counting other days too.`
      : "No customer debt is open.";

  const summary = [
    `On ${dateLabel} you recorded ${totals.count} ${recordWord}.`,
    `Sales were ${formatUgx(totals.sales)}. Money spent was ${formatUgx(totals.expenses)}.`,
    `Money in was ${formatUgx(totals.cashIn)} and money out was ${formatUgx(totals.cashOut)}, so cash left is ${formatUgx(totals.net)}.`,
    debtSentence,
  ].join(" ");

  const tips: string[] = [];
  if (totals.count === 0) {
    tips.push("Nothing is recorded for this day. Add sales and costs while you still remember them.");
  }
  if (totals.count > 0 && totals.cashOut > totals.cashIn) {
    tips.push("More money went out than came in. Check stock you bought and bills you paid.");
  }
  if (outstanding > 0) {
    const who = topDebtor ? ` Start with ${topDebtor.counterparty}.` : "";
    tips.push(`Ask customers who still owe you before you give more goods on credit.${who}`);
  }
  if (totals.sales > 0 && totals.expenses === 0) {
    tips.push("No costs are recorded. Add transport, airtime, or stock if you paid for them.");
  }
  if (tips.length < 2) {
    tips.push("Write each sale the same day so tomorrow's picture stays clear.");
  }
  if (tips.length < 3) {
    tips.push("If a customer paid only part, record the cash and the balance as two items.");
  }

  return { summary, tips: tips.slice(0, 3) };
}
