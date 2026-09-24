-- Ensure OWNER and ADMIN roles have tenant.settings permission
-- (0012 added the permission row but omitted the role_permissions mapping)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('OWNER', 'ADMIN') AND p.name = 'tenant.settings'
ON CONFLICT DO NOTHING;
