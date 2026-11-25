// CaféPOS Cali - Einstein. Datos guardados en el navegador (localStorage); funciona sin internet.
const $ = (s) => document.querySelector(s),
  K = "cafepos_db";
const cop = (n) => "$" + Math.round(n).toLocaleString("es-CO");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const sha = async (s) => {
  try {
    const b = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(s),
    );
    return [...new Uint8Array(b)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "x" + btoa(s);
  }
};
const dia = (i) => {
  const d = new Date(i);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};
const hora = (i) => new Date(i).toTimeString().slice(0, 5);
const MENU = {
  Cajero: ["ordenar", "cierre"],
  Administrador: [
    "ordenar",
    "precios",
    "insumos",
    "historial",
    "cierre",
    "bitacora",
  ],
  "Soporte técnico": ["usuarios", "respaldo"],
};
const ET = {
  ordenar: "Ordenar",
  precios: "Precios",
  cierre: "Cierre de caja",
  insumos: "Insumos",
  historial: "Historial",
  bitacora: "Bitácora",
  usuarios: "Usuarios",
  respaldo: "Respaldo",
};
let db,
  user = null,
  view = "",
  carro = [],
  rec = "",
  cat = "",
  caja = "Caja 1",
  cc = "",
  editarPrecios = false;
const CAJAS = ["Caja 1", "Caja 2"];
const save = () => localStorage.setItem(K, JSON.stringify(db));
const log = (t) => {
  db.bitacora.unshift({
    f: new Date().toISOString(),
    u: user ? user.u : "sistema",
    t,
  });
  save();
};
function aviso(t) {
  const e = $("#toast");
  e.textContent = t;
  e.style.display = "block";
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => (e.style.display = "none"), 2800);
}

async function init() {
  try {
    db = JSON.parse(localStorage.getItem(K));
  } catch {}
  if (!db) {
    db = {
      usuarios: [],
      productos: [],
      ventas: [],
      insumos: [],
      bitacora: [],
      cierres: [],
      n: { venta: 1, cierre: 1, prod: 1, ins: 1 },
    };
    for (const [u, p, r] of [
      ["admin", "admin123", "Administrador"],
      ["cajero", "cajero123", "Cajero"],
      ["soporte", "soporte123", "Soporte técnico"],
    ])
      db.usuarios.push({ u, h: await sha(p), rol: r, activo: true });
    [
      ["Tinto", "Bebidas calientes", 2000],
      ["Americano", "Bebidas calientes", 3000],
      ["Capuchino", "Bebidas calientes", 5000],
      ["Latte", "Bebidas calientes", 5500],
      ["Chocolate caliente", "Bebidas calientes", 4500],
      ["Té", "Bebidas calientes", 2500],
      ["Jugo natural", "Bebidas frías", 5000],
      ["Limonada", "Bebidas frías", 4000],
      ["Gaseosa", "Bebidas frías", 3000],
      ["Agua", "Bebidas frías", 2500],
      ["Sándwich de pollo", "Comida", 9000],
      ["Sándwich mixto", "Comida", 8000],
      ["Croissant", "Comida", 4500],
      ["Pan de bono", "Comida", 2500],
      ["Empanada", "Comida", 3000],
      ["Brownie", "Comida", 4000],
    ].forEach((p) =>
      db.productos.push({
        id: db.n.prod++,
        nombre: p[0],
        cat: p[1],
        precio: p[2],
        activo: true,
      }),
    );
    [
      ["Café (kg)", 5, 2],
      ["Leche (L)", 20, 8],
      ["Pan (und)", 60, 20],
      ["Vasos desechables (und)", 200, 50],
      ["Azúcar (kg)", 4, 1],
    ].forEach((x) =>
      db.insumos.push({ id: db.n.ins++, nombre: x[0], saldo: x[1], min: x[2] }),
    );
    save();
  }
  pintar();
}
function pintar() {
  if (!user) {
    $("#nav").innerHTML = "";
    $("#app").innerHTML =
      `<form class="caja login" onsubmit="entrar(event)"><h2>CaféPOS <em>Einstein</em></h2><p class="sub">Inicia sesión para continuar</p><input id="lu" placeholder="Usuario" required><input id="lp" type="password" placeholder="Contraseña" required><button>Entrar</button><small class="hint">Pruebas: admin/admin123, cajero/cajero123, soporte/soporte123</small></form>`;
    return;
  }
  const m = MENU[user.rol];
  if (!m.includes(view)) view = m[0];
  $("#nav").innerHTML =
    m
      .map(
        (v) =>
          `<button class="${v == view ? "on" : ""}" onclick="view='${v}';pintar()">${ET[v]}</button>`,
      )
      .join("") +
    `<span class="quien">${esc(user.u)} (${user.rol})</span><button class="sec" onclick="user=null;carro=[];pintar()">Salir</button>`;
  const bajos =
    user.rol == "Administrador"
      ? db.insumos
          .filter((i) => i.saldo <= i.min)
          .map(
            (i) =>
              `<div class="alerta">⚠ Stock mínimo: ${esc(i.nombre)} (quedan ${i.saldo}, mínimo ${i.min})</div>`,
          )
          .join("")
      : "";
  $("#app").innerHTML =
    bajos +
    (user.rol == "Soporte técnico" &&
    (!db.respaldo || dia(db.respaldo) != dia(new Date()))
      ? '<div class="alerta">Hoy todavía no se ha hecho la copia de respaldo.</div>'
      : "") +
    V[view]();
}
async function entrar(e) {
  e.preventDefault();
  const h = await sha($("#lp").value),
    u = db.usuarios.find((x) => x.u == $("#lu").value && x.activo && x.h == h);
  if (!u) return aviso("Usuario o contraseña incorrectos.");
  user = u;
  view = "";
  pintar();
}

/* ---- Venta (RF-03, RF-04, RF-05) ---- */
const total = () => carro.reduce((s, c) => s + c.cant * c.precio, 0);
const prods = (q) =>
  db.productos
    .filter(
      (p) =>
        p.activo &&
        (!cat || p.cat == cat) &&
        p.nombre.toLowerCase().includes(q.toLowerCase()),
    )
    .map(
      (p) =>
        `<button class="prod" onclick="add(${p.id})"><b>${esc(p.nombre)}</b><span>${cop(p.precio)}</span></button>`,
    )
    .join("") || "<p>No hay productos con ese nombre.</p>";
const cambio = () =>
  rec === ""
    ? "Cambio: $0"
    : +rec >= total()
      ? "Cambio: " + cop(rec - total())
      : "Faltan " + cop(total() - rec);
function lineas() {
  return (
    `<h3>Pedido actual · ${caja}</h3>` +
    (carro.length
      ? carro
          .map(
            (c, i) =>
              `<div class="lin"><span>${esc(c.nombre)}</span><span><button onclick="cant(${i},-1)">-</button> ${c.cant} <button onclick="cant(${i},1)">+</button></span><b>${cop(c.cant * c.precio)}</b></div>`,
          )
          .join("")
      : "<p>Agrega productos para empezar.</p>") +
    `${carro.length ? `<p class="total">Total: ${cop(total())}</p><label for="recibido">Dinero recibido (COP)</label><input class="recibido" id="recibido" type="text" inputmode="none" placeholder="$0" value="${rec === "" ? "" : cop(+rec)}" readonly><div class="teclado" aria-label="Teclado numérico">${["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((n) => `<button type="button" class="sec" onclick="teclaDinero('${n}')">${n}</button>`).join("")}<button type="button" class="sec" aria-label="Borrar todo" onclick="teclaDinero('limpiar')">C</button><button type="button" class="sec" onclick="teclaDinero('0')">0</button><button type="button" class="sec" aria-label="Borrar último dígito" onclick="teclaDinero('borrar')">⌫</button></div><p class="total" id="camb">${cambio()}</p><button onclick="cobrar()">Cobrar</button> ` : ""}<button class="sec" onclick="carro=[];rec='';refT()">Cancelar</button>`
  );
}
const refT = () => ($("#lineas").innerHTML = lineas());
function teclaDinero(tecla) {
  if (tecla == "limpiar") rec = "";
  else if (tecla == "borrar") rec = rec.slice(0, -1);
  else {
    const siguiente = (rec + tecla).replace(/^0+(?=\d)/, "");
    if (!Number.isSafeInteger(+siguiente))
      return aviso("El valor ingresado es demasiado grande.");
    rec = siguiente;
  }
  $("#recibido").value = rec === "" ? "" : cop(+rec);
  $("#camb").textContent = cambio();
}
function add(id) {
  const p = db.productos.find((x) => x.id == id),
    c = carro.find((x) => x.id == id);
  c
    ? c.cant++
    : carro.push({ id, nombre: p.nombre, precio: p.precio, cant: 1 });
  refT();
}
function cant(i, d) {
  carro[i].cant += d;
  if (carro[i].cant < 1) carro.splice(i, 1);
  if (!carro.length) rec = "";
  refT();
}
function cobrar() {
  if (!carro.length) return aviso("Agrega al menos un producto.");
  if (rec === "" || +rec < total())
    return aviso("El dinero recibido es menor que el total.");
  const v = {
    n: db.n.venta++,
    f: new Date().toISOString(),
    cajero: user.u,
    caja,
    items: carro.map((c) => ({ ...c })),
    total: total(),
    recibido: +rec,
    cambio: +rec - total(),
    cierre: null,
  };
  db.ventas.push(v);
  save();
  carro = [];
  rec = "";
  refT();
  recibo(v);
}
function recibo(v) {
  $("#modal").innerHTML =
    `<div class="recibo"><b>CAFETERÍA EINSTEIN</b><span>Recibo N° ${String(v.n).padStart(6, "0")}</span><span>${new Date(v.f).toLocaleString("es-CO")}</span><span>Cajero: ${esc(v.cajero)} · ${v.caja || "Caja 1"}</span><hr>${v.items.map((i) => `<span>${i.cant} x ${esc(i.nombre)} ${cop(i.cant * i.precio)}</span>`).join("")}<hr><b>Total: ${cop(v.total)}</b><span>Recibido: ${cop(v.recibido)}</span><span>Cambio: ${cop(v.cambio)}</span><button onclick="window.print()">Imprimir</button><button class="sec" onclick="$('#modal').classList.remove('abierto')">Cerrar</button></div>`;
  $("#modal").classList.add("abierto");
}

/* ---- Pantallas ---- */
const tabla = (cab, filas) =>
  `<div class="tabla"><table><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr>${filas.join("") || `<tr><td colspan="${cab.length}">Sin registros todavía.</td></tr>`}</table></div>`;
const fila = (c) => `<tr>${c.map((x) => `<td>${x}</td>`).join("")}</tr>`;
const V = {
  ordenar: () =>
    `<div class="dos"><div><div class="filtros"><h2 style="margin:0">Ordenar</h2><select aria-label="Caja" onchange="caja=this.value;refT()">${CAJAS.map((c) => `<option ${c == caja ? "selected" : ""}>${c}</option>`).join("")}</select></div><input class="buscar" placeholder="Buscar producto..." oninput="$('#prods').innerHTML=prods(this.value)"><div class="chips">${["Todos", ...new Set(db.productos.filter((p) => p.activo).map((p) => p.cat))].map((c) => `<button class="chip ${(c == "Todos" ? "" : c) == cat ? "on" : ""}" onclick="cat='${c == "Todos" ? "" : c}';pintar()">${c}</button>`).join("")}</div><div id="prods" class="grid">${prods("")}</div></div><div class="ticket" id="lineas">${lineas()}</div></div>`,

  cierre: () => {
    if (user.rol != "Administrador" && !cc) cc = caja;
    const pend = pendientes(),
      esp = pend.reduce((s, v) => s + v.total, 0),
      mis = db.cierres.filter(
        (c) => user.rol == "Administrador" || c.por == user.u,
      );
    return (
      `<div class="caja"><h2>Cierre de caja</h2><div class="filtros"><label>Caja</label><select onchange="cc=this.value;pintar()">${(user.rol == "Administrador" ? ["", ...CAJAS] : CAJAS).map((c) => `<option value="${c}" ${c == cc ? "selected" : ""}>${c || "Todas las cajas"}</option>`).join("")}</select></div><p>Ventas sin cerrar: <b>${pend.length}</b>. Efectivo esperado: <b>${cop(esp)}</b></p><div class="filtros" style="margin-top:12px"><input id="cont" type="number" min="0" placeholder="Efectivo contado"><input id="obs" placeholder="Observación (si hay diferencia)"><button onclick="cerrarCaja()">Generar cierre</button></div></div>` +
      (user.rol == "Administrador"
        ? `<div class="caja"><h3>Facturas en PDF</h3><div class="filtros"><input type="date" id="fd" value="${dia(new Date())}"><button onclick="pdfFacturas()">Abrir PDF con todas las facturas</button></div><small>Incluye todas las facturas de esa fecha, de la caja elegida arriba.</small></div>`
        : "") +
      `<div class="caja"><h3>Cierres anteriores</h3>${tabla(
        [
          "N°",
          "Fecha",
          "Por",
          "Caja",
          "Ventas",
          "Esperado",
          "Contado",
          "Diferencia",
          "Observación",
        ],
        mis.map((c) =>
          fila([
            c.id,
            new Date(c.f).toLocaleString("es-CO"),
            esc(c.por),
            esc(c.caja || "Todas"),
            c.n,
            cop(c.esp),
            cop(c.cont),
            cop(c.dif),
            esc(c.obs),
          ]),
        ),
      )}</div>`
    );
  },

  precios: () =>
    `<div class="caja"><div class="filtros"><h2 style="margin:0">Precios</h2><button class="sec" onclick="editarPrecios=!editarPrecios;pintar()">${editarPrecios ? "Finalizar edición" : "Editar precios"}</button></div><p class="sub">Lista de precios de los productos disponibles para ordenar.</p>${editarPrecios ? `<form class="filtros" onsubmit="crearProd(event)"><input id="np" placeholder="Nombre del producto" required><input id="ncat" placeholder="Categoría" required><input id="npr" type="number" min="1" step="1" placeholder="Precio en COP" required><button type="submit">Agregar producto</button></form>` : ""}${tabla(
      ["Producto", "Categoría", "Precio", "Estado"],
      db.productos.map((p) =>
        fila([
          editarPrecios
            ? `<input aria-label="Nombre de ${esc(p.nombre)}" value="${esc(p.nombre)}" onchange="editP(${p.id},'nombre',this.value)">`
            : esc(p.nombre),
          editarPrecios
            ? `<input aria-label="Categoría de ${esc(p.nombre)}" value="${esc(p.cat)}" onchange="editP(${p.id},'cat',this.value)">`
            : esc(p.cat),
          editarPrecios
            ? `<input aria-label="Precio de ${esc(p.nombre)}" type="number" min="1" step="1" value="${p.precio}" onchange="editP(${p.id},'precio',this.value)">`
            : cop(p.precio),
          editarPrecios
            ? `<button class="sec" onclick="estadoP(${p.id})">${p.activo ? "Activo (desactivar)" : "Inactivo (activar)"}</button>`
            : p.activo
              ? "Activo"
              : "Inactivo",
        ]),
      ),
    )}</div>`,

  insumos: () =>
    `<div class="caja"><h2>Insumos</h2><div class="filtros"><select id="mi">${db.insumos.map((i) => `<option value="${i.id}">${esc(i.nombre)}</option>`).join("")}</select><select id="mt"><option>Entrada</option><option>Salida</option><option>Ajuste</option></select><input id="mc" type="number" min="0" step="any" placeholder="Cantidad"><button onclick="movIns()">Registrar</button></div><div class="filtros"><input id="ni" placeholder="Nuevo insumo (ej. Chocolate en polvo (kg))"><input id="ns" type="number" min="0" step="any" placeholder="Saldo inicial"><input id="nm" type="number" min="0" step="any" placeholder="Stock mínimo"><button class="sec" onclick="crearIns()">Agregar insumo</button></div>${tabla(
      ["Insumo", "Saldo", "Stock mínimo"],
      db.insumos.map((i) =>
        fila([
          esc(i.nombre) + (i.saldo <= i.min ? " ⚠" : ""),
          i.saldo,
          `<input type="number" min="0" step="any" value="${i.min}" onchange="minIns(${i.id},this.value)">`,
        ]),
      ),
    )}<p><small>Ajuste: la cantidad escrita pasa a ser el nuevo saldo.</small></p></div>`,

  historial: () =>
    `<div class="caja"><h2>Historial de ventas</h2><div class="filtros"><label>Fecha</label><input type="date" id="d1" onchange="hist()"><input type="date" id="d2" onchange="hist()"><label>Hora</label><input type="time" id="h1" onchange="hist()"><input type="time" id="h2" onchange="hist()"><select id="hc" onchange="hist()"><option value="">Todos los cajeros</option>${db.usuarios
      .filter((u) => u.rol == "Cajero")
      .map((u) => `<option>${esc(u.u)}</option>`)
      .join(
        "",
      )}</select><select id="hk" onchange="hist()"><option value="">Todas las cajas</option>${CAJAS.map((c) => `<option>${c}</option>`).join("")}</select></div><div id="histT">${histT()}</div></div>`,

  bitacora: () =>
    `<div class="caja"><h2>Bitácora de cambios</h2>${tabla(
      ["Fecha", "Usuario", "Cambio"],
      db.bitacora
        .slice(0, 200)
        .map((b) =>
          fila([new Date(b.f).toLocaleString("es-CO"), esc(b.u), esc(b.t)]),
        ),
    )}</div>`,

  usuarios: () =>
    `<div class="caja"><h2>Usuarios</h2><div class="filtros"><input id="nu" placeholder="Usuario"><input id="np2" type="password" placeholder="Contraseña (mín. 6)"><select id="nr"><option>Cajero</option><option>Administrador</option><option>Soporte técnico</option></select><button onclick="crearU()">Crear cuenta</button></div>${tabla(
      ["Usuario", "Rol", "Estado"],
      db.usuarios.map((u) =>
        fila([
          esc(u.u),
          `<select onchange="rolU('${esc(u.u)}',this.value)">${Object.keys(MENU)
            .map((r) => `<option ${r == u.rol ? "selected" : ""}>${r}</option>`)
            .join("")}</select>`,
          `<button class="sec" onclick="estadoU('${esc(u.u)}')">${u.activo ? "Activa (desactivar)" : "Inactiva (activar)"}</button>`,
        ]),
      ),
    )}</div>`,

  respaldo: () =>
    `<div class="caja"><h2>Copias de respaldo</h2><p>Último respaldo: <b>${db.respaldo ? new Date(db.respaldo).toLocaleString("es-CO") : "nunca"}</b>. Se recomienda hacer uno cada día.</p><div class="filtros"><button onclick="bajar()">Descargar copia</button><label>Restaurar:</label><input type="file" accept=".json" onchange="subir(this)"></div></div>`,
};

/* ---- Acciones ---- */
function crearProd(e) {
  e.preventDefault();
  const n = $("#np").value.trim(),
    catProd = $("#ncat").value.trim(),
    p = +$("#npr").value;
  if (!n || !catProd || !Number.isInteger(p) || p <= 0)
    return aviso("Escribe nombre, categoría y un precio entero mayor a 0.");
  db.productos.push({
    id: db.n.prod++,
    nombre: n,
    cat: catProd,
    precio: p,
    activo: true,
  });
  log(`Producto creado: ${n} (${cop(p)})`);
  pintar();
}
function editP(id, campo, val) {
  const p = db.productos.find((x) => x.id == id);
  if (campo == "precio") {
    val = +val;
    if (!Number.isInteger(val) || val <= 0) {
      aviso("El precio debe ser un número entero mayor a 0.");
      return pintar();
    }
  } else {
    val = val.trim();
    if (!val) {
      aviso("El nombre y la categoría no pueden quedar vacíos.");
      return pintar();
    }
  }
  log(
    `${campo == "precio" ? "Precio" : campo == "cat" ? "Categoría" : "Producto"} de ${p.nombre}: ${p[campo]} -> ${val}`,
  );
  p[campo] = val;
  save();
  pintar();
}
function estadoP(id) {
  const p = db.productos.find((x) => x.id == id);
  p.activo = !p.activo;
  log(`${p.nombre} ${p.activo ? "activado" : "desactivado"}`);
  pintar();
}
function cerrarCaja() {
  const pend = pendientes(),
    esp = pend.reduce((s, v) => s + v.total, 0);
  const cont = $("#cont").value,
    obs = $("#obs").value.trim();
  if (cont === "") return aviso("Escribe el efectivo contado.");
  const dif = +cont - esp;
  if (dif !== 0 && !obs)
    return aviso(
      "Hay una diferencia de " + cop(dif) + ". Escribe una observación.",
    );
  const c = {
    id: db.n.cierre++,
    f: new Date().toISOString(),
    por: user.u,
    caja: cc || "Todas",
    n: pend.length,
    esp,
    cont: +cont,
    dif,
    obs,
  };
  pend.forEach((v) => (v.cierre = c.id));
  db.cierres.unshift(c);
  log(`Cierre de caja N° ${c.id}: diferencia ${cop(dif)}`);
  aviso("Cierre N° " + c.id + " guardado.");
  pintar();
}
function movIns() {
  const i = db.insumos.find((x) => x.id == $("#mi").value),
    t = $("#mt").value,
    c = +$("#mc").value;
  if ($("#mc").value === "" || c < 0)
    return aviso("Escribe una cantidad válida.");
  if (t == "Salida" && c > i.saldo)
    return aviso("La salida es mayor que el saldo (" + i.saldo + ").");
  i.saldo = t == "Entrada" ? i.saldo + c : t == "Salida" ? i.saldo - c : c;
  log(`${t} de ${c} en ${i.nombre}. Saldo: ${i.saldo}`);
  pintar();
  if (i.saldo <= i.min)
    aviso("Alerta: " + i.nombre + " llegó al stock mínimo.");
}
function minIns(id, v) {
  const i = db.insumos.find((x) => x.id == id);
  log(`Mínimo de ${i.nombre}: ${i.min} -> ${+v}`);
  i.min = +v;
  save();
  pintar();
}
function histT() {
  const g = (id) => ($("#" + id) ? $("#" + id).value : "");
  const l = db.ventas
    .filter(
      (v) =>
        (!g("d1") || dia(v.f) >= g("d1")) &&
        (!g("d2") || dia(v.f) <= g("d2")) &&
        (!g("h1") || hora(v.f) >= g("h1")) &&
        (!g("h2") || hora(v.f) <= g("h2")) &&
        (!g("hc") || v.cajero == g("hc")) &&
        (!g("hk") || (v.caja || "Caja 1") == g("hk")),
    )
    .reverse();
  return (
    `<p>${l.length} ventas, total <b>${cop(l.reduce((s, v) => s + v.total, 0))}</b></p>` +
    tabla(
      ["N°", "Fecha", "Cajero", "Caja", "Total", ""],
      l.map((v) =>
        fila([
          v.n,
          new Date(v.f).toLocaleString("es-CO"),
          esc(v.cajero),
          v.caja || "Caja 1",
          cop(v.total),
          `<button class="sec" onclick="recibo(db.ventas.find(x=>x.n==${v.n}))">Ver recibo</button>`,
        ]),
      ),
    )
  );
}
const hist = () => ($("#histT").innerHTML = histT());
async function crearU() {
  const u = $("#nu").value.trim(),
    p = $("#np2").value;
  if (!u || p.length < 6)
    return aviso("Escribe un usuario y una contraseña de mínimo 6 caracteres.");
  if (db.usuarios.some((x) => x.u == u)) return aviso("Ese usuario ya existe.");
  db.usuarios.push({ u, h: await sha(p), rol: $("#nr").value, activo: true });
  log(`Cuenta creada: ${u} (${$("#nr").value})`);
  pintar();
}
function rolU(u, r) {
  const x = db.usuarios.find((y) => y.u == u);
  log(`Rol de ${u}: ${x.rol} -> ${r}`);
  x.rol = r;
  save();
  if (u == user.u) {
    user = null;
  }
  pintar();
}
function estadoU(u) {
  const x = db.usuarios.find((y) => y.u == u);
  if (u == user.u) return aviso("No puedes desactivar tu propia cuenta.");
  x.activo = !x.activo;
  log(`Cuenta ${u} ${x.activo ? "activada" : "desactivada"}`);
  pintar();
}
function bajar() {
  db.respaldo = new Date().toISOString();
  log("Copia de respaldo generada");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(db)], { type: "application/json" }),
  );
  a.download = "respaldo-cafepos-" + dia(db.respaldo) + ".json";
  a.click();
  pintar();
}
function subir(inp) {
  const f = inp.files[0];
  if (
    !f ||
    !confirm("Restaurar reemplaza todos los datos actuales. ¿Continuar?")
  )
    return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.usuarios || !d.productos) throw 0;
      db = d;
      save();
      user = null;
      pintar();
      aviso("Copia restaurada. Inicia sesión de nuevo.");
    } catch {
      aviso("El archivo no es una copia válida.");
    }
  };
  r.readAsText(f);
}
const pendientes = () =>
  db.ventas.filter(
    (v) =>
      !v.cierre &&
      (user.rol == "Administrador" || v.cajero == user.u) &&
      (!cc || (v.caja || "Caja 1") == cc),
  );
function crearIns() {
  const n = $("#ni").value.trim(),
    s = +$("#ns").value,
    m = +$("#nm").value;
  if (!n) return aviso("Escribe el nombre del insumo.");
  if (db.insumos.some((i) => i.nombre.toLowerCase() == n.toLowerCase()))
    return aviso("Ese insumo ya existe.");
  if ($("#ns").value === "" || $("#nm").value === "" || s < 0 || m < 0)
    return aviso("Escribe el saldo inicial y el stock mínimo.");
  db.insumos.push({ id: db.n.ins++, nombre: n, saldo: s, min: m });
  log(`Insumo creado: ${n} (saldo ${s}, mínimo ${m})`);
  pintar();
}

/* ---- PDF de facturas (se genera aquí mismo, sin internet) ---- */
function crearPDF(paginas) {
  const enc = (t) =>
    t
      .replace(/[\u202f]/g, " ")
      .replace(/[\\()]/g, "\\$&")
      .replace(/[^\x20-\xFF]/g, "?");
  const o = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${paginas.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${paginas.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  paginas.forEach((ls, i) => {
    const c =
      "BT /F1 10 Tf 13 TL 50 742 Td\n" +
      ls.map((l) => `(${enc(l)}) Tj T*`).join("\n") +
      "\nET";
    o[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    o[5 + i * 2] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
  });
  let out = "%PDF-1.4\n",
    off = [];
  for (let i = 1; i < o.length; i++) {
    off[i] = out.length;
    out += `${i} 0 obj\n${o[i]}\nendobj\n`;
  }
  const x = out.length;
  out +=
    `xref\n0 ${o.length}\n0000000000 65535 f \n` +
    off
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size ${o.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return new Blob([Uint8Array.from(out, (c) => c.charCodeAt(0))], {
    type: "application/pdf",
  });
}
const pad = (s, n) => String(s).padEnd(n).slice(0, n),
  rp = (s, n) => String(s).padStart(n);
function lineasFactura(v) {
  const w = 44,
    l = [
      "CAFETERÍA EINSTEIN",
      `Factura N° ${String(v.n).padStart(6, "0")}  ${v.caja || "Caja 1"}`,
      new Date(v.f).toLocaleString("es-CO"),
      "Cajero: " + v.cajero,
      "-".repeat(w),
    ];
  v.items.forEach((i) =>
    l.push(
      pad(i.cant + " x " + i.nombre, 30) + rp(cop(i.cant * i.precio), w - 30),
    ),
  );
  l.push(
    "-".repeat(w),
    pad("TOTAL", 20) + rp(cop(v.total), w - 20),
    pad("Recibido", 20) + rp(cop(v.recibido), w - 20),
    pad("Cambio", 20) + rp(cop(v.cambio), w - 20),
    "=".repeat(w),
    "",
  );
  return l;
}
function pdfFacturas() {
  const f = $("#fd").value,
    lista = db.ventas.filter(
      (v) => dia(v.f) == f && (!cc || (v.caja || "Caja 1") == cc),
    );
  if (!lista.length) return aviso("No hay facturas para esa fecha y caja.");
  const paginas = [
    [
      "FACTURAS DEL " + f + " - " + (cc || "Todas las cajas"),
      lista.length +
        " facturas, total " +
        cop(lista.reduce((s, v) => s + v.total, 0)),
      "",
    ],
  ];
  lista.forEach((v) => {
    const r = lineasFactura(v);
    let p = paginas[paginas.length - 1];
    if (p.length + r.length > 54) paginas.push((p = []));
    p.push(...r);
  });
  window.open(URL.createObjectURL(crearPDF(paginas)), "_blank");
  log(`PDF de facturas generado (${f}, ${cc || "todas las cajas"})`);
}
init();
