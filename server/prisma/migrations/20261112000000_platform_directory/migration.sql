CREATE TABLE platforms (
 code TEXT PRIMARY KEY, name TEXT NOT NULL, "group" TEXT NOT NULL DEFAULT 'Другие', color TEXT NOT NULL DEFAULT '#64748b', text_color TEXT NOT NULL DEFAULT '#ffffff', description TEXT NOT NULL DEFAULT '', created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO platforms (code,name,"group",color,text_color) VALUES
('PS1','PlayStation 1','PlayStation','#4b5563','#f9fafb'),
('PS2','PlayStation 2','PlayStation','#003791','#ffffff'),
('PS3','PlayStation 3','PlayStation','#374151','#f9fafb'),
('PS4','PlayStation 4','PlayStation','#0070d1','#ffffff'),
('PS5','PlayStation 5','PlayStation','#2563eb','#ffffff'),
('Xbox Original','Xbox Original','Xbox','#107c10','#ffffff'),
('Xbox 360','Xbox 360','Xbox','#8dc63f','#172013'),
('Xbox One','Xbox One','Xbox','#0e5c2f','#ffffff'),
('Xbox Series S','Xbox Series S','Xbox','#107c10','#ffffff'),
('Xbox Series X','Xbox Series X','Xbox','#1f2937','#bef264'),
('Nintendo Switch','Nintendo Switch','Nintendo','#e60012','#ffffff'),
('Nintendo Switch 2','Nintendo Switch 2','Nintendo','#b80010','#ffffff');
INSERT INTO platforms(code,name) SELECT DISTINCT platform, platform FROM editions WHERE platform NOT IN (SELECT code FROM platforms) ON CONFLICT DO NOTHING;
ALTER TABLE editions ADD CONSTRAINT editions_platform_fkey FOREIGN KEY(platform) REFERENCES platforms(code) ON DELETE RESTRICT ON UPDATE CASCADE;
