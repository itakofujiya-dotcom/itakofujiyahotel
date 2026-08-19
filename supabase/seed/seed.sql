insert into public.hotel_settings (hotel_name_ja, hotel_name_en, postal_code, address_ja, telephone, fax, email, check_in_time, check_out_time, front_desk_open, front_desk_close, map_url)
values ('潮来富士屋ホテル','ITAKO FUJIYA HOTEL','311-2424','茨城県潮来市潮来102','0299-62-2000','0299-63-0801',null,'16:00','10:00','16:00','22:00','https://goo.gl/maps/GwPmVZCzfNbi5CRZ9');

-- Room types and prices are intentionally not seeded: final saleable products are not confirmed.
with room_seed(room_number, room_style, standard_capacity, max_capacity, sales_status, operations_note) as (values
('201','western',4,4,'active',null),('202','western',2,4,'active',null),('203','western',2,4,'active',null),('205','western',2,4,'active',null),('206','western',2,4,'active',null),('207','western',2,4,'active',null),('208','western',2,4,'active',null),('210','western',2,4,'active',null),
('301','western',4,4,'active',null),('302','japanese',2,4,'active',null),('303','japanese',2,4,'active',null),('305','japanese',2,4,'active',null),('306','japanese',2,4,'active',null),('307','western',2,4,'active',null),('308','japanese',2,4,'active',null),('310','japanese',2,4,'active',null),
('401','western',4,4,'active',null),('402','japanese',2,4,'active',null),('403','japanese',2,4,'active',null),('405','japanese',2,4,'active',null),('406','japanese',2,4,'active',null),('407','japanese',2,4,'active',null),('408','japanese',2,4,'active',null),('410','japanese',2,4,'active',null),
('501','western',4,4,'inactive','オンライン販売方針は未確定'),('502','japanese',2,4,'active',null),('503','japanese',2,4,'active',null),('505','japanese',2,4,'active',null),('506','japanese',2,4,'active',null),('507','japanese',2,4,'active',null),('508','japanese',2,4,'active',null),('510','japanese',2,4,'active',null),
('601','western',4,4,'active',null),('602','japanese',2,4,'active',null),('603','japanese',2,4,'active',null),('605','japanese',2,4,'active',null),('606','japanese',2,4,'active',null),('607','japanese',2,4,'active',null),('608','japanese',2,4,'active',null),('610','japanese',2,4,'active',null))
insert into public.rooms (room_number, floor, room_style, standard_capacity, max_capacity, sales_status, operations_note)
select room_number, substring(room_number,1,1)::smallint, room_style, standard_capacity, max_capacity, sales_status, operations_note from room_seed;

insert into public.amenities (code,label_ja,category,provided_by_default) values
('wifi','無料Wi-Fi','facility',true),('air-conditioner','エアコン','facility',true),('tv','テレビ','facility',true),('refrigerator','冷蔵庫','facility',true),('kettle','電気ポット','facility',true),('hair-dryer','ドライヤー','facility',true),('bathroom','バス','facility',true),('toilet','トイレ','facility',true),('non-smoking','禁煙','facility',true),('toothbrush','歯ブラシ','toiletry',true),('towel','タオル','toiletry',true),('shampoo','シャンプー','toiletry',true),('conditioner','コンディショナー','toiletry',true),('body-soap','ボディソープ','toiletry',true),('slippers','スリッパ','toiletry',true),('coffee','コーヒー','toiletry',false),('tea','お茶','toiletry',false);

insert into public.room_amenities (room_id, amenity_id)
select rooms.id, amenities.id from public.rooms cross join public.amenities where amenities.provided_by_default;
