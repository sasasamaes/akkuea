# Emergency Operating Procedures

This document describes emergency procedures for the defi-rwa smart contract. It covers the roles involved, how to pause and recover, and how to monitor governance events.

## Roles

| Role | Can Pause | Can Schedule Recovery | Can Execute/Cancel Recovery |
|---|---|---|---|
| `Admin` | ✅ | ✅ | ✅ |
| `Pauser` | ✅ | ❌ | ❌ |
| `EmergencyGuard` | ✅ | ❌ | ❌ |

> **Note**: `EmergencyGuard` is a limited role for designated incident responders. They can pause the contract immediately but cannot trigger or influence the recovery path. This design prevents a compromised guard key from unpausing the system without administrative oversight.

### Granting / Revoking EmergencyGuard

```bash
# Grant
invoke_contract grant_emergency_role --admin <ADMIN_ADDR> --target <GUARD_ADDR>

# Revoke
invoke_contract revoke_emergency_role --admin <ADMIN_ADDR> --target <GUARD_ADDR>
```

---

## Timelock Parameters

| Parameter | Value |
|---|---|
| `TIMELOCK_DURATION` | `86400` seconds (24 hours) |

The constant is defined in `src/access/roles.rs` and is enforced by `TimelockControl::execute_recovery`.

---

## Pause Runbook

1. **Detect incident** — off-chain monitoring or manual observation.
2. **Pause immediately** — any Admin, Pauser, or EmergencyGuard calls:
   ```
   invoke_contract emergency_pause --caller <RESPONDER_ADDR>
   ```
3. **Confirm pause** — verify via ledger state or emitted `EmergencyPaused` event.
4. **Notify stakeholders** — communicate status via internal channels.

---

## Recovery Runbook

> Only an Admin can initiate and finalize recovery.

1. **Assess incident** — confirm the root cause is understood and mitigated.
2. **Schedule recovery**:
   ```
   invoke_contract schedule_recovery --caller <ADMIN_ADDR>
   ```
   This emits `RecoveryScheduled` with `earliest_execution = now + 86400s`.
3. **Wait 24 hours** — the timelock enforces a mandatory cooling-off period.
4. **Execute recovery** (after `earliest_execution` has passed):
   ```
   invoke_contract execute_recovery --caller <ADMIN_ADDR>
   ```
   This emits `RecoveryExecuted` and clears the pause state.
5. **Verify recovery** — confirm contract is unpaused and operations are normal.

---

## Cancellation Runbook

If a scheduled recovery needs to be withdrawn (e.g., the incident is not yet resolved):

```
invoke_contract cancel_recovery --caller <ADMIN_ADDR>
```

This emits `RecoveryCancelled`. The contract remains paused. A new recovery can be scheduled from scratch.

---

## Governance Events Reference

All events are emitted during the emergency control flow and can be indexed by off-chain services.

| Event | Trigger | Key Fields |
|---|---|---|
| `EmergencyPaused` | `emergency_pause` called | `by`, `timestamp` |
| `RecoveryScheduled` | `schedule_recovery` called | `by`, `earliest_execution`, `timestamp` |
| `RecoveryCancelled` | `cancel_recovery` called | `by`, `timestamp` |
| `RecoveryExecuted` | `execute_recovery` called | `by`, `timestamp` |

---

## Error Conditions

| Panic Message | Cause |
|---|---|
| `Caller does not have permission to pause` | Caller lacks Admin/Pauser/EmergencyGuard role |
| `Contract not paused` | Tried to schedule recovery while contract is active |
| `Recovery already scheduled` | Second schedule while one is pending |
| `No recovery scheduled` | Cancel/execute called with no pending record |
| `Timelock not expired` | Execute called before 24h has elapsed |
| `Caller not admin` | Non-admin tried a recovery governance action |
