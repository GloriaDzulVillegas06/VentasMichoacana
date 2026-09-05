# La Michoacana / Troles 2.0 — Supabase

## 1. Crear la base
En Supabase abre **SQL Editor > New query**, pega todo `supabase.sql` y ejecuta **Run**.

> Este archivo está pensado para una base nueva. No necesitas ejecutar los SQL anteriores.

## 2. Conectar la página
En Supabase copia:
- **Project URL**
- **anon/public key**

Abre `config.js` y reemplaza:

```js
window.TROLES_CONFIG = {
  SUPABASE_URL: 'PEGA_AQUI_TU_PROJECT_URL',
  SUPABASE_ANON_KEY: 'PEGA_AQUI_TU_ANON_KEY'
};
```

No uses nunca la `service_role` en GitHub Pages.

## 3. Cargar existencias reales
El SQL crea los productos con stock inicial 0. Puedes cargar stock desde la propia pantalla **Inventario > + Mercancía** una vez conectada.

## 4. Funciones nuevas
- Stock físico, apartado y disponible.
- Levantar apartados con cliente, teléfono, fecha y hora.
- Validación para no apartar más unidades de las disponibles.
- Confirmar o cancelar apartados.
- Cancelar libera unidades automáticamente.
- Registrar anticipos.
- Entregar un apartado lo convierte en venta y descuenta stock físico.
- Los saldos de pedidos entregados siguen apareciendo en **Por cobrar**.
- Recordatorios 24 h y 2 h antes en la campana de la aplicación.
- Cola de notificaciones lista para conectar WhatsApp posteriormente.
- Recomendación de pedido a proveedor usa stock disponible, por lo que considera apartados.

## Importante sobre los recordatorios
En esta versión los recordatorios se muestran dentro de la PWA al abrir/refrescar la aplicación. Todavía no son notificaciones push del sistema ni mensajes automáticos de WhatsApp; la base ya deja la cola preparada para conectar ese canal después.

## Seguridad
Para la primera prueba, el SQL permite acceso con la anon key y no exige login. Antes de usar la página públicamente se debe activar Supabase Auth y RLS para proteger las operaciones de escritura.

## Productos y sabores
En **Inventario → + Producto** puedes crear nuevos sabores/productos con nombre, categoría, emoji, precios, existencia inicial, stock mínimo e ideal. En cada tarjeta aparece **Editar** para cambiar esos datos o desactivar el producto. Se desactiva en lugar de borrarlo para conservar el historial de ventas.


## Modificar pedidos al proveedor
Los pedidos en estado PEDIDO ahora se pueden abrir desde **Ver pedidos proveedor > Modificar pedido**. Puedes agregar productos, quitar productos, cambiar cantidades o presupuesto y guardar los cambios. Los pedidos RECIBIDOS no se pueden editar para proteger el inventario.
