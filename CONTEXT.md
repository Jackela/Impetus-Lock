# Domain glossary

| Term | Meaning |
| --- | --- |
| Account | A user identity confirmed by the server, identified by its stable user ID. |
| Session | A period during which an account is authorized to perform remote work. Pausing a session does not discard its writing. |
| Owned draft | Writing and its locks belonging to a confirmed account, whether or not it has a remote task yet. |
| Unassigned draft | Writing retained from storage whose account ownership cannot be established. It becomes an owned new draft only through an explicit import. |
| Recovery conflict | A local draft and a changed server version that must both be preserved until the writer chooses how to continue. |
