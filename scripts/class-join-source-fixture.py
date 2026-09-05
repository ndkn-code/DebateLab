"""Load production authorization/trigger bodies into the minimal local DB fixture."""
from pathlib import Path
import re
import sys
root = Path(__file__).resolve().parents[1]
sources = {
    '20260830150100_unified_organization_backend.sql': [
        'organization_is_admin', 'can_manage_class', 'enforce_class_organization_scope',
    ],
    '20260902140000_head_teacher_role.sql': ['organization_role', 'organization_can_manage_class'],
    '20260829050000_class_transaction_operations.sql': ['write_class_operation_audit'],
}
for name, functions in sources.items():
    text = (root / 'supabase/migrations' / name).read_text()
    for function in functions:
        match = re.search(r'create or replace function private\.' + function + r'\s*\(.*?\$\$;', text, re.S | re.I)
        if not match:
            sys.exit(f'Missing production function: {function}')
        print(match.group(0))
