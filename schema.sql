-- MOiNA AI website: tables, RLS, storage. Run in Supabase SQL Editor.
create table admin_profiles(id uuid primary key references auth.users on delete cascade, created_at timestamptz default now());
-- Admin = listed in admin_profiles AND signed in with MFA (aal2). Role is never taken from user input.
create or replace function is_admin() returns boolean language sql security definer stable set search_path=public as
$$ select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from admin_profiles where id=auth.uid()) $$;
create table app_settings(key text primary key, value jsonb not null default 'null', updated_at timestamptz default now());
create table website_content(key text primary key, value text not null default '', updated_at timestamptz default now());
create table app_releases(id uuid primary key default gen_random_uuid(), platform text not null check(platform in('android','ios')),
 version text not null, notes text default '', file_path text, file_size bigint, min_os text, store_url text, testflight_url text,
 is_published boolean not null default false, is_latest boolean not null default false, released_at timestamptz default now(), unique(platform,version));
create table app_features(id uuid primary key default gen_random_uuid(), title text not null, description text default '', sort int default 0, is_published boolean default true);
create table app_screenshots(id uuid primary key default gen_random_uuid(), url text not null, platform text default 'android', sort int default 0, is_published boolean default true);
create table download_statistics(id bigserial primary key, release_id uuid references app_releases on delete set null,
 platform text check(platform in('android','ios','web')), event text not null check(event in('visit','request','completed')), created_at timestamptz default now());
create table faq_items(id uuid primary key default gen_random_uuid(), question text not null, answer text not null, sort int default 0, is_published boolean default true);
create table contact_messages(id uuid primary key default gen_random_uuid(), name text check(char_length(name)<=100), email text check(char_length(email)<=200), message text check(char_length(message)<=3000), created_at timestamptz default now());
create table admin_activity_logs(id bigserial primary key, admin_id uuid default auth.uid(), action text not null, detail text, created_at timestamptz default now());
create table social_links(id uuid primary key default gen_random_uuid(), label text not null, url text not null, sort int default 0);
create index on app_releases(platform,is_published,released_at desc);
create index on download_statistics(event,platform,created_at);

do $$ declare t text; begin
 foreach t in array array['admin_profiles','app_settings','website_content','app_releases','app_features','app_screenshots','download_statistics','faq_items','contact_messages','admin_activity_logs','social_links']
 loop execute format('alter table %I enable row level security',t); end loop; end $$;

create policy own_profile on admin_profiles for select using(id=auth.uid());   -- no insert/update/delete from clients
do $$ declare t text; begin
 foreach t in array array['app_settings','website_content','social_links'] loop
  execute format('create policy pub_read on %I for select using(true)',t);
  execute format('create policy admin_all on %I for all using(is_admin()) with check(is_admin())',t); end loop;
 foreach t in array array['app_features','app_screenshots','faq_items','app_releases'] loop
  execute format('create policy pub_read on %I for select using(is_published)',t);
  execute format('create policy admin_all on %I for all using(is_admin()) with check(is_admin())',t); end loop;
end $$;
create policy stats_insert on download_statistics for insert with check(event in('visit','request','completed'));
create policy stats_admin on download_statistics for select using(is_admin());
create policy msg_insert on contact_messages for insert with check(true);
create policy msg_admin on contact_messages for select using(is_admin());
create policy msg_admin_del on contact_messages for delete using(is_admin());
create policy log_admin_read on admin_activity_logs for select using(is_admin());
create policy log_admin_ins on admin_activity_logs for insert with check(is_admin() and admin_id=auth.uid());

create or replace function set_latest(rid uuid) returns void language plpgsql security definer set search_path=public as $$
declare p text; begin if not is_admin() then raise exception 'forbidden'; end if;
 select platform into p from app_releases where id=rid;
 update app_releases set is_latest=false where platform=p;
 update app_releases set is_latest=true,is_published=true where id=rid; end $$;

insert into app_settings(key,value) values('android_enabled','true'),('ios_enabled','true'),('maintenance','false'),('accent','"#5b6cff"') on conflict do nothing;
insert into website_content(key,value) values('site_title','MOiNA AI'),('hero_title','Meet Your Intelligent AI Companion'),('hero_subtitle',''),('description',''),
 ('about',''),('privacy',''),('terms',''),('support_contact',''),('footer_text',''),('seo_title','MOiNA AI'),('seo_description','') on conflict do nothing;

-- Storage
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('app-releases','app-releases',false,524288000,null),
 ('website-assets','website-assets',true,10485760,array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon']),
 ('app-screenshots','app-screenshots',true,10485760,array['image/png','image/jpeg','image/webp']),
 ('promotional-media','promotional-media',true,52428800,array['image/png','image/jpeg','image/webp','video/mp4','video/webm']) on conflict do nothing;
create policy pub_assets_read on storage.objects for select using(bucket_id in('website-assets','app-screenshots','promotional-media'));
-- APK is private; anyone may fetch a signed URL only for a PUBLISHED release's file.
create policy apk_read on storage.objects for select using(bucket_id='app-releases' and (is_admin() or exists(select 1 from public.app_releases r where r.file_path=name and r.is_published)));
create policy admin_write on storage.objects for insert with check(is_admin() and bucket_id in('app-releases','website-assets','app-screenshots','promotional-media') and (bucket_id<>'app-releases' or lower(name) like '%.apk'));
create policy admin_update on storage.objects for update using(is_admin());
create policy admin_delete on storage.objects for delete using(is_admin());

-- FIRST ADMIN (no password in code):
-- 1) Dashboard > Authentication > Users > Add user (your email + strong password). Turn OFF "Allow new users to sign up".
-- 2) Run:  insert into admin_profiles(id) select id from auth.users where email='YOUR_EMAIL';
-- 3) Log in on the site; first time you scan a QR code with Google Authenticator.
