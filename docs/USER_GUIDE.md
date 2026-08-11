# ML-IMS — User Guide

**Repository:** [https://github.com/raorayala/ml-ims](https://github.com/raorayala/ml-ims)  

This guide explains how to use the dashboard, inventory workflows, agent, and reports after the system is running. For install steps, see [SETUP.md](./SETUP.md).

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

Keep that terminal open while you work. Open the dashboard in a browser.

---

## 2. Dashboard overview

The home page is organized into:

1. **Summary stats** — reagent count, low-stock count, open POs, recent transactions  
2. **Reagent list** — name, barcode, total Active stock, threshold, supplier, lot count  
3. **Low-stock alerts** — reagents at or below minimum; **Evaluate thresholds** creates/refreshes Draft POs  
4. **Draft / open POs** — suggested reorder quantities and status  
5. **Check-out / check-in** — manual inventory movements + barcode scanner  
6. **Agentic AI loop** — natural-language commands  
7. **30-day consumption chart** — usage by project  
8. **Transaction logger** — immutable audit trail (newest first)  

Use **Refresh** anytime to reload live data.

---

## 3. Check out a reagent

Typical lab use: remove material from an Active lot for an experiment.

1. Sign in at `/login` (seed: `lab-tech-001` / `changeme123`).  
2. Enter **Lot number** (seed example: `902`).  
3. Enter **Quantity** (example: `50`).  
4. Enter **Project / experiment** (example: `EXP-101`).  
5. Click **Check out** (logged as your signed-in username).  

**What happens**

- Quantity is deducted only if the lot is `Active` and has enough stock.  
- An immutable `Check-out` transaction is written.  
- Total Active stock for that reagent is recalculated.  
- If stock is at/below the threshold and no open PO exists, a **Draft** purchase order and low-stock alert are created.  

**Common errors**

| Message / situation | Meaning |
|---------------------|---------|
| Lot not found | Wrong lot number |
| Lot is not Active | Lot depleted, expired, or quarantined |
| Insufficient quantity | Requested more than available on that lot |

---

## 4. Check in a reagent

Use when returning unused material to a lot.

1. Enter lot number and quantity.  
2. Click **Check in**.  

Check-in is blocked for `Expired` or `Quarantined` lots.

---

## 5. Barcode / QR scanning

1. In **Check-out / check-in**, click **Start scanner**.  
2. Allow camera permission when prompted.  
3. Point at a reagent barcode or lot QR.  
4. The scanned value fills the lot field (prefix `LOT-` is stripped if present).  

If the camera is unavailable, type the lot number manually.

---

## 6. Low-stock alerts & purchase orders

- Alerts appear when Active stock ≤ `min_threshold_quantity`.  
- Click **Evaluate thresholds** to scan all reagents and create missing Draft POs.  
- Suggested quantity uses:  
  `max(standard reorder quantity, average monthly consumption × 1.5 − current stock)`.  
- Open PO statuses include `Draft`, `Pending Approval`, and `Submitted`. A new Draft is **not** created if one of these already exists for that reagent.

### Approving a purchase order

On each open PO card, use the action buttons:

1. **Send for approval** (`Draft` → `Pending Approval`)  
2. **Approve & submit** (`Pending Approval` → `Submitted`)  
3. **Mark received** (`Submitted` → `Received`)  

Received POs leave the open-PO list.

## 6b. Master data admin

Scroll to **Master data admin** on the dashboard to:

- Create a **supplier** (name, email, phone, account number)  
- Create a **reagent** (unit, thresholds, supplier, optional barcode)  
- Create a **lot** (lot number, quantity, location, expiration date)  

Deletes (when a record has no dependents) are available via the REST API — see [API.md](./API.md).

Seed data often shows low stock for:

- Ampicillin Sodium (vials)  
- Tryptic Soy Agar (g)  

---

## 7. Using the agent (natural language)

On the dashboard, type a command in **Agentic AI loop** and click **Run agent**.

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

Optional free LLM (Ollama): set `AGENT_USE_LLM=true` in `.env` and run Ollama locally. The rule-based parser works without any LLM.

---

## 8. Reports (API)

These are available to the dashboard and any HTTP client:

| Report | Endpoint |
|--------|----------|
| Dashboard aggregate | `GET /api/dashboard` |
| Stock by location | `GET /api/reports/stock-summary` |
| Consumption 30/60/90 | `GET /api/reports/consumption?days=30&groupBy=project` |
| Expirations | `GET /api/reports/expirations` |

Example (PowerShell):

```powershell
Invoke-RestMethod http://localhost:4000/api/reports/expirations | ConvertTo-Json -Depth 6
```

---

## 9. Expiration quarantine

- Active lots past their expiration date are marked **Quarantined** by a scheduled job (default midnight: `CRON_SCHEDULE=0 0 * * *`).  
- A startup sweep also runs when the API starts.  
- Manual trigger: `POST /api/jobs/quarantine-expired`.

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
- [Setup from GitHub](./SETUP.md)  
- [README](../README.md)  
