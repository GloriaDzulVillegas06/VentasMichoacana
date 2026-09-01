
-- ============================================================
-- TROLES / LA MICHOACANA - ESQUEMA COMPLETO DESDE CERO
-- PostgreSQL / Supabase
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- LIMPIEZA OPCIONAL
-- Descomenta SOLO si quieres borrar todo y recrear desde cero.
-- ============================================================
-- drop view if exists public.v_inventario cascade;
-- drop table if exists public.notificaciones cascade;
-- drop table if exists public.pedido_cliente_pagos cascade;
-- drop table if exists public.pedido_cliente_detalles cascade;
-- drop table if exists public.pedidos_clientes cascade;
-- drop table if exists public.pedido_proveedor_detalles cascade;
-- drop table if exists public.pedidos_proveedor cascade;
-- drop table if exists public.movimientos_inventario cascade;
-- drop table if exists public.pagos cascade;
-- drop table if exists public.venta_detalles cascade;
-- drop table if exists public.ventas cascade;
-- drop table if exists public.productos cascade;
-- drop table if exists public.vendedores cascade;
-- drop table if exists public.configuracion cascade;

-- ============================================================
-- CONFIGURACIÓN
-- ============================================================

create table public.configuracion (
    clave text primary key,
    valor text not null
);

-- ============================================================
-- VENDEDORES
-- ============================================================

create table public.vendedores (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    telefono text,
    activo boolean not null default true,
    created_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCTOS
-- ============================================================

create table public.productos (
    id text primary key,
    nombre text not null unique,
    categoria text not null default 'Trol',
    emoji text,
    precio_venta numeric(10,2) not null default 0 check (precio_venta >= 0),
    precio_compra numeric(10,2) not null default 0 check (precio_compra >= 0),
    stock_fisico integer not null default 0 check (stock_fisico >= 0),
    stock_minimo integer not null default 5 check (stock_minimo >= 0),
    stock_ideal integer not null default 12 check (stock_ideal >= 0),
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================
-- VENTAS
-- ============================================================

create table public.ventas (
    id uuid primary key default gen_random_uuid(),
    vendedor_id uuid references public.vendedores(id),
    vendedor_nombre text not null,
    cliente_nombre text,
    cliente_telefono text,
    origen text not null default 'VENTA_DIRECTA',
    pedido_cliente_id uuid,
    total numeric(10,2) not null default 0 check (total >= 0),
    estado text not null default 'ACTIVA'
        check (estado in ('ACTIVA','CANCELADA')),
    notas text,
    created_at timestamptz not null default now(),
    cancelled_at timestamptz
);

create table public.venta_detalles (
    id uuid primary key default gen_random_uuid(),
    venta_id uuid not null references public.ventas(id) on delete cascade,
    producto_id text not null references public.productos(id),
    producto_nombre text not null,
    cantidad integer not null check (cantidad > 0),
    precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
    subtotal numeric(10,2) not null check (subtotal >= 0),
    created_at timestamptz not null default now()
);

create table public.pagos (
    id uuid primary key default gen_random_uuid(),
    venta_id uuid not null references public.ventas(id) on delete cascade,
    metodo text not null
        check (metodo in ('EFECTIVO','TRANSFERENCIA','OTRO')),
    monto numeric(10,2) not null check (monto > 0),
    referencia text,
    notas text,
    created_at timestamptz not null default now()
);

-- ============================================================
-- MOVIMIENTOS DE INVENTARIO
-- ============================================================

create table public.movimientos_inventario (
    id uuid primary key default gen_random_uuid(),
    producto_id text not null references public.productos(id),
    tipo text not null
        check (tipo in ('ENTRADA','SALIDA','AJUSTE','MERMA','DEVOLUCION')),
    cantidad integer not null check (cantidad > 0),
    stock_anterior integer not null check (stock_anterior >= 0),
    stock_nuevo integer not null check (stock_nuevo >= 0),
    referencia_tipo text,
    referencia_id uuid,
    motivo text,
    created_at timestamptz not null default now()
);

-- ============================================================
-- PEDIDOS A PROVEEDOR
-- ============================================================

create table public.pedidos_proveedor (
    id uuid primary key default gen_random_uuid(),
    presupuesto numeric(10,2) not null default 0 check (presupuesto >= 0),
    total_estimado numeric(10,2) not null default 0 check (total_estimado >= 0),
    estado text not null default 'BORRADOR'
        check (estado in ('BORRADOR','PEDIDO','RECIBIDO','CANCELADO')),
    notas text,
    created_at timestamptz not null default now(),
    recibido_at timestamptz
);

create table public.pedido_proveedor_detalles (
    id uuid primary key default gen_random_uuid(),
    pedido_id uuid not null references public.pedidos_proveedor(id) on delete cascade,
    producto_id text not null references public.productos(id),
    cantidad integer not null check (cantidad > 0),
    precio_compra numeric(10,2) not null check (precio_compra >= 0),
    subtotal numeric(10,2) not null check (subtotal >= 0)
);

-- ============================================================
-- PEDIDOS / APARTADOS DE CLIENTES
-- ============================================================

create table public.pedidos_clientes (
    id uuid primary key default gen_random_uuid(),
    cliente_nombre text not null,
    cliente_telefono text,
    vendedor_id uuid references public.vendedores(id),
    fecha_entrega timestamptz not null,
    estado text not null default 'APARTADO'
        check (estado in (
            'APARTADO',
            'CONFIRMADO',
            'ENTREGADO',
            'CANCELADO',
            'NO_RECOGIDO'
        )),
    total numeric(10,2) not null default 0 check (total >= 0),
    monto_pagado numeric(10,2) not null default 0 check (monto_pagado >= 0),
    monto_pendiente numeric(10,2) generated always as (greatest(total - monto_pagado, 0)) stored,
    notas text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    entregado_at timestamptz,
    cancelado_at timestamptz
);

create table public.pedido_cliente_detalles (
    id uuid primary key default gen_random_uuid(),
    pedido_id uuid not null references public.pedidos_clientes(id) on delete cascade,
    producto_id text not null references public.productos(id),
    producto_nombre text not null,
    cantidad integer not null check (cantidad > 0),
    precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
    subtotal numeric(10,2) not null check (subtotal >= 0)
);

create table public.pedido_cliente_pagos (
    id uuid primary key default gen_random_uuid(),
    pedido_id uuid not null references public.pedidos_clientes(id) on delete cascade,
    metodo text not null
        check (metodo in ('EFECTIVO','TRANSFERENCIA','OTRO')),
    monto numeric(10,2) not null check (monto > 0),
    referencia text,
    notas text,
    created_at timestamptz not null default now()
);

-- ============================================================
-- NOTIFICACIONES / RECORDATORIOS
-- ============================================================

create table public.notificaciones (
    id uuid primary key default gen_random_uuid(),
    pedido_cliente_id uuid references public.pedidos_clientes(id) on delete cascade,
    tipo text not null default 'PEDIDO',
    canal text not null default 'PWA'
        check (canal in ('PWA','WHATSAPP','EMAIL')),
    enviar_en timestamptz not null,
    mensaje text not null,
    estado text not null default 'PENDIENTE'
        check (estado in ('PENDIENTE','ENVIADA','CANCELADA','ERROR')),
    intentos integer not null default 0,
    enviado_en timestamptz,
    error_mensaje text,
    created_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index idx_productos_activo on public.productos(activo);
create index idx_ventas_created_at on public.ventas(created_at desc);
create index idx_venta_detalles_venta on public.venta_detalles(venta_id);
create index idx_pagos_venta on public.pagos(venta_id);
create index idx_movimientos_producto on public.movimientos_inventario(producto_id);
create index idx_movimientos_fecha on public.movimientos_inventario(created_at desc);
create index idx_pedidos_clientes_fecha on public.pedidos_clientes(fecha_entrega);
create index idx_pedidos_clientes_estado on public.pedidos_clientes(estado);
create index idx_pedido_cliente_detalles_pedido on public.pedido_cliente_detalles(pedido_id);
create index idx_notificaciones_pendientes on public.notificaciones(estado, enviar_en);

-- ============================================================
-- INVENTARIO: FÍSICO / APARTADO / DISPONIBLE
-- ============================================================

create or replace view public.v_inventario as
select
    p.id as producto_id,
    p.nombre,
    p.categoria,
    p.emoji,
    p.precio_venta,
    p.precio_compra,
    p.stock_fisico,
    coalesce(a.stock_apartado, 0)::integer as stock_apartado,
    greatest(p.stock_fisico - coalesce(a.stock_apartado, 0), 0)::integer as stock_disponible,
    p.stock_minimo,
    p.stock_ideal,
    p.activo
from public.productos p
left join (
    select
        d.producto_id,
        sum(d.cantidad)::integer as stock_apartado
    from public.pedido_cliente_detalles d
    inner join public.pedidos_clientes pc on pc.id = d.pedido_id
    where pc.estado in ('APARTADO','CONFIRMADO')
    group by d.producto_id
) a on a.producto_id = p.id;

-- ============================================================
-- FUNCIÓN AUXILIAR: ACTUALIZAR updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_productos_updated_at
before update on public.productos
for each row execute function public.set_updated_at();

create trigger trg_pedidos_clientes_updated_at
before update on public.pedidos_clientes
for each row execute function public.set_updated_at();

-- ============================================================
-- FUNCIÓN: VALIDAR DISPONIBILIDAD DE UN PRODUCTO
-- ============================================================

create or replace function public.stock_disponible_producto(p_producto_id text)
returns integer
language sql
stable
as $$
    select coalesce(stock_disponible, 0)
    from public.v_inventario
    where producto_id = p_producto_id;
$$;

-- ============================================================
-- FUNCIÓN: CREAR PEDIDO DE CLIENTE / APARTADO
-- items:
-- [
--   {"productoId":"TR008","cantidad":1},
--   {"productoId":"TR012","cantidad":1}
-- ]
-- ============================================================

create or replace function public.crear_pedido_cliente(
    p_cliente_nombre text,
    p_cliente_telefono text,
    p_fecha_entrega timestamptz,
    p_items jsonb,
    p_notas text default null,
    p_vendedor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pedido_id uuid;
    v_item jsonb;
    v_producto public.productos%rowtype;
    v_cantidad integer;
    v_disponible integer;
    v_total numeric(10,2) := 0;
    v_detalle text := '';
begin
    if p_cliente_nombre is null or btrim(p_cliente_nombre) = '' then
        raise exception 'El nombre del cliente es requerido';
    end if;

    if p_fecha_entrega <= now() then
        raise exception 'La fecha de entrega debe ser futura';
    end if;

    if p_items is null or jsonb_array_length(p_items) = 0 then
        raise exception 'El pedido debe contener al menos un producto';
    end if;

    -- Validar antes de insertar
    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_cantidad := coalesce((v_item->>'cantidad')::integer, 0);

        if v_cantidad <= 0 then
            raise exception 'Cantidad inválida';
        end if;

        select *
        into v_producto
        from public.productos
        where id = v_item->>'productoId'
          and activo = true
        for update;

        if not found then
            raise exception 'Producto no encontrado: %', v_item->>'productoId';
        end if;

        select stock_disponible
        into v_disponible
        from public.v_inventario
        where producto_id = v_producto.id;

        if v_disponible < v_cantidad then
            raise exception 'Stock insuficiente para %. Disponible: %, solicitado: %',
                v_producto.nombre, v_disponible, v_cantidad;
        end if;
    end loop;

    insert into public.pedidos_clientes (
        cliente_nombre,
        cliente_telefono,
        vendedor_id,
        fecha_entrega,
        estado,
        notas
    )
    values (
        btrim(p_cliente_nombre),
        nullif(btrim(p_cliente_telefono), ''),
        p_vendedor_id,
        p_fecha_entrega,
        'APARTADO',
        p_notas
    )
    returning id into v_pedido_id;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_cantidad := (v_item->>'cantidad')::integer;

        select *
        into v_producto
        from public.productos
        where id = v_item->>'productoId';

        insert into public.pedido_cliente_detalles (
            pedido_id,
            producto_id,
            producto_nombre,
            cantidad,
            precio_unitario,
            subtotal
        )
        values (
            v_pedido_id,
            v_producto.id,
            v_producto.nombre,
            v_cantidad,
            v_producto.precio_venta,
            v_producto.precio_venta * v_cantidad
        );

        v_total := v_total + (v_producto.precio_venta * v_cantidad);

        if v_detalle <> '' then
            v_detalle := v_detalle || E'\n';
        end if;

        v_detalle := v_detalle || v_cantidad || ' x ' || v_producto.nombre;
    end loop;

    update public.pedidos_clientes
    set total = v_total
    where id = v_pedido_id;

    -- Recordatorio 24 horas antes
    if p_fecha_entrega - interval '24 hours' > now() then
        insert into public.notificaciones (
            pedido_cliente_id,
            tipo,
            canal,
            enviar_en,
            mensaje
        )
        values (
            v_pedido_id,
            'PEDIDO_24H',
            'PWA',
            p_fecha_entrega - interval '24 hours',
            '🍦 Pedido para mañana' || E'\n' ||
            'Cliente: ' || btrim(p_cliente_nombre) || E'\n' ||
            'Entrega: ' || to_char(p_fecha_entrega at time zone 'America/Merida', 'DD/MM/YYYY HH12:MI AM') || E'\n\n' ||
            v_detalle
        );
    end if;

    -- Recordatorio 2 horas antes
    if p_fecha_entrega - interval '2 hours' > now() then
        insert into public.notificaciones (
            pedido_cliente_id,
            tipo,
            canal,
            enviar_en,
            mensaje
        )
        values (
            v_pedido_id,
            'PEDIDO_2H',
            'PWA',
            p_fecha_entrega - interval '2 hours',
            '⚠️ Pedido en 2 horas' || E'\n' ||
            'Cliente: ' || btrim(p_cliente_nombre) || E'\n' ||
            'Entrega: ' || to_char(p_fecha_entrega at time zone 'America/Merida', 'DD/MM/YYYY HH12:MI AM') || E'\n\n' ||
            v_detalle
        );
    end if;

    return v_pedido_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: CAMBIAR ESTADO DE PEDIDO
-- Cancelar libera automáticamente el apartado porque la vista
-- solo cuenta APARTADO / CONFIRMADO.
-- ============================================================

create or replace function public.cambiar_estado_pedido_cliente(
    p_pedido_id uuid,
    p_estado text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_estado not in ('APARTADO','CONFIRMADO','CANCELADO','NO_RECOGIDO') then
        raise exception 'Estado no permitido con esta función';
    end if;

    update public.pedidos_clientes
    set
        estado = p_estado,
        cancelado_at = case
            when p_estado in ('CANCELADO','NO_RECOGIDO') then now()
            else null
        end
    where id = p_pedido_id
      and estado <> 'ENTREGADO';

    if not found then
        raise exception 'Pedido no encontrado o ya entregado';
    end if;

    if p_estado in ('CANCELADO','NO_RECOGIDO') then
        update public.notificaciones
        set estado = 'CANCELADA'
        where pedido_cliente_id = p_pedido_id
          and estado = 'PENDIENTE';
    end if;
end;
$$;

-- ============================================================
-- FUNCIÓN: REGISTRAR ANTICIPO / PAGO DE PEDIDO
-- ============================================================

create or replace function public.registrar_pago_pedido_cliente(
    p_pedido_id uuid,
    p_metodo text,
    p_monto numeric,
    p_referencia text default null,
    p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pago_id uuid;
    v_total numeric(10,2);
    v_pagado numeric(10,2);
begin
    if p_metodo not in ('EFECTIVO','TRANSFERENCIA','OTRO') then
        raise exception 'Método de pago inválido';
    end if;

    if p_monto <= 0 then
        raise exception 'El monto debe ser mayor a 0';
    end if;

    select total, monto_pagado
    into v_total, v_pagado
    from public.pedidos_clientes
    where id = p_pedido_id
      and estado not in ('CANCELADO','NO_RECOGIDO');

    if not found then
        raise exception 'Pedido no encontrado o cancelado';
    end if;

    if v_pagado + p_monto > v_total then
        raise exception 'El pago excede el saldo pendiente';
    end if;

    insert into public.pedido_cliente_pagos (
        pedido_id,
        metodo,
        monto,
        referencia,
        notas
    )
    values (
        p_pedido_id,
        p_metodo,
        p_monto,
        p_referencia,
        p_notas
    )
    returning id into v_pago_id;

    update public.pedidos_clientes
    set monto_pagado = monto_pagado + p_monto
    where id = p_pedido_id;

    return v_pago_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: REGISTRAR VENTA DIRECTA
-- items:
-- [
--   {"productoId":"TR001","cantidad":2},
--   {"productoId":"TR008","cantidad":1}
-- ]
-- pagos:
-- [
--   {"metodo":"EFECTIVO","monto":70},
--   {"metodo":"TRANSFERENCIA","monto":35}
-- ]
-- ============================================================

create or replace function public.registrar_venta(
    p_vendedor_id uuid,
    p_vendedor_nombre text,
    p_cliente_nombre text,
    p_cliente_telefono text,
    p_items jsonb,
    p_pagos jsonb default '[]'::jsonb,
    p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_venta_id uuid;
    v_item jsonb;
    v_pago jsonb;
    v_producto public.productos%rowtype;
    v_cantidad integer;
    v_disponible integer;
    v_total numeric(10,2) := 0;
    v_total_pagos numeric(10,2) := 0;
begin
    if p_items is null or jsonb_array_length(p_items) = 0 then
        raise exception 'La venta debe contener productos';
    end if;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_cantidad := coalesce((v_item->>'cantidad')::integer, 0);

        if v_cantidad <= 0 then
            raise exception 'Cantidad inválida';
        end if;

        select *
        into v_producto
        from public.productos
        where id = v_item->>'productoId'
          and activo = true
        for update;

        if not found then
            raise exception 'Producto no encontrado';
        end if;

        select stock_disponible
        into v_disponible
        from public.v_inventario
        where producto_id = v_producto.id;

        if v_disponible < v_cantidad then
            raise exception 'Stock disponible insuficiente para %', v_producto.nombre;
        end if;

        v_total := v_total + (v_producto.precio_venta * v_cantidad);
    end loop;

    for v_pago in select * from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb))
    loop
        v_total_pagos := v_total_pagos + coalesce((v_pago->>'monto')::numeric, 0);
    end loop;

    if v_total_pagos > v_total then
        raise exception 'Los pagos exceden el total de la venta';
    end if;

    insert into public.ventas (
        vendedor_id,
        vendedor_nombre,
        cliente_nombre,
        cliente_telefono,
        origen,
        total,
        estado,
        notas
    )
    values (
        p_vendedor_id,
        coalesce(nullif(btrim(p_vendedor_nombre), ''), 'Sin vendedor'),
        nullif(btrim(p_cliente_nombre), ''),
        nullif(btrim(p_cliente_telefono), ''),
        'VENTA_DIRECTA',
        v_total,
        'ACTIVA',
        p_notas
    )
    returning id into v_venta_id;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_cantidad := (v_item->>'cantidad')::integer;

        select *
        into v_producto
        from public.productos
        where id = v_item->>'productoId'
        for update;

        insert into public.venta_detalles (
            venta_id,
            producto_id,
            producto_nombre,
            cantidad,
            precio_unitario,
            subtotal
        )
        values (
            v_venta_id,
            v_producto.id,
            v_producto.nombre,
            v_cantidad,
            v_producto.precio_venta,
            v_producto.precio_venta * v_cantidad
        );

        insert into public.movimientos_inventario (
            producto_id,
            tipo,
            cantidad,
            stock_anterior,
            stock_nuevo,
            referencia_tipo,
            referencia_id,
            motivo
        )
        values (
            v_producto.id,
            'SALIDA',
            v_cantidad,
            v_producto.stock_fisico,
            v_producto.stock_fisico - v_cantidad,
            'VENTA',
            v_venta_id,
            'Venta directa'
        );

        update public.productos
        set stock_fisico = stock_fisico - v_cantidad
        where id = v_producto.id;
    end loop;

    for v_pago in select * from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb))
    loop
        insert into public.pagos (
            venta_id,
            metodo,
            monto,
            referencia
        )
        values (
            v_venta_id,
            upper(v_pago->>'metodo'),
            (v_pago->>'monto')::numeric,
            v_pago->>'referencia'
        );
    end loop;

    return v_venta_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: ENTREGAR PEDIDO DE CLIENTE
-- Convierte el apartado en venta y descuenta stock físico.
-- ============================================================

create or replace function public.entregar_pedido_cliente(
    p_pedido_id uuid,
    p_vendedor_id uuid default null,
    p_vendedor_nombre text default 'Mamá',
    p_pago_final_metodo text default null,
    p_pago_final_monto numeric default 0,
    p_referencia text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pedido public.pedidos_clientes%rowtype;
    v_det record;
    v_producto public.productos%rowtype;
    v_venta_id uuid;
    v_anticipo record;
begin
    select *
    into v_pedido
    from public.pedidos_clientes
    where id = p_pedido_id
    for update;

    if not found then
        raise exception 'Pedido no encontrado';
    end if;

    if v_pedido.estado not in ('APARTADO','CONFIRMADO') then
        raise exception 'El pedido no se puede entregar en estado %', v_pedido.estado;
    end if;

    if coalesce(p_pago_final_monto, 0) < 0 then
        raise exception 'Monto final inválido';
    end if;

    if v_pedido.monto_pagado + coalesce(p_pago_final_monto,0) > v_pedido.total then
        raise exception 'El pago excede el total del pedido';
    end if;

    -- Crear venta
    insert into public.ventas (
        vendedor_id,
        vendedor_nombre,
        cliente_nombre,
        cliente_telefono,
        origen,
        pedido_cliente_id,
        total,
        estado,
        notas
    )
    values (
        p_vendedor_id,
        coalesce(nullif(btrim(p_vendedor_nombre), ''), 'Mamá'),
        v_pedido.cliente_nombre,
        v_pedido.cliente_telefono,
        'PEDIDO_CLIENTE',
        v_pedido.id,
        v_pedido.total,
        'ACTIVA',
        'Entrega de pedido apartado'
    )
    returning id into v_venta_id;

    for v_det in
        select *
        from public.pedido_cliente_detalles
        where pedido_id = p_pedido_id
    loop
        select *
        into v_producto
        from public.productos
        where id = v_det.producto_id
        for update;

        if v_producto.stock_fisico < v_det.cantidad then
            raise exception 'Stock físico insuficiente para %', v_producto.nombre;
        end if;

        insert into public.venta_detalles (
            venta_id,
            producto_id,
            producto_nombre,
            cantidad,
            precio_unitario,
            subtotal
        )
        values (
            v_venta_id,
            v_det.producto_id,
            v_det.producto_nombre,
            v_det.cantidad,
            v_det.precio_unitario,
            v_det.subtotal
        );

        insert into public.movimientos_inventario (
            producto_id,
            tipo,
            cantidad,
            stock_anterior,
            stock_nuevo,
            referencia_tipo,
            referencia_id,
            motivo
        )
        values (
            v_producto.id,
            'SALIDA',
            v_det.cantidad,
            v_producto.stock_fisico,
            v_producto.stock_fisico - v_det.cantidad,
            'PEDIDO_CLIENTE',
            v_pedido.id,
            'Entrega de pedido'
        );

        update public.productos
        set stock_fisico = stock_fisico - v_det.cantidad
        where id = v_producto.id;
    end loop;

    -- Copiar anticipos como pagos de la venta
    for v_anticipo in
        select *
        from public.pedido_cliente_pagos
        where pedido_id = p_pedido_id
        order by created_at
    loop
        insert into public.pagos (
            venta_id,
            metodo,
            monto,
            referencia,
            notas
        )
        values (
            v_venta_id,
            v_anticipo.metodo,
            v_anticipo.monto,
            v_anticipo.referencia,
            'Anticipo del pedido'
        );
    end loop;

    if coalesce(p_pago_final_monto,0) > 0 then
        if p_pago_final_metodo not in ('EFECTIVO','TRANSFERENCIA','OTRO') then
            raise exception 'Método de pago final inválido';
        end if;

        insert into public.pagos (
            venta_id,
            metodo,
            monto,
            referencia,
            notas
        )
        values (
            v_venta_id,
            p_pago_final_metodo,
            p_pago_final_monto,
            p_referencia,
            'Pago al entregar pedido'
        );
    end if;

    update public.pedidos_clientes
    set
        estado = 'ENTREGADO',
        monto_pagado = monto_pagado + coalesce(p_pago_final_monto,0),
        entregado_at = now()
    where id = p_pedido_id;

    update public.notificaciones
    set estado = 'CANCELADA'
    where pedido_cliente_id = p_pedido_id
      and estado = 'PENDIENTE';

    return v_venta_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: REGISTRAR ENTRADA DE INVENTARIO
-- ============================================================

create or replace function public.registrar_entrada_inventario(
    p_producto_id text,
    p_cantidad integer,
    p_motivo text default 'Entrada de mercancía'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_stock integer;
begin
    if p_cantidad <= 0 then
        raise exception 'Cantidad inválida';
    end if;

    select stock_fisico
    into v_stock
    from public.productos
    where id = p_producto_id
    for update;

    if not found then
        raise exception 'Producto no encontrado';
    end if;

    insert into public.movimientos_inventario (
        producto_id,
        tipo,
        cantidad,
        stock_anterior,
        stock_nuevo,
        motivo
    )
    values (
        p_producto_id,
        'ENTRADA',
        p_cantidad,
        v_stock,
        v_stock + p_cantidad,
        p_motivo
    );

    update public.productos
    set stock_fisico = stock_fisico + p_cantidad
    where id = p_producto_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: AJUSTAR INVENTARIO
-- ============================================================

create or replace function public.ajustar_inventario(
    p_producto_id text,
    p_nuevo_stock integer,
    p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_stock integer;
    v_diferencia integer;
begin
    if p_nuevo_stock < 0 then
        raise exception 'El stock no puede ser negativo';
    end if;

    select stock_fisico
    into v_stock
    from public.productos
    where id = p_producto_id
    for update;

    if not found then
        raise exception 'Producto no encontrado';
    end if;

    v_diferencia := abs(p_nuevo_stock - v_stock);

    if v_diferencia = 0 then
        return;
    end if;

    insert into public.movimientos_inventario (
        producto_id,
        tipo,
        cantidad,
        stock_anterior,
        stock_nuevo,
        motivo
    )
    values (
        p_producto_id,
        'AJUSTE',
        v_diferencia,
        v_stock,
        p_nuevo_stock,
        coalesce(p_motivo, 'Ajuste manual')
    );

    update public.productos
    set stock_fisico = p_nuevo_stock
    where id = p_producto_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: CREAR PEDIDO A PROVEEDOR
-- ============================================================

create or replace function public.crear_pedido_proveedor(
    p_presupuesto numeric,
    p_items jsonb,
    p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_item jsonb;
    v_producto public.productos%rowtype;
    v_cantidad integer;
    v_total numeric(10,2) := 0;
begin
    if p_presupuesto < 0 then
        raise exception 'Presupuesto inválido';
    end if;

    if p_items is null or jsonb_array_length(p_items) = 0 then
        raise exception 'Debes agregar productos';
    end if;

    insert into public.pedidos_proveedor (
        presupuesto,
        estado,
        notas
    )
    values (
        p_presupuesto,
        'PEDIDO',
        p_notas
    )
    returning id into v_id;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_cantidad := (v_item->>'cantidad')::integer;

        if v_cantidad <= 0 then
            raise exception 'Cantidad inválida';
        end if;

        select *
        into v_producto
        from public.productos
        where id = v_item->>'productoId';

        if not found then
            raise exception 'Producto no encontrado';
        end if;

        insert into public.pedido_proveedor_detalles (
            pedido_id,
            producto_id,
            cantidad,
            precio_compra,
            subtotal
        )
        values (
            v_id,
            v_producto.id,
            v_cantidad,
            v_producto.precio_compra,
            v_cantidad * v_producto.precio_compra
        );

        v_total := v_total + (v_cantidad * v_producto.precio_compra);
    end loop;

    if p_presupuesto > 0 and v_total > p_presupuesto then
        raise exception 'El pedido excede el presupuesto';
    end if;

    update public.pedidos_proveedor
    set total_estimado = v_total
    where id = v_id;

    return v_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: RECIBIR PEDIDO DE PROVEEDOR
-- ============================================================

create or replace function public.recibir_pedido_proveedor(
    p_pedido_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pedido public.pedidos_proveedor%rowtype;
    v_det record;
    v_stock integer;
begin
    select *
    into v_pedido
    from public.pedidos_proveedor
    where id = p_pedido_id
    for update;

    if not found then
        raise exception 'Pedido no encontrado';
    end if;

    if v_pedido.estado <> 'PEDIDO' then
        raise exception 'El pedido no está pendiente de recibir';
    end if;

    for v_det in
        select *
        from public.pedido_proveedor_detalles
        where pedido_id = p_pedido_id
    loop
        select stock_fisico
        into v_stock
        from public.productos
        where id = v_det.producto_id
        for update;

        insert into public.movimientos_inventario (
            producto_id,
            tipo,
            cantidad,
            stock_anterior,
            stock_nuevo,
            referencia_tipo,
            referencia_id,
            motivo
        )
        values (
            v_det.producto_id,
            'ENTRADA',
            v_det.cantidad,
            v_stock,
            v_stock + v_det.cantidad,
            'PEDIDO_PROVEEDOR',
            p_pedido_id,
            'Recepción de pedido a proveedor'
        );

        update public.productos
        set stock_fisico = stock_fisico + v_det.cantidad
        where id = v_det.producto_id;
    end loop;

    update public.pedidos_proveedor
    set
        estado = 'RECIBIDO',
        recibido_at = now()
    where id = p_pedido_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: CANCELAR ÚLTIMA VENTA
-- Revierte inventario y marca venta CANCELADA.
-- ============================================================

create or replace function public.cancelar_ultima_venta()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_venta_id uuid;
    v_det record;
    v_stock integer;
begin
    select id
    into v_venta_id
    from public.ventas
    where estado = 'ACTIVA'
    order by created_at desc
    limit 1
    for update;

    if v_venta_id is null then
        raise exception 'No hay ventas activas para cancelar';
    end if;

    for v_det in
        select *
        from public.venta_detalles
        where venta_id = v_venta_id
    loop
        select stock_fisico
        into v_stock
        from public.productos
        where id = v_det.producto_id
        for update;

        insert into public.movimientos_inventario (
            producto_id,
            tipo,
            cantidad,
            stock_anterior,
            stock_nuevo,
            referencia_tipo,
            referencia_id,
            motivo
        )
        values (
            v_det.producto_id,
            'DEVOLUCION',
            v_det.cantidad,
            v_stock,
            v_stock + v_det.cantidad,
            'VENTA',
            v_venta_id,
            'Cancelación de venta'
        );

        update public.productos
        set stock_fisico = stock_fisico + v_det.cantidad
        where id = v_det.producto_id;
    end loop;

    update public.ventas
    set
        estado = 'CANCELADA',
        cancelled_at = now()
    where id = v_venta_id;

    return v_venta_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: OBTENER NOTIFICACIONES PENDIENTES
-- ============================================================

create or replace function public.obtener_notificaciones_pendientes()
returns setof public.notificaciones
language sql
stable
as $$
    select *
    from public.notificaciones
    where estado = 'PENDIENTE'
      and enviar_en <= now()
    order by enviar_en;
$$;

-- ============================================================
-- FUNCIÓN: MARCAR NOTIFICACIÓN ENVIADA
-- ============================================================

create or replace function public.marcar_notificacion_enviada(
    p_notificacion_id uuid
)
returns void
language sql
as $$
    update public.notificaciones
    set
        estado = 'ENVIADA',
        enviado_en = now(),
        intentos = intentos + 1
    where id = p_notificacion_id;
$$;

-- ============================================================
-- FUNCIÓN: RESUMEN / ESTADO GENERAL PARA FRONTEND
-- ============================================================

create or replace function public.obtener_estado_app()
returns jsonb
language sql
stable
as $$
select jsonb_build_object(
    'products',
    coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', producto_id,
                'nombre', nombre,
                'categoria', categoria,
                'emoji', emoji,
                'precioVenta', precio_venta,
                'precioCompra', precio_compra,
                'stockFisico', stock_fisico,
                'stockApartado', stock_apartado,
                'stockDisponible', stock_disponible,
                'stockMinimo', stock_minimo,
                'stockIdeal', stock_ideal,
                'activo', activo
            )
            order by nombre
        )
        from public.v_inventario
    ), '[]'::jsonb),

    'sellers',
    coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', id,
                'nombre', nombre,
                'telefono', telefono,
                'activo', activo
            )
            order by nombre
        )
        from public.vendedores
    ), '[]'::jsonb),

    'sales',
    coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', id,
                'vendedorNombre', vendedor_nombre,
                'clienteNombre', cliente_nombre,
                'total', total,
                'estado', estado,
                'origen', origen,
                'fecha', created_at
            )
            order by created_at desc
        )
        from public.ventas
        where estado = 'ACTIVA'
    ), '[]'::jsonb),

    'customerOrders',
    coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', pc.id,
                'clienteNombre', pc.cliente_nombre,
                'clienteTelefono', pc.cliente_telefono,
                'fechaEntrega', pc.fecha_entrega,
                'estado', pc.estado,
                'total', pc.total,
                'montoPagado', pc.monto_pagado,
                'montoPendiente', pc.monto_pendiente,
                'notas', pc.notas
            )
            order by pc.fecha_entrega
        )
        from public.pedidos_clientes pc
        where pc.estado not in ('ENTREGADO','CANCELADO')
    ), '[]'::jsonb),

    'notifications',
    coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', id,
                'tipo', tipo,
                'canal', canal,
                'enviarEn', enviar_en,
                'mensaje', mensaje,
                'estado', estado
            )
            order by enviar_en
        )
        from public.notificaciones
        where estado = 'PENDIENTE'
    ), '[]'::jsonb),

    'config',
    coalesce((
        select jsonb_object_agg(clave, valor)
        from public.configuracion
    ), '{}'::jsonb)
);
$$;

-- ============================================================
-- DATOS INICIALES
-- Ajusta después precios y existencias reales.
-- ============================================================

insert into public.configuracion (clave, valor)
values
    ('nombre_negocio','La Michoacana'),
    ('moneda','MXN'),
    ('zona_horaria','America/Merida'),
    ('mensaje_whatsapp','¡Sabor que te enamora!')
on conflict (clave) do update set valor = excluded.valor;

insert into public.vendedores (nombre)
values
    ('Mamá'),
    ('Miri'),
    ('Papá'),
    ('Rodrigo'),
    ('Gloria')
on conflict (nombre) do nothing;

insert into public.productos (
    id, nombre, categoria, emoji,
    precio_venta, precio_compra,
    stock_fisico, stock_minimo, stock_ideal
)
values
    ('TR001','Coco','Trol','🥥',35,18,0,5,12),
    ('TR002','Elote','Trol','🌽',35,18,0,5,12),
    ('TR003','Fresa','Trol','🍓',35,18,0,5,12),
    ('TR004','Galleta','Trol','🍪',35,18,0,5,12),
    ('TR005','Oreo','Trol','🍪',35,18,0,5,12),
    ('TR006','Uva','Trol','🍇',35,18,0,5,12),
    ('TR007','Chocolate','Trol','🍫',35,18,0,5,12),
    ('TR008','Mango c/chamoy','Trol','🥭',35,18,0,5,12),
    ('TR009','Piña c/chamoy','Trol','🍍',35,18,0,5,12),
    ('TR010','Limón c/chamoy','Trol','🍋',35,18,0,5,12),
    ('TR011','Tamarindo c/chamoy','Trol','🌶️',35,18,0,5,12),
    ('TR012','Guanábana','Trol','🍈',35,18,0,5,12),
    ('TR013','Sandía','Trol','🍉',35,18,0,5,12),
    ('TR014','Chicle','Trol','🍬',35,18,0,5,12),
    ('OT001','Fresas con crema','Otro','🍓',45,25,0,3,8),
    ('OT002','Bolsas de hielo','Otro','🧊',10,5,0,4,15)
on conflict (id) do update set
    nombre = excluded.nombre,
    categoria = excluded.categoria,
    emoji = excluded.emoji,
    precio_venta = excluded.precio_venta,
    precio_compra = excluded.precio_compra,
    stock_minimo = excluded.stock_minimo,
    stock_ideal = excluded.stock_ideal;

-- ============================================================
-- RLS
-- Por ahora desactivado para simplificar la conexión inicial.
-- Antes de publicar una versión abierta al público conviene
-- activar Auth + políticas RLS.
-- ============================================================

alter table public.configuracion disable row level security;
alter table public.vendedores disable row level security;
alter table public.productos disable row level security;
alter table public.ventas disable row level security;
alter table public.venta_detalles disable row level security;
alter table public.pagos disable row level security;
alter table public.movimientos_inventario disable row level security;
alter table public.pedidos_proveedor disable row level security;
alter table public.pedido_proveedor_detalles disable row level security;
alter table public.pedidos_clientes disable row level security;
alter table public.pedido_cliente_detalles disable row level security;
alter table public.pedido_cliente_pagos disable row level security;
alter table public.notificaciones disable row level security;

-- ============================================================
-- PRUEBAS ÚTILES
-- ============================================================

-- Ver inventario:
-- select * from public.v_inventario order by nombre;

-- Dar stock inicial de prueba:
-- select public.ajustar_inventario('TR008', 10, 'Stock inicial');
-- select public.ajustar_inventario('TR012', 8, 'Stock inicial');

-- Crear apartado:
-- select public.crear_pedido_cliente(
--   'Cliente prueba',
--   '9990000000',
--   '2026-09-06T12:00:00-06:00'::timestamptz,
--   '[
--      {"productoId":"TR008","cantidad":1},
--      {"productoId":"TR012","cantidad":1}
--    ]'::jsonb,
--   'Entregar al mediodía'
-- );

-- Revisar físico/apartado/disponible:
-- select * from public.v_inventario
-- where producto_id in ('TR008','TR012');

-- Ver pedidos:
-- select * from public.pedidos_clientes order by fecha_entrega;

-- Ver recordatorios:
-- select * from public.notificaciones order by enviar_en;

-- ============================================================
-- TROLES 2.0 · COMPATIBILIDAD CON EL FRONTEND
-- Estas columnas conservan las cuentas por persona que ya usa
-- la aplicación original.
-- ============================================================

alter table public.venta_detalles
    add column if not exists cliente text not null default 'Cliente',
    add column if not exists monto_pagado numeric(10,2) not null default 0 check (monto_pagado >= 0),
    add column if not exists monto_pendiente numeric(10,2) not null default 0 check (monto_pendiente >= 0),
    add column if not exists estado_pago text not null default 'PENDIENTE'
        check (estado_pago in ('PAGADO','PARCIAL','PENDIENTE'));

alter table public.pagos
    add column if not exists detalle_id uuid references public.venta_detalles(id) on delete cascade;

create index if not exists idx_pagos_detalle on public.pagos(detalle_id);

-- ============================================================
-- REGISTRAR VENTA COMO LA PÁGINA ACTUAL
-- p_detalles:
-- [{"productoId":"TR008","cantidad":1,"cliente":"Lupita",
--   "pagos":[{"metodo":"EFECTIVO","monto":35}]}]
-- ============================================================
create or replace function public.registrar_venta_app(
    p_vendedor text,
    p_detalles jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_venta_id uuid;
    v_detalle_id uuid;
    v_item jsonb;
    v_pago jsonb;
    v_producto public.productos%rowtype;
    v_cantidad integer;
    v_disponible integer;
    v_subtotal numeric(10,2);
    v_pagado numeric(10,2);
    v_total numeric(10,2) := 0;
begin
    if p_detalles is null or jsonb_array_length(p_detalles)=0 then
        raise exception 'La venta debe contener productos';
    end if;

    -- Validar y calcular total antes de modificar inventario.
    for v_item in select * from jsonb_array_elements(p_detalles)
    loop
        v_cantidad := coalesce((v_item->>'cantidad')::integer,0);
        if v_cantidad <= 0 then raise exception 'Cantidad inválida'; end if;

        select * into v_producto
        from public.productos
        where id=v_item->>'productoId' and activo=true
        for update;
        if not found then raise exception 'Producto no encontrado: %',v_item->>'productoId'; end if;

        select stock_disponible into v_disponible
        from public.v_inventario where producto_id=v_producto.id;
        if v_disponible < v_cantidad then
            raise exception 'Stock disponible insuficiente para %. Disponible: %',v_producto.nombre,v_disponible;
        end if;
        v_total := v_total + v_producto.precio_venta*v_cantidad;
    end loop;

    insert into public.ventas(vendedor_nombre,total,estado,origen)
    values(coalesce(nullif(btrim(p_vendedor),''),'Sin vendedor'),v_total,'ACTIVA','VENTA_DIRECTA')
    returning id into v_venta_id;

    for v_item in select * from jsonb_array_elements(p_detalles)
    loop
        v_cantidad := (v_item->>'cantidad')::integer;
        select * into v_producto from public.productos where id=v_item->>'productoId' for update;
        v_subtotal := v_producto.precio_venta*v_cantidad;
        v_pagado := 0;
        for v_pago in select * from jsonb_array_elements(coalesce(v_item->'pagos','[]'::jsonb))
        loop
            v_pagado := v_pagado + coalesce((v_pago->>'monto')::numeric,0);
        end loop;
        if v_pagado > v_subtotal then raise exception 'El pago excede el subtotal de %',v_producto.nombre; end if;

        insert into public.venta_detalles(
            venta_id,producto_id,producto_nombre,cantidad,precio_unitario,subtotal,
            cliente,monto_pagado,monto_pendiente,estado_pago
        ) values(
            v_venta_id,v_producto.id,v_producto.nombre,v_cantidad,v_producto.precio_venta,v_subtotal,
            coalesce(nullif(btrim(v_item->>'cliente'),''),'Cliente'),v_pagado,v_subtotal-v_pagado,
            case when v_pagado>=v_subtotal then 'PAGADO' when v_pagado>0 then 'PARCIAL' else 'PENDIENTE' end
        ) returning id into v_detalle_id;

        for v_pago in select * from jsonb_array_elements(coalesce(v_item->'pagos','[]'::jsonb))
        loop
            if coalesce((v_pago->>'monto')::numeric,0)>0 then
                insert into public.pagos(venta_id,detalle_id,metodo,monto,referencia,notas)
                values(v_venta_id,v_detalle_id,upper(v_pago->>'metodo'),(v_pago->>'monto')::numeric,'VENTA',null);
            end if;
        end loop;

        insert into public.movimientos_inventario(
            producto_id,tipo,cantidad,stock_anterior,stock_nuevo,referencia_tipo,referencia_id,motivo
        ) values(
            v_producto.id,'SALIDA',v_cantidad,v_producto.stock_fisico,v_producto.stock_fisico-v_cantidad,
            'VENTA',v_venta_id,'Venta'
        );
        update public.productos set stock_fisico=stock_fisico-v_cantidad where id=v_producto.id;
    end loop;
    return v_venta_id;
end;
$$;

-- ============================================================
-- ABONO A UNA CUENTA PENDIENTE DE VENTA
-- ============================================================
create or replace function public.registrar_pago_venta_detalle(
    p_detalle_id uuid,
    p_metodo text,
    p_monto numeric,
    p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_det public.venta_detalles%rowtype;
    v_pago_id uuid;
begin
    if p_metodo not in ('EFECTIVO','TRANSFERENCIA','OTRO') then raise exception 'Método inválido'; end if;
    if p_monto <= 0 then raise exception 'Monto inválido'; end if;
    select * into v_det from public.venta_detalles where id=p_detalle_id for update;
    if not found then raise exception 'Cuenta no encontrada'; end if;
    if p_monto > v_det.monto_pendiente then raise exception 'El abono excede el saldo pendiente'; end if;

    insert into public.pagos(venta_id,detalle_id,metodo,monto,referencia,notas)
    values(v_det.venta_id,p_detalle_id,p_metodo,p_monto,'ABONO',p_nota)
    returning id into v_pago_id;

    update public.venta_detalles
    set monto_pagado=monto_pagado+p_monto,
        monto_pendiente=greatest(0,monto_pendiente-p_monto),
        estado_pago=case when monto_pendiente-p_monto<=0.001 then 'PAGADO' else 'PARCIAL' end
    where id=p_detalle_id;
    return v_pago_id;
end;
$$;

-- ============================================================
-- ESTADO COMPLETO DE LA APP
-- Devuelve la forma esperada por script.js.
-- ============================================================
create or replace function public.obtener_estado_app_completo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with sales_json as (
    select coalesce(jsonb_agg(sale_obj order by fecha desc),'[]'::jsonb) value
    from (
        select jsonb_build_object(
            'ventaId',v.id,
            'fecha',v.created_at,
            'vendedor',v.vendedor_nombre,
            'cantidadProductos',coalesce((select sum(d.cantidad) from public.venta_detalles d where d.venta_id=v.id),0),
            'total',v.total,
            'estado',v.estado,
            'detalles',coalesce((select jsonb_agg(jsonb_build_object(
                'detalleId',d.id,'productoId',d.producto_id,'cantidad',d.cantidad,
                'precioUnitario',d.precio_unitario,'subtotal',d.subtotal,'cliente',d.cliente,
                'estadoPago',d.estado_pago,'montoPagado',d.monto_pagado,'montoPendiente',d.monto_pendiente
            ) order by d.created_at) from public.venta_detalles d where d.venta_id=v.id),'[]'::jsonb)
        ) sale_obj,v.created_at fecha
        from public.ventas v
    ) q
), provider_orders as (
    select coalesce(jsonb_agg(obj order by fecha desc),'[]'::jsonb) value
    from (
      select jsonb_build_object(
        'pedidoId',p.id,'fecha',p.created_at,'presupuesto',p.presupuesto,
        'costoTotal',p.total_estimado,'estado',p.estado,
        'detalles',coalesce((select jsonb_agg(jsonb_build_object(
          'productoId',d.producto_id,'cantidad',d.cantidad,'precioCompra',d.precio_compra,'subtotal',d.subtotal
        )) from public.pedido_proveedor_detalles d where d.pedido_id=p.id),'[]'::jsonb)
      ) obj,p.created_at fecha from public.pedidos_proveedor p
    ) q
), customer_orders as (
    select coalesce(jsonb_agg(obj order by fecha),'[]'::jsonb) value
    from (
      select jsonb_build_object(
        'id',p.id,'clienteNombre',p.cliente_nombre,'clienteTelefono',p.cliente_telefono,
        'fechaEntrega',p.fecha_entrega,'estado',p.estado,'total',p.total,
        'montoPagado',p.monto_pagado,'montoPendiente',p.monto_pendiente,'notas',p.notas,
        'detalles',coalesce((select jsonb_agg(jsonb_build_object(
          'id',d.id,'productoId',d.producto_id,'productoNombre',d.producto_nombre,
          'cantidad',d.cantidad,'precioUnitario',d.precio_unitario,'subtotal',d.subtotal
        )) from public.pedido_cliente_detalles d where d.pedido_id=p.id),'[]'::jsonb)
      ) obj,p.fecha_entrega fecha
      from public.pedidos_clientes p
      where p.estado not in ('ENTREGADO','CANCELADO','NO_RECOGIDO')
    ) q
), receivables as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'detalleId',d.id,'ventaId',v.id,'fecha',v.created_at,'vendedor',v.vendedor_nombre,
      'productoId',d.producto_id,'cantidad',d.cantidad,'cliente',d.cliente,
      'subtotal',d.subtotal,'montoPagado',d.monto_pagado,'montoPendiente',d.monto_pendiente,'estadoPago',d.estado_pago
    ) order by v.created_at),'[]'::jsonb) value
    from public.venta_detalles d join public.ventas v on v.id=d.venta_id
    where v.estado='ACTIVA' and d.monto_pendiente>0.001
), products_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'productoId',i.producto_id,'nombre',i.nombre,'categoria',i.categoria,'emoji',i.emoji,
      'precioVenta',i.precio_venta,'precioCompra',i.precio_compra,
      'stockFisico',i.stock_fisico,'stockApartado',i.stock_apartado,'stockDisponible',i.stock_disponible,
      'stock',i.stock_disponible,'stockMinimo',i.stock_minimo,'stockIdeal',i.stock_ideal,'activo',i.activo,
      'ventasUltimos30Dias',coalesce((select sum(d.cantidad) from public.venta_detalles d join public.ventas v on v.id=d.venta_id where d.producto_id=i.producto_id and v.estado='ACTIVA' and v.created_at>=now()-interval '30 days'),0)
    ) order by i.nombre),'[]'::jsonb) value from public.v_inventario i
), dashboard as (
  select jsonb_build_object(
    'ventasHoy',coalesce((select sum(total) from public.ventas where estado='ACTIVA' and created_at >= date_trunc('day',now() at time zone 'America/Merida') at time zone 'America/Merida'),0),
    'productosVendidosHoy',coalesce((select sum(d.cantidad) from public.venta_detalles d join public.ventas v on v.id=d.venta_id where v.estado='ACTIVA' and v.created_at >= date_trunc('day',now() at time zone 'America/Merida') at time zone 'America/Merida'),0),
    'productosDisponibles',coalesce((select sum(stock_disponible) from public.v_inventario where activo),0),
    'productosBajoStock',coalesce((select count(*) from public.v_inventario where activo and stock_disponible<=stock_minimo),0)
  ) value
)
select jsonb_build_object(
 'products',(select value from products_json),
 'sales',(select value from sales_json),
 'orders',(select value from provider_orders),
 'customerOrders',(select value from customer_orders),
 'receivables',(select value from receivables),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('pagoId',id,'ventaId',venta_id,'detalleId',detalle_id,'metodo',metodo,'monto',monto,'fecha',created_at) order by created_at desc) from public.pagos),'[]'::jsonb),
 'movements',coalesce((select jsonb_agg(jsonb_build_object('movimientoId',id,'productoId',producto_id,'tipo',tipo,'cantidad',cantidad,'stockAnterior',stock_anterior,'stockNuevo',stock_nuevo,'fecha',created_at,'motivo',motivo) order by created_at desc) from public.movimientos_inventario),'[]'::jsonb),
 'sellers',coalesce((select jsonb_agg(jsonb_build_object('vendedorId',id,'nombre',nombre,'telefono',telefono,'activo',activo) order by nombre) from public.vendedores),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'tipo',tipo,'canal',canal,'enviarEn',enviar_en,'mensaje',mensaje,'estado',estado) order by enviar_en) from public.notificaciones where estado='PENDIENTE'),'[]'::jsonb),
 'config',coalesce((select jsonb_object_agg(clave,valor) from public.configuracion),'{}'::jsonb),
 'dashboard',(select value from dashboard)
);
$$;

-- Permisos RPC para la anon key durante la etapa de pruebas.
grant usage on schema public to anon;
grant select,insert,update,delete on all tables in schema public to anon;
grant select on public.v_inventario to anon;
grant execute on all functions in schema public to anon;

-- ============================================================
-- ENTREGA DE APARTADO · VERSIÓN PARA FRONTEND
-- Distribuye anticipos/pago final sobre los detalles para que
-- cualquier saldo restante siga apareciendo en "Por cobrar".
-- ============================================================
create or replace function public.entregar_pedido_cliente(
    p_pedido_id uuid,
    p_vendedor_id uuid default null,
    p_vendedor_nombre text default 'Mamá',
    p_pago_final_metodo text default null,
    p_pago_final_monto numeric default 0,
    p_referencia text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pedido public.pedidos_clientes%rowtype;
    v_det record;
    v_producto public.productos%rowtype;
    v_venta_id uuid;
    v_detalle_id uuid;
    v_pago_disponible numeric(10,2);
    v_aplicado numeric(10,2);
    v_metodo text;
begin
    select * into v_pedido from public.pedidos_clientes where id=p_pedido_id for update;
    if not found then raise exception 'Pedido no encontrado'; end if;
    if v_pedido.estado not in ('APARTADO','CONFIRMADO') then raise exception 'El pedido no se puede entregar en estado %',v_pedido.estado; end if;
    if coalesce(p_pago_final_monto,0)<0 then raise exception 'Monto final inválido'; end if;
    if v_pedido.monto_pagado+coalesce(p_pago_final_monto,0)>v_pedido.total then raise exception 'El pago excede el total'; end if;
    if coalesce(p_pago_final_monto,0)>0 and p_pago_final_metodo not in ('EFECTIVO','TRANSFERENCIA','OTRO') then raise exception 'Método de pago final inválido'; end if;

    v_pago_disponible := v_pedido.monto_pagado + coalesce(p_pago_final_monto,0);
    v_metodo := coalesce(p_pago_final_metodo,'OTRO');

    insert into public.ventas(vendedor_id,vendedor_nombre,cliente_nombre,cliente_telefono,origen,pedido_cliente_id,total,estado,notas)
    values(p_vendedor_id,coalesce(nullif(btrim(p_vendedor_nombre),''),'Mamá'),v_pedido.cliente_nombre,v_pedido.cliente_telefono,'PEDIDO_CLIENTE',v_pedido.id,v_pedido.total,'ACTIVA','Entrega de pedido apartado')
    returning id into v_venta_id;

    for v_det in select * from public.pedido_cliente_detalles where pedido_id=p_pedido_id order by id
    loop
        select * into v_producto from public.productos where id=v_det.producto_id for update;
        if v_producto.stock_fisico<v_det.cantidad then raise exception 'Stock físico insuficiente para %',v_producto.nombre; end if;

        v_aplicado := least(v_pago_disponible,v_det.subtotal);
        insert into public.venta_detalles(
          venta_id,producto_id,producto_nombre,cantidad,precio_unitario,subtotal,cliente,
          monto_pagado,monto_pendiente,estado_pago
        ) values(
          v_venta_id,v_det.producto_id,v_det.producto_nombre,v_det.cantidad,v_det.precio_unitario,v_det.subtotal,
          v_pedido.cliente_nombre,v_aplicado,v_det.subtotal-v_aplicado,
          case when v_aplicado>=v_det.subtotal then 'PAGADO' when v_aplicado>0 then 'PARCIAL' else 'PENDIENTE' end
        ) returning id into v_detalle_id;
        v_pago_disponible := greatest(0,v_pago_disponible-v_aplicado);

        insert into public.movimientos_inventario(producto_id,tipo,cantidad,stock_anterior,stock_nuevo,referencia_tipo,referencia_id,motivo)
        values(v_producto.id,'SALIDA',v_det.cantidad,v_producto.stock_fisico,v_producto.stock_fisico-v_det.cantidad,'PEDIDO_CLIENTE',v_pedido.id,'Entrega de pedido');
        update public.productos set stock_fisico=stock_fisico-v_det.cantidad where id=v_producto.id;
    end loop;

    -- Los anticipos se conservan como pagos globales de la venta.
    insert into public.pagos(venta_id,metodo,monto,referencia,notas)
    select v_venta_id,metodo,monto,coalesce(referencia,'ANTICIPO'),'Anticipo del pedido'
    from public.pedido_cliente_pagos where pedido_id=p_pedido_id;

    if coalesce(p_pago_final_monto,0)>0 then
      insert into public.pagos(venta_id,metodo,monto,referencia,notas)
      values(v_venta_id,p_pago_final_metodo,p_pago_final_monto,p_referencia,'Pago al entregar pedido');
    end if;

    update public.pedidos_clientes
    set estado='ENTREGADO',monto_pagado=monto_pagado+coalesce(p_pago_final_monto,0),entregado_at=now()
    where id=p_pedido_id;
    update public.notificaciones set estado='CANCELADA' where pedido_cliente_id=p_pedido_id and estado='PENDIENTE';
    return v_venta_id;
end;
$$;

-- ============================================================
-- DESHACER ÚLTIMA VENTA · restaura también un apartado entregado
-- ============================================================
create or replace function public.cancelar_ultima_venta()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_venta public.ventas%rowtype;
    v_det record;
    v_stock integer;
begin
    select * into v_venta from public.ventas where estado='ACTIVA' order by created_at desc limit 1 for update;
    if not found then raise exception 'No hay una venta activa para deshacer'; end if;

    for v_det in select * from public.venta_detalles where venta_id=v_venta.id
    loop
        select stock_fisico into v_stock from public.productos where id=v_det.producto_id for update;
        insert into public.movimientos_inventario(producto_id,tipo,cantidad,stock_anterior,stock_nuevo,referencia_tipo,referencia_id,motivo)
        values(v_det.producto_id,'DEVOLUCION',v_det.cantidad,v_stock,v_stock+v_det.cantidad,'VENTA',v_venta.id,'Cancelación de venta');
        update public.productos set stock_fisico=stock_fisico+v_det.cantidad where id=v_det.producto_id;
    end loop;

    update public.ventas set estado='CANCELADA',cancelled_at=now() where id=v_venta.id;

    if v_venta.pedido_cliente_id is not null then
        update public.pedidos_clientes set estado='CONFIRMADO',entregado_at=null where id=v_venta.pedido_cliente_id;
    end if;
    return v_venta.id;
end;
$$;

grant execute on function public.entregar_pedido_cliente(uuid,uuid,text,text,numeric,text) to anon;
grant execute on function public.cancelar_ultima_venta() to anon;

-- ============================================================
-- ADMINISTRACIÓN DE PRODUCTOS DESDE LA APP
-- ============================================================
create or replace function public.crear_producto(
    p_nombre text,
    p_categoria text default 'Trol',
    p_emoji text default null,
    p_precio_venta numeric default 0,
    p_precio_compra numeric default 0,
    p_stock_inicial integer default 0,
    p_stock_minimo integer default 5,
    p_stock_ideal integer default 12
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id text;
begin
    if p_nombre is null or btrim(p_nombre) = '' then raise exception 'El nombre es requerido'; end if;
    if p_precio_venta < 0 or p_precio_compra < 0 then raise exception 'Los precios no pueden ser negativos'; end if;
    if p_stock_inicial < 0 or p_stock_minimo < 0 or p_stock_ideal < 0 then raise exception 'El stock no puede ser negativo'; end if;
    if exists(select 1 from public.productos where lower(nombre)=lower(btrim(p_nombre))) then raise exception 'Ya existe un producto con ese nombre'; end if;

    v_id := 'PR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    insert into public.productos(id,nombre,categoria,emoji,precio_venta,precio_compra,stock_fisico,stock_minimo,stock_ideal,activo)
    values(v_id,btrim(p_nombre),coalesce(nullif(btrim(p_categoria),''),'Trol'),nullif(btrim(p_emoji),''),p_precio_venta,p_precio_compra,p_stock_inicial,p_stock_minimo,p_stock_ideal,true);

    if p_stock_inicial > 0 then
      insert into public.movimientos_inventario(producto_id,tipo,cantidad,stock_anterior,stock_nuevo,motivo)
      values(v_id,'ENTRADA',p_stock_inicial,0,p_stock_inicial,'Existencia inicial al crear producto');
    end if;
    return v_id;
end;
$$;

create or replace function public.actualizar_producto(
    p_producto_id text,
    p_nombre text,
    p_categoria text,
    p_emoji text,
    p_precio_venta numeric,
    p_precio_compra numeric,
    p_stock_minimo integer,
    p_stock_ideal integer,
    p_activo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_nombre is null or btrim(p_nombre) = '' then raise exception 'El nombre es requerido'; end if;
    if p_precio_venta < 0 or p_precio_compra < 0 then raise exception 'Los precios no pueden ser negativos'; end if;
    if p_stock_minimo < 0 or p_stock_ideal < 0 then raise exception 'El stock no puede ser negativo'; end if;
    if exists(select 1 from public.productos where lower(nombre)=lower(btrim(p_nombre)) and id<>p_producto_id) then raise exception 'Ya existe otro producto con ese nombre'; end if;

    update public.productos set
      nombre=btrim(p_nombre), categoria=coalesce(nullif(btrim(p_categoria),''),'Trol'), emoji=nullif(btrim(p_emoji),''),
      precio_venta=p_precio_venta, precio_compra=p_precio_compra, stock_minimo=p_stock_minimo,
      stock_ideal=p_stock_ideal, activo=p_activo
    where id=p_producto_id;
    if not found then raise exception 'Producto no encontrado'; end if;
end;
$$;

grant execute on function public.crear_producto(text,text,text,numeric,numeric,integer,integer,integer) to anon;
grant execute on function public.actualizar_producto(text,text,text,numeric,numeric,integer,integer,boolean) to anon;
