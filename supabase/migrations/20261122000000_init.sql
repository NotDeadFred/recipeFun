-- RecipeFun schema: profiles, recipes, groups, shared cookbooks, saved sites, shopping list.
-- Row-level security makes the database itself enforce who can see what:
--   * You can always see and edit your own rows.
--   * Members of a group can see cookbooks shared with that group, and the recipes in them.
--   * Only a cookbook's owner can rename/delete it; any group member can add recipes to a shared cookbook.

create extension if not exists pgcrypto;

-- Profiles --------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Home Cook',
  unit_system text not null default 'us' check (unit_system in ('us', 'metric')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Groups ----------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- Security-definer helper avoids recursive RLS checks on group_members.
create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

create function public.add_group_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.add_group_owner();

-- Join by invite code without being able to list every group.
create function public.join_group(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into gid from public.groups where invite_code = upper(trim(code));
  if gid is null then raise exception 'No group found for that invite code'; end if;
  insert into public.group_members (group_id, user_id, role) values (gid, auth.uid(), 'member')
  on conflict do nothing;
  return gid;
end;
$$;

-- Cookbooks -------------------------------------------------------------------
create table public.cookbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  group_id uuid references public.groups (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_at timestamptz not null default now()
);

-- Recipes ---------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  image_url text,
  source_type text not null check (source_type in ('imported', 'manual', 'claude')),
  source_url text,
  source_name text,
  servings int not null default 4,
  prep_minutes int,
  cook_minutes int,
  total_minutes int,
  cuisine text,
  tags text[] not null default '{}',
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_owner_idx on public.recipes (owner_id);

create table public.cookbook_recipes (
  cookbook_id uuid not null references public.cookbooks (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  added_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (cookbook_id, recipe_id)
);

create function public.can_view_cookbook(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cookbooks c
    where c.id = cid
      and (c.owner_id = auth.uid() or (c.group_id is not null and public.is_group_member(c.group_id)))
  );
$$;

create function public.can_view_recipe(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.recipes r where r.id = rid and r.owner_id = auth.uid())
      or exists (
        select 1 from public.cookbook_recipes cr
        where cr.recipe_id = rid and public.can_view_cookbook(cr.cookbook_id)
      );
$$;

-- Saved sites & shopping list --------------------------------------------------
create table public.saved_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  url text not null,
  search_url text,
  created_at timestamptz not null default now()
);

create table public.shopping_lists (
  owner_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Row-level security ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.cookbooks enable row level security;
alter table public.recipes enable row level security;
alter table public.cookbook_recipes enable row level security;
alter table public.saved_sites enable row level security;
alter table public.shopping_lists enable row level security;

-- Profiles: see yourself and people who share a group with you; edit only yourself.
create policy "profiles read" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy "profiles update self" on public.profiles for update using (id = auth.uid());

-- Groups
create policy "groups read members" on public.groups for select using (public.is_group_member(id) or owner_id = auth.uid());
create policy "groups create" on public.groups for insert with check (owner_id = auth.uid());
create policy "groups owner update" on public.groups for update using (owner_id = auth.uid());
create policy "groups owner delete" on public.groups for delete using (owner_id = auth.uid());

create policy "members read" on public.group_members for select using (public.is_group_member(group_id));
create policy "members leave" on public.group_members for delete using (
  user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
);

-- Cookbooks
create policy "cookbooks read" on public.cookbooks for select using (public.can_view_cookbook(id));
create policy "cookbooks create" on public.cookbooks for insert with check (
  owner_id = auth.uid() and (group_id is null or public.is_group_member(group_id))
);
create policy "cookbooks owner update" on public.cookbooks for update using (owner_id = auth.uid())
  with check (group_id is null or public.is_group_member(group_id));
create policy "cookbooks owner delete" on public.cookbooks for delete using (owner_id = auth.uid());

create policy "cookbook recipes read" on public.cookbook_recipes for select using (public.can_view_cookbook(cookbook_id));
create policy "cookbook recipes add" on public.cookbook_recipes for insert with check (
  added_by = auth.uid() and public.can_view_cookbook(cookbook_id) and public.can_view_recipe(recipe_id)
);
create policy "cookbook recipes remove" on public.cookbook_recipes for delete using (
  added_by = auth.uid() or exists (select 1 from public.cookbooks c where c.id = cookbook_id and c.owner_id = auth.uid())
);

-- Recipes: owners have full control; shared recipes are read-only to group members.
create policy "recipes read" on public.recipes for select using (public.can_view_recipe(id));
create policy "recipes create" on public.recipes for insert with check (owner_id = auth.uid());
create policy "recipes owner update" on public.recipes for update using (owner_id = auth.uid());
create policy "recipes owner delete" on public.recipes for delete using (owner_id = auth.uid());

-- Personal tables
create policy "sites own" on public.saved_sites for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "shopping own" on public.shopping_lists for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
