# Lifecycle statuses

Each Game, Edition, MarketEntry, NewsPost, Discussion, User, Deal and Report stores only a statusId reference to the Status directory. Read the lifecycle code through statusReference.code. Directory names and descriptions remain editable; identity and valid codes are protected in the database.

Use statusWhere for a directory-code predicate and statusWrite to resolve a transition to its actual directory ID. Marketplace references are scoped to Listing or Auction according to kind. Changing kind must also remap statusId to that entity's directory.

The HTTP API retains status and moderationStatus as projections for compatibility. They are not Prisma fields or independently writable database values. The universal admin table accepts statusId only. Its reference metadata is loaded for business checks and stripped before a Prisma scalar write.

Marketplace projections:

| Directory code | API status | API moderationStatus |
| --- | --- | --- |
| draft | active | draft |
| pending | active | pending |
| active | active | visible |
| rejected | active | hidden |
| removed | active | removed |
| sold | sold | visible |
| closed | closed | visible |

Use marketStatusWhere when filtering these API projections, including combined lifecycle and moderation filters. Partial transitions preserve the existing lifecycle/moderation projection, matching the previous compatibility behavior. Terminal states take precedence; reopening a sold or closed record resumes publication. statusWrite reads existing marketplace state by ID; callers retain their version/status predicates on the actual update to prevent stale writes.

Migration 20261102050000_single_status_source validates existing references, replaces synchronization with entity validation/default triggers, removes the old status/moderation_status columns and unused enum types, and recreates affected indexes using status_id. It runs atomically and preserves the backfilled status_id values. It has not been applied to the working database as part of this change.

Database integration tests require the isolated CI database discvault_ci. Unit and HTTP tests do not require a database. Before release, run the full migration chain and database tests in that isolated environment. Do not run an older API version against the schema after removing its compatibility columns.
