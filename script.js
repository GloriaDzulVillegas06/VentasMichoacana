'use strict';

const SUPABASE_URL = (window.TROLES_CONFIG?.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = window.TROLES_CONFIG?.SUPABASE_ANON_KEY || '';
const DEMO_MODE = !SUPABASE_URL || SUPABASE_URL.includes('PEGA_AQUI') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PEGA_AQUI');
const DEMO_KEY = 'michoacana_demo_v2';
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const initialProducts = [
  ['TR001','Coco','Trol',35,18,10,5,12,'🥥'],['TR002','Elote','Trol',35,18,8,5,12,'🌽'],
  ['TR003','Fresa','Trol',35,18,3,5,12,'🍓'],['TR004','Galleta','Trol',35,18,7,5,12,'🍪'],
  ['TR005','Oreo','Trol',35,18,2,5,12,'🍪'],['TR006','Uva','Trol',35,18,9,5,12,'🍇'],
  ['TR007','Chocolate','Trol',35,18,6,5,12,'🍫'],['TR008','Mango c/chamoy','Trol',35,18,12,5,12,'🥭'],
  ['TR009','Piña c/chamoy','Trol',35,18,5,5,12,'🍍'],['TR010','Limón c/chamoy','Trol',35,18,4,5,12,'🍋'],
  ['TR011','Tamarindo c/chamoy','Trol',35,18,6,5,12,'🌶️'],['TR012','Guanábana','Trol',35,18,8,5,12,'🍈'],
  ['TR013','Sandía','Trol',35,18,0,5,12,'🍉'],['TR014','Chicle','Trol',35,18,7,5,12,'🍬'],
  ['OT001','Fresas con crema','Otro',45,25,5,3,8,'🍓'],['OT002','Bolsas de hielo','Otro',10,5,10,4,15,'🧊']
].map(([productoId,nombre,categoria,precioVenta,precioCompra,stock,stockMinimo,stockIdeal,emoji]) => ({ productoId,nombre,categoria,precioVenta,precioCompra,stock,stockMinimo,stockIdeal,emoji,activo:true,ventasUltimos30Dias:0 }));

let state = { products: [], sales: [], orders: [], customerOrders: [], notifications: [], movements: [], sellers: [], receivables: [], payments: [], config: { nombreNegocio:'La Michoacana', mensajeWhatsApp:'¡Sabor que te enamora!', moneda:'MXN' }, dashboard:null, statistics:null };
let saleCart = {};
let orderCart = {};
let editingOrderId = null;
let historyPeriod = 'today';
let confirmResolver = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  $('#demoBadge').hidden = !DEMO_MODE;
  bindEvents();
  await refreshAll();
}

function bindEvents() {
  $$('.bottom-nav button').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  $$('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
  $('#quickEntry').addEventListener('click', openInventoryEntry);
  $('#inventoryEntryBtn').addEventListener('click', openInventoryEntry);
  $('#newProductBtn').addEventListener('click', openProductForm);
  $('#quickShare').addEventListener('click', openShare);
  $('#quickCustomerOrder').addEventListener('click', openCustomerOrderForm);
  $('#quickCustomerOrders').addEventListener('click', openCustomerOrders);
  $('#newCustomerOrderBtn').addEventListener('click', openCustomerOrderForm);
  $('#customerOrdersBtn').addEventListener('click', openCustomerOrders);
  $('#notificationBtn').addEventListener('click', openNotifications);
  $('#registerSaleBtn').addEventListener('click', registerSale);
  $('#undoSaleBtn').addEventListener('click', undoLastSale);
  $('#inventorySearch').addEventListener('input', renderInventory);
  $('#generateOrderBtn').addEventListener('click', () => generarPedidoPorPresupuesto(Number($('#budgetInput').value)));
  $('#budgetInput').addEventListener('input', updateOrderSummary);
  $('#createOrderBtn').addEventListener('click', createOrder);
  $('#cancelOrderEditBtn').addEventListener('click', cancelOrderEdit);
  $('#shareOrderBtn').addEventListener('click', () => shareOrderByWhatsApp());
  $('#ordersHistoryBtn').addEventListener('click', openOrders);
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', e => { if (e.target === $('#modalBackdrop')) closeModal(); });
  $('#confirmCancelBtn').addEventListener('click',()=>resolveConfirmation(false));
  $('#confirmAcceptBtn').addEventListener('click',()=>resolveConfirmation(true));
  $('#confirmBackdrop').addEventListener('click',e=>{if(e.target===$('#confirmBackdrop'))resolveConfirmation(false)});
  $('#historyFilters').addEventListener('click', e => { if (!e.target.dataset.period) return; historyPeriod=e.target.dataset.period; $$('#historyFilters button').forEach(b=>b.classList.toggle('active',b===e.target)); $('#customDates').hidden=historyPeriod!=='custom'; if(historyPeriod==='custom'){const today=localDateValue(new Date());if(!$('#dateFrom').value)$('#dateFrom').value=today;if(!$('#dateTo').value)$('#dateTo').value=today;$('#historyRangeCaption').textContent='Selecciona las fechas y pulsa Aplicar';}else{renderHistory();updateHistoryCaption();} });
  $('#applyDates').addEventListener('click',()=>{const from=$('#dateFrom').value,to=$('#dateTo').value;if(!from||!to)return toast('Selecciona ambas fechas',true);if(from>to)return toast('La fecha inicial no puede ser posterior a la final',true);renderHistory();updateHistoryCaption()});
}

async function supabaseRpc(functionName, payload = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(body?.message || body?.details || `Supabase HTTP ${response.status}`);
  return body;
}

function normalizeServerState(data = {}) {
  const normalized = { ...data };
  normalized.products = (data.products || []).map(p => ({
    ...p,
    stockFisico: Number(p.stockFisico ?? p.stock ?? 0),
    stockApartado: Number(p.stockApartado ?? 0),
    stockDisponible: Number(p.stockDisponible ?? p.stock ?? 0),
    stock: Number(p.stockDisponible ?? p.stock ?? 0),
    ventasUltimos30Dias: Number(p.ventasUltimos30Dias ?? 0)
  }));
  normalized.sales = data.sales || [];
  normalized.orders = data.orders || [];
  normalized.customerOrders = data.customerOrders || [];
  normalized.notifications = data.notifications || [];
  normalized.receivables = data.receivables || [];
  normalized.payments = data.payments || [];
  normalized.movements = data.movements || [];
  return normalized;
}

async function apiRequest(action, data = {}) {
  if (DEMO_MODE) return demoApi(action, data);
  try {
    let result;
    switch (action) {
      case 'getDashboard':
        result = normalizeServerState(await supabaseRpc('obtener_estado_app_completo'));
        return { success:true, data:result, message:'' };
      case 'registerSale':
        result = await supabaseRpc('registrar_venta_app', { p_vendedor: data.vendedor, p_detalles: data.detalles });
        return { success:true, data:result, message:'✅ Venta registrada' };
      case 'registerPayment':
        result = await supabaseRpc('registrar_pago_venta_detalle', { p_detalle_id: data.detalleId, p_metodo: data.metodo, p_monto: Number(data.monto), p_nota: data.nota || null });
        return { success:true, data:result, message:'Pago registrado' };
      case 'undoLastSale':
        result = await supabaseRpc('cancelar_ultima_venta');
        return { success:true, data:result, message:'Venta cancelada e inventario recuperado' };
      case 'registerInventoryEntry':
        if (data.pedidoId) {
          await supabaseRpc('recibir_pedido_proveedor', { p_pedido_id: data.pedidoId });
        } else {
          for (const d of data.detalles) await supabaseRpc('registrar_entrada_inventario', { p_producto_id:d.productoId, p_cantidad:Number(d.cantidad), p_motivo:'Entrada manual' });
        }
        return { success:true, data:null, message:'Mercancía registrada' };
      case 'adjustInventory': {
        const p = state.products.find(x => x.productoId === data.productoId);
        const fisico = Number(p?.stockFisico ?? p?.stock ?? 0);
        await supabaseRpc('ajustar_inventario', { p_producto_id:data.productoId, p_nuevo_stock:fisico + Number(data.cantidad), p_motivo:data.motivo || data.tipo || 'Ajuste manual' });
        return { success:true, data:null, message:'Inventario actualizado' };
      }
      case 'createProduct':
        result = await supabaseRpc('crear_producto', { p_nombre:data.nombre, p_categoria:data.categoria, p_emoji:data.emoji || null, p_precio_venta:Number(data.precioVenta), p_precio_compra:Number(data.precioCompra), p_stock_inicial:Number(data.stockInicial), p_stock_minimo:Number(data.stockMinimo), p_stock_ideal:Number(data.stockIdeal) });
        return { success:true, data:result, message:'Producto agregado' };
      case 'updateProduct':
        await supabaseRpc('actualizar_producto', { p_producto_id:data.productoId, p_nombre:data.nombre, p_categoria:data.categoria, p_emoji:data.emoji || null, p_precio_venta:Number(data.precioVenta), p_precio_compra:Number(data.precioCompra), p_stock_minimo:Number(data.stockMinimo), p_stock_ideal:Number(data.stockIdeal), p_activo:Boolean(data.activo) });
        return { success:true, data:null, message:'Producto actualizado' };
      case 'createOrder':
        result = await supabaseRpc('crear_pedido_proveedor', { p_presupuesto:Number(data.presupuesto), p_items:data.detalles, p_notas:null });
        return { success:true, data:result, message:'Pedido guardado' };
      case 'updateOrder':
        result = await supabaseRpc('actualizar_pedido_proveedor', { p_pedido_id:data.pedidoId, p_presupuesto:Number(data.presupuesto), p_items:data.detalles, p_notas:null });
        return { success:true, data:result, message:'Pedido actualizado' };
      case 'receiveOrder':
        await supabaseRpc('recibir_pedido_proveedor', { p_pedido_id:data.pedidoId });
        return { success:true, data:null, message:'Pedido recibido' };
      case 'createCustomerOrder':
        result = await supabaseRpc('crear_pedido_cliente', { p_cliente_nombre:data.clienteNombre, p_cliente_telefono:data.clienteTelefono || null, p_fecha_entrega:data.fechaEntrega, p_items:data.detalles, p_notas:data.notas || null, p_vendedor_id:null });
        return { success:true, data:result, message:'🍧 Apartado registrado' };
      case 'changeCustomerOrderStatus':
        await supabaseRpc('cambiar_estado_pedido_cliente', { p_pedido_id:data.pedidoId, p_estado:data.estado });
        return { success:true, data:null, message:'Pedido actualizado' };
      case 'payCustomerOrder':
        result = await supabaseRpc('registrar_pago_pedido_cliente', { p_pedido_id:data.pedidoId, p_metodo:data.metodo, p_monto:Number(data.monto), p_referencia:data.referencia || null, p_notas:data.notas || null });
        return { success:true, data:result, message:'Anticipo registrado' };
      case 'deliverCustomerOrder':
        result = await supabaseRpc('entregar_pedido_cliente', { p_pedido_id:data.pedidoId, p_vendedor_id:null, p_vendedor_nombre:data.vendedor || 'Mamá', p_pago_final_metodo:data.metodo || null, p_pago_final_monto:Number(data.monto || 0), p_referencia:data.referencia || null });
        return { success:true, data:result, message:'✅ Pedido entregado y venta registrada' };
      case 'markNotificationSent':
        await supabaseRpc('marcar_notificacion_enviada', { p_notificacion_id:data.notificacionId });
        return { success:true, data:null, message:'' };
      default:
        throw new Error(`Acción no soportada: ${action}`);
    }
  } catch (error) {
    console.error(`Supabase ${action}:`, error);
    throw new Error(error.message || 'No se pudo conectar con Supabase.');
  }
}

async function refreshAll(showLoader = true) {
  setLoading(showLoader);
  try {
    const result = await apiRequest('getDashboard');
    state = { ...state, ...result.data };
    renderAll();
  } catch (error) { toast(error.message, true); }
  finally { setLoading(false); }
}

function renderAll() { renderDashboard(); renderSellers(); renderSaleProducts(); renderInventory(); renderHistory(); renderPeriodStatistics(); renderReceivables(); renderNotificationBadge(); }
function renderSellers(){const current=$('#sellerSelect').value;const sellers=(state.sellers||[]).filter(s=>typeof s==='string'||s.activo).map(s=>typeof s==='string'?s:s.nombre);const values=sellers.length?sellers:['Mamá','Miri','Papá','Rodrigo','Gloria'];$('#sellerSelect').innerHTML=values.map(name=>`<option>${escapeHtml(name)}</option>`).join('');if(values.includes(current))$('#sellerSelect').value=current}
function stockStatus(p) { const stock=Number(p.stockDisponible ?? p.stock ?? 0); return stock <= 0 ? 'out' : stock <= p.stockMinimo ? 'low' : 'normal'; }
function statusLabel(p) { return stockStatus(p)==='out'?'Agotado':stockStatus(p)==='low'?'Stock bajo':'Normal'; }
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function renderDashboard() {
  const d = state.dashboard || calculateDashboard();
  $('#dashboardCards').innerHTML = [
    ['💰','Ventas de hoy',money.format(d.ventasHoy)],['🍧','Productos vendidos',d.productosVendidosHoy],
    ['📦','Unidades disponibles',d.productosDisponibles],['⚠️','Con poco stock',`${d.productosBajoStock} productos`]
  ].map(x=>`<article class="metric-card"><div class="icon">${x[0]}</div><span>${x[1]}</span><strong>${x[2]}</strong></article>`).join('');
  const lows=state.products.filter(p=>Number(p.stockDisponible??p.stock)<=p.stockMinimo).sort((a,b)=>Number(a.stockDisponible??a.stock)-Number(b.stockDisponible??b.stock));
  $('#lowStockList').innerHTML=lows.length?lows.map(p=>`<div class="attention-item ${p.stock===0?'out':''}"><span>${p.emoji} <strong>${escapeHtml(p.nombre)}</strong></span><span>${Number(p.stockDisponible??p.stock)===0?'agotado':`quedan ${Number(p.stockDisponible??p.stock)}`}</span></div>`).join(''):'<div class="empty">✨ Todo está bien surtido</div>';
}

function renderSaleProducts() {
  $('#saleProducts').innerHTML=state.products.filter(p=>p.activo).map(p=>`<article class="product-card ${Number(p.stockDisponible??p.stock)<=0?'sold-out':''}"><div class="product-name">${p.emoji} ${escapeHtml(p.nombre)}</div><div class="product-price">${money.format(p.precioVenta)} · disponibles ${Number(p.stockDisponible??p.stock)}</div><div class="stepper"><button data-sale-minus="${p.productoId}" aria-label="Quitar ${escapeHtml(p.nombre)}">−</button><strong id="sale-qty-${p.productoId}">${saleCart[p.productoId]||0}</strong><button data-sale-plus="${p.productoId}" ${Number(p.stockDisponible??p.stock)<=0?'disabled':''} aria-label="Agregar ${escapeHtml(p.nombre)}">+</button></div></article>`).join('');
  $$('[data-sale-plus]').forEach(b=>b.addEventListener('click',()=>changeSaleQty(b.dataset.salePlus,1)));
  $$('[data-sale-minus]').forEach(b=>b.addEventListener('click',()=>changeSaleQty(b.dataset.saleMinus,-1)));
  updateSaleSummary();
}

function changeSaleQty(id, delta) {
  const p=state.products.find(x=>x.productoId===id); const next=Math.max(0,(saleCart[id]||0)+delta);
  const available=Number(p.stockDisponible??p.stock); if(next>available) return toast(`Solo hay ${available} disponibles de ${p.nombre}`,true);
  saleCart[id]=next; $(`#sale-qty-${id}`).textContent=next; updateSaleSummary();
}
function updateSaleSummary(){ const items=Object.entries(saleCart).filter(([,q])=>q>0); const count=items.reduce((s,[,q])=>s+q,0); const total=items.reduce((s,[id,q])=>s+state.products.find(p=>p.productoId===id).precioVenta*q,0); $('#saleItemCount').textContent=count; $('#saleTotal').textContent=money.format(total); $('#registerSaleBtn').textContent=`Continuar · ${money.format(total)}`; $('#registerSaleBtn').disabled=count===0; }

function registerSale(){
  const items=Object.entries(saleCart).filter(([,cantidad])=>cantidad>0);if(!items.length)return;
  const cards=[];items.forEach(([id,cantidad])=>{const p=state.products.find(x=>x.productoId===id);for(let unit=1;unit<=cantidad;unit++){const subtotal=p.precioVenta;cards.push(`<article class="payment-card" data-checkout="${id}-${unit}" data-product="${id}" data-subtotal="${subtotal}"><h3>${p.emoji} ${escapeHtml(p.nombre)}${cantidad>1?` · ${unit} de ${cantidad}`:''}</h3><div class="amount-due">${money.format(subtotal)}</div><label>¿Para quién es?<input data-client required placeholder="Nombre del cliente"></label><label>Forma de pago<select data-payment-method><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="PENDIENTE">No ha pagado</option><option value="MIXTO">Pago dividido o abono</option></select></label><div class="split-fields"><label>Efectivo<input data-cash type="number" min="0" max="${subtotal}" step="0.01" value="${subtotal}"></label><label>Transferencia<input data-transfer type="number" min="0" max="${subtotal}" step="0.01" value="0" disabled></label></div><div class="payment-status">Pagado: ${money.format(subtotal)} · Pendiente: ${money.format(0)}</div></article>`);}});
  openModal('Cliente y forma de pago',`<form id="checkoutForm" class="modal-form"><p class="inventory-meta">Cada unidad es una cuenta separada. Puedes asignar personas y pagos diferentes.</p>${cards.join('')}<div id="checkoutTotals" class="payment-status"></div><button class="primary-button" type="submit">Confirmar venta</button></form>`);
  $$('[data-payment-method]').forEach(s=>s.addEventListener('change',()=>updateCheckoutCard(s.closest('[data-checkout]'),true)));$$('[data-cash],[data-transfer]').forEach(i=>i.addEventListener('input',()=>updateCheckoutCard(i.closest('[data-checkout]'))));$('#checkoutForm').addEventListener('submit',submitSaleCheckout);updateCheckoutTotals();
}
function updateCheckoutCard(card,reset=false){const method=$('[data-payment-method]',card).value,subtotal=Number(card.dataset.subtotal),cash=$('[data-cash]',card),transfer=$('[data-transfer]',card);cash.disabled=method==='TRANSFERENCIA'||method==='PENDIENTE';transfer.disabled=method==='EFECTIVO'||method==='PENDIENTE';if(reset){cash.value=method==='EFECTIVO'?subtotal:0;transfer.value=method==='TRANSFERENCIA'?subtotal:0}const cashAmount=Number(cash.value||0),transferAmount=Number(transfer.value||0),paid=cashAmount+transferAmount,pending=Math.max(0,subtotal-paid),isOver=paid>subtotal+0.001,isIncomplete=(method==='EFECTIVO'||method==='TRANSFERENCIA')&&Math.abs(paid-subtotal)>0.001,isEmptyMixed=method==='MIXTO'&&paid<=0,status=$('.payment-status',card);status.textContent=isOver?`El pago supera ${money.format(subtotal)}`:isIncomplete?`Debe recibirse exactamente ${money.format(subtotal)}`:isEmptyMixed?'Captura un abono o selecciona “No ha pagado”':`Pagado: ${money.format(paid)} · Pendiente: ${money.format(pending)}`;status.classList.toggle('pending',!isOver&&pending>0);status.classList.toggle('invalid',isOver||isIncomplete||isEmptyMixed);updateCheckoutTotals()}
function updateCheckoutTotals(){const cards=$$('[data-checkout]');if(!cards.length||!$('#checkoutTotals'))return;let total=0,paid=0;cards.forEach(card=>{total+=Number(card.dataset.subtotal);paid+=Number($('[data-cash]',card).value||0)+Number($('[data-transfer]',card).value||0)});$('#checkoutTotals').textContent=`Total ${money.format(total)} · Recibido ${money.format(paid)} · Por cobrar ${money.format(Math.max(0,total-paid))}`}
async function submitSaleCheckout(e){e.preventDefault();const detalles=[];for(const card of $$('[data-checkout]')){const productoId=card.dataset.product,subtotal=Number(card.dataset.subtotal),cliente=$('[data-client]',card).value.trim(),method=$('[data-payment-method]',card).value,cash=Number($('[data-cash]',card).value||0),transfer=Number($('[data-transfer]',card).value||0),paid=cash+transfer;let pagos=[];if(!cliente)return toast('Escribe el nombre de cada cliente',true);if(cash<0||transfer<0||paid>subtotal+0.001)return toast(`No puedes recibir más de ${money.format(subtotal)}`,true);if((method==='EFECTIVO'||method==='TRANSFERENCIA')&&Math.abs(paid-subtotal)>0.001)return toast(`El pago debe ser exactamente ${money.format(subtotal)}`,true);if(method==='EFECTIVO'&&transfer>0)return toast('En efectivo no debe haber importe de transferencia',true);if(method==='TRANSFERENCIA'&&cash>0)return toast('En transferencia no debe haber importe de efectivo',true);if(method==='PENDIENTE'&&paid>0)return toast('Selecciona una forma de pago para registrar el importe',true);if(method==='MIXTO'&&paid<=0)return toast('Captura un abono o selecciona “No ha pagado”',true);if(cash>0)pagos.push({metodo:'EFECTIVO',monto:cash});if(transfer>0)pagos.push({metodo:'TRANSFERENCIA',monto:transfer});detalles.push({productoId,cantidad:1,cliente,pagos})}if(!await appConfirm(`¿Registrar la venta por ${$('#saleTotal').textContent}?`))return;setLoading(true);try{const r=await apiRequest('registerSale',{vendedor:$('#sellerSelect').value,detalles});closeModal();resetSaleForm();await refreshAll(false);historyPeriod='today';$$('#historyFilters button').forEach(b=>b.classList.toggle('active',b.dataset.period==='today'));$('#customDates').hidden=true;navigate('history');toast(r.message||'✅ Venta registrada')}catch(err){console.error(err);toast('❌ No se pudo registrar la venta.',true)}finally{setLoading(false)}}
function resetSaleForm(){saleCart={};renderSaleProducts();$('#sellerSelect').selectedIndex=0;$('#saleItemCount').textContent='0';$('#saleTotal').textContent=money.format(0);$('#registerSaleBtn').textContent=`Continuar · ${money.format(0)}`;$('#registerSaleBtn').disabled=true}

async function undoLastSale(){
  if(!await appConfirm('¿Deseas deshacer la última venta registrada?','Deshacer venta'))return; setLoading(true);
  try{const r=await apiRequest('undoLastSale');toast(r.message||'Venta cancelada e inventario recuperado');saleCart={};await refreshAll(false)}catch(e){console.error(e);toast(e.message,true)}finally{setLoading(false)}
}

function renderInventory(){
  const q=$('#inventorySearch').value.trim().toLowerCase(); const products=state.products.filter(p=>p.nombre.toLowerCase().includes(q));
  $('#inventoryProducts').innerHTML=products.length?products.map(p=>{const fisico=Number(p.stockFisico??p.stock??0),apartado=Number(p.stockApartado??0),disponible=Number(p.stockDisponible??p.stock??0);return `<article class="inventory-card ${stockStatus(p)}"><div><h3>${p.emoji||'🍧'} ${escapeHtml(p.nombre)}</h3><div class="inventory-meta">${money.format(p.precioVenta)} · ${escapeHtml(p.categoria||'Producto')} · Mín. ${p.stockMinimo} · Ideal ${p.stockIdeal}<div class="stock-breakdown"><span class="stock-chip">Físico ${fisico}</span><span class="stock-chip reserved">Apartado ${apartado}</span><span class="stock-chip available">Disponible ${disponible}</span></div></div></div><div class="stock-value"><strong>${disponible}</strong><span>disponibles</span><button data-adjust="${p.productoId}">Modificar físico</button><button data-edit-product="${p.productoId}">Editar</button></div></article>`}).join(''):'<div class="empty">No se encontraron productos</div>';
  $$('[data-adjust]').forEach(b=>b.addEventListener('click',()=>openAdjustment(b.dataset.adjust)));$$('[data-edit-product]').forEach(b=>b.addEventListener('click',()=>openProductForm(b.dataset.editProduct)));
}

function openProductForm(id=null){
  const p=id?state.products.find(x=>x.productoId===id):null;
  openModal(p?'Editar producto':'Nuevo producto',`<form id="productForm" class="modal-form">
    <label>Nombre<input id="productName" maxlength="80" required value="${escapeHtml(p?.nombre||'')}" placeholder="Ej. Mazapán"></label>
    <label>Categoría<select id="productCategory"><option value="Trol" ${!p||p.categoria==='Trol'?'selected':''}>Trol</option><option value="Otro" ${p?.categoria==='Otro'?'selected':''}>Otro</option><option value="Paleta" ${p?.categoria==='Paleta'?'selected':''}>Paleta</option><option value="Bebida" ${p?.categoria==='Bebida'?'selected':''}>Bebida</option></select></label>
    <label>Emoji (opcional)<input id="productEmoji" maxlength="8" value="${escapeHtml(p?.emoji||'🍧')}" placeholder="🍧"></label>
    <div class="split-fields"><label>Precio venta<input id="productSalePrice" type="number" min="0" step="0.01" required value="${p?.precioVenta??35}"></label><label>Precio compra<input id="productBuyPrice" type="number" min="0" step="0.01" required value="${p?.precioCompra??0}"></label></div>
    ${p?'':`<label>Existencia inicial<input id="productInitialStock" type="number" min="0" step="1" required value="0"></label>`}
    <div class="split-fields"><label>Stock mínimo<input id="productMinStock" type="number" min="0" step="1" required value="${p?.stockMinimo??5}"></label><label>Stock ideal<input id="productIdealStock" type="number" min="0" step="1" required value="${p?.stockIdeal??12}"></label></div>
    ${p?`<label class="switch-row"><span>Producto activo<small>Si lo desactivas deja de aparecer para nuevas ventas y apartados.</small></span><span class="switch"><input id="productActive" type="checkbox" ${p.activo!==false?'checked':''}><span></span></span></label>`:''}
    <button class="primary-button" type="submit">${p?'Guardar cambios':'Agregar producto'}</button>
  </form>`);
  $('#productForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const payload={nombre:$('#productName').value.trim(),categoria:$('#productCategory').value,emoji:$('#productEmoji').value.trim()||'🍧',precioVenta:Number($('#productSalePrice').value),precioCompra:Number($('#productBuyPrice').value),stockMinimo:Number($('#productMinStock').value),stockIdeal:Number($('#productIdealStock').value)};
    if(!payload.nombre)return toast('Escribe el nombre del producto',true);
    if(payload.precioVenta<0||payload.precioCompra<0||payload.stockMinimo<0||payload.stockIdeal<0)return toast('Revisa precios y existencias',true);
    setLoading(true);
    try{
      if(p){payload.productoId=p.productoId;payload.activo=$('#productActive').checked;await apiRequest('updateProduct',payload)}
      else{payload.stockInicial=Number($('#productInitialStock').value);if(payload.stockInicial<0)return toast('La existencia inicial no puede ser negativa',true);await apiRequest('createProduct',payload)}
      closeModal();toast(p?'Producto actualizado':'🍧 Producto agregado');await refreshAll(false);
    }catch(err){console.error(err);toast(err.message,true)}finally{setLoading(false)}
  });
}

function openInventoryEntry(){
  openModal('Registrar mercancía',`<form id="entryForm" class="modal-form"><p class="inventory-meta">Escribe cuántas unidades llegaron. Puedes capturar varios productos.</p><div class="entry-list">${state.products.map(p=>`<label class="entry-row"><span>${p.emoji} ${escapeHtml(p.nombre)}<small class="stock-caption">Físico: ${Number(p.stockFisico??p.stock)} · Apartado: ${Number(p.stockApartado??0)}</small></span><input type="number" min="0" step="1" inputmode="numeric" data-entry="${p.productoId}" value="0"></label>`).join('')}</div><label><span>Pedido relacionado (opcional)</span><select id="entryOrder"><option value="">Ninguno</option>${state.orders.filter(o=>o.estado==='PEDIDO').map(o=>`<option value="${o.pedidoId}">${o.pedidoId}</option>`).join('')}</select></label><button class="primary-button" type="submit">Registrar entrada</button></form>`);
  $('#entryForm').addEventListener('submit',submitInventoryEntry);
}

async function submitInventoryEntry(e){e.preventDefault();const detalles=$$('[data-entry]',e.target).map(i=>({productoId:i.dataset.entry,cantidad:Number(i.value)})).filter(x=>x.cantidad>0);if(!detalles.length)return toast('Captura al menos una cantidad',true);if(!await appConfirm('¿Registrar la entrada de mercancía?'))return;setLoading(true);try{const r=await apiRequest('registerInventoryEntry',{detalles,pedidoId:$('#entryOrder').value||null});closeModal();toast(r.message||'Mercancía registrada');await refreshAll(false)}catch(err){console.error(err);toast(err.message,true)}finally{setLoading(false)}}

function openAdjustment(id){const p=state.products.find(x=>x.productoId===id),physical=Number(p.stockFisico??p.stock);openModal(`Modificar ${p.nombre}`,`<form id="adjustForm" class="modal-form"><p>Stock físico actual: <strong>${physical}</strong> · Apartado: <strong>${Number(p.stockApartado??0)}</strong></p><label>Motivo<select id="adjustReason"><option value="ENTRADA">Entrada de mercancía</option><option value="AJUSTE">Ajuste</option><option value="MERMA">Merma</option><option value="MERMA">Producto dañado</option><option value="AJUSTE">Otro</option></select></label><label>Cambio de unidades<input id="adjustQty" type="number" step="1" inputmode="numeric" placeholder="Ej. 5 o -2" required></label><label>Nota<input id="adjustNote" maxlength="120" placeholder="Motivo breve"></label><button type="submit" class="primary-button">Guardar movimiento</button></form>`);$('#adjustForm').addEventListener('submit',async e=>{e.preventDefault();const cantidad=Number($('#adjustQty').value);if(!cantidad||physical+cantidad<0)return toast('La cantidad no es válida',true);if(!await appConfirm(`¿Cambiar el stock físico de ${physical} a ${physical+cantidad}?`,'Modificar inventario'))return;setLoading(true);try{await apiRequest('adjustInventory',{productoId:id,cantidad,tipo:$('#adjustReason').value,motivo:$('#adjustNote').value||$('#adjustReason option:checked').textContent});closeModal();toast('Inventario actualizado');await refreshAll(false)}catch(err){console.error(err);toast(err.message,true)}finally{setLoading(false)}})}

function openShare(){let showQty=false;const draw=()=>{const message=buildShareMessage(showQty);$('#modalBody').innerHTML=`<div class="switch-row"><strong>Mostrar cantidades</strong><label class="switch"><input id="showQty" type="checkbox" ${showQty?'checked':''}><span></span></label></div><div class="share-preview">${escapeHtml(message)}</div><div class="modal-actions"><button id="copyShare" class="secondary-button">📋 Copiar lista</button><button id="whatsappShare" class="primary-button">💬 Enviar por WhatsApp</button></div>`;$('#showQty').addEventListener('change',e=>{showQty=e.target.checked;draw()});$('#copyShare').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(message);toast('Lista copiada')}catch(e){console.error(e);toast('No se pudo copiar; mantén presionado el texto.',true)}});$('#whatsappShare').addEventListener('click',()=>window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener'))};openModal('Compartir existencias','');draw()}
function buildShareMessage(showQty=false){const available=state.products.filter(p=>p.activo&&Number(p.stockDisponible??p.stock)>0);const troles=available.filter(p=>p.categoria==='Trol');const others=available.filter(p=>p.categoria!=='Trol');let lines=['🍧 LA MICHOACANA 🍧','','Sabores disponibles hoy:','',...troles.map(p=>`${p.emoji||'🍧'} ${p.nombre}${showQty?` — ${Number(p.stockDisponible??p.stock)}`:''}`)];if(troles.length)lines.push('',`💲${troles[0].precioVenta} c/u`);if(others.length)lines.push('','También tenemos:',...others.map(p=>`${p.emoji||'✨'} ${p.nombre}${showQty?` — ${Number(p.stockDisponible??p.stock)}`:''} · ${money.format(p.precioVenta)}`));if(state.config?.mensajeWhatsApp)lines.push('','✨ '+state.config.mensajeWhatsApp);return lines.join('\n')}

function generarPedidoPorPresupuesto(presupuesto){orderCart={};if(!Number.isFinite(presupuesto)||presupuesto<=0){renderOrderProducts();return toast('Escribe un presupuesto mayor que cero',true)}const all=[...state.products].filter(p=>p.activo&&p.precioCompra>0),hasSales=all.some(p=>Number(p.ventasUltimos30Dias)>0),products=all.filter(p=>!hasSales||Number(p.ventasUltimos30Dias)>0).sort((a,b)=>recommendationScore(b)-recommendationScore(a));let remaining=presupuesto;for(const p of products){const desired=suggestedOrderQuantity(p,hasSales),qty=Math.min(desired,Math.floor(remaining/p.precioCompra));if(qty>0){orderCart[p.productoId]=qty;remaining-=qty*p.precioCompra}}renderOrderProducts();toast('Pedido basado en ventas de los últimos 30 días')}
function priority(p){const stock=Number(p.stockDisponible??p.stock);return stock===0?0:stock<p.stockMinimo?1:stock<p.stockIdeal?2:3}
function recommendationScore(p){const rotation=Number(p.ventasUltimos30Dias)||0,stock=Number(p.stockDisponible??p.stock),urgency=stock===0?40:stock<p.stockMinimo?25:stock<p.stockIdeal?10:0;return rotation*5+urgency}
function suggestedOrderQuantity(p,hasSales=state.products.some(x=>Number(x.ventasUltimos30Dias)>0)){const rotation=Number(p.ventasUltimos30Dias)||0;if(hasSales&&rotation===0)return 0;const target=hasSales?Math.min(p.stockIdeal*2,Math.max(p.stockIdeal,Math.ceil(rotation/2))):p.stockIdeal;return Math.max(0,target-Number(p.stockDisponible??p.stock))}
function renderOrderProducts(){const hasSales=state.products.some(x=>Number(x.ventasUltimos30Dias)>0),products=[...state.products].filter(p=>p.activo&&p.precioCompra>0).sort((a,b)=>recommendationScore(b)-recommendationScore(a)||a.nombre.localeCompare(b.nombre,'es'));$('#orderProducts').innerHTML=products.map(p=>{const suggested=suggestedOrderQuantity(p,hasSales);const qty=orderCart[p.productoId]||0;return `<article class="order-card"><div><h3>${p.emoji} ${escapeHtml(p.nombre)}</h3><div class="order-meta">Disponible ${Number(p.stockDisponible??p.stock)} · Apartado ${Number(p.stockApartado??0)} · Vendidos 30 días: ${p.ventasUltimos30Dias||0}<br>Sugerencia: comprar ${suggested} · ${money.format(p.precioCompra)} c/u</div></div><div><div class="stepper"><button data-order-minus="${p.productoId}">−</button><strong>${qty}</strong><button data-order-plus="${p.productoId}">+</button></div><div class="subtotal">${money.format(qty*p.precioCompra)}</div></div></article>`}).join('');$$('[data-order-plus]').forEach(b=>b.addEventListener('click',()=>changeOrderQty(b.dataset.orderPlus,1)));$$('[data-order-minus]').forEach(b=>b.addEventListener('click',()=>changeOrderQty(b.dataset.orderMinus,-1)));updateOrderSummary()}
function changeOrderQty(id,delta){const p=state.products.find(x=>x.productoId===id);const next=Math.max(0,(orderCart[id]||0)+delta);const budget=Number($('#budgetInput').value)||0;const current=orderTotal();if(delta>0&&current+p.precioCompra>budget)return toast('El pedido no puede exceder el presupuesto',true);orderCart[id]=next;renderOrderProducts()}
function orderTotal(){return Object.entries(orderCart).reduce((s,[id,q])=>s+state.products.find(p=>p.productoId===id).precioCompra*q,0)}
function updateOrderSummary(){const budget=Number($('#budgetInput').value)||0,total=orderTotal();$('#orderSummary').hidden=total<=0;$('#orderTotal').textContent=money.format(total);$('#orderRemaining').textContent=money.format(Math.max(0,budget-total));$('#createOrderBtn').disabled=total<=0||total>budget}
function buildOrderMessage(details){const lines=['Quisiera pedir:',''];details.filter(d=>Number(d.cantidad)>0).forEach(d=>{const p=state.products.find(x=>x.productoId===d.productoId);lines.push(`${p?.nombre||d.productoId} × ${d.cantidad}`)});return lines.join('\n')}
function shareOrderByWhatsApp(order=null){const details=order?order.detalles:Object.entries(orderCart).filter(([,cantidad])=>cantidad>0).map(([productoId,cantidad])=>({productoId,cantidad}));const total=order?Number(order.costoTotal):orderTotal();if(!details.length)return toast('El pedido está vacío',true);const message=buildOrderMessage(details,total,order?.pedidoId||'');window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener')}
async function createOrder(){
  const presupuesto=Number($('#budgetInput').value);
  const detalles=Object.entries(orderCart).filter(([,cantidad])=>cantidad>0).map(([productoId,cantidad])=>({productoId,cantidad}));
  if(!detalles.length)return toast('Agrega al menos un producto',true);
  if(orderTotal()>presupuesto)return toast('El pedido excede el presupuesto',true);
  const editing=Boolean(editingOrderId);
  const title=editing?'Guardar cambios':'Guardar pedido';
  const question=editing?`¿Guardar los cambios de este pedido por ${money.format(orderTotal())}?`:`¿Guardar este pedido por ${money.format(orderTotal())}?`;
  if(!await appConfirm(question,title))return;
  setLoading(true);
  try{
    const r=await apiRequest(editing?'updateOrder':'createOrder',{pedidoId:editingOrderId,presupuesto,detalles,estado:'PEDIDO'});
    toast(r.message||(editing?'Pedido actualizado':'Pedido guardado'));
    resetOrderEditor();
    await refreshAll(false);
    renderOrderProducts();
  }catch(e){console.error(e);toast(e.message,true)}finally{setLoading(false)}
}

function resetOrderEditor(){
  editingOrderId=null;
  orderCart={};
  $('#budgetInput').value='';
  $('#createOrderBtn').textContent='Guardar pedido';
  $('#cancelOrderEditBtn').hidden=true;
  updateOrderSummary();
}

function cancelOrderEdit(){
  if(!editingOrderId)return;
  resetOrderEditor();
  renderOrderProducts();
  toast('Edición cancelada');
}

function editProviderOrder(id){
  const o=state.orders.find(x=>x.pedidoId===id);
  if(!o)return toast('No se encontró el pedido',true);
  if(o.estado!=='PEDIDO')return toast('Solo se pueden modificar pedidos pendientes',true);
  editingOrderId=id;
  orderCart={};
  (o.detalles||[]).forEach(d=>{orderCart[d.productoId]=Number(d.cantidad)||0});
  $('#budgetInput').value=Number(o.presupuesto)||Number(o.costoTotal)||0;
  $('#createOrderBtn').textContent='Guardar cambios';
  $('#cancelOrderEditBtn').hidden=false;
  closeModal();
  navigate('order');
  renderOrderProducts();
  updateOrderSummary();
  toast('Pedido cargado para modificar');
}

function openOrders(){
  const html=state.orders.length?state.orders.map(o=>`<article class="history-card"><div class="history-head"><strong>${o.pedidoId}</strong><span>${dateTime.format(new Date(o.fecha))}</span></div><div class="history-items">${o.detalles.map(d=>{const p=state.products.find(x=>x.productoId===d.productoId);return `${p?.emoji||''} ${escapeHtml(p?.nombre||d.productoId)} × ${d.cantidad}<br>`}).join('')}</div><div class="history-total"><span>${o.estado}</span><span>${money.format(o.costoTotal)}</span></div><button class="whatsapp-button" data-share-order="${o.pedidoId}">💬 Enviar por WhatsApp</button>${o.estado==='PEDIDO'?`<button class="secondary-button" data-edit-order="${o.pedidoId}">✏️ Modificar pedido</button><button class="secondary-button" data-receive="${o.pedidoId}">Marcar como recibido</button>`:''}</article>`).join(''):'<div class="empty">Aún no hay pedidos</div>';
  openModal('Pedidos',`<div class="history-list">${html}</div>`);
  $$('[data-edit-order]').forEach(b=>b.addEventListener('click',()=>editProviderOrder(b.dataset.editOrder)));
  $$('[data-receive]').forEach(b=>b.addEventListener('click',()=>receiveOrder(b.dataset.receive)));
  $$('[data-share-order]').forEach(b=>b.addEventListener('click',()=>shareOrderByWhatsApp(state.orders.find(o=>o.pedidoId===b.dataset.shareOrder))));
}
async function receiveOrder(id){if(!await appConfirm('¿Confirmas que recibiste todo este pedido?','Recibir pedido'))return;setLoading(true);try{await apiRequest('receiveOrder',{pedidoId:id});closeModal();toast('Pedido recibido e inventario actualizado');await refreshAll(false)}catch(e){console.error(e);toast(e.message,true)}finally{setLoading(false)}}

function renderHistory(){if(!state.sales)return;const range=getHistoryRange();const sales=state.sales.filter(s=>{const d=new Date(s.fecha);return d>=range.from&&d<=range.to});const active=sales.filter(s=>s.estado==='ACTIVA');const count=active.reduce((n,s)=>n+s.cantidadProductos,0),total=active.reduce((n,s)=>n+s.total,0);$('#historyStats').innerHTML=`<div class="stat-mini"><span>Ventas</span><strong>${active.length}</strong></div><div class="stat-mini"><span>Productos</span><strong>${count}</strong></div><div class="stat-mini"><span>Total</span><strong>${money.format(total)}</strong></div>`;$('#salesHistory').innerHTML=sales.length?sales.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(s=>`<article class="history-card ${s.estado==='CANCELADA'?'cancelled':''}"><div class="history-head"><span>${dateTime.format(new Date(s.fecha))}</span><span>${escapeHtml(s.vendedor)}</span></div><div class="history-items">${s.detalles.map(d=>{const p=state.products.find(x=>x.productoId===d.productoId);return `${p?.emoji||''} ${escapeHtml(p?.nombre||d.productoId)} × ${d.cantidad} · ${escapeHtml(d.cliente||'Cliente')} <small>${d.estadoPago||'PAGADO'}${Number(d.montoPendiente)>0?` · debe ${money.format(d.montoPendiente)}`:''}</small><br>`}).join('')}</div><div class="history-total"><span>${s.estado==='CANCELADA'?'<i class="cancelled-tag">CANCELADA</i>':'Total'}</span><span>${money.format(s.total)}</span></div></article>`).join(''):'<div class="empty">No hay ventas en este periodo</div>';renderRankings(active)}
function renderReceivables(){const items=(state.receivables||[]).filter(x=>Number(x.montoPendiente)>=0.01);$('#receivablesTotal').textContent=money.format(items.reduce((n,x)=>n+Number(x.montoPendiente),0));$('#receivablesList').innerHTML=items.length?items.map(x=>{const p=state.products.find(y=>y.productoId===x.productoId);return `<div class="receivable-row"><div><b>${escapeHtml(x.cliente)}</b><small>${p?.emoji||''} ${escapeHtml(p?.nombre||x.productoId)} × ${x.cantidad}<br>${dateTime.format(new Date(x.fecha))}</small></div><strong>${money.format(x.montoPendiente)}</strong><button data-collect="${x.detalleId}">Registrar pago</button></div>`}).join(''):'<div class="empty">✨ No hay pagos pendientes</div>';$$('[data-collect]').forEach(b=>b.addEventListener('click',()=>openCollection(b.dataset.collect)))}
function openCollection(detailId){const item=state.receivables.find(x=>x.detalleId===detailId),p=state.products.find(x=>x.productoId===item.productoId);openModal(`Cobro de ${item.cliente}`,`<form id="collectionForm" class="modal-form"><p>${p?.emoji||''} ${escapeHtml(p?.nombre||item.productoId)} · Falta <strong>${money.format(item.montoPendiente)}</strong></p><label>Monto recibido<input id="collectionAmount" type="number" min="0.01" max="${item.montoPendiente}" step="0.01" value="${item.montoPendiente}" required></label><label>Forma de pago<select id="collectionMethod"><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="OTRO">Otro</option></select></label><label>Nota<input id="collectionNote" maxlength="120" placeholder="Opcional"></label><button class="primary-button" type="submit">Registrar abono</button></form>`);$('#collectionForm').addEventListener('submit',async e=>{e.preventDefault();const monto=Number($('#collectionAmount').value);if(monto<=0||monto>Number(item.montoPendiente)+0.001)return toast('El monto no es válido',true);if(!await appConfirm(`¿Registrar un pago de ${money.format(monto)}?`,'Registrar abono'))return;setLoading(true);try{await apiRequest('registerPayment',{detalleId:detailId,monto,metodo:$('#collectionMethod').value,nota:$('#collectionNote').value});closeModal();toast('Pago registrado');await refreshAll(false)}catch(err){console.error(err);toast(err.message,true)}finally{setLoading(false)}})}
function getHistoryRange(){const now=new Date(),end=new Date(now);end.setHours(23,59,59,999);let from=new Date(now);from.setHours(0,0,0,0);if(historyPeriod==='week'){const day=(from.getDay()+6)%7;from.setDate(from.getDate()-day)}else if(historyPeriod==='month')from=new Date(now.getFullYear(),now.getMonth(),1);else if(historyPeriod==='custom'){const a=$('#dateFrom').value,b=$('#dateTo').value;if(a)from=new Date(`${a}T00:00:00`);if(b){end.setTime(new Date(`${b}T23:59:59`).getTime())}}return{from,to:end}}
function localDateValue(date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
function updateHistoryCaption(){const range=getHistoryRange(),count=state.sales.filter(s=>{const date=new Date(s.fecha);return date>=range.from&&date<=range.to}).length,labels={today:'Hoy',week:'Esta semana',month:'Este mes',custom:`${$('#dateFrom').value} al ${$('#dateTo').value}`};$('#historyRangeCaption').textContent=`Mostrando: ${labels[historyPeriod]} · ${count} ${count===1?'venta':'ventas'}`}
function renderRankings(sales){const counts={};sales.forEach(s=>s.detalles.forEach(d=>counts[d.productoId]=(counts[d.productoId]||0)+d.cantidad));const rows=state.products.map(p=>({name:p.nombre,emoji:p.emoji,count:counts[p.productoId]||0}));const make=(list)=>list.map((x,i)=>`<div class="ranking-row"><span>${i+1}</span><span>${x.emoji} ${escapeHtml(x.name)}</span><strong>${x.count}</strong></div>`).join('');$('#topProducts').innerHTML=make([...rows].sort((a,b)=>b.count-a.count).slice(0,5));$('#bottomProducts').innerHTML=make([...rows].sort((a,b)=>a.count-b.count).slice(0,5))}
function renderPeriodStatistics(){const now=new Date(),today=new Date(now);today.setHours(0,0,0,0);const week=new Date(today);week.setDate(week.getDate()-((week.getDay()+6)%7));const month=new Date(now.getFullYear(),now.getMonth(),1);const summarize=from=>{const sales=state.sales.filter(s=>s.estado==='ACTIVA'&&new Date(s.fecha)>=from);return{cantidad:sales.reduce((n,s)=>n+s.cantidadProductos,0),dinero:sales.reduce((n,s)=>n+s.total,0)}};$('#periodStatistics').innerHTML=[['Hoy',summarize(today)],['Esta semana',summarize(week)],['Este mes',summarize(month)]].map(([label,x])=>`<div><b>${label}</b><span>${x.cantidad} productos</span><strong>${money.format(x.dinero)}</strong></div>`).join('')}

function navigate(view){$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});if(view==='order')renderOrderProducts();if(view==='history'){renderHistory();updateHistoryCaption()}}
function openModal(title,body){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modalBackdrop').hidden=false;document.body.style.overflow='hidden'}
function closeModal(){$('#modalBackdrop').hidden=true;document.body.style.overflow=''}
function appConfirm(message,title='Confirmar acción'){if(confirmResolver)resolveConfirmation(false);$('#confirmTitle').textContent=title;$('#confirmMessage').textContent=message;$('#confirmBackdrop').hidden=false;setTimeout(()=>$('#confirmAcceptBtn').focus(),0);return new Promise(resolve=>{confirmResolver=resolve})}
function resolveConfirmation(accepted){if(!confirmResolver)return;const resolve=confirmResolver;confirmResolver=null;$('#confirmBackdrop').hidden=true;resolve(accepted)}
function setLoading(on){$('#loading').hidden=!on;$$('button').forEach(b=>{if(on){b.dataset.wasDisabled=String(b.disabled);b.disabled=true}else if(b.dataset.wasDisabled!==undefined){b.disabled=b.dataset.wasDisabled==='true';delete b.dataset.wasDisabled}})}
let toastTimer;function toast(message,error=false){clearTimeout(toastTimer);const el=$('#toast');el.textContent=message;el.className=`toast show${error?' error':''}`;toastTimer=setTimeout(()=>el.className='toast',3000)}

function loadDemo(){const raw=localStorage.getItem(DEMO_KEY);let db=null;if(raw){try{db=JSON.parse(raw)}catch(e){console.error(e)}}if(!db)db={products:structuredClone(initialProducts),sales:[],orders:[],movements:[],config:{nombreNegocio:'La Michoacana',mensajeWhatsApp:'¡Sabor que te enamora!',moneda:'MXN'}};db.sellers=db.sellers||['Mamá','Miri','Papá','Rodrigo','Gloria'].map((nombre,i)=>({vendedorId:`VEN${i+1}`,nombre,activo:true}));db.payments=db.payments||[];db.receivables=db.sales.flatMap(s=>s.estado==='ACTIVA'?s.detalles.filter(d=>Number(d.montoPendiente)>0).map(d=>({...d,ventaId:s.ventaId,fecha:s.fecha,vendedor:s.vendedor})):[]);return db}
function saveDemo(db){localStorage.setItem(DEMO_KEY,JSON.stringify(db))}
function demoId(prefix,list,key){const day=new Date().toISOString().slice(0,10).replaceAll('-','');const n=list.filter(x=>String(x[key]).startsWith(`${prefix}-${day}`)).length+1;return `${prefix}-${day}-${String(n).padStart(4,'0')}`}
function calculateDashboard(db=state){const today=new Date();today.setHours(0,0,0,0);const sales=db.sales.filter(s=>s.estado==='ACTIVA'&&new Date(s.fecha)>=today);return{ventasHoy:sales.reduce((n,s)=>n+s.total,0),productosVendidosHoy:sales.reduce((n,s)=>n+s.cantidadProductos,0),productosDisponibles:db.products.reduce((n,p)=>n+p.stock,0),productosBajoStock:db.products.filter(p=>p.stock<=p.stockMinimo).length}}
async function demoApi(action,data){await new Promise(r=>setTimeout(r,180));const db=loadDemo();const product=id=>db.products.find(p=>p.productoId===id);const movement=(p,cantidad,tipo,referencia,motivo)=>{const old=p.stock;p.stock+=cantidad;db.movements.push({movimientoId:demoId('M',db.movements,'movimientoId'),fecha:new Date().toISOString(),productoId:p.productoId,tipo,cantidad,stockAnterior:old,stockNuevo:p.stock,referencia,motivo})};
  if(action==='getDashboard'||action==='getProducts'||action==='getInventory'){const cutoff=Date.now()-30*864e5;db.products.forEach(p=>p.ventasUltimos30Dias=db.sales.filter(s=>s.estado==='ACTIVA'&&new Date(s.fecha).getTime()>=cutoff).reduce((n,s)=>n+s.detalles.filter(d=>d.productoId===p.productoId).reduce((a,d)=>a+d.cantidad,0),0));return{success:true,data:{...db,dashboard:calculateDashboard(db)},message:''}}
  if(action==='registerSale'){for(const d of data.detalles){const p=product(d.productoId);if(!p||d.cantidad<=0||p.stock<d.cantidad)throw new Error(`Stock insuficiente de ${p?.nombre||d.productoId}`)}const ventaId=demoId('V',db.sales,'ventaId');const detalles=data.detalles.map((d,i)=>{const p=product(d.productoId),subtotal=p.precioVenta*d.cantidad,pagos=d.pagos||[],montoPagado=pagos.reduce((n,x)=>n+Number(x.monto),0),detalleId=`${ventaId}-D${i+1}`;pagos.forEach(x=>db.payments.push({pagoId:demoId('PG',db.payments,'pagoId'),fecha:new Date().toISOString(),ventaId,detalleId,cliente:d.cliente,metodo:x.metodo,monto:Number(x.monto),referencia:'VENTA',nota:''}));return{detalleId,productoId:d.productoId,cantidad:d.cantidad,precioUnitario:p.precioVenta,subtotal,cliente:d.cliente||'Cliente',estadoPago:montoPagado>=subtotal?'PAGADO':montoPagado>0?'PARCIAL':'PENDIENTE',montoPagado,montoPendiente:subtotal-montoPagado}});const sale={ventaId,fecha:new Date().toISOString(),vendedor:data.vendedor,cantidadProductos:detalles.reduce((n,d)=>n+d.cantidad,0),total:detalles.reduce((n,d)=>n+d.subtotal,0),estado:'ACTIVA',detalles};db.sales.push(sale);detalles.forEach(d=>movement(product(d.productoId),-d.cantidad,'SALIDA',ventaId,'Venta'));saveDemo(db);return{success:true,data:sale,message:'✅ Venta registrada'}}
  if(action==='registerPayment'){let detail,sale;for(const s of db.sales){const found=s.detalles.find(d=>d.detalleId===data.detalleId);if(found){detail=found;sale=s;break}}const amount=Number(data.monto);if(!detail||sale.estado!=='ACTIVA'||amount<=0||amount>detail.montoPendiente+0.001)throw new Error('El abono no es válido');detail.montoPagado+=amount;detail.montoPendiente=Math.max(0,detail.subtotal-detail.montoPagado);detail.estadoPago=detail.montoPendiente<=0.001?'PAGADO':'PARCIAL';db.payments.push({pagoId:demoId('PG',db.payments,'pagoId'),fecha:new Date().toISOString(),ventaId:sale.ventaId,detalleId:detail.detalleId,cliente:detail.cliente,metodo:data.metodo,monto:amount,referencia:'ABONO',nota:data.nota||''});saveDemo(db);return{success:true,data:detail,message:'Pago registrado'}}
  if(action==='undoLastSale'){const sale=[...db.sales].reverse().find(s=>s.estado==='ACTIVA');if(!sale)throw new Error('No hay una venta activa para deshacer');sale.estado='CANCELADA';sale.detalles.forEach(d=>movement(product(d.productoId),d.cantidad,'DEVOLUCION',sale.ventaId,'Cancelación de venta'));saveDemo(db);return{success:true,data:sale,message:'Venta cancelada e inventario recuperado'}}
  if(action==='createProduct'){const base=(data.categoria==='Trol'?'TR':'OT');const nums=db.products.map(p=>Number(String(p.productoId).replace(/\D/g,''))||0);const id=base+String(Math.max(0,...nums)+1).padStart(3,'0');db.products.push({productoId:id,nombre:data.nombre,categoria:data.categoria,emoji:data.emoji||'🍧',precioVenta:Number(data.precioVenta),precioCompra:Number(data.precioCompra),stock:Number(data.stockInicial||0),stockFisico:Number(data.stockInicial||0),stockApartado:0,stockDisponible:Number(data.stockInicial||0),stockMinimo:Number(data.stockMinimo),stockIdeal:Number(data.stockIdeal),activo:true,ventasUltimos30Dias:0});saveDemo(db);return{success:true,data:id,message:'Producto agregado'}}
  if(action==='updateProduct'){const p=product(data.productoId);if(!p)throw new Error('Producto no encontrado');Object.assign(p,{nombre:data.nombre,categoria:data.categoria,emoji:data.emoji||'🍧',precioVenta:Number(data.precioVenta),precioCompra:Number(data.precioCompra),stockMinimo:Number(data.stockMinimo),stockIdeal:Number(data.stockIdeal),activo:Boolean(data.activo)});saveDemo(db);return{success:true,data:null,message:'Producto actualizado'}}
  if(action==='registerInventoryEntry'){const ref=data.pedidoId||'ENTRADA-MANUAL';data.detalles.forEach(d=>{if(d.cantidad>0)movement(product(d.productoId),d.cantidad,'ENTRADA',ref,'Entrada de mercancía')});if(data.pedidoId){const o=db.orders.find(x=>x.pedidoId===data.pedidoId);if(o)o.estado='RECIBIDO'}saveDemo(db);return{success:true,data:null,message:'Mercancía registrada'}}
  if(action==='adjustInventory'){const p=product(data.productoId);if(!p||!data.cantidad||p.stock+data.cantidad<0)throw new Error('Ajuste inválido');movement(p,data.cantidad,data.tipo,'AJUSTE-MANUAL',data.motivo);saveDemo(db);return{success:true,data:p,message:'Inventario actualizado'}}
  if(action==='createOrder'){const costoTotal=data.detalles.reduce((n,d)=>n+product(d.productoId).precioCompra*d.cantidad,0);if(costoTotal>data.presupuesto)throw new Error('El pedido excede el presupuesto');const pedidoId=demoId('P',db.orders,'pedidoId');const order={pedidoId,fecha:new Date().toISOString(),presupuesto:data.presupuesto,costoTotal,estado:data.estado||'PEDIDO',detalles:data.detalles.map(d=>({...d,precioCompra:product(d.productoId).precioCompra,subtotal:product(d.productoId).precioCompra*d.cantidad}))};db.orders.push(order);saveDemo(db);return{success:true,data:order,message:'Pedido guardado'}}
  if(action==='updateOrder'){const o=db.orders.find(x=>x.pedidoId===data.pedidoId);if(!o||o.estado!=='PEDIDO')throw new Error('Solo se pueden modificar pedidos pendientes');const costoTotal=data.detalles.reduce((n,d)=>n+product(d.productoId).precioCompra*d.cantidad,0);if(costoTotal>data.presupuesto)throw new Error('El pedido excede el presupuesto');o.presupuesto=data.presupuesto;o.costoTotal=costoTotal;o.detalles=data.detalles.map(d=>({...d,precioCompra:product(d.productoId).precioCompra,subtotal:product(d.productoId).precioCompra*d.cantidad}));saveDemo(db);return{success:true,data:o,message:'Pedido actualizado'}}
  if(action==='receiveOrder'){const o=db.orders.find(x=>x.pedidoId===data.pedidoId);if(!o||o.estado!=='PEDIDO')throw new Error('El pedido no está pendiente');o.detalles.forEach(d=>movement(product(d.productoId),d.cantidad,'ENTRADA',o.pedidoId,'Pedido recibido'));o.estado='RECIBIDO';saveDemo(db);return{success:true,data:o,message:'Pedido recibido'}}
  if(action==='getSales')return{success:true,data:db.sales,message:''};if(action==='getStatistics')return{success:true,data:{},message:''};if(action==='getOrders')return{success:true,data:db.orders,message:''};throw new Error(`Acción demo no implementada: ${action}`)
}

// ============================================================
// TROLES 2.0 · PEDIDOS / APARTADOS DE CLIENTES
// ============================================================
function renderNotificationBadge(){
  const due=(state.notifications||[]).filter(n=>n.estado==='PENDIENTE'&&new Date(n.enviarEn)<=new Date());
  const badge=$('#notificationCount');
  badge.textContent=due.length;
  badge.hidden=due.length===0;
}

function openNotifications(){
  if(DEMO_MODE)return toast('Configura Supabase en config.js para activar recordatorios.',true);
  const items=(state.notifications||[]).filter(n=>n.estado==='PENDIENTE').sort((a,b)=>new Date(a.enviarEn)-new Date(b.enviarEn));
  const now=new Date();
  const html=items.length?items.map(n=>`<article class="notification-item ${new Date(n.enviarEn)<=now?'due':''}"><strong>${new Date(n.enviarEn)<=now?'🔔 Ahora':'⏰ '+dateTime.format(new Date(n.enviarEn))}</strong><div>${escapeHtml(n.mensaje).replaceAll('\n','<br>')}</div>${new Date(n.enviarEn)<=now?`<button class="small-button" data-notification-done="${n.id}">Marcar visto</button>`:''}</article>`).join(''):'<div class="empty">✨ No hay recordatorios pendientes</div>';
  openModal('Recordatorios',`<div class="notification-list">${html}</div><p class="inventory-meta">Los recordatorios aparecen aquí. La entrega por WhatsApp se conectará después usando la misma cola.</p>`);
  $$('[data-notification-done]').forEach(b=>b.addEventListener('click',async()=>{try{await apiRequest('markNotificationSent',{notificacionId:b.dataset.notificationDone});await refreshAll(false);openNotifications()}catch(e){toast(e.message,true)}}));
}

function openCustomerOrderForm(){
  if(DEMO_MODE)return toast('Primero configura Supabase en config.js para probar apartados.',true);
  const cart={};
  const min=new Date(Date.now()+30*60000); min.setMinutes(Math.ceil(min.getMinutes()/5)*5,0,0);
  const pad=n=>String(n).padStart(2,'0');
  const local=`${min.getFullYear()}-${pad(min.getMonth()+1)}-${pad(min.getDate())}T${pad(min.getHours())}:${pad(min.getMinutes())}`;
  const drawProducts=()=>{
    const host=$('#customerOrderProducts'); if(!host)return;
    host.innerHTML=state.products.filter(p=>p.activo).map(p=>{const qty=cart[p.productoId]||0,available=Number(p.stockDisponible??p.stock??0);return `<div class="customer-product-row"><div><strong>${p.emoji} ${escapeHtml(p.nombre)}</strong><small>Disponible ${available} · Apartado ${Number(p.stockApartado??0)} · ${money.format(p.precioVenta)}</small></div><div class="stepper"><button type="button" data-customer-minus="${p.productoId}">−</button><strong>${qty}</strong><button type="button" data-customer-plus="${p.productoId}" ${qty>=available?'disabled':''}>+</button></div></div>`}).join('');
    $$('[data-customer-plus]').forEach(b=>b.addEventListener('click',()=>{const p=state.products.find(x=>x.productoId===b.dataset.customerPlus),available=Number(p.stockDisponible??p.stock??0),next=(cart[p.productoId]||0)+1;if(next>available)return toast(`Sólo hay ${available} disponibles`,true);cart[p.productoId]=next;drawProducts();updateTotal()}));
    $$('[data-customer-minus]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.customerMinus;cart[id]=Math.max(0,(cart[id]||0)-1);drawProducts();updateTotal()}));
  };
  const updateTotal=()=>{const total=Object.entries(cart).reduce((n,[id,q])=>n+q*Number(state.products.find(p=>p.productoId===id)?.precioVenta||0),0);const el=$('#customerOrderTotal');if(el)el.textContent=money.format(total)};
  openModal('Levantar apartado',`<form id="customerOrderForm" class="modal-form"><label>Cliente<input id="customerName" required placeholder="Nombre"></label><label>Teléfono (opcional)<input id="customerPhone" inputmode="tel" placeholder="999 000 0000"></label><label>Fecha y hora de entrega<input id="customerDelivery" type="datetime-local" min="${local}" value="${local}" required></label><label>Notas<input id="customerNotes" maxlength="180" placeholder="Ej. llevar al trabajo"></label><div><strong>Productos</strong><div id="customerOrderProducts" class="customer-products"></div></div><div class="payment-status">Total del apartado: <strong id="customerOrderTotal">$0</strong></div><button class="primary-button" type="submit">Apartar productos</button></form>`);
  drawProducts(); updateTotal();
  $('#customerOrderForm').addEventListener('submit',async e=>{e.preventDefault();const detalles=Object.entries(cart).filter(([,q])=>q>0).map(([productoId,cantidad])=>({productoId,cantidad}));if(!detalles.length)return toast('Selecciona al menos un producto',true);const dt=$('#customerDelivery').value;if(!dt)return;const fechaEntrega=new Date(dt).toISOString();if(!await appConfirm('¿Apartar estos productos para el cliente?','Crear apartado'))return;setLoading(true);try{await apiRequest('createCustomerOrder',{clienteNombre:$('#customerName').value.trim(),clienteTelefono:$('#customerPhone').value.trim(),fechaEntrega,detalles,notas:$('#customerNotes').value.trim()});closeModal();await refreshAll(false);toast('🍧 Apartado registrado')}catch(err){toast(err.message,true)}finally{setLoading(false)}});
}

function customerOrderUrgency(o){const diff=new Date(o.fechaEntrega)-new Date();if(diff<0)return 'overdue';if(diff<=2*3600000)return 'urgent';return ''}
function customerOrderItems(o){return (o.detalles||[]).map(d=>{const p=state.products.find(x=>x.productoId===d.productoId);return `${p?.emoji||''} ${escapeHtml(d.productoNombre||p?.nombre||d.productoId)} × ${d.cantidad}`}).join('<br>')}
function openCustomerOrders(){
  if(DEMO_MODE)return toast('Primero configura Supabase en config.js para ver apartados.',true);
  const orders=(state.customerOrders||[]).slice().sort((a,b)=>new Date(a.fechaEntrega)-new Date(b.fechaEntrega));
  const html=orders.length?orders.map(o=>`<article class="customer-order-card ${customerOrderUrgency(o)}"><div class="customer-order-head"><div><strong>${escapeHtml(o.clienteNombre)}</strong><small>${dateTime.format(new Date(o.fechaEntrega))}</small></div><span class="order-status ${String(o.estado).toLowerCase()}">${o.estado}</span></div><div class="customer-order-meta">${customerOrderItems(o)}</div><div class="history-total"><span>Pagado ${money.format(Number(o.montoPagado||0))}</span><span>Pendiente ${money.format(Number(o.montoPendiente||0))}</span></div><div class="customer-order-actions"><button class="secondary-button" data-share-customer="${o.id}">💬 Compartir</button>${o.estado==='APARTADO'?`<button class="secondary-button" data-confirm-customer="${o.id}">Confirmar</button>`:''}${Number(o.montoPendiente)>0?`<button class="secondary-button" data-pay-customer="${o.id}">Registrar anticipo</button>`:''}${['APARTADO','CONFIRMADO'].includes(o.estado)?`<button class="primary-button" data-deliver-customer="${o.id}">Entregar</button><button class="danger-button" data-cancel-customer="${o.id}">Cancelar</button>`:''}</div></article>`).join(''):'<div class="empty">Aún no hay apartados</div>';
  openModal('Apartados de clientes',`<div class="history-list">${html}</div>`);
  $$('[data-share-customer]').forEach(b=>b.addEventListener('click',()=>shareCustomerOrder(orders.find(o=>o.id===b.dataset.shareCustomer))));
  $$('[data-confirm-customer]').forEach(b=>b.addEventListener('click',()=>changeCustomerOrderStatus(b.dataset.confirmCustomer,'CONFIRMADO')));
  $$('[data-cancel-customer]').forEach(b=>b.addEventListener('click',()=>changeCustomerOrderStatus(b.dataset.cancelCustomer,'CANCELADO')));
  $$('[data-pay-customer]').forEach(b=>b.addEventListener('click',()=>openCustomerOrderPayment(orders.find(o=>o.id===b.dataset.payCustomer))));
  $$('[data-deliver-customer]').forEach(b=>b.addEventListener('click',()=>openCustomerOrderDelivery(orders.find(o=>o.id===b.dataset.deliverCustomer))));
}
function buildCustomerOrderMessage(o){return [`🍧 Pedido apartado`,`Cliente: ${o.clienteNombre}`,`Entrega: ${dateTime.format(new Date(o.fechaEntrega))}`,'',...(o.detalles||[]).map(d=>`${d.productoNombre||state.products.find(p=>p.productoId===d.productoId)?.nombre||d.productoId} × ${d.cantidad}`),'',`Total: ${money.format(Number(o.total||0))}`,Number(o.montoPendiente)>0?`Pendiente: ${money.format(Number(o.montoPendiente))}`:'Pagado ✅'].join('\n')}
function shareCustomerOrder(o){window.open(`https://wa.me/?text=${encodeURIComponent(buildCustomerOrderMessage(o))}`,'_blank','noopener')}
async function changeCustomerOrderStatus(id,estado){if(!await appConfirm(estado==='CANCELADO'?'Al cancelar, los productos vuelven a quedar disponibles. ¿Continuar?':'¿Confirmar este pedido?',estado==='CANCELADO'?'Cancelar apartado':'Confirmar apartado'))return;setLoading(true);try{await apiRequest('changeCustomerOrderStatus',{pedidoId:id,estado});await refreshAll(false);openCustomerOrders();toast('Pedido actualizado')}catch(e){toast(e.message,true)}finally{setLoading(false)}}
function openCustomerOrderPayment(o){openModal(`Anticipo · ${o.clienteNombre}`,`<form id="customerPayForm" class="modal-form"><p>Pendiente: <strong>${money.format(Number(o.montoPendiente))}</strong></p><label>Monto<input id="customerPayAmount" type="number" min="0.01" max="${o.montoPendiente}" step="0.01" value="${o.montoPendiente}" required></label><label>Método<select id="customerPayMethod"><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="OTRO">Otro</option></select></label><label>Referencia<input id="customerPayRef" placeholder="Opcional"></label><button class="primary-button">Guardar anticipo</button></form>`);$('#customerPayForm').addEventListener('submit',async e=>{e.preventDefault();setLoading(true);try{await apiRequest('payCustomerOrder',{pedidoId:o.id,metodo:$('#customerPayMethod').value,monto:Number($('#customerPayAmount').value),referencia:$('#customerPayRef').value});await refreshAll(false);openCustomerOrders();toast('Anticipo registrado')}catch(err){toast(err.message,true)}finally{setLoading(false)}})}
function openCustomerOrderDelivery(o){const pending=Number(o.montoPendiente||0);openModal(`Entregar · ${o.clienteNombre}`,`<form id="customerDeliverForm" class="modal-form"><p>${customerOrderItems(o)}</p><p>Saldo pendiente: <strong>${money.format(pending)}</strong></p>${pending>0?`<label>Pago al entregar<input id="deliveryAmount" type="number" min="0" max="${pending}" step="0.01" value="${pending}"></label><label>Método<select id="deliveryMethod"><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="OTRO">Otro</option></select></label>`:'<p>Pedido pagado ✅</p>'}<label>Vendedor<select id="deliverySeller">${(state.sellers||[]).filter(s=>typeof s==='string'||s.activo).map(s=>`<option>${escapeHtml(typeof s==='string'?s:s.nombre)}</option>`).join('')}</select></label><button class="primary-button">Confirmar entrega</button></form>`);$('#customerDeliverForm').addEventListener('submit',async e=>{e.preventDefault();if(!await appConfirm('Esto descontará el stock físico y registrará la venta. ¿Continuar?','Entregar pedido'))return;setLoading(true);try{await apiRequest('deliverCustomerOrder',{pedidoId:o.id,vendedor:$('#deliverySeller').value,metodo:pending>0?$('#deliveryMethod').value:null,monto:pending>0?Number($('#deliveryAmount').value):0});await refreshAll(false);closeModal();toast('✅ Pedido entregado')}catch(err){toast(err.message,true)}finally{setLoading(false)}})}
