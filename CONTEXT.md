# Domain glossary

| Term              | Meaning                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Task              | An account-owned writing document with content, locks and an optimistic version.                       |
| Lock              | A creative constraint preserved in Markdown that ordinary edits cannot delete.                         |
| Intervention      | A Muse/Loki action that adds or changes writing under the task ownership and version contracts.        |
| Account           | A server-confirmed user identity with a stable ID.                                                     |
| Owned draft       | Writing and locks attached to a server-confirmed account, with or without a remote task.               |
| Unassigned draft  | Retained legacy writing whose account cannot be established; importing it requires an explicit choice. |
| Recovery conflict | A local draft and changed server version retained until the writer decides how to continue.            |
| Session           | Authorization for remote work; expiry must preserve local writing.                                     |

Runtime and dependency versions come from package/lock files and CI. Product requirements come from OpenSpec. Git and validation output establish implementation/check status; neither is release evidence.
