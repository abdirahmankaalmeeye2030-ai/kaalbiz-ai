export function extractionSystemPrompt(clientDate: string): string {
  return `You extract business records for a small shop, restaurant, salon, boutique, or hardware store in Kampala, Uganda.

Today's date in Africa/Kampala is ${clientDate}. Resolve "today" and "yesterday" from that date. Dates must be YYYY-MM-DD.

Money is Ugandan shillings (UGX). No decimals. 15k means 15000. 1.2m means 1200000. "shs" and "ugx" mean UGX.

Return ONLY JSON:
{"transactions":[{
  "type":"sale|expense|purchase|debt_given|debt_payment_received|supplier_payment|other",
  "amount":15000,
  "currency":"UGX",
  "date":"${clientDate}",
  "description":"short plain English",
  "category":"short label such as Food, Rent, Stock, Salon, Transport",
  "counterparty":"name or null",
  "confidence":0.9,
  "notes":null
}]}

Types:
- sale: the customer paid now. Amount is the cash received now.
- expense: a cost of running the business, such as rent, transport, airtime, wages, electricity, or water.
- purchase: stock bought for the business and paid now.
- debt_given: the customer still owes the business. Amount is what they owe, not cash received.
- debt_payment_received: the customer paid back money they already owed.
- supplier_payment: money paid to a supplier.
- other: anything else.

If one message is a sale that was only partly paid, return a sale for the amount paid AND a debt_given for the amount still owed. Do not also add the full price as a third record.
A message may contain several records. If nothing is a business record, return {"transactions":[]}.
Do not add totals or records that are not in the message.`;
}

export function receiptSystemPrompt(clientDate: string): string {
  return `${extractionSystemPrompt(clientDate)}

You are reading a photo of a receipt or handwritten note. Use only amounts and names you can see. If the photo is not a receipt, or you cannot read it, return {"transactions":[]}.`;
}

export function summarySystemPrompt(): string {
  return `You write a short daily note for the owner of a small business in Kampala.
Use simple English. Do not use accounting jargon. Do not change the numbers you are given. Do not invent records.
Return ONLY JSON: {"summary":"2 to 4 short sentences","tips":["practical tip","practical tip"]}
Give 2 or 3 tips a shop owner can use tomorrow. When you mention money, copy the UGX figures you were given.`;
}

export function summaryUserPrompt(input: {
  dateLabel: string;
  sales: number;
  expenses: number;
  cashIn: number;
  cashOut: number;
  net: number;
  outstanding: number;
  lines: string[];
}): string {
  const records = input.lines.length > 0 ? input.lines.join("\n") : "No records for this day.";
  return `Date: ${input.dateLabel}
Sales: UGX ${input.sales}
Money spent (costs, stock bought, and supplier payments): UGX ${input.expenses}
Money in (sales plus debt payments received): UGX ${input.cashIn}
Money out: UGX ${input.cashOut}
Cash left (money in minus money out): UGX ${input.net}
Customers still owe in total, including other days: UGX ${input.outstanding}

Records:
${records}`;
}
