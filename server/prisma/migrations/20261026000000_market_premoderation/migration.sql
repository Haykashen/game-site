-- New lots and listings wait for an administrator before publication.
ALTER TYPE "ModerationStatus" ADD VALUE 'pending' BEFORE 'visible';

-- Owner-facing review results. Both values are inserted before an existing
-- value, so the migration never references a value added in the same transaction.
ALTER TYPE "NotificationType" ADD VALUE 'entry_approved' BEFORE 'deal_created';
ALTER TYPE "NotificationType" ADD VALUE 'entry_rejected' BEFORE 'deal_created';
