begin;

select plan(4);

select has_policy(
  'public',
  'lms_operation_receipts',
  'No direct LMS operation receipt access',
  'operation receipts have an explicit browser-role denial policy'
);

select is(
  has_table_privilege('anon', 'public.lms_operation_receipts', 'SELECT'),
  false,
  'anonymous users cannot read operation receipts'
);

select is(
  has_table_privilege('authenticated', 'public.lms_operation_receipts', 'SELECT'),
  false,
  'authenticated users cannot read operation receipts'
);

select ok(
  not has_table_privilege('authenticated', 'public.lms_operation_receipts', 'INSERT')
  and not has_table_privilege('authenticated', 'public.lms_operation_receipts', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.lms_operation_receipts', 'DELETE'),
  'authenticated users cannot mutate operation receipts'
);

select * from finish();
rollback;
