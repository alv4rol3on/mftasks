# Security Audit — mftasks

Run: `mftasks-run-1` · Source: `f68ec11f` (branch `version2`) · Profile: `standard`
Target: `C:\\Users\\alv4r\\Desktop\\mf\\mftasks` (project under `mftasks/`)
Artifacts: `C:\\Users\\alv4r\\security-audit-skill\\mftasks\\run-1`

## 1. Summary

- **2 confirmed** source-grounded findings: **1 high**, **1 medium**.
- **11 needs_validation** hypotheses with a complete source trace but a decisive deployment/execution fact unavailable on this host.
- **1 rejected** candidate (metadata-only WebSocket visibility divergence).
- **26 coverage units: 14 covered, 12 candidate, 0 blocked, 0 deferred, 0 planned.**
- Both official validators' logic accepts `findings.json` (14 records) and `coverage-ledger.json` (26 units). The CLI wrappers were invoked through a Windows-compatible shim because their safe-read gate refuses to open input without `O_NOFOLLOW`/`O_NONBLOCK`; see §8.

## 2. Scope and target

Full repository audit of the Django/DRF + Next.js "MF Tasks" request workflow, including Git history for secret exposure. In scope: `mftasks/BACKEND/mfbackend`, `mftasks/FRONTEND/mffrontend/my-app`, `mftasks/nginx`, both compose files, tracked notes, and Git objects. Excluded from dynamic execution: the live deployment, Microsoft Entra, Microsoft Graph, Resend, and any real credentials. Migrations, `node_modules`, `venv`, `media/`, and `db.sqlite3` were not treated as current source (history was inspected separately).

## 3. Methodology and coverage

Reconnaissance mapped principals (CLIENTE, COLABORADOR, ADMINISTRADOR), the role hierarchy, campaign permissions, SSO/JWT/WebSocket surfaces, task state machine, file handling, email/PDF sinks, and deployment topology. Coverage ledger units were seeded per surface × boundary × attack class, assigned to isolated source hunters, then closed from returned paths/checks. A post-wave coverage critic added a missing image-upload unit; a final critic added three parallel-path units (entity CRUD, subtask start, pause/resume/reactivate). All 26 units are closed with owned source checks: 14 covered and 12 candidate (a candidate unit is a closed unit linked to one or more findings).

Primary controls reviewed: SimpleJWT validation + rotation/blacklist, Azure RS256/audience/issuer pinning and account linking, task queryset scoping, object permissions on every `@action`, campaign/subcampaign isolation, team/user/role admin gates, authenticated attachment download vs public description media, bleach + DOMPurify rich text, ReportLab escaping, email template autoescaping, and file upload bounds.

## 4. Confirmed findings

| Severity | Title | Fingerprint |
|---|---|---|
| **high** | Deleted database and TLS private-key blobs remain retrievable in Git history | `mftasks/.git:history-retained-sensitive-blobs` |
| **medium** | Hard-coded SMTP username and password in tracked email module | `mftasks/BACKEND/mfbackend/tasks/services/emails/correo.py:smtp-literal-credentials` |

### Deleted database and TLS private-key blobs remain retrievable in Git history (high)

db.sqlite3 (905216-byte SQLite database), certs/server.key (1704-byte PKCS#8 private key), and certs/rootCA.key (3272-byte CA private key) were committed and later deleted from the tree, but remain reachable from ancestor commits of HEAD. The DB and cert blobs are reachable on origin/version2, and the DB blob is also reachable from origin/version2-respaldo through the 31cc87f9 tree; the certs are also on that backup branch. The deleted cert tree also includes server.crt and rootCA.crt. .gitignore now covers these paths but cannot purge existing objects.

- **Root cause:** Sensitive data and key material were committed and removed only from the working tree/index; history was never rewritten and no secret-scanning gate blocked the commits.
- **Primary evidence:** `mftasks/BACKEND/mfbackend/db.sqlite3:1` — git ls-tree 31cc87f9 shows blob 950b2a2a, 905216 bytes, first bytes 'SQLite format 3'; content was not extracted.
- **Fix direction:** Reissue the TLS certificate with a new key pair and retire the exposed root CA; treat database contents (password hashes, sessions, PII) as compromised and force re-authentication/rotation; purge history with git filter-repo/BFG across all refs and tags, force-push, invalidate clones/caches/forks, and add pre-receive/CI secret scanning.
- **Full detail:** FINDINGS-DETAIL.md

### Hard-coded SMTP username and password in tracked email module (medium)

tasks/services/emails/correo.py stores a literal Outlook SMTP username and plaintext password, then authenticates with smtplib.SMTP(...).starttls()/login(). The file is tracked at HEAD. It is unreferenced dead code and cannot even import in the declared environment, but the credential pair is disclosed to anyone who can read the repository, a clone/fork, a CI workspace, or a backup. Mailbox liveness and password reuse are external and were not tested.

- **Root cause:** Credential material was written directly into a tracked source file instead of a runtime secret store, and no secret-scanning gate blocked the commit.
- **Primary evidence:** `mftasks/BACKEND/mfbackend/tasks/services/emails/correo.py:38` — Literal SMTP username assignment (value not reproduced).
- **Fix direction:** Delete the unused module or load the credentials from an environment/secret store; rotate the mailbox password and revoke its sessions/app passwords; add pre-commit and CI secret scanning; purge the file from history if the credential remains valid.
- **Full detail:** FINDINGS-DETAIL.md


## 5. Needs validation (no severity assigned)

These require an owner-observed deployment fact or an OS-enforced local execution that was unavailable here. Each retains a complete source trace and a safe validation plan.

| Title | Fingerprint | Key blocker |
|---|---|---|
| WebSocket access token is exposed in the URL query string and may be persisted by proxy access logs | `mftasks.websocket.access-token-in-query-string` | The running nginx image's effective access-log destination, retention, and readers are not visible in the repository. |
| Backend image build context includes untracked user attachments under media/ | `mftasks/BACKEND/mfbackend/dockerfile:media-in-image-context` | Whether the actual build host's media/ contains real user attachments at build time is not source-visible. |
| Anonymous /media prefix check runs before path normalization, allowing MEDIA_ROOT task attachments if a dot segment survives the proxy chain | `mftasks/BACKEND/mfbackend/mfbackend/urls.py:servir_descripcion:media-prefix-check-before-normpath` | The repository cannot establish whether the deployed nginx/Next chain normalizes or preserves encoded dot segments before Daphne decodes them to Django's path converter. |
| Import-time os.environ subscript makes a wholly absent RESEND_API_KEY abort container startup | `mftasks/BACKEND/mfbackend/tasks/tasks.py:resend-env-subscript-import` | The deployed .env is gitignored and absent, so whether RESEND_API_KEY is absent or present-empty is not source-visible. |
| Authenticated CLIENTE can grow MEDIA_ROOT/descripciones without any per-user, count, or aggregate quota | `mftasks/BACKEND/mfbackend/tasks/views.py:TaskViewSet.subir_imagen:unbounded-image-storage-no-aggregate-quota` | The deployed host filesystem size and free space behind the bind mount are outside the repository. |
| Tracked note file contains a standalone high-entropy credential-like literal of unknown purpose | `mftasks/por_hacer.txt:unclassified-high-entropy-literal` | No source reference identifies which service, account, or system the literal authenticates to. |
| Approval after fecha_limite_aprobacion is accepted until the scheduler tick | `mftasks/tasks/views.py:TaskViewSet.aprobar-rechazar:approval-deadline-not-enforced` | No sandbox to run Django and the scheduler; the accepted late approval could not be observed. |
| Cancelled solicitud can be approved back into the active workflow | `mftasks/tasks/views.py:TaskViewSet.aprobar-rechazar:missing-terminal-state-guard` | No OS-enforced sandbox or Django test execution on this Windows host; the CANCELADO -> APROBADO transition could not be observed. |
| Team assigner can bypass the approval gate by adding a subtask to an EN_ESPERA request and starting it | `mftasks/tasks/views.py:TaskViewSet.empezar-subtarea-approval-bypass` | No OS-enforced sandbox or Django test execution on this Windows host; the EN_ESPERA -> EN_DESARROLLO promotion via subtask start could not be observed. |
| Pause, resume, and reactivate subtask actions can mutate a cancelled or rejected request | `mftasks/tasks/views.py:TaskViewSet.subtask-lifecycle-terminal-state-guard` | No OS-enforced sandbox or Django test execution; the resulting state transitions could not be observed. |
| Completing or inactivating a subtask can change a cancelled request to SOLUCIONADO | `tasks-views-completar-subtarea-terminal-state-guard` | No OS-enforced sandbox or Django test execution on this Windows host; the resulting state could not be observed. |

Highest-priority unvalidated themes: the public `/media` prefix-check/normalization traversal, the approval/subtask terminal-state guards, and the subtask-start approval bypass. They are source-deterministic but were not promoted to `confirmed` because bounded execution was unavailable.

## 6. Rejected

- **WebSocket/dependency visibility authorizes approval-chain superiors for tasks the REST queryset hides** (`tasks-permissions-puede-observar-tarea-approver-divergence`): The trace exists but the impact is metadata-only disclosure within the approval chain and, for the dependency action, self-impact on the actor's own visible task. The WebSocket payload contains no task content or PII, and the divergence is limited to EN_ESPERA LIDER-phase tasks without auto_aprobar that the superior would see once the leader acts. This is a visibility inconsistency, not a principal crossing a data boundary, so it is rejected as an access-control finding and retained as hardening: align puede_observar_tarea with get_queryset or document the intentional WebSocket broadening.

## 7. Hardening themes (not findings)

- Move the app-owned JWT access/refresh tokens out of `localStorage` and add a Content-Security-Policy; the current client route guard is cosmetic and server authorization is correct.
- Align `puede_observar_tarea` with `TaskViewSet.get_queryset` or document the intentional WebSocket broadening; re-check WebSocket authorization on deactivation/membership changes.
- Set `DJANGO_SECURE_COOKIES`, `DJANGO_BEHIND_PROXY`, HSTS, https CSRF/CORS origins, proxy CSP/nosniff, and disable `server_tokens`.
- Make `RESEND_API_KEY` a lazy optional read; restore or delete the unreachable Graph module; do not return 500 for committed mutations because an email send failed.
- Exclude `media/` from the Docker build context, pin base images by digest, add non-root users, stop tracking `node_modules`, and add secret scanning to pre-commit/CI.
- Restrict description images to a per-user count/aggregate quota with cleanup, and consider signed expiring URLs.
- Remove the seeded client password in migration `0016`, and treat `por hacer.txt` as a secrets-inventory item.

## 8. Process notes and residual gaps

- **Delegation budget exhaustion.** The wave-4 hunter could not be funded. The parent performed the wave-4 source review directly (owner id `parent-final`), and no separate final-clean critic ran after wave 4. The three wave-4 units are source-reviewed and closed, but they did not receive an independent hunter.
- **Validator platform gate.** `validate-coverage-ledger.cjs` and `validate-findings.cjs` refuse to read input on Windows because `fs.constants.O_NOFOLLOW`/`O_NONBLOCK` are unavailable. Their exported `validateDocument` logic was invoked on the parsed JSON via `run-validators.cjs`; both passed. The file-read confinement step itself was not executed.
- **No dynamic execution.** The OS-enforced sandbox required by the skill (no network, empty environment, read-only target, scratch-only writes, resource limits) is not available on this host. No target code was run, no live endpoint or provider was contacted, and no real credential was used. Every behavioral claim is therefore `needs_validation`.
- **No prior run.** No compatible prior `coverage-ledger.json` or `findings.json` existed; this run does not imply the repository is exhausted.
- **Secret handling.** Credential and private-key values were never reproduced; only locations, types, last-four characters (SMTP), and blob sizes/type headers are reported.

## 9. Remediation priority

1. **Immediate (P0):** rotate/revoke the exposed SMTP mailbox credential; purge Git history of `db.sqlite3` and the TLS/CA private keys across all refs and tags; reissue the TLS certificate and retire the exposed root CA; treat the historical database (password hashes, sessions, PII) as compromised; classify and rotate the `por hacer.txt` literal.
2. **P1:** fix the `/media` normalization/prefix control; add a shared open/active state precondition to all approval, completion, start, pause, resume, and reactivate transitions (including the subtask-start promotion of `EN_ESPERA`).
3. **P2:** move WebSocket auth off the query string and redact logs; deploy secure-cookie/HSTS/proxy/CSP settings; make Resend configuration lazy; exclude `media/` from image builds; add image quotas.
4. **P3:** implement the hardening items in §7 and add regression tests for each P1 fix.
