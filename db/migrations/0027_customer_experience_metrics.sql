-- Aggregate first-party experience measurements. No contact details, raw IPs,
-- search text, URLs or order contents. Short-lived salted signatures deduplicate.
CREATE TABLE IF NOT EXISTS experience_counts (
 day TEXT NOT NULL, metric TEXT NOT NULL, subject TEXT NOT NULL,
 device TEXT NOT NULL, bucket INTEGER NOT NULL DEFAULT 0,
 amount INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,metric,subject,device,bucket)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS experience_seen (
 day TEXT NOT NULL, signature TEXT NOT NULL, metric TEXT NOT NULL,
 subject TEXT NOT NULL, device TEXT NOT NULL, bucket INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,signature)
) WITHOUT ROWID;
CREATE TRIGGER IF NOT EXISTS experience_count_after_seen AFTER INSERT ON experience_seen
BEGIN
 INSERT INTO experience_counts(day,metric,subject,device,bucket,amount)
 VALUES(NEW.day,NEW.metric,NEW.subject,NEW.device,NEW.bucket,1)
 ON CONFLICT(day,metric,subject,device,bucket) DO UPDATE SET amount=amount+1;
END;
