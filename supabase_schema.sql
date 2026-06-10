-- ══════════════════════════════════════════════════════════════════
--  YAPS MUSIC — Supabase Schema
--  Run this entire file in: Supabase Dashboard → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════════

-- ── PROFILES ────────────────────────────────────────────────────
-- Extends auth.users with public artist profile data
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  bio           text,
  avatar_url    text,
  follower_count bigint default 0,
  created_at    timestamptz default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ── TRACKS ──────────────────────────────────────────────────────
create table if not exists tracks (
  id             bigint generated always as identity primary key,
  title          text not null,
  artist_name    text,
  artist_id      uuid references auth.users(id) on delete set null,
  genre          text,
  audio_url      text,          -- Supabase Storage public URL
  artwork_url    text,          -- Supabase Storage public URL
  duration_label text,          -- e.g. "3:42"
  duration_secs  int,           -- raw seconds for sorting
  tags           text[],        -- e.g. ['Uganda','Trending','Afrobeats']
  play_count     bigint default 0,
  like_count     bigint default 0,
  is_public      boolean default true,
  created_at     timestamptz default now()
);

-- Fast atomic play-count increment (called via .rpc)
create or replace function increment_play_count(track_id bigint)
returns void language sql security definer as $$
  update tracks set play_count = play_count + 1 where id = track_id;
$$;


-- ── TRACK LIKES ─────────────────────────────────────────────────
create table if not exists track_likes (
  track_id  bigint references tracks(id) on delete cascade,
  user_id   uuid   references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (track_id, user_id)
);

-- Keep like_count in sync automatically
create or replace function sync_like_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update tracks set like_count = like_count + 1 where id = NEW.track_id;
  elsif TG_OP = 'DELETE' then
    update tracks set like_count = greatest(like_count - 1, 0) where id = OLD.track_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_like_insert on track_likes;
create trigger trg_like_insert after insert on track_likes
  for each row execute procedure sync_like_count();

drop trigger if exists trg_like_delete on track_likes;
create trigger trg_like_delete after delete on track_likes
  for each row execute procedure sync_like_count();


-- ── PLAYLISTS ───────────────────────────────────────────────────
create table if not exists playlists (
  id          text primary key,           -- client-generated UUID
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  track_ids   bigint[],
  is_public   boolean default false,
  updated_at  timestamptz default now()
);


-- ── FOLLOWS ─────────────────────────────────────────────────────
create table if not exists follows (
  follower_id uuid references auth.users(id) on delete cascade,
  followee_id uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (follower_id, followee_id)
);

-- Keep follower_count in sync
create or replace function sync_follower_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update profiles set follower_count = follower_count + 1 where id = NEW.followee_id;
  elsif TG_OP = 'DELETE' then
    update profiles set follower_count = greatest(follower_count - 1, 0) where id = OLD.followee_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_follow_insert on follows;
create trigger trg_follow_insert after insert on follows
  for each row execute procedure sync_follower_count();

drop trigger if exists trg_follow_delete on follows;
create trigger trg_follow_delete after delete on follows
  for each row execute procedure sync_follower_count();


-- ── NOTIFICATIONS ───────────────────────────────────────────────
create table if not exists notifications (
  id           bigint generated always as identity primary key,
  recipient_id uuid references auth.users(id) on delete cascade,
  sender_id    uuid references auth.users(id) on delete set null,
  type         text,     -- 'like' | 'follow' | 'comment' | 'repost'
  message      text,
  track_id     bigint references tracks(id) on delete cascade,
  read         boolean default false,
  created_at   timestamptz default now()
);


-- ── MESSAGES ────────────────────────────────────────────────────
create table if not exists messages (
  id           bigint generated always as identity primary key,
  thread_id    text not null,
  sender_id    uuid references auth.users(id) on delete cascade,
  sender_name  text,
  recipient_id uuid references auth.users(id) on delete cascade,
  text         text not null,
  read         boolean default false,
  created_at   timestamptz default now()
);


-- ══════════════════════════════════════════════════════════════
--  ROW-LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

-- profiles
alter table profiles enable row level security;
create policy "public read profiles"   on profiles for select using (true);
create policy "owner update profile"   on profiles for update using (auth.uid() = id);

-- tracks
alter table tracks enable row level security;
create policy "public read tracks"     on tracks for select using (is_public = true);
create policy "artist insert track"    on tracks for insert with check (auth.uid() = artist_id);
create policy "artist update track"    on tracks for update using (auth.uid() = artist_id);
create policy "artist delete track"    on tracks for delete using (auth.uid() = artist_id);

-- track_likes
alter table track_likes enable row level security;
create policy "public read likes"      on track_likes for select using (true);
create policy "user manage likes"      on track_likes using (auth.uid() = user_id);
create policy "user insert like"       on track_likes for insert with check (auth.uid() = user_id);

-- playlists
alter table playlists enable row level security;
create policy "owner manage playlist"  on playlists using (auth.uid() = user_id);
create policy "public read playlist"   on playlists for select using (is_public = true or auth.uid() = user_id);

-- follows
alter table follows enable row level security;
create policy "public read follows"    on follows for select using (true);
create policy "user manage follows"    on follows using (auth.uid() = follower_id);
create policy "user insert follow"     on follows for insert with check (auth.uid() = follower_id);

-- notifications
alter table notifications enable row level security;
create policy "recipient read notifs"  on notifications for select using (auth.uid() = recipient_id);
create policy "recipient update notif" on notifications for update using (auth.uid() = recipient_id);

-- messages
alter table messages enable row level security;
create policy "participant read msgs"  on messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "sender insert msg"      on messages for insert
  with check (auth.uid() = sender_id);


-- ══════════════════════════════════════════════════════════════
--  REALTIME
--  Enable in: Supabase Dashboard → Database → Replication
--  Toggle ON for: tracks, notifications, messages
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
--  STORAGE BUCKETS  (create manually in Dashboard → Storage)
--  1. "audio"   — public bucket, for MP3/M4A uploads
--  2. "artwork" — public bucket, for cover image uploads
--
--  Bucket policies (add in Dashboard → Storage → Policies):
--    audio:   SELECT public, INSERT authenticated
--    artwork: SELECT public, INSERT authenticated
-- ══════════════════════════════════════════════════════════════
