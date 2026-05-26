update public.smart_popup_campaigns
set
  copy_en = replace(copy_en::text, 'DebateLab', 'Thinkfy')::jsonb,
  copy_vi = replace(copy_vi::text, 'DebateLab', 'Thinkfy')::jsonb,
  updated_at = now()
where copy_en::text ilike '%DebateLab%'
   or copy_vi::text ilike '%DebateLab%';
