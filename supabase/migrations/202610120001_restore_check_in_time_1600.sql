alter table public.hotel_settings
  alter column check_in_time set default time '16:00',
  alter column front_desk_open set default time '16:00';

update public.hotel_settings
set check_in_time = time '16:00',
    front_desk_open = time '16:00'
where check_in_time is distinct from time '16:00'
   or front_desk_open is distinct from time '16:00';

do $migration$
declare
  v_signature text;
  v_function regprocedure;
  v_function_definition text;
  v_updated_definition text;
begin
  foreach v_signature in array array[
    'public.create_public_reservation(uuid,date,date,integer,integer,integer,integer,uuid,text,text,text,text,time without time zone,text,integer)',
    'public.create_public_mixed_reservation(uuid,date,date,jsonb,text,text,text,text,time without time zone,text,integer)'
  ]
  loop
    v_function := to_regprocedure(v_signature);
    if v_function is null then
      continue;
    end if;

    select pg_get_functiondef(v_function)
    into strict v_function_definition;

    v_updated_definition := replace(
      v_function_definition,
      'p_expected_check_in_time < ''15:00''::time without time zone',
      'p_expected_check_in_time < ''16:00''::time without time zone'
    );
    v_updated_definition := replace(
      v_updated_definition,
      'p_expected_check_in_time < time ''15:00''',
      'p_expected_check_in_time < time ''16:00'''
    );

    if v_updated_definition = v_function_definition then
      raise exception 'PUBLIC_BOOKING_CHECK_IN_VALIDATION_NOT_FOUND: %', v_signature;
    end if;

    execute v_updated_definition;
  end loop;
end;
$migration$;
