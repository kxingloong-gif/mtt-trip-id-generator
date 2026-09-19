# MTT Trip ID Generator
## Consultant & Supervisor User Manual

This manual explains how to use the MTT Trip ID Generator day-to-day. It
does not cover any technical setup — if you need that, see `README.md`
instead.

---

### 1. Purpose

The Trip ID gives every confirmed trip **one permanent reference number**
that stays with it for life. The same number is used to link that trip
across Odoo, the Monthly Statistic Report (MSR), revenue, direct costs,
and profitability analysis, so that everyone looking at a given trip - no
matter which system they're in - is looking at the same booking.

This is a reference number, not a monitoring tool. It exists so figures
line up cleanly between systems, not to track individual staff performance.

---

### 2. When to Generate a Trip ID

**Normal trigger: the customer has paid a deposit.**

| Situation | Generate a Trip ID? |
|---|---|
| Enquiry only | No |
| Quotation sent | No |
| Follow-up in progress | No |
| Verbal confirmation only | No |
| Deposit received | **Yes** |

Verbal confirmation is not reliable enough on its own - customers
sometimes confirm by phone or message and then pull out before actually
paying. Waiting for the deposit avoids generating IDs for trips that
never actually happen.

**Possible exception:** some corporate or agent bookings may be formally
confirmed under approved credit terms without an upfront deposit. Where
management has approved this kind of formal confirmation, it may be
treated as equivalent to deposit receipt for the purpose of generating a
Trip ID. If you are not sure whether a booking qualifies, check with your
supervisor before generating an ID.

---

### 3. Generating a New Trip ID

1. Log in with your own email and password.
2. Type the trip description into the description box, e.g. "4 Days 3
   Nights Kundasang and Kota Kinabalu Tour".
3. Click **Generate ID**.
4. The Trip ID and the complete Odoo Opportunity Name appear, for example:

   ```
   M2600123 | 4D3N Kundasang + Kota Kinabalu
   ```

5. Click **Copy for Odoo**, then paste that exact text into the
   Opportunity Name field on the existing Odoo opportunity.

You cannot type or choose the Trip ID yourself - it is generated
automatically and cannot be changed afterwards.

---

### 4. Important Rule About the Trip ID

**`M2600123` never changes, no matter what.**

Even if:
- the itinerary changes,
- the number of nights changes,
- the hotel changes,
- the number of passengers changes,

...the description may be updated (see section 5), but the Trip ID itself
stays exactly the same for the life of that booking. It is also never
reused for a different booking, even if the original one is voided.

---

### 5. Requesting an Amendment

If the trip description needs to change after the Trip ID has already
been generated (for example, the customer extends the trip), you do not
edit it yourself. Instead:

1. Find the Trip ID in the register.
2. Click **Request Amendment**.
3. Enter the **Proposed New Description**.
4. Enter an **Amendment Reason** (required).
5. Click **Submit Request**.
6. Wait for a Supervisor or Admin to approve or reject it.

While your request is waiting for review, the **current approved
description stays exactly as it was** - nothing changes until someone
with the authority to approve it does so. You can see the status of your
request ("Pending") under **My Amendment / Void Requests**.

---

### 6. After Amendment Approval

Once your amendment is approved:

- the description shown in the register updates to the new text,
- a revised **Odoo Opportunity Name** becomes available, e.g.
  `M2600123 | 5D4N Kundasang + Kota Kinabalu`,
- click **Copy for Odoo** and paste the updated name into the existing
  Odoo opportunity, replacing what was there before,
- the Trip ID (`M2600123`) stays exactly the same.

If your request is rejected instead, the description stays as it was,
and you can see the reviewer's rejection reason in **My Amendment / Void
Requests**.

---

### 7. Supervisor Approval Process

Supervisors and Admins review pending requests:

1. Open **Pending Amendment / Void Requests**.
2. Review the current description, the proposed description (if it's an
   amendment), and the reason given.
3. Click **Review**, then **Approve** or **Reject**.
4. If rejecting, enter a short rejection reason - this is required and is
   shown to the person who requested the change.

**A Supervisor can never approve their own amendment or void request.**
If a Supervisor requests a change to a record they created themselves,
that request can only be approved by an Admin, never by the Supervisor
themselves or by another Supervisor.

---

### 8. Cancellation

If a genuine, deposited trip is later cancelled by the customer, a
Supervisor or Admin marks it **Cancelled** with a reason. The record
remains in the register exactly as it was, just marked Cancelled - it is
**not** the same as Void, and a cancelled trip is never removed or hidden.

---

### 9. Void

**Void** is only for a genuine mistake in creating the record itself, for
example:

- an accidental duplicate Trip ID for the same booking,
- a Trip ID generated for the wrong booking,
- an obvious administrative slip - the record should never have existed.

A Consultant or Supervisor cannot void a record directly - they submit a
**Request Void** with a reason, and a Supervisor or Admin must approve it
before the record actually becomes Void. Trip IDs are never reused, even
once voided.

Do not confuse Void with Cancellation (section 8) - a real trip that
later fell through is Cancelled, not Void.

---

### 10. Common Examples

**Example A** - Customer pays a deposit for a 4D3N Kundasang trip.
-> Generate a Trip ID.

**Example B** - Customer verbally confirms but has not paid a deposit yet.
-> Do not generate a Trip ID yet. Wait for the deposit.

**Example C** - Customer pays a deposit, then later changes the trip from
4D3N to 5D4N.
-> Keep the same Trip ID. Submit a Request Amendment with the new
description and a reason.

**Example D** - Customer pays a deposit but later cancels the trip.
-> Mark the record Cancelled, not Void.

**Example E** - A consultant accidentally generates the same trip twice.
-> Submit a Request Void for the duplicate record, explaining the mistake.

---

### 11. What Not To Do

- Do not manually change a Trip ID - it cannot be edited by anyone.
- Do not generate a new Trip ID just because the itinerary changed -
  submit an amendment instead.
- Do not mark a genuinely cancelled trip as Void - use Cancelled.
- Do not generate a Trip ID for a speculative enquiry, a quotation only,
  or a verbal confirmation with no deposit.
- Do not attempt to reuse an old or voided Trip ID for a new booking.

---

### 12. Quick Reference

| Situation | Action |
|---|---|
| Enquiry only | No Trip ID |
| Quotation sent | No Trip ID |
| Verbal confirmation only | No Trip ID |
| Deposit received (or approved formal confirmation) | Generate Trip ID |
| Itinerary or details change | Request Amendment |
| Customer cancels a confirmed trip | Mark Cancelled |
| Duplicate or wrong Trip ID created | Request Void |
| The Trip ID itself | Never changes, never reused |
