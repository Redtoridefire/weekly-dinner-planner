-- Additive upgrade: apply after 202610110001. Existing finalized menus are kept.
create table public.dinner_pricebook(name text primary key,unit text not null,offers jsonb not null);
alter table public.dinner_pricebook enable row level security;
create policy pricebook_read on public.dinner_pricebook for select to authenticated using(true);
revoke all on public.dinner_pricebook from anon,authenticated;
grant select on public.dinner_pricebook to authenticated;
alter table public.dinner_homes add column planning jsonb not null default '{"strategy":"votes","budget":0,"prices":{}}';
alter table public.dinner_weeks add column planning jsonb not null default '{"strategy":"votes","budget":0,"prices":{}}';
create function public.dinner_week_planning() returns trigger language plpgsql security definer set search_path='' as $$
begin select planning into new.planning from public.dinner_homes where id=new.home_id;return new;end;$$;
create trigger dinner_week_planning before insert on public.dinner_weeks for each row execute function public.dinner_week_planning();
revoke all on function public.dinner_week_planning() from public,anon,authenticated;

create function public.dinner_package_cost(amount numeric,offers jsonb) returns numeric language sql immutable set search_path='' as $$
 with a as(select (offers->0->>'size')::numeric size,(offers->0->>'price')::numeric price),
 b as(select (offers->1->>'size')::numeric size,(offers->1->>'price')::numeric price),
 packages as(select least(a.size,b.size) small_size,greatest(a.size,b.size) big_size,
 case when a.size<=b.size then a.price else b.price end small_price,
 case when a.size<=b.size then b.price else a.price end big_price from a,b)
 select min(i*big_price+ceil(greatest(amount-i*big_size,0)/small_size)*small_price)
 from packages cross join lateral generate_series(0,ceil(amount/big_size)::integer) i;
$$;

create or replace function public.dinner_selected(week uuid) returns text[] language plpgsql stable security definer set search_path='' as $$
declare w public.dinner_weeks;winner text[];mode text;budget numeric;wanted integer;
begin
 select * into w from public.dinner_weeks where id=week;
 if w.locked_ids is not null then return w.locked_ids;end if;
 mode:=w.planning->>'strategy';budget:=(w.planning->>'budget')::numeric;
 if mode='votes' then
   return (select coalesce(array_agg(x.id order by x.score desc,x.position),'{}') from (
     select c.id,c.position,(select count(*) from public.dinner_votes v where v.week_id=w.id and c.id=any(v.meal_ids)) score
     from public.dinner_catalog c where (not (w.preferences->>'vegetarian')::boolean or (c.recipe->>'vegetarian')::boolean)
     and (not (w.preferences->>'quick')::boolean or (c.recipe->>'time')::integer<=30)
     and (not coalesce((w.preferences->>'keto')::boolean,false) or coalesce((c.recipe->>'keto')::boolean,false))
     order by score desc,c.position limit w.dinners
   ) x);
 end if;
 select least(w.dinners,count(*)::integer) into wanted from public.dinner_catalog c
 where (not (w.preferences->>'vegetarian')::boolean or (c.recipe->>'vegetarian')::boolean)
 and (not (w.preferences->>'quick')::boolean or (c.recipe->>'time')::integer<=30)
 and (not coalesce((w.preferences->>'keto')::boolean,false) or coalesce((c.recipe->>'keto')::boolean,false));
 with recursive pool as materialized (
   select c.id,c.position,row_number() over(order by c.position) idx,
   (select count(*) from public.dinner_votes v where v.week_id=w.id and c.id=any(v.meal_ids)) score
   from public.dinner_catalog c where (not (w.preferences->>'vegetarian')::boolean or (c.recipe->>'vegetarian')::boolean)
   and (not (w.preferences->>'quick')::boolean or (c.recipe->>'time')::integer<=30)
   and (not coalesce((w.preferences->>'keto')::boolean,false) or coalesce((c.recipe->>'keto')::boolean,false))
 ), combinations(ids,positions,last_idx,score) as (
   select '{}'::text[],'{}'::integer[],0::bigint,0::bigint
   union all select array_append(x.ids,p.id),array_append(x.positions,p.position),p.idx,x.score+p.score
   from combinations x join pool p on p.idx>x.last_idx
   where cardinality(x.ids)<wanted and p.idx<=(select count(*) from pool)-(wanted-cardinality(x.ids)-1)
 ), plans as materialized(select ids,positions,score from combinations where cardinality(ids)=wanted),
 requirements as materialized (
   select p.ids,i->>0 name,sum((i->>2)::numeric*w.servings/4) amount
   from plans p join public.dinner_catalog c on c.id=any(p.ids)
   cross join lateral jsonb_array_elements(c.recipe->'ingredients') i
   where not (i->>0)=any(w.pantry) group by p.ids,i->>0
 ), price_cases as materialized(select distinct name,amount from requirements),
 quotes as materialized(
   select x.name,x.amount,public.dinner_package_cost(x.amount,coalesce(w.planning->'prices'->x.name,b.offers)) cost
   from price_cases x join public.dinner_pricebook b on b.name=x.name
 ), totals as (
   select p.ids,p.positions,p.score,coalesce(sum(q.cost),0) cost from plans p
   left join requirements r on r.ids=p.ids left join quotes q on q.name=r.name and q.amount=r.amount
   group by p.ids,p.positions,p.score
 ) select ids into winner from totals
 order by case when mode='balanced' and budget>0 and cost>budget then 1 else 0 end,
 case when mode='balanced' and (budget=0 or cost<=budget) then score end desc nulls last,
 cost,score desc,positions limit 1;
 return (select coalesce(array_agg(c.id order by (select count(*) from public.dinner_votes v where v.week_id=w.id and c.id=any(v.meal_ids)) desc,c.position),'{}') from public.dinner_catalog c where c.id=any(winner));
end;$$;
revoke all on function public.dinner_package_cost(numeric,jsonb) from public,anon,authenticated;

alter function public.dinner_snapshot(uuid) rename to dinner_snapshot_v1;
revoke all on function public.dinner_snapshot_v1(uuid) from public,anon,authenticated;
create function public.dinner_snapshot(household_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;planning jsonb;
begin
 result:=public.dinner_snapshot_v1(household_id);
 select w.planning into planning from public.dinner_weeks w where w.home_id=household_id and w.week_start=(result->>'week')::date;
 return jsonb_set(result,'{state}',(result->'state')||planning)||jsonb_build_object('schemaVersion',2);
end;$$;
revoke all on function public.dinner_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.dinner_snapshot(uuid) to authenticated;

alter function public.dinner_mutate(uuid,date,integer,text,jsonb) rename to dinner_mutate_v1;
revoke all on function public.dinner_mutate_v1(uuid,date,integer,text,jsonb) from public,anon,authenticated;
create function public.dinner_mutate(household_id uuid,expected_week date,expected_revision integer,action_name text,action_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.dinner_weeks;home public.dinner_homes;mode text;budget numeric;new_planning jsonb;offers jsonb;normalized_offers jsonb;keto boolean;item text;
begin
 if not public.dinner_is_member(household_id) then raise exception 'You do not belong to this household.';end if;
 if expected_week is distinct from public.dinner_current_week(household_id) then raise exception 'A new week has started. Refresh before making changes.';end if;
 select * into home from public.dinner_homes where id=household_id;
 select * into w from public.dinner_weeks where home_id=household_id and week_start=expected_week for update;
 if w.id is null then raise exception 'Refresh your household before making changes.';end if;
 if expected_revision is distinct from w.revision then raise exception 'The household changed while you were editing. Refresh and try again.';end if;
 if action_name='vote' and coalesce((w.preferences->>'keto')::boolean,false) and not exists(select 1 from public.dinner_catalog where id=action_payload->>'id' and coalesce((recipe->>'keto')::boolean,false)) then raise exception 'This meal does not match household preferences.';end if;
 if action_name in ('prices','settings') then
   if home.owner_id is distinct from auth.uid() then raise exception 'Only the household owner can change prices or settings.';end if;
   if w.locked_ids is not null then raise exception 'The menu is finalized. Reopen voting before changing prices or settings.';end if;
 end if;
 if action_name='prices' then
   item:=action_payload->>'name';offers:=action_payload->'offers';
   if not exists(select 1 from public.dinner_pricebook where name=item) then raise exception 'Unknown ingredient.';end if;
   if jsonb_typeof(offers) is distinct from 'array' then raise exception 'Enter two valid package offers.';end if;
   if jsonb_array_length(offers)<>2 then raise exception 'Enter two valid package offers.';end if;
   if exists(select 1 from jsonb_array_elements(offers) o where jsonb_typeof(o->'label') is distinct from 'string' or length(trim(o->>'label')) not between 1 and 40 or jsonb_typeof(o->'size') is distinct from 'number' or jsonb_typeof(o->'price') is distinct from 'number') then raise exception 'Enter valid labels, package sizes, and prices.';end if;
   if exists(select 1 from jsonb_array_elements(offers) o where (o->>'size')::numeric not between 1 and 100000 or (o->>'price')::numeric not between 0 and 10000 or (o->>'price')::numeric<>round((o->>'price')::numeric,2)) then raise exception 'Use positive sizes and prices from $0 to $10,000 with two decimal places.';end if;
   select jsonb_agg(jsonb_build_object('label',trim(o->>'label'),'size',(o->>'size')::numeric,'price',(o->>'price')::numeric) order by idx) into normalized_offers from jsonb_array_elements(offers) with ordinality x(o,idx);
   update public.dinner_weeks set planning=jsonb_set(planning,array['prices',item],normalized_offers),revision=revision+1 where id=w.id;
   update public.dinner_homes set planning=jsonb_set(planning,array['prices',item],normalized_offers) where id=home.id;
 elsif action_name='settings' then
   mode:=coalesce(action_payload->>'strategy',w.planning->>'strategy');
   if mode not in ('votes','balanced','cheapest') then raise exception 'Choose a valid savings mode.';end if;
   if action_payload ? 'budget' then
     if jsonb_typeof(action_payload->'budget') is distinct from 'number' then raise exception 'Enter a valid grocery budget.';end if;
     budget:=(action_payload->>'budget')::numeric;
   else budget:=(w.planning->>'budget')::numeric;end if;
   if budget not between 0 and 10000 or budget<>round(budget,2) then raise exception 'Use a budget from $0 to $10,000 with two decimal places.';end if;
   if action_payload->'preferences' ? 'keto' and jsonb_typeof(action_payload->'preferences'->'keto') is distinct from 'boolean' then raise exception 'Invalid keto preference.';end if;
   keto:=coalesce((action_payload->'preferences'->>'keto')::boolean,false);
   perform public.dinner_mutate_v1(household_id,expected_week,expected_revision,action_name,action_payload);
   new_planning:=jsonb_set(jsonb_set(w.planning,'{strategy}',to_jsonb(mode)),'{budget}',to_jsonb(budget));
   update public.dinner_weeks set planning=new_planning,preferences=jsonb_set(preferences,'{keto}',to_jsonb(keto)) where id=w.id;
   update public.dinner_homes set planning=new_planning,preferences=jsonb_set(preferences,'{keto}',to_jsonb(keto)) where id=home.id;
 else perform public.dinner_mutate_v1(household_id,expected_week,expected_revision,action_name,action_payload);end if;
 return public.dinner_snapshot(household_id);
end;$$;
revoke all on function public.dinner_mutate(uuid,date,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.dinner_mutate(uuid,date,integer,text,jsonb) to authenticated;

-- Seven additional keto-style recipes.
insert into public.dinner_catalog(id,position,recipe) values
('keto-eggs',8,$recipe${"id":"keto-eggs","name":"Cheesy cabbage & egg skillet","emoji":"🍳","color":"#e9e4c9","time":20,"vegetarian":true,"keto":true,"description":"An economical one-pan dinner of tender cabbage, eggs, and melted cheddar.","ingredients":[["Eggs","pieces",8],["Cabbage","heads",0.5],["Cheddar","g",100],["Butter","g",30]],"steps":"Thinly slice cabbage and sauté in butter until tender, about 10 minutes. Add beaten eggs and cook until set and the egg dish reaches 160°F / 71°C. Finish with cheddar. Choose cheese made with vegetarian rennet if needed."}$recipe$::jsonb),
('keto-frittata',9,$recipe${"id":"keto-frittata","name":"Broccoli cheddar frittata","emoji":"🥚","color":"#dfe7cf","time":30,"vegetarian":true,"keto":true,"description":"A filling, low-carb egg bake with broccoli and cheddar.","ingredients":[["Eggs","pieces",8],["Broccoli","heads",1],["Cheddar","g",120],["Cream","ml",100],["Butter","g",20]],"steps":"Heat oven to 400°F / 200°C. Chop broccoli and sauté in butter in an oven-safe pan until tender. Whisk eggs and cream, add to pan, sprinkle with cheddar, and bake 15–20 minutes until the center reaches 160°F / 71°C. Use vegetarian-certified cheese if needed."}$recipe$::jsonb),
('keto-cabbage',10,$recipe${"id":"keto-cabbage","name":"Chicken & cabbage skillet","emoji":"🥬","color":"#e2e8d3","time":25,"vegetarian":false,"keto":true,"description":"Budget-friendly chicken thighs and cabbage with garlic and olive oil.","ingredients":[["Chicken thighs","g",700],["Cabbage","heads",0.5],["Garlic","cloves",2],["Olive oil","tbsp",2]],"steps":"Cut boneless chicken into strips. Sauté in olive oil, then add thinly sliced cabbage and minced garlic. Cook until cabbage is tender and every piece of chicken reaches 165°F / 74°C."}$recipe$::jsonb),
('keto-zucchini',11,$recipe${"id":"keto-zucchini","name":"Creamy garlic chicken & zucchini","emoji":"🍗","color":"#e5dfd1","time":30,"vegetarian":false,"keto":true,"description":"Chicken thighs, zucchini, and a creamy garlic sauce, without pasta.","ingredients":[["Chicken thighs","g",700],["Zucchini","g",600],["Cream","ml",100],["Garlic","cloves",2],["Olive oil","tbsp",1]],"steps":"Cut boneless chicken into bite-sized pieces and brown in olive oil. Add sliced zucchini and garlic. Stir in cream and simmer until chicken reaches 165°F / 74°C and zucchini is tender."}$recipe$::jsonb),
('keto-wraps',12,$recipe${"id":"keto-wraps","name":"Cheeseburger lettuce wraps","emoji":"🥬","color":"#e9ddce","time":25,"vegetarian":false,"keto":true,"description":"All the burger flavor in crisp lettuce leaves, without buns or fries.","ingredients":[["Ground beef","g",600],["Lettuce","heads",0.5],["Tomatoes","pieces",1],["Cheddar","g",80],["Olive oil","tbsp",1]],"steps":"Form beef into small patties. Cook in olive oil to 160°F / 71°C, then add cheddar. Wrap in washed lettuce leaves with sliced tomato. Avoid sweetened sauces."}$recipe$::jsonb),
('keto-salmon',13,$recipe${"id":"keto-salmon","name":"Lemon butter salmon & broccoli","emoji":"🐟","color":"#dde7e8","time":30,"vegetarian":false,"keto":true,"description":"A simple salmon supper with buttery broccoli and fresh lemon.","ingredients":[["Salmon","g",600],["Broccoli","heads",1],["Butter","g",40],["Lemons","pieces",1]],"steps":"Heat oven to 400°F / 200°C. Place salmon and small broccoli florets on a tray, add butter and lemon juice, and roast until salmon reaches 145°F / 63°C, about 15–20 minutes. Cook broccoli longer if needed."}$recipe$::jsonb),
('keto-tofu',14,$recipe${"id":"keto-tofu","name":"Sesame tofu & zucchini skillet","emoji":"🥢","color":"#e6e8d3","time":25,"vegetarian":true,"keto":true,"description":"Crispy firm tofu and zucchini with ginger and unsweetened soy sauce.","ingredients":[["Firm tofu","g",600],["Zucchini","g",600],["Soy sauce","ml",30],["Ginger","g",10],["Sesame seeds","tbsp",1],["Olive oil","tbsp",2]],"steps":"Pat tofu dry, cube, and sauté in olive oil until golden. Add sliced zucchini and grated ginger, cooking until tender. Toss with unsweetened soy sauce and sesame seeds. Check tofu and sauce labels for carbohydrate content."}$recipe$::jsonb);

-- Illustrative USD estimates only; not live store quotes.
insert into public.dinner_pricebook(name,unit,offers) values
('Black beans','cans',$offers$[{"label":"Standard package","size":1,"price":0.95},{"label":"Value package","size":4,"price":3.5}]$offers$::jsonb),
('Tortillas','pieces',$offers$[{"label":"Standard package","size":10,"price":2.2},{"label":"Value package","size":20,"price":3.8}]$offers$::jsonb),
('Cabbage','heads',$offers$[{"label":"Standard package","size":1,"price":2.2},{"label":"Value package","size":2,"price":4}]$offers$::jsonb),
('Limes','pieces',$offers$[{"label":"Standard package","size":1,"price":0.5},{"label":"Value package","size":6,"price":2.5}]$offers$::jsonb),
('Smoked paprika','tsp',$offers$[{"label":"Standard package","size":20,"price":2},{"label":"Value package","size":40,"price":3.5}]$offers$::jsonb),
('Olive oil','tbsp',$offers$[{"label":"Standard package","size":32,"price":5},{"label":"Value package","size":64,"price":9}]$offers$::jsonb),
('Chicken thighs','g',$offers$[{"label":"Standard package","size":454,"price":3},{"label":"Value package","size":1362,"price":8}]$offers$::jsonb),
('Potatoes','g',$offers$[{"label":"Standard package","size":907,"price":2.5},{"label":"Value package","size":2268,"price":4}]$offers$::jsonb),
('Broccoli','heads',$offers$[{"label":"Standard package","size":1,"price":1.75},{"label":"Value package","size":3,"price":4.8}]$offers$::jsonb),
('Lemons','pieces',$offers$[{"label":"Standard package","size":1,"price":0.6},{"label":"Value package","size":6,"price":3}]$offers$::jsonb),
('Garlic','cloves',$offers$[{"label":"Standard package","size":10,"price":0.6},{"label":"Value package","size":30,"price":1.5}]$offers$::jsonb),
('Pasta','g',$offers$[{"label":"Standard package","size":454,"price":1.1},{"label":"Value package","size":907,"price":2}]$offers$::jsonb),
('Crushed tomatoes','cans',$offers$[{"label":"Standard package","size":1,"price":1.6},{"label":"Value package","size":3,"price":4.5}]$offers$::jsonb),
('Spinach','g',$offers$[{"label":"Standard package","size":227,"price":2},{"label":"Value package","size":454,"price":3.5}]$offers$::jsonb),
('Cream','ml',$offers$[{"label":"Standard package","size":473,"price":3},{"label":"Value package","size":946,"price":5}]$offers$::jsonb),
('Parmesan','g',$offers$[{"label":"Standard package","size":227,"price":3.5},{"label":"Value package","size":454,"price":6}]$offers$::jsonb),
('Salmon','g',$offers$[{"label":"Standard package","size":454,"price":10},{"label":"Value package","size":907,"price":18}]$offers$::jsonb),
('Rice','g',$offers$[{"label":"Standard package","size":907,"price":2},{"label":"Value package","size":2268,"price":4}]$offers$::jsonb),
('Cucumber','pieces',$offers$[{"label":"Standard package","size":1,"price":0.8},{"label":"Value package","size":3,"price":2}]$offers$::jsonb),
('Teriyaki sauce','ml',$offers$[{"label":"Standard package","size":300,"price":2},{"label":"Value package","size":600,"price":3.5}]$offers$::jsonb),
('Sesame seeds','tbsp',$offers$[{"label":"Standard package","size":16,"price":2},{"label":"Value package","size":32,"price":3.5}]$offers$::jsonb),
('Chickpeas','cans',$offers$[{"label":"Standard package","size":1,"price":0.95},{"label":"Value package","size":4,"price":3.5}]$offers$::jsonb),
('Coconut milk','cans',$offers$[{"label":"Standard package","size":1,"price":1.8},{"label":"Value package","size":3,"price":5}]$offers$::jsonb),
('Curry powder','tbsp',$offers$[{"label":"Standard package","size":16,"price":2},{"label":"Value package","size":32,"price":3.5}]$offers$::jsonb),
('Onion','pieces',$offers$[{"label":"Standard package","size":1,"price":0.6},{"label":"Value package","size":6,"price":2.5}]$offers$::jsonb),
('Ground beef','g',$offers$[{"label":"Standard package","size":454,"price":4.5},{"label":"Value package","size":1362,"price":12}]$offers$::jsonb),
('Burger buns','pieces',$offers$[{"label":"Standard package","size":8,"price":2},{"label":"Value package","size":16,"price":3.5}]$offers$::jsonb),
('Lettuce','heads',$offers$[{"label":"Standard package","size":1,"price":1.5},{"label":"Value package","size":3,"price":4}]$offers$::jsonb),
('Tomatoes','pieces',$offers$[{"label":"Standard package","size":1,"price":0.7},{"label":"Value package","size":6,"price":3.5}]$offers$::jsonb),
('Firm tofu','g',$offers$[{"label":"Standard package","size":397,"price":1.8},{"label":"Value package","size":794,"price":3.3}]$offers$::jsonb),
('Bell peppers','pieces',$offers$[{"label":"Standard package","size":1,"price":0.8},{"label":"Value package","size":3,"price":2}]$offers$::jsonb),
('Soy sauce','ml',$offers$[{"label":"Standard package","size":450,"price":2},{"label":"Value package","size":900,"price":3.5}]$offers$::jsonb),
('Ginger','g',$offers$[{"label":"Standard package","size":100,"price":0.8},{"label":"Value package","size":300,"price":2}]$offers$::jsonb),
('Dry lentils','g',$offers$[{"label":"Standard package","size":454,"price":1.4},{"label":"Value package","size":907,"price":2.5}]$offers$::jsonb),
('Carrots','pieces',$offers$[{"label":"Standard package","size":6,"price":1},{"label":"Value package","size":12,"price":1.8}]$offers$::jsonb),
('Vegetable broth','ml',$offers$[{"label":"Standard package","size":946,"price":1.5},{"label":"Value package","size":1892,"price":2.8}]$offers$::jsonb),
('Bread','loaves',$offers$[{"label":"Standard package","size":1,"price":1.5},{"label":"Value package","size":2,"price":2.7}]$offers$::jsonb),
('Eggs','pieces',$offers$[{"label":"Standard package","size":12,"price":3},{"label":"Value package","size":18,"price":4.2}]$offers$::jsonb),
('Butter','g',$offers$[{"label":"Standard package","size":454,"price":3.5},{"label":"Value package","size":907,"price":6}]$offers$::jsonb),
('Cheddar','g',$offers$[{"label":"Standard package","size":227,"price":2},{"label":"Value package","size":454,"price":3.5}]$offers$::jsonb),
('Zucchini','g',$offers$[{"label":"Standard package","size":454,"price":1.6},{"label":"Value package","size":1362,"price":4.25}]$offers$::jsonb);
