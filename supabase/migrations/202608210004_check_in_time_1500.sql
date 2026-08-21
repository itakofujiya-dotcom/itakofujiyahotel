alter table public.hotel_settings
  alter column check_in_time set default time '15:00',
  alter column front_desk_open set default time '15:00';

update public.hotel_settings
set check_in_time = time '15:00',
    front_desk_open = time '15:00'
where check_in_time is distinct from time '15:00'
   or front_desk_open is distinct from time '15:00';

do $migration$
declare
  v_function_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.create_public_reservation(uuid,date,date,integer,integer,integer,integer,uuid,text,text,text,text,time without time zone,text,integer)'::regprocedure
  )
  into strict v_function_definition;

  v_updated_definition := replace(
    v_function_definition,
    'p_expected_check_in_time < time ''16:00''',
    'p_expected_check_in_time < time ''15:00'''
  );

  if v_updated_definition = v_function_definition then
    raise exception 'PUBLIC_BOOKING_CHECK_IN_VALIDATION_NOT_FOUND';
  end if;

  execute v_updated_definition;
end;
$migration$;
