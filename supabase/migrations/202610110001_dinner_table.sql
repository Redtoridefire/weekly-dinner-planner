-- Run once in Supabase SQL Editor, or apply with supabase db push.
create table public.dinner_catalog (
 id text primary key, position integer not null unique, recipe jsonb not null
);
create table public.dinner_homes (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80),
 owner_id uuid not null references auth.users(id) on delete cascade,
 timezone text not null default 'America/New_York',
 servings integer not null default 4 check(servings between 1 and 20),
 dinners integer not null default 5 check(dinners between 1 and 7),
 preferences jsonb not null default '{"vegetarian":false,"quick":false}', created_at timestamptz not null default now()
);
create table public.dinner_members (
 home_id uuid not null references public.dinner_homes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, primary key(home_id,user_id)
);
create table public.dinner_weeks (
 id uuid primary key default gen_random_uuid(),home_id uuid not null references public.dinner_homes(id) on delete cascade,
 week_start date not null, servings integer not null check(servings between 1 and 20), dinners integer not null check(dinners between 1 and 7),
 preferences jsonb not null, locked_ids text[], pantry text[] not null default '{}', revision integer not null default 0,
 unique(home_id,week_start)
);
create table public.dinner_votes (
 week_id uuid not null references public.dinner_weeks(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, meal_ids text[] not null default '{}', primary key(week_id,user_id)
);
create table public.dinner_invites (
 token_hash text primary key,home_id uuid not null references public.dinner_homes(id) on delete cascade,
 expires_at timestamptz not null, remaining integer not null default 10 check(remaining>=0)
);
create index dinner_members_user_idx on public.dinner_members(user_id);
create index dinner_votes_user_idx on public.dinner_votes(user_id);
alter table public.dinner_catalog enable row level security;
alter table public.dinner_homes enable row level security;
alter table public.dinner_members enable row level security;
alter table public.dinner_weeks enable row level security;
alter table public.dinner_votes enable row level security;
alter table public.dinner_invites enable row level security;

create function public.dinner_is_member(home uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dinner_members where home_id=home and user_id=auth.uid());
$$;
create policy catalog_read on public.dinner_catalog for select to authenticated using(true);
create policy homes_read on public.dinner_homes for select to authenticated using(public.dinner_is_member(id));
create policy members_read on public.dinner_members for select to authenticated using(public.dinner_is_member(home_id));
create policy weeks_read on public.dinner_weeks for select to authenticated using(public.dinner_is_member(home_id));
create policy votes_read on public.dinner_votes for select to authenticated using(exists(select 1 from public.dinner_weeks w where w.id=week_id and public.dinner_is_member(w.home_id)));

create function public.dinner_current_week(home uuid) returns date language sql stable security definer set search_path='' as $$
 select date_trunc('week',now() at time zone timezone)::date from public.dinner_homes where id=home;
$$;
create function public.dinner_selected(week uuid) returns text[] language sql stable security definer set search_path='' as $$
 select coalesce(w.locked_ids,(select coalesce(array_agg(r.id order by r.score desc,r.position),'{}') from (
   select c.id,c.position,(select count(*) from public.dinner_votes v where v.week_id=w.id and c.id=any(v.meal_ids)) score
   from public.dinner_catalog c
   where (not (w.preferences->>'vegetarian')::boolean or (c.recipe->>'vegetarian')::boolean)
     and (not (w.preferences->>'quick')::boolean or (c.recipe->>'time')::integer<=30)
   order by score desc,c.position limit w.dinners
 ) r)) from public.dinner_weeks w where w.id=week;
$$;

create function public.dinner_households() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'timezone',h.timezone,'owner',h.owner_id=auth.uid()) order by h.created_at),'[]')
 from public.dinner_homes h where public.dinner_is_member(h.id);
$$;
create function public.dinner_create_household(household_name text,household_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
declare home uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 if length(trim(household_name)) not between 1 and 80 then raise exception 'Enter a household name of 1–80 characters.';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=household_timezone) then raise exception 'Choose a valid timezone.';end if;
 if (select count(*) from public.dinner_members where user_id=auth.uid())>=10 then raise exception 'Household limit reached.';end if;
 insert into public.dinner_homes(name,owner_id,timezone) values(trim(household_name),auth.uid(),household_timezone) returning id into home;
 insert into public.dinner_members values(home,auth.uid());return home;
end;$$;
create function public.dinner_invite(household_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if not exists(select 1 from public.dinner_homes where id=household_id and owner_id=auth.uid()) then raise exception 'Only the household owner can invite members.';end if;
 -- Rotate invitations: any previously issued codes are invalidated.
 delete from public.dinner_invites where home_id=household_id;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.dinner_invites(token_hash,home_id,expires_at) values(encode(sha256(convert_to(token,'UTF8')),'hex'),household_id,now()+interval '7 days');return token;
end;$$;
create function public.dinner_join_household(invite_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.dinner_invites;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 select * into invitation from public.dinner_invites where token_hash=encode(sha256(convert_to(trim(invite_token),'UTF8')),'hex') for update;
 if invitation.home_id is null or invitation.expires_at<now() or invitation.remaining<=0 then raise exception 'This invitation is invalid or expired. Ask the owner for a new code.';end if;
 if public.dinner_is_member(invitation.home_id) then return invitation.home_id;end if;
 if (select count(*) from public.dinner_members where user_id=auth.uid())>=10 then raise exception 'Household limit reached.';end if;
 if (select count(*) from public.dinner_members where home_id=invitation.home_id)>=20 then raise exception 'Household member limit reached.';end if;
 insert into public.dinner_members values(invitation.home_id,auth.uid());
 update public.dinner_invites set remaining=remaining-1 where token_hash=invitation.token_hash;return invitation.home_id;
end;$$;
create function public.dinner_snapshot(household_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare home public.dinner_homes;w public.dinner_weeks;start_date date;
begin
 if not public.dinner_is_member(household_id) then raise exception 'You do not belong to this household.';end if;
 select * into home from public.dinner_homes where id=household_id;
 start_date:=public.dinner_current_week(household_id);
 insert into public.dinner_weeks(home_id,week_start,servings,dinners,preferences) values(home.id,start_date,home.servings,home.dinners,home.preferences) on conflict(home_id,week_start) do nothing;
 select * into w from public.dinner_weeks where home_id=home.id and week_start=start_date for share;
 return jsonb_build_object('week',start_date,'owner',home.owner_id=auth.uid(),'memberCount',(select count(*) from public.dinner_members where home_id=home.id),'state',jsonb_build_object(
 'servings',w.servings,'dinners',w.dinners,'preferences',w.preferences,'revision',w.revision,'pantry',to_jsonb(w.pantry),
 'locked',case when w.locked_ids is null then null else jsonb_build_object('ids',w.locked_ids) end,
 'votes',(select coalesce(jsonb_object_agg(user_id::text,to_jsonb(meal_ids)),'{}') from public.dinner_votes where week_id=w.id)));
end;$$;
create function public.dinner_mutate(household_id uuid,expected_week date,expected_revision integer,action_name text,action_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.dinner_weeks;home public.dinner_homes;ids text[];item text;allowed boolean;new_preferences jsonb;new_servings integer;new_dinners integer;
begin
 if not public.dinner_is_member(household_id) then raise exception 'You do not belong to this household.';end if;
 if expected_week is distinct from public.dinner_current_week(household_id) then raise exception 'A new week has started. Refresh before making changes.';end if;
 select * into home from public.dinner_homes where id=household_id;
 select * into w from public.dinner_weeks where home_id=household_id and week_start=expected_week for update;
 if w.id is null then raise exception 'Refresh your household before making changes.';end if;
 if expected_revision is distinct from w.revision then raise exception 'The household changed while you were editing. Refresh and try again.';end if;
 if action_name in ('settings','finalize','reopen','reset') and home.owner_id is distinct from auth.uid() then raise exception 'Only the household owner can change the menu or settings.';end if;
 if w.locked_ids is not null and action_name not in ('pantry','reopen','reset') then raise exception 'The menu is finalized. Ask the owner to reopen voting.';end if;
 if action_name='vote' then
   item:=action_payload->>'id';
   if jsonb_typeof(action_payload->'enabled') is distinct from 'boolean' then raise exception 'Invalid vote.';end if;
   select exists(select 1 from public.dinner_catalog c where c.id=item and (not (w.preferences->>'vegetarian')::boolean or (c.recipe->>'vegetarian')::boolean) and (not (w.preferences->>'quick')::boolean or (c.recipe->>'time')::integer<=30)) into allowed;
   if not allowed then raise exception 'This meal does not match household preferences.';end if;
   select meal_ids into ids from public.dinner_votes where week_id=w.id and user_id=auth.uid();ids:=coalesce(ids,'{}');
   if (action_payload->>'enabled')::boolean then if not item=any(ids) then ids:=array_append(ids,item);end if;else ids:=array_remove(ids,item);end if;
   insert into public.dinner_votes values(w.id,auth.uid(),ids) on conflict(week_id,user_id) do update set meal_ids=excluded.meal_ids;
 elsif action_name='settings' then
   if jsonb_typeof(action_payload->'servings') is distinct from 'number' or jsonb_typeof(action_payload->'dinners') is distinct from 'number' or jsonb_typeof(action_payload->'preferences'->'vegetarian') is distinct from 'boolean' or jsonb_typeof(action_payload->'preferences'->'quick') is distinct from 'boolean' then raise exception 'Invalid household settings.';end if;
   if (action_payload->>'servings')::numeric<>trunc((action_payload->>'servings')::numeric) or (action_payload->>'dinners')::numeric<>trunc((action_payload->>'dinners')::numeric) then raise exception 'Settings must use whole numbers.';end if;
   new_servings:=(action_payload->>'servings')::integer;new_dinners:=(action_payload->>'dinners')::integer;
   if new_servings not between 1 and 20 or new_dinners not between 1 and 7 then raise exception 'Choose 1–20 people and 1–7 dinners.';end if;
   new_preferences:=jsonb_build_object('vegetarian',(action_payload->'preferences'->>'vegetarian')::boolean,'quick',(action_payload->'preferences'->>'quick')::boolean);
   update public.dinner_weeks set servings=new_servings,dinners=new_dinners,preferences=new_preferences where id=w.id;
   update public.dinner_homes set servings=new_servings,dinners=new_dinners,preferences=new_preferences where id=home.id;
 elsif action_name='finalize' then
   ids:=public.dinner_selected(w.id);if cardinality(ids)=0 then raise exception 'No meals match your preferences.';end if;
   update public.dinner_weeks set locked_ids=ids where id=w.id;
 elsif action_name='reopen' then update public.dinner_weeks set locked_ids=null where id=w.id;
 elsif action_name='pantry' then
   item:=action_payload->>'name';
   if jsonb_typeof(action_payload->'enabled') is distinct from 'boolean' then raise exception 'Invalid pantry change.';end if;
   if not exists(select 1 from public.dinner_catalog c cross join lateral jsonb_array_elements(c.recipe->'ingredients') i where c.id=any(public.dinner_selected(w.id)) and i->>0=item) then raise exception 'That ingredient is not on the current shopping list.';end if;
   ids:=w.pantry;if (action_payload->>'enabled')::boolean then if not item=any(ids) then ids:=array_append(ids,item);end if;else ids:=array_remove(ids,item);end if;
   update public.dinner_weeks set pantry=ids where id=w.id;
 elsif action_name='reset' then
   delete from public.dinner_votes where week_id=w.id;update public.dinner_weeks set locked_ids=null,pantry='{}' where id=w.id;
 else raise exception 'Unknown planner action.';end if;
 update public.dinner_weeks set revision=revision+1 where id=w.id;
 return public.dinner_snapshot(household_id);
end;$$;

revoke all on public.dinner_catalog,public.dinner_homes,public.dinner_members,public.dinner_weeks,public.dinner_votes,public.dinner_invites from anon,authenticated;
grant select on public.dinner_catalog,public.dinner_homes,public.dinner_members,public.dinner_weeks,public.dinner_votes to authenticated;
revoke all on function public.dinner_is_member(uuid),public.dinner_current_week(uuid),public.dinner_selected(uuid),public.dinner_households(),public.dinner_create_household(text,text),public.dinner_invite(uuid),public.dinner_join_household(text),public.dinner_snapshot(uuid),public.dinner_mutate(uuid,date,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.dinner_is_member(uuid),public.dinner_households(),public.dinner_create_household(text,text),public.dinner_invite(uuid),public.dinner_join_household(text),public.dinner_snapshot(uuid),public.dinner_mutate(uuid,date,integer,text,jsonb) to authenticated;

create function public.dinner_members_list(household_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.dinner_is_member(household_id) then raise exception 'You do not belong to this household.';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(split_part(u.email,'@',1),''),'Household member'),'owner',m.user_id=h.owner_id) order by m.user_id),'[]') from public.dinner_members m join public.dinner_homes h on h.id=m.home_id join auth.users u on u.id=m.user_id where m.home_id=household_id);
end;$$;
create function public.dinner_remove_member(household_id uuid,member_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare home public.dinner_homes;
begin
 if not public.dinner_is_member(household_id) then raise exception 'You do not belong to this household.';end if;
 select * into home from public.dinner_homes where id=household_id;
 if member_id=home.owner_id then raise exception 'The owner cannot leave. Delete the household instead.';end if;
 if home.owner_id is distinct from auth.uid() and member_id is distinct from auth.uid() then raise exception 'Only the owner can remove other members.';end if;
 perform 1 from public.dinner_weeks where home_id=household_id order by id for update;
 delete from public.dinner_votes where user_id=member_id and week_id in(select id from public.dinner_weeks where home_id=household_id);
 delete from public.dinner_members where home_id=household_id and user_id=member_id;
 update public.dinner_weeks set revision=revision+1 where home_id=household_id;
end;$$;
create function public.dinner_delete_household(household_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.dinner_homes where id=household_id and owner_id=auth.uid()) then raise exception 'Only the owner can delete this household.';end if;
 delete from public.dinner_homes where id=household_id;
end;$$;
revoke all on function public.dinner_members_list(uuid),public.dinner_remove_member(uuid,uuid),public.dinner_delete_household(uuid) from public,anon,authenticated;
grant execute on function public.dinner_members_list(uuid),public.dinner_remove_member(uuid,uuid),public.dinner_delete_household(uuid) to authenticated;

-- Prevent repeated authenticated requests from overwhelming the grocery API.
create table public.dinner_grocery_limits(home_id uuid primary key references public.dinner_homes(id) on delete cascade,last_attempt timestamptz not null,day date not null,attempts integer not null);
alter table public.dinner_grocery_limits enable row level security;
revoke all on public.dinner_grocery_limits from anon,authenticated;
create function public.dinner_reserve_grocery(household_id uuid,expected_week date,expected_revision integer) returns boolean language plpgsql security definer set search_path='' as $$
declare w public.dinner_weeks;success uuid;
begin
 if not public.dinner_is_member(household_id) then raise exception 'You do not belong to this household.';end if;
 if expected_week is distinct from public.dinner_current_week(household_id) then raise exception 'The menu changed. Refresh before creating a grocery link.';end if;
 select * into w from public.dinner_weeks where home_id=household_id and week_start=expected_week for share;
 if w.id is null or w.locked_ids is null or w.revision is distinct from expected_revision then raise exception 'The menu changed. Refresh before creating a grocery link.';end if;
 insert into public.dinner_grocery_limits(home_id,last_attempt,day,attempts) values(household_id,now(),current_date,1)
 on conflict(home_id) do update set last_attempt=now(),day=current_date,attempts=case when public.dinner_grocery_limits.day=current_date then public.dinner_grocery_limits.attempts+1 else 1 end
 where public.dinner_grocery_limits.last_attempt<now()-interval '30 seconds' and (public.dinner_grocery_limits.day<>current_date or public.dinner_grocery_limits.attempts<20)
 returning home_id into success;
 return success is not null;
end;$$;
revoke all on function public.dinner_reserve_grocery(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.dinner_reserve_grocery(uuid,date,integer) to authenticated;

-- Versioned starter recipes shared with model.js.
insert into public.dinner_catalog(id,position,recipe) values
('tacos',0,$recipe${"id":"tacos","name":"Smoky black bean tacos","emoji":"🌮","color":"#efe2c2","time":25,"vegetarian":true,"description":"Warm tortillas, smoky beans, crunchy cabbage, and a squeeze of lime.","ingredients":[["Black beans","cans",2],["Tortillas","pieces",8],["Cabbage","heads",0.5],["Limes","pieces",2],["Smoked paprika","tsp",2],["Olive oil","tbsp",1]],"steps":"Drain beans and warm with oil and paprika for 8 minutes. Slice cabbage. Warm tortillas and fill with beans and cabbage; finish with lime."}$recipe$::jsonb),
('chicken',1,$recipe${"id":"chicken","name":"Lemon sheet-pan chicken","emoji":"🍗","color":"#e4e9d2","time":45,"vegetarian":false,"description":"Golden chicken, roasted potatoes, and broccoli. One pan, happy people.","ingredients":[["Chicken thighs","g",700],["Potatoes","g",800],["Broccoli","heads",1],["Lemons","pieces",1],["Olive oil","tbsp",2],["Garlic","cloves",3]],"steps":"Heat oven to 425°F / 220°C. Cut potatoes small and toss with chicken, oil, garlic, and lemon. Roast 20 minutes, add broccoli, then roast until chicken reaches 165°F / 74°C, about 20 more minutes."}$recipe$::jsonb),
('pasta',2,$recipe${"id":"pasta","name":"Creamy tomato pasta","emoji":"🍝","color":"#f0dcd0","time":25,"vegetarian":true,"description":"A cozy tomato sauce with spinach and a little parmesan.","ingredients":[["Pasta","g",400],["Crushed tomatoes","cans",1],["Spinach","g",150],["Cream","ml",150],["Parmesan","g",60],["Garlic","cloves",2],["Olive oil","tbsp",1]],"steps":"Boil pasta according to the package. Sauté garlic in oil, add tomatoes and simmer 10 minutes. Stir in cream and spinach, then toss with pasta and parmesan."}$recipe$::jsonb),
('salmon',3,$recipe${"id":"salmon","name":"Teriyaki salmon bowls","emoji":"🍚","color":"#dce6e8","time":30,"vegetarian":false,"description":"Flaky salmon over rice, with cucumber and a sweet-savory glaze.","ingredients":[["Salmon","g",600],["Rice","g",300],["Cucumber","pieces",1],["Teriyaki sauce","ml",100],["Sesame seeds","tbsp",1]],"steps":"Cook rice according to the package. Brush salmon with teriyaki sauce and bake at 400°F / 200°C until it reaches 145°F / 63°C, about 12–15 minutes. Serve over rice with sliced cucumber and sesame."}$recipe$::jsonb),
('curry',4,$recipe${"id":"curry","name":"Coconut chickpea curry","emoji":"🍛","color":"#eee4bd","time":30,"vegetarian":true,"description":"Creamy coconut, chickpeas, and spinach. A weeknight comfort favorite.","ingredients":[["Chickpeas","cans",2],["Coconut milk","cans",1],["Spinach","g",150],["Rice","g",300],["Curry powder","tbsp",2],["Onion","pieces",1],["Olive oil","tbsp",1]],"steps":"Cook rice. Chop onion and sauté in oil until soft. Add curry powder, drained chickpeas, and coconut milk; simmer 15 minutes. Stir in spinach until wilted and serve with rice."}$recipe$::jsonb),
('burgers',5,$recipe${"id":"burgers","name":"Build-your-own burgers","emoji":"🍔","color":"#e7dbc9","time":30,"vegetarian":false,"description":"Classic burgers with crisp lettuce, tomatoes, and oven fries.","ingredients":[["Ground beef","g",600],["Burger buns","pieces",4],["Lettuce","heads",0.5],["Tomatoes","pieces",2],["Potatoes","g",800],["Olive oil","tbsp",2]],"steps":"Cut potatoes into thin fries, toss with oil and roast at 425°F / 220°C for 25–30 minutes. Form beef into patties and cook to 160°F / 71°C. Serve in buns with lettuce and tomato."}$recipe$::jsonb),
('stirfry',6,$recipe${"id":"stirfry","name":"Ginger tofu stir-fry","emoji":"🥦","color":"#dde7d3","time":25,"vegetarian":true,"description":"Crispy tofu, colorful vegetables, and a gingery soy sauce.","ingredients":[["Firm tofu","g",500],["Broccoli","heads",1],["Bell peppers","pieces",2],["Rice","g",300],["Soy sauce","ml",60],["Ginger","g",20],["Olive oil","tbsp",2]],"steps":"Cook rice. Pat tofu dry, cube and sauté in oil until golden. Add chopped broccoli and peppers; stir-fry until tender. Add grated ginger and soy sauce, heat through, and serve with rice."}$recipe$::jsonb),
('soup',7,$recipe${"id":"soup","name":"Rustic lentil soup","emoji":"🥣","color":"#e9ddcf","time":40,"vegetarian":true,"description":"A big pot of lentils and vegetables, with crusty bread for dipping.","ingredients":[["Dry lentils","g",300],["Carrots","pieces",3],["Onion","pieces",1],["Crushed tomatoes","cans",1],["Vegetable broth","ml",1200],["Bread","loaves",1],["Olive oil","tbsp",1]],"steps":"Chop onion and carrots; sauté in oil for 5 minutes. Add rinsed lentils, tomatoes and broth. Simmer 30 minutes or until lentils are tender. Serve with bread."}$recipe$::jsonb);
