# ML-IMS — User Requirements Specification

**Product:** Microbiology Laboratory Inventory Management System (ML-IMS)  
**Repository:** [https://github.com/raorayala/ml-ims](https://github.com/raorayala/ml-ims)  
**Audience:** Lab technicians, inventory managers, lab supervisors, and integrators

---

## 1. Purpose

Provide an automated, auditable, real-time system for tracking microbiology laboratory reagents and lots, recording inventory movements, alerting on low stock, drafting purchase orders, and supporting natural-language / MCP-driven operations — using free/unpaid software only.

---

## 2. Stakeholders & Roles

| Role | Needs |
|------|--------|
| Lab technician | Check out / check in reagents quickly; associate use with project/experiment; optional barcode scan |
| Inventory manager | Monitor stock by location; act on low-stock alerts; review draft POs |
| Lab supervisor | Audit consumption trends; expiration visibility; immutable transaction history |
| Integrator / AI operator | Call MCP tools or agent loop from Cursor / CLI |

---

## 3. Functional Requirements

### 3.1 Inventory master data

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Maintain **suppliers** (name, email, phone, account number) | Must |
| FR-02 | Maintain **reagents** (name, unit of measure, min threshold, reorder quantity, supplier, optional barcode) | Must |
| FR-03 | Maintain **inventory lots** (lot number, quantity, storage location, expiration date, status) | Must |
| FR-04 | Units of measure limited to: `mL`, `L`, `g`, `kg`, `vials`, `packs` | Must |
| FR-05 | Lot status values: `Active`, `Depleted`, `Expired`, `Quarantined` | Must |

### 3.2 Check-out / check-in

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06 | Check-out only from lots with status `Active` | Must |
| FR-07 | Reject check-out when requested quantity exceeds current lot quantity | Must |
| FR-08 | Perform stock update and audit insert inside an isolated database transaction | Must |
| FR-09 | Append an immutable row to `inventory_transactions` for every movement | Must |
| FR-10 | Recalculate total Active stock for the reagent after check-out | Must |
| FR-11 | Support check-in (return) that increases lot quantity and writes an audit row | Must |
| FR-12 | Capture acting user id and optional experiment/project code | Must |
| FR-13 | Dashboard supports HTML5 barcode/QR scan to autofill lot/barcode values | Should |

### 3.3 Automated reorder & alerts

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-14 | After check-out, compare total Active stock to `min_threshold_quantity` | Must |
| FR-15 | If stock ≤ threshold and no open PO exists (`Draft` / `Pending Approval` / `Submitted`), create a `Draft` purchase order | Must |
| FR-16 | Suggested quantity = `max(reorder_quantity, avg_monthly_consumption × 1.5 − current_stock)` | Must |
| FR-17 | Persist a low-stock alert payload with the draft PO | Must |
| FR-18 | Support explicit threshold evaluation across all reagents | Must |

### 3.4 Reporting & analytics

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-19 | Stock summary grouped by storage location with expiration highlights | Must |
| FR-20 | Consumption rates for rolling 30 / 60 / 90 days, by project or reagent | Must |
| FR-21 | Expiration tracking for lots within 30 / 60 / 90 days | Must |
| FR-22 | Cron job marks Active lots as `Quarantined` at 00:00 on expiration date | Must |
| FR-23 | Dashboard shows reagent list, low-stock alerts, open POs, transaction log, consumption chart | Must |

### 3.5 MCP & agentic AI

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-24 | Expose MCP tools: `check_out_reagent`, `check_in_reagent`, `evaluate_thresholds`, `generate_draft_po`, `get_consumption_report` | Must |
| FR-25 | Agent loop parses natural language (e.g. “I took 50mL of Lot 902 for Project EXP-101”) into tool calls | Must |
| FR-26 | Agent executes reorder logic automatically after applicable mutations | Must |
| FR-27 | Optional free local LLM (Ollama) when enabled; rule-based parser works offline by default | Should |

### 3.6 Data & audit

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-28 | Relational schema with primary keys, foreign keys, indexes, and enum constraints | Must |
| FR-29 | Transaction ledger is append-only (no update/delete of historical movements in normal workflows) | Must |
| FR-30 | Purchase order statuses: `Draft`, `Pending Approval`, `Submitted`, `Received` | Must |

---

## 4. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Prefer free/unpaid stack (Node.js, Next.js, Prisma, SQLite/PostgreSQL, MCP SDK, optional Ollama) |
| NFR-02 | Validate all mutating API inputs (Zod) with clear error codes/messages |
| NFR-03 | Local development runnable without paid cloud services |
| NFR-04 | Modular monorepo: `apps/*` + `packages/*` |
| NFR-05 | Responsive web dashboard usable on desktop and typical lab workstation displays |
| NFR-06 | Secrets (`.env`) never committed to Git |

---

## 5. Out of Scope (current release)

- Full supplier EDI / email submission of purchase orders  
- Multi-tenant SaaS authentication / SSO  
- Mobile native apps  
- Paid LLM provider hard dependency  
- Electronic signatures / GLP Part 11 certification package  

---

## 6. Acceptance Criteria (smoke)

1. Fresh clone from GitHub can be set up with documented setup steps.  
2. Seed data loads Lot `902` (Ethanol Absolute) and low-stock reagents.  
3. Check-out of 50 mL from Lot `902` for `EXP-101` succeeds and appears in the transaction log.  
4. Threshold evaluation creates Draft POs for reagents below minimum.  
5. Dashboard at `http://localhost:3000` shows reagents, alerts, and transactions.  
6. Agent phrase above executes the same check-out path successfully.  

---

## 7. Related documents

- [Setup from GitHub](./SETUP.md)  
- [User Guide](./USER_GUIDE.md)  
- [Project README](../README.md)  
