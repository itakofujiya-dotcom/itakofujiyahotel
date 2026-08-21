update public.hotel_settings
set telephone = '0299-94-2662',
    fax = '0299-94-2663'
where telephone is distinct from '0299-94-2662'
   or fax is distinct from '0299-94-2663';
