-- Preserve the already-deployed function behavior while making its PL/pgSQL
-- declarations explicit for stricter database lint settings.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.search_available_room_types(date,date,integer,integer,integer,integer)'::regprocedure
  ) into v_definition;

  v_definition := replace(
    v_definition,
    'v_distribution integer[] := ''{}'';',
    'v_distribution integer[] := array[]::integer[];'
  );
  v_definition := replace(
    v_definition,
    E'\n  v_index integer;',
    ''
  );

  execute v_definition;
end;
$$;
