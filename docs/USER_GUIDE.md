# ML-IMS — User Guide

**Repository:** [https://github.com/raorayala/ml-ims](https://github.com/raorayala/ml-ims)  

This guide explains how to use the dashboard, inventory workflows, agent, and reports after the system is running. For install steps, see [SETUP.md](./SETUP.md). Known product limits and the build order for missing workflows are in [ROADMAP.md](./ROADMAP.md).

---

## 1. Starting the application

From the project root:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Web dashboard | http://localhost:3000 |
| REST API | http://localhost:4000/api |
| Health check | http://localhost:4000/api/health |

Keep that terminal open while you work. Open the dashboard in a browser. Sign in at `/login`.

Seed accounts (password `changeme123`): `lab-tech-001` (LAB_USER), `admin` (ADMIN).

The browser stores the JWT in **localStorage**. Use the dashboard only on a trusted workstation; do not treat this as a public-internet session model.

---

## 2. Dashboard overview

The home page is organized into:

1. **Summary stats** — reagent count, low-stock count, open POs, recent transactions  
2. **Reagent list** — name, barcode, total Active stock, threshold, supplier, lot count  
3. **Low-stock alerts** — reagents at or below minimum; **Evaluate thresholds** creates/refreshes Draft POs  
4. **Draft / open POs** — suggested reorder quantities and status  
5. **Check-out / check-in** — manual inventory movements + barcode scanner (autofill)  
6. **Agentic AI loop** — natural-language commands  
7. **30-day consumption chart** — usage by project (may mix units; see Reports)  
8. **Transaction logger** — recent audit rows (newest first, limited list)  

Use **Refresh** anytime to reload live data.

---

## 3. Check out a reagent

Typical lab use: remove material from an Active lot for an experiment.

1. Sign in at `/login` (seed: `lab-tech-001` / `changeme123`).  
2. Enter **Lot number** (seed example: `902`). There is no FEFO picker; you choose the lot.  
3. Enter **Quantity** (example: `50`).  
4. Enter **Project / experiment** (example: `EXP-101`).  
5. Click **Check out** (logged as your signed-in **username**).  

**What happens**

- Quantity is deducted only if the lot is `Active` and the read quantity is enough.  
- A `Check-out` transaction is written.  
- Total Active stock for that reagent is recalculated.  
- If stock is at/below the threshold and no open PO exists, a **Draft** purchase order and low-stock alert payload are created.  

**Concurrency:** two people checking out the same lot at the same time can both succeed against stale quantity (especially on PostgreSQL). Prefer one operator per lot until Phase 1 lands.

**Common errors**

| Message / situation | Meaning |
|---------------------|---------|
| Lot not found | Wrong lot number |
| Lot is not Active | Lot depleted, expired, or quarantined |
| Insufficient quantity | Requested more than available on that lot (as last read) |

---

## 4. Check in a reagent

Use when returning unused material to a lot.

1. Enter lot number and quantity.  
2. Click **Check in**.  

Check-in is blocked for `Expired` or `Quarantined` lots. Returned quantity is **not** a substitute for a documented adjustment (no reason field).

---

## 5. Barcode / QR scanning

1. In **Check-out / check-in**, click **Start scanner**.  
2. Allow camera permission when prompted.  
3. Point at a reagent barcode or lot QR.  
4. The scanned value **fills the lot text field** (prefix `LOT-` is stripped if present).  

The scanner does **not** look up a lot-level barcode, confirm the lot exists, or choose the earliest-expiring lot (FEFO). If the camera is unavailable, type the lot number manually.

---

## 6. Low-stock alerts & purchase orders

- Alerts appear when Active stock ≤ `min_threshold_quantity`. They are **in-app only** (no email, Teams, or Slack; no acknowledge/escalate).  
- Click **Evaluate thresholds** to scan all reagents and create missing Draft POs (ADMIN).  
- Suggested quantity uses:  
  `max(standard reorder quantity, average monthly consumption × 1.5 − current stock)`.  
- Open PO statuses include `Draft`, `Pending Approval`, and `Submitted`. A new Draft is **not** created if one of these already exists for that reagent.

### Changing a purchase order status (ADMIN)

On each open PO card:

1. **Send for approval** (`Draft` → `Pending Approval`)  
2. **Approve & submit** (`Pending Approval` → `Submitted`)  
3. **Mark received** (`Submitted` → `Received`)  

The API currently **allows any status**, including reverse or skip-to-Received. **Mark received does not receive goods:** it does not record quantity, cost, invoice, lot number, or expiry, and it does **not** create or update inventory lots. Received POs only leave the open-PO list. Use master-data **create lot** if you need stock on the shelf, and treat that as a temporary workaround (it also does not write a receiving ledger row).

Approvals are not stored as identity + timestamp + comments; the acting admin is whoever called the status API.

## 6b. Master data admin (ADMIN)

Scroll to **Master data admin** on the dashboard to:

- Create a **supplier** (name, email, phone, account number)  
- Create a **reagent** (unit, thresholds, supplier, optional barcode)  
- Create a **lot** (lot number, quantity, location, expiration date)  

**Update and delete are not on the dashboard.** Deletes (when a record has no dependents) and lot patches are REST-only — see [API.md](./API.md).

**Do not use `PATCH /lots` to fix stock.** Changing quantity or status there skips the audit ledger, reason, and reorder evaluation. Prefer check-out, check-in, or wait for the planned adjustment/disposal workflows.

Seed data often shows low stock for:

- Ampicillin Sodium (vials)  
- Tryptic Soy Agar (g)  

---

## 7. Using the agent (natural language)

On the dashboard, type a command in **Agentic AI loop** and click **Run agent**. The HTTP agent uses your signed-in username.

### Supported examples

```text
I took 50mL of Lot 902 for Project EXP-101
Check in 25 of lot ETH-881
Evaluate thresholds
Show 30 day consumption by project
Generate a purchase order for Ampicillin Sodium
```

### CLI agent

```bash
npm run start -w @ml-ims/agent -- "I took 50mL of Lot 902 for Project EXP-101"
```

Interactive mode (no message argument):

```bash
npm run start -w @ml-ims/agent
```

The CLI/MCP actor defaults to `DEFAULT_USER_ID` in `.env` (or a tool argument). That value is stored as free text on the ledger; it is not verified against `users`.

Optional free LLM (Ollama): set `AGENT_USE_LLM=true` in `.env` and run Ollama locally. The rule-based parser works without any LLM.

---

## 8. Reports (API)

These are available to the dashboard and any HTTP client:

| Report | Endpoint | Caveat |
|--------|----------|--------|
| Dashboard aggregate | `GET /api/dashboard` | Recent txs only |
| Stock by location | `GET /api/reports/stock-summary` | `totalQuantity` **adds mixed units** |
| Consumption 30/60/90 | `GET /api/reports/consumption?days=30&groupBy=project` | Project totals can mix units |
| Expirations | `GET /api/reports/expirations` | Uses API host local calendar |

Trust **per-reagent** quantities and units. Do not use a location or project grand total as a physical amount when units differ.

There is no CSV/PDF export, saved report, or full audit explorer (filter/search/sort/page). `GET /api/transactions?limit=` returns at most 500 newest rows.

Example (PowerShell, after login you still need a Bearer token from the browser or `POST /api/auth/login`):

```powershell
Invoke-RestMethod http://localhost:4000/api/reports/expirations | ConvertTo-Json -Depth 6
```

Unauthenticated report calls return 401.

---

## 9. Expiration quarantine

- Active lots with `expiration_date` on or before **today in the API process timezone** are marked **Quarantined** (default schedule `CRON_SCHEDULE=0 0 * * *`).  
- A startup sweep also runs when the API starts.  
- Manual trigger: `POST /api/jobs/quarantine-expired` (ADMIN).  
- No quarantine reason is stored; no ledger row is written; there is no configurable warning lead time or notification.

---

## 10. MCP tools (advanced)

For Cursor / MCP clients, start:

```bash
npm run dev:mcp
```

Tools:

| Tool | Use |
|------|-----|
| `check_out_reagent` | Deduct stock + audit + reorder |
| `check_in_reagent` | Return stock + audit |
| `evaluate_thresholds` | Full low-stock scan |
| `generate_draft_po` | Draft PO for one reagent id |
| `get_consumption_report` | Consumption analytics |

Registration template: [`mcp.json.example`](../mcp.json.example).

MCP is a privileged local process: it accepts the `userId` you pass. Do not expose it on a network.

---

## 11. Seed demo data cheat sheet

| Item | Value |
|------|--------|
| Sample lot | `902` (Ethanol Absolute, mL) |
| Sample project | `EXP-101` |
| Seed login | `lab-tech-001` / `changeme123` (LAB_USER); `admin` / `changeme123` (ADMIN) |
| Other lots | `ETH-881`, `PBS-2201`, `TSA-77`, `GLY-501`, `AMP-19` |

Re-seed (wipes inventory tables and reloads demo data):

```bash
npm run db:seed
```

---

## 12. Related documents

- [User Requirements](./USER_REQUIREMENTS.md)  
- [Roadmap](./ROADMAP.md)  
- [Setup from GitHub](./SETUP.md)  
- [README](../README.md)  
