-- ============================================================================
-- ESG Astraa HRMS — Personal (1-on-1) chat + attachments
-- - recipient_id: null = global/department message; set = direct message.
-- - attachments: files/images shared in a message.
-- - DMs are private to sender + recipient (NOT even admins can read them).
-- ============================================================================

alter table public.messages
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade;
alter table public.messages
  add column if not exists attachments jsonb;

create index if not exists idx_messages_dm
  on public.messages (recipient_id, sender_id, created_at);

-- Read: global → everyone; department → same dept/admin; DM → the two people only.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    case
      when recipient_id is not null then
        (sender_id = auth.uid() or recipient_id = auth.uid())
      when department is not null then
        (public.is_admin() or department = public.my_department())
      else true
    end
  );

-- Post: must be you + chat enabled; DM to anyone (not yourself); dept only your dept.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or coalesce((select can_chat from public.profiles where id = auth.uid()), false)
    )
    and (
      case
        when recipient_id is not null then recipient_id <> auth.uid()
        when department is not null then department = public.my_department()
        else true
      end
    )
  );

-- Public bucket for chat attachments (unguessable UUID paths).
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', true)
on conflict (id) do nothing;

drop policy if exists chat_files_read on storage.objects;
create policy chat_files_read on storage.objects
  for select using (bucket_id = 'chat-files');
drop policy if exists chat_files_write on storage.objects;
create policy chat_files_write on storage.objects
  for insert with check (bucket_id = 'chat-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists chat_files_delete on storage.objects;
create policy chat_files_delete on storage.objects
  for delete using (bucket_id = 'chat-files' and (storage.foldername(name))[1] = auth.uid()::text);
