# Module: repairs

## Responsibility

Repair ticket lifecycle management. Handles intake, diagnosis, parts tracking, status workflow, cost tracking, checklist management, photo documentation, AI-assisted diagnosis, and customer notification on completion.

## Tables Owned

| Table | Description |
|-------|-------------|
| `repairs` | Repair tickets (device, problem, status, costs, technician) |
| `repair_status_log` | Status change history with timestamps and user |
| `repair_parts_used` | Parts consumed per repair (linked to parts_inventory) |
| `parts_inventory` | Spare parts stock |
| `checklist_templates` | Configurable repair checklists |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/repairs` | GET, POST | List repairs (filtered) / create new ticket |
| `/api/repairs/[id]` | GET, PATCH | Repair detail / update status |
| `/api/repairs/[id]/parts` | GET, POST | Parts used on a repair |
| `/api/repairs/[id]/checklist` | GET, POST | Repair checklist items |
| `/api/repairs/[id]/photos` | GET, POST | Before/after photos |
| `/api/repairs/track` | GET | Public repair tracking (no auth) |
| `/api/parts` | GET, POST | Parts inventory CRUD |
| `/api/parts/[id]` | PATCH, DELETE | Part detail/update |
| `/api/checklists/templates` | GET, POST | Checklist template management |

## Events Published

| Event | When | Payload |
|-------|------|---------|
| `repair.created` | New ticket created | repair_id, customer_id, store_id |
| `repair.status_changed` | Status transition | repair_id, old_status, new_status, user_id |
| `repair.completed` | Repair delivered | repair_id, final_cost, customer_id |

## Events Consumed

None directly -- WhatsApp notification on `ready` status is triggered by the marketing module.

## Key Files

| File | Purpose |
|------|---------|
| `components/RepairHeader.tsx` | Repair ticket header (device info, customer, dates) |
| `components/RepairStatusActions.tsx` | Status transition buttons with validation |
| `components/RepairTimeline.tsx` | Visual timeline of status changes |
| `components/RepairPartsSection.tsx` | Parts used list with add/remove |
| `components/RepairCostSummary.tsx` | Estimated vs. final cost, deposit tracking |
| `components/RepairAIDiagnosis.tsx` | AI diagnosis suggestions |
| `components/RepairChecklistPhotos.tsx` | Checklist items + photo capture |
| `components/CollapsibleSection.tsx` | Collapsible UI sections |
| `hooks/useRepairDetail.ts` | Fetch and manage single repair state |
| `hooks/useRepairStatus.ts` | Status transition logic with validation |
| `hooks/useRepairParts.ts` | Parts tracking (add, remove, cost calculation) |

## Status Machine

Valid transitions (enforced server-side):

```
received --> diagnosing --> waiting_parts --> in_repair --> ready --> delivered
                |                                |
                +----------> in_repair ----------+
                |                                |
                +----------> cancelled           +----------> cancelled
```

- `received`: Device accepted at intake
- `diagnosing`: Technician examining the device
- `waiting_parts`: Parts need to be ordered
- `in_repair`: Active repair work
- `ready`: Repair complete, awaiting customer pickup
- `delivered`: Customer picked up device
- `cancelled`: Repair cancelled at any stage

## Business Rules

- Each status change is logged with timestamp, user, and optional notes
- Cannot skip statuses (e.g., received directly to delivered is blocked)
- Final cost may differ from estimate -- confirmed at completion
- Deposit tracked separately, balance = final_cost - deposit
- WhatsApp notification sent to customer when status changes to `ready`
- Public tracking page available at `/track?phone=XXXXX` (no login required)
- AI diagnosis suggests common issues and parts based on device model + problem description
