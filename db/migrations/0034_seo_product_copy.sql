-- Owner-approved display spelling. Product IDs, English names, commercial
-- values and historical order snapshots are intentionally not rewritten.
UPDATE products SET
 name=replace(name,'كوسركس','كوزركس'),
 description=replace(description,'كوسركس','كوزركس'),
 details_json=replace(details_json,'كوسركس','كوزركس'),
 updated_at=datetime('now')
WHERE instr(name,'كوسركس')>0 OR instr(description,'كوسركس')>0
 OR instr(details_json,'كوسركس')>0;
