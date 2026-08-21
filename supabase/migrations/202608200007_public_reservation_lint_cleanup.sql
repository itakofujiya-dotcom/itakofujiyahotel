-- Preserve the applied function while making PL/pgSQL's stricter checker
-- understand the integer array initialization and loop-scoped variables.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.create_public_reservation(uuid,date,date,integer,integer,integer,integer,uuid,text,text,text,text,time without time zone,text,integer)'::regprocedure
  ) into v_definition;

  v_definition := replace(
    v_definition,
    'v_distribution integer[] := ''{}'';',
    'v_distribution integer[] := array[]::integer[];'
  );
  v_definition := replace(
    v_definition,
    'v_free_distribution integer[] := ''{}'';',
    'v_free_distribution integer[] := array[]::integer[];'
  );
  v_definition := replace(
    v_definition,
    E'  v_index integer;\n',
    ''
  );

  execute v_definition;
end;
$$;
