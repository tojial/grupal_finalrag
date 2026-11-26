// RAGNAROK ESPORTS - script.js (lógica de la app + registro de la PWA). Sin compilación: se edita y se sube tal cual.


// ============================================================
  // RAGNAROK ESPORTS - PLATAFORMA GAMING
  // ============================================================

  $(document).ready(function() {

    // ============================================================
    // 1. CONFIGURACIÓN
    // ============================================================
    const STORAGE_KEY = 'ragnarok_events_history_v6';
    const INSCRIPCIONES_KEY = 'ragnarok_inscripciones_v2';
    let eventsHistory = [];
    let inscripciones = [];
    let productosData = [];
    let categoriaActual = 'todos';
    let playerCount = 0; // declarado arriba: inicializarJugadores() se ejecuta antes de la sección de inscripción
    let currentUser = null, currentProfile = null, supabaseClient = null;
    // Debe declararse antes del bloque de inicialización que restaura el perfil.
    const SESSION_CACHE_KEY = 'ragnarok_cached_profile_v1';
    let profileLoadVersion = 0;
    const LAST_SECTION_KEY = 'ragnarok_last_section_v1';
    const savedSection = safeGet(LAST_SECTION_KEY);

    // Safe storage helpers: keep the app usable when storage is blocked.
    function safeGet(key, fallback = null) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch (_) { return fallback; } }
    function safeSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }
    // Sanitize HTML templates before any jQuery HTML insertion. DOMPurify is loaded from CDN;
    // a conservative fallback strips scriptable tags/attributes if it is unavailable.
    if (window.DOMPurify && window.jQuery) {
      // Las filas <tr>/<td> sueltas se perderían al sanitizar (el parser las descarta fuera de una tabla): se envuelven antes.
      const sanitizeMarkup = value => {
        if (typeof value !== 'string') return value;
        if (/^\s*<(tr|td|th|tbody|thead|tfoot)\b/i.test(value)) {
          const tpl = document.createElement('template');
          tpl.innerHTML = DOMPurify.sanitize('<table><tbody>' + value + '</tbody></table>');
          const body = tpl.content.querySelector('tbody');
          return body ? body.innerHTML : '';
        }
        return DOMPurify.sanitize(value);
      };
      const htmlOriginal = $.fn.html; const appendOriginal = $.fn.append; const prependOriginal = $.fn.prepend;
      $.fn.html = function(value) { return arguments.length ? htmlOriginal.call(this, sanitizeMarkup(value)) : htmlOriginal.call(this); };
      $.fn.append = function(...values) { return appendOriginal.apply(this, values.map(sanitizeMarkup)); };
      $.fn.prepend = function(...values) { return prependOriginal.apply(this, values.map(sanitizeMarkup)); };
    } else if (window.jQuery) {
      const safeFallback = value => {
        if (typeof value !== 'string') return value;
        const template = document.createElement('template'); template.innerHTML = value;
        template.content.querySelectorAll('script, iframe, object, embed, style, link, meta').forEach(node => node.remove());
        template.content.querySelectorAll('*').forEach(element => [...element.attributes].forEach(attribute => {
          const name = attribute.name.toLowerCase(), content = attribute.value.trim();
          if (name.startsWith('on') || name === 'srcdoc' || (['href','src','xlink:href','formaction'].includes(name) && /^javascript:/i.test(content))) element.removeAttribute(attribute.name);
        }));
        return template.innerHTML;
      };
      const htmlOriginal = $.fn.html; const appendOriginal = $.fn.append; const prependOriginal = $.fn.prepend;
      $.fn.html = function(value) { return arguments.length ? htmlOriginal.call(this, safeFallback(value)) : htmlOriginal.call(this); };
      $.fn.append = function(...values) { return appendOriginal.apply(this, values.map(safeFallback)); };
      $.fn.prepend = function(...values) { return prependOriginal.apply(this, values.map(safeFallback)); };
    }
    // Programmatically connect existing labels and make controls accessible.
    document.querySelectorAll('.form-group').forEach(group => {
      const label = group.querySelector('label'); const control = group.querySelector('input, select, textarea');
      if (label && control && control.id) label.htmlFor = control.id;
    });
    document.querySelectorAll('.nav-btn').forEach(btn => { btn.setAttribute('aria-controls', 'page-' + btn.dataset.section); });
    document.querySelectorAll('a[target="_blank"]').forEach(link => { link.rel = 'noopener noreferrer'; });


    // ============================================================
    // 2. DATOS DE PRODUCTOS
    // ============================================================
    const productosBase = [
      // Ropa y Vestimenta
      { id: 1, nombre: 'Polera Oficial', categoria: 'ropa', precio: 25, img: 'imagenes/polerarak2.png', desc: 'Diseño exclusivo con logo Ragnarok.', destacado: true, nuevo: false, disponible: true },
      { id: 2, nombre: 'Gorra Ragnarok', categoria: 'ropa', precio: 15, img: 'imagenes/gorrarak.png', desc: 'Logo bordado, talla ajustable.', destacado: false, nuevo: true, disponible: true },
      { id: 3, nombre: 'Hoodie Ragnarok', categoria: 'ropa', precio: 45, img: 'imagenes/Hoodie Ragnarok edición limitada.png', desc: 'Hoodie con capucha y logo bordado.', destacado: true, nuevo: false, disponible: true },
      { id: 4, nombre: 'Chaqueta Esports', categoria: 'ropa', precio: 65, img: 'imagenes/Chaqueta Esports Ragnarok Neón.png', desc: 'Chaqueta oficial del equipo.', destacado: false, nuevo: true, disponible: true },
      { id: 5, nombre: 'Camiseta Deportiva', categoria: 'ropa', precio: 30, img: 'imagenes/Camiseta esports RAGNAROK neón.png', desc: 'Camiseta transpirable para entrenar.', destacado: false, nuevo: false, disponible: true },
      
      // Accesorios
      { id: 6, nombre: 'Tomatodo Gamer', categoria: 'accesorios', precio: 10, img: 'imagenes/tomatodorak.png', desc: 'Acero inoxidable, 750ml.', destacado: true, nuevo: false, disponible: true },
      { id: 7, nombre: 'Mochila Gaming', categoria: 'accesorios', precio: 55, img: 'imagenes/Mochila gamer Ragnarok neón verde.png', desc: 'Mochila con compartimento para laptop.', destacado: false, nuevo: true, disponible: true },
      { id: 8, nombre: 'Pulsera Ragnarok', categoria: 'accesorios', precio: 8, img: 'imagenes/Pulsera Ragnarok_ estilo gamer neón.png', desc: 'Pulsera de silicona con logo.', destacado: false, nuevo: false, disponible: true },
      { id: 9, nombre: 'Llavero Gamer', categoria: 'accesorios', precio: 5, img: 'imagenes/Llavero Ragnarok_ diseño gamer neón.png', desc: 'Llavero metálico edición limitada.', destacado: false, nuevo: true, disponible: true },
      { id: 10, nombre: 'Mousepad Gaming', categoria: 'accesorios', precio: 15, img: 'imagenes/Alfombrilla XL Ragnarok Gaming Neon.png', desc: 'Mousepad antideslizante RGB.', destacado: false, nuevo: false, disponible: true },
      
      // Periféricos Gaming
      { id: 11, nombre: 'Mouse Gaming RGB', categoria: 'perifericos', precio: 40, img: 'imagenes/Mouse gaming Ragnarok_ precisión y RGB.png', desc: 'Mouse con sensor óptico 16000 DPI.', destacado: true, nuevo: false, disponible: true },
      { id: 12, nombre: 'Teclado Mecánico', categoria: 'perifericos', precio: 85, img: 'imagenes/Póster gamer del teclado mecánico Ragnarok.png', desc: 'Teclado mecánico RGB switches azules.', destacado: true, nuevo: true, disponible: true },
      { id: 13, nombre: 'Auriculares Gaming', categoria: 'perifericos', precio: 60, img: 'imagenes/Auriculares Gaming Ragnarok Neón.png', desc: 'Auriculares con micrófono y sonido 7.1.', destacado: false, nuevo: false, disponible: true },
      { id: 14, nombre: 'Micrófono USB', categoria: 'perifericos', precio: 50, img: 'imagenes/Micrófono Ragnarök_ potencia RGB gamer.png', desc: 'Micrófono condensador para streaming.', destacado: false, nuevo: true, disponible: true },
      { id: 15, nombre: 'Control Gaming', categoria: 'perifericos', precio: 35, img: 'imagenes/Control gaming Ragnarok_ poder neón sin límites.png', desc: 'Control inalámbrico compatible PC/consola.', destacado: false, nuevo: false, disponible: true },
      
      // Coleccionables
      { id: 16, nombre: 'Figura Gaming', categoria: 'coleccionables', precio: 30, img: 'imagenes/Figura gaming Ragnarok_ edición coleccionista neon.png', desc: 'Figura coleccionable de edición limitada.', destacado: true, nuevo: false, disponible: true },
      { id: 17, nombre: 'Pack de Stickers', categoria: 'coleccionables', precio: 6, img: 'imagenes/Pack de Stickers Ragnarok Gamer.png', desc: 'Pack de 10 stickers exclusivos.', destacado: false, nuevo: true, disponible: true },
      { id: 18, nombre: 'Poster Ragnarok', categoria: 'coleccionables', precio: 12, img: 'imagenes/Póster neón de gaming RAGNAROK.png', desc: 'Poster oficial del equipo tamaño A2.', destacado: false, nuevo: false, disponible: true },
      
      // Merchandising Ragnarok
      { id: 19, nombre: 'Pack Merchandising', categoria: 'merchandising', precio: 75, img: 'imagenes/Pack merchandising Ragnarok neón.png', desc: 'Pack completo de merchandising oficial.', destacado: true, nuevo: false, disponible: true },
      { id: 20, nombre: 'Artículo Exclusivo', categoria: 'merchandising', precio: 100, img: 'imagenes/Hoodie Ragnarok edición limitada.png', desc: 'Artículo de colección ultra limitado.', destacado: true, nuevo: true, disponible: false },
      { id: 21, nombre: 'Taza Ragnarok', categoria: 'merchandising', precio: 12, img: 'imagenes/Taza Gamer Ragnarok_ Pasión en Cada Sorbo.png', desc: 'Taza cerámica con logo del equipo.', destacado: false, nuevo: false, disponible: true },
      { id: 22, nombre: 'Alfombrilla XL', categoria: 'merchandising', precio: 20, img: 'imagenes/Alfombrilla XL Ragnarok Gaming Neon.png', desc: 'Alfombrilla de escritorio XL.', destacado: true, nuevo: false, disponible: true }
    ];

    productosData = [...productosBase];
    window.productosData = productosData;

    // ============================================================
    // 3. CARGAR DATOS
    // ============================================================
    function loadHistory() {
      const saved = safeGet(STORAGE_KEY);
      if (saved) {
        try { eventsHistory = JSON.parse(saved); } catch (e) { eventsHistory = []; }
      }
    }

    function saveHistory() {
      safeSet(STORAGE_KEY, JSON.stringify(eventsHistory));
    }

    function loadInscripciones() {
      const saved = safeGet(INSCRIPCIONES_KEY);
      if (saved) {
        try { inscripciones = JSON.parse(saved); } catch (e) { inscripciones = []; }
      }
    }

    function saveInscripciones() {
      safeSet(INSCRIPCIONES_KEY, JSON.stringify(inscripciones));
    }

    // ============================================================
    // 4. REGISTRO DE EVENTOS
    // ============================================================
    function registrarEvento(nombre, descripcion) {
      const ahora = new Date();
      const timestamp = Date.now();

      eventsHistory.unshift({
        id: timestamp + Math.random(),
        nombre: nombre,
        descripcion: descripcion,
        fecha: ahora.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        hora: ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        timestamp: timestamp
      });

      if (eventsHistory.length > 100) eventsHistory = eventsHistory.slice(0, 100);

      saveHistory();
      renderizarTablaEventos();
      actualizarEstadisticas();
      if (supabaseClient && currentUser && currentProfile?.role === 'admin') {
        supabaseClient.from('event_log').insert({ user_id: currentUser.id, event_name: nombre, description: descripcion }).then(({error}) => { if(error) console.warn('Registro de evento cloud:', error.message); });
      }
    }

    // ============================================================
    // 5. RENDERIZAR TABLA EVENTOS
    // ============================================================
    function renderizarTablaEventos() {
      const $tbody = $('#eventsTableBody');
      $tbody.empty();

      if (eventsHistory.length === 0) {
        $tbody.html('<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#555;">No hay eventos registrados. Interactúa con el sitio para comenzar.</td></tr>');
        return;
      }

      eventsHistory.forEach(evento => {
        $tbody.append(`
          <tr>
            <td>${evento.nombre}</td>
            <td>${evento.descripcion}</td>
            <td>${evento.fecha}</td>
            <td>${evento.hora}</td>
            <td class="timestamp-cell">${evento.timestamp.toLocaleString()}</td>
          </tr>
        `);
      });
    }

    // ============================================================
    // 6. ESTADÍSTICAS
    // ============================================================
    function actualizarEstadisticas() {
      $('#totalEvents').text(eventsHistory.length);
      $('#lastEventName').text(eventsHistory.length > 0 ? eventsHistory[0].nombre : '--');
      
      const ahora = new Date();
      $('#lastUpdate').text(ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }

    // ============================================================
    // 7. RELOJ
    // ============================================================
    function actualizarReloj() {
      const ahora = new Date();
      const horas = String(ahora.getHours()).padStart(2, '0');
      const minutos = String(ahora.getMinutes()).padStart(2, '0');
      const segundos = String(ahora.getSeconds()).padStart(2, '0');
      $('#clockTime').text(`${horas}:${minutos}:${segundos}`);

      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      $('#clockDate').text(`${dias[ahora.getDay()]}, ${ahora.getDate()} de ${meses[ahora.getMonth()]} de ${ahora.getFullYear()}`);
      $('#clockTimestamp').text(Date.now().toLocaleString());
    }

    actualizarReloj();
    setInterval(actualizarReloj, 1000);

    // ============================================================
    // 8. NAVEGACIÓN
    // ============================================================
    function showSection(sectionId) {
      if (['inscripcion','eventos','admin'].includes(sectionId) && currentProfile?.role !== 'admin') { alert('Esta sección es exclusiva para administradores.'); sectionId = 'inicio'; }
      $('.page-section').removeClass('active').hide();
      $('#page-' + sectionId).fadeIn(300, function() {
        $(this).addClass('active');
      });
      $('.nav-btn').removeClass('active').removeAttr('aria-current');
      $('.nav-btn[data-section="' + sectionId + '"]').addClass('active').attr('aria-current', 'page');
      $('#mainPanel').scrollTop(0);
      
      const nombres = {
        'inicio': 'Inicio', 'equipo': 'Equipo', 'juegos': 'Juegos',
        'torneos': 'Torneos', 'inscripcion': 'Inscripción de Equipos',
        'productos': 'Productos / Tienda', 'patrocinadores': 'Patrocinadores',
        'eventos': 'Sistema de Eventos', 'cuenta': 'Cuenta / Perfil', 'admin': 'Vista Admin', 'contacto': 'Contacto'
      };
      safeSet(LAST_SECTION_KEY, sectionId);
            registrarEvento('Abrió ' + nombres[sectionId], 'El usuario navegó a la sección ' + nombres[sectionId]);
    }

    window.showSection = showSection;

    // ============================================================
    // 9. MENÚ HAMBURGUESA (slideToggle)
    // ============================================================
    $('#sidebar').attr('inert', true);
    $('#hamburgerBtn').on('click', function() {
      const isOpen = !$('#sidebar').hasClass('open');
      $('#sidebar').toggleClass('open', isOpen);
      $('#overlay').toggleClass('active', isOpen).attr('aria-hidden', String(!isOpen));
      $('#sidebar').prop('inert', !isOpen);
      $('#hamburgerBtn').attr('aria-expanded', String(isOpen)).attr('aria-label', isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
      if (isOpen) $('.nav-btn').first().trigger('focus');
      else $('#hamburgerBtn').trigger('focus');
      registrarEvento('Menú', 'El usuario abrió/cerró el menú lateral');
    });

    $('#overlay').on('click', function() {
      $('#sidebar').removeClass('open').prop('inert', true);
      $('#hamburgerBtn').attr('aria-expanded', 'false').attr('aria-label', 'Abrir menú de navegación');
      $(this).removeClass('active').attr('aria-hidden', 'true');
      $('#hamburgerBtn').trigger('focus');
    });

    $('.nav-btn').on('click', function() {
      const section = $(this).data('section');
      showSection(section);
      $('#sidebar').removeClass('open').prop('inert', true);
      $('#overlay').removeClass('active').attr('aria-hidden', 'true');
      $('#hamburgerBtn').attr('aria-expanded', 'false').attr('aria-label', 'Abrir menú de navegación');
      $('#mainPanel').trigger('focus');
    });
    $(document).on('keydown', function(event) {
      if (event.key === 'Tab' && $('#sidebar').hasClass('open')) {
        const $focusable = $('#sidebar').find('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').filter(':visible');
        const first = $focusable[0], last = $focusable[$focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (event.key === 'Escape' && $('#sidebar').hasClass('open')) {
        $('#sidebar').removeClass('open').prop('inert', true); $('#overlay').removeClass('active').attr('aria-hidden', 'true');
        $('#hamburgerBtn').attr('aria-expanded', 'false').attr('aria-label', 'Abrir menú de navegación').trigger('focus');
      }
    });

    // ============================================================
    // 10. INICIALIZACIÓN
    // ============================================================
    loadHistory();
    loadInscripciones();
    renderizarTablaEventos();
    actualizarEstadisticas();
    renderizarProductos();
    renderizarProductosDestacados();
    renderizarInscripciones();
    inicializarJugadores();
    try {
      const cachedBoot = JSON.parse(safeGet(SESSION_CACHE_KEY, 'null'));
      if (cachedBoot && cachedBoot.user && cachedBoot.profile) {
        currentUser = cachedBoot.user;
        currentProfile = cachedBoot.profile;
        aplicarPermisosPorRol();
      }
    } catch (_) {}

    if (savedSection && $('#page-' + savedSection).length) {
      if (!['inscripcion', 'eventos', 'admin'].includes(savedSection) || currentProfile?.role === 'admin') {
        showSection(savedSection);
      }
    }

    registrarEvento('Ingreso al Sitio', 'El usuario ingresó a la plataforma Ragnarok eSports');

    // ============================================================
    // 11. FILTROS DE EQUIPO
    // ============================================================
    $('#filtroJuegoEquipo, #filtroRolEquipo').on('change', function() {
      const juego = $('#filtroJuegoEquipo').val();
      const rol = $('#filtroRolEquipo').val();

      $('.equipo-card').each(function() {
        const cardJuego = $(this).data('juego');
        const cardRol = $(this).data('rol');
        
        const matchJuego = juego === 'todos' || cardJuego === juego;
        const matchRol = rol === 'todos' || cardRol === rol;
        
        if (matchJuego && matchRol) {
          $(this).fadeIn(200);
        } else {
          $(this).fadeOut(200);
        }
      });
      
      registrarEvento('Filtró Equipo', 'Juego: ' + juego + ', Rol: ' + rol);
    });

    // ============================================================
    // 12. FILTROS DE TORNEOS
    // ============================================================
    $('#filtroJuegoTorneo, #filtroEstadoTorneo').on('change', function() {
      const juego = $('#filtroJuegoTorneo').val();
      const estado = $('#filtroEstadoTorneo').val();

      $('.torneo-card').each(function() {
        const cardJuego = $(this).data('juego');
        const cardEstado = $(this).data('estado');
        
        const matchJuego = juego === 'todos' || cardJuego === juego;
        const matchEstado = estado === 'todos' || cardEstado === estado;
        
        if (matchJuego && matchEstado) {
          $(this).fadeIn(200);
        } else {
          $(this).fadeOut(200);
        }
      });
      
      registrarEvento('Filtró Torneos', 'Juego: ' + juego + ', Estado: ' + estado);
    });

    // ============================================================
    // 13. FILTROS DE PRODUCTOS
    // ============================================================
    $('#categoryPills').on('click', '.category-pill', function() {
      $('#categoryPills .category-pill').removeClass('active');
      $(this).addClass('active');
      categoriaActual = $(this).data('categoria');
      renderizarProductos();
    });

    $('#searchProductos, #precioMin, #precioMax, #filtroDisponibilidad, #filtroDestacados, #ordenProductos').on('input change', function() {
      renderizarProductos();
    });

    $('#resetFiltros').on('click', function() {
      $('#searchProductos').val('');
      $('#precioMin').val('');
      $('#precioMax').val('');
      $('#filtroDisponibilidad').val('todos');
      $('#filtroDestacados').val('todos');
      $('#ordenProductos').val('default');
      $('#categoryPills .category-pill').removeClass('active');
      $('#categoryPills .category-pill[data-categoria="todos"]').addClass('active');
      categoriaActual = 'todos';
      renderizarProductos();
      registrarEvento('Filtros', 'El usuario limpió los filtros de productos');
    });

    // ============================================================
    // 14. RENDERIZAR PRODUCTOS
    // ============================================================
    function renderizarProductos() {
      const $grid = $('#productosGrid');
      $grid.empty();

      const busqueda = $('#searchProductos').val().toLowerCase();
      const precioMin = parseFloat($('#precioMin').val()) || 0;
      const precioMaxRaw = $('#precioMax').val();
      const precioMax = precioMaxRaw === '' ? Infinity : Number(precioMaxRaw);
      const disponibilidad = $('#filtroDisponibilidad').val();
      const destacados = $('#filtroDestacados').val();
      const orden = $('#ordenProductos').val();

      let filtrados = productosData.filter(p => {
        const matchBusqueda = p.nombre.toLowerCase().includes(busqueda) || p.desc.toLowerCase().includes(busqueda);
        const matchCategoria = categoriaActual === 'todos' || p.categoria === categoriaActual;
        const matchPrecio = p.precio >= precioMin && p.precio <= precioMax;
        const matchDisponibilidad = disponibilidad === 'todos' || 
          (disponibilidad === 'disponible' && p.disponible) || 
          (disponibilidad === 'agotado' && !p.disponible);
        const matchDestacados = destacados === 'todos' || (destacados === 'destacados' && p.destacado);
        return matchBusqueda && matchCategoria && matchPrecio && matchDisponibilidad && matchDestacados;
      });

      if (orden === 'precio-asc') filtrados.sort((a, b) => a.precio - b.precio);
      else if (orden === 'precio-desc') filtrados.sort((a, b) => b.precio - a.precio);
      else if (orden === 'nombre-asc') filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));

      $('#resultCount').text(`Mostrando ${filtrados.length} producto(s)`);

      if (filtrados.length === 0) {
        $grid.html('<p style="text-align:center;color:var(--gray);grid-column:1/-1;padding:2rem;">No se encontraron productos con los filtros seleccionados.</p>');
        return;
      }

      filtrados.forEach(p => {
        const badgeHtml = p.nuevo ? '<span class="badge badge-new">Nuevo</span>' : 
                          p.destacado ? '<span class="badge badge-featured">Destacado</span>' : '';
        const disponibilidadTexto = p.disponible ? 'Disponible' : 'Agotado';
        const disponibilidadColor = p.disponible ? 'var(--green-bright)' : '#ff4444';

        $grid.append(`
          <div class="card producto-card">
            <img src="${p.img}" alt="${p.nombre}">
            ${badgeHtml}
            <h3>${p.nombre}</h3>
            <p class="desc">${p.desc}</p>
            <p style="font-size:0.75rem;color:var(--gray);text-transform:uppercase;">${p.categoria}</p>
            <p class="price">Bs ${Number(p.precio).toFixed(2)}</p>
            <p style="font-size:0.8rem;color:${disponibilidadColor};font-weight:700;">${disponibilidadTexto}</p>
            <button class="btn btn-sm toggle-detail" data-target="detail-${p.id}" aria-controls="detail-${p.id}" aria-expanded="false">Ver Detalles</button>
            <button class="btn btn-sm btn-pedido-producto" data-id="${p.id}" ${p.disponible ? '' : 'disabled'}>🛒 Hacer Pedido</button>
            <div class="product-detail" id="detail-${p.id}">
              <h4>📋 DETALLES DEL PRODUCTO</h4>
              <ul>
                <li>Categoría: <span>${p.categoria}</span></li>
                <li>Precio: <span>Bs ${Number(p.precio).toFixed(2)}</span></li>
                <li>Disponibilidad: <span>${disponibilidadTexto}</span></li>
              </ul>
            </div>
          </div>
        `);
      });
    }

    // Productos destacados en inicio
    function renderizarProductosDestacados() {
      const $grid = $('#productosDestacadosInicio');
      $grid.empty(); // Evitar duplicados
      const destacados = productosData.filter(p => p.destacado && p.disponible).slice(0, 3);
      
      destacados.forEach(p => {
        $grid.append(`
          <div class="card">
            <img src="${p.img}" alt="${p.nombre}">
            <span class="badge badge-featured">Destacado</span>
            <h3>${p.nombre}</h3>
            <p class="desc">${p.desc}</p>
            <p class="price">Bs ${Number(p.precio).toFixed(2)}</p>
          </div>
        `);
      });
    }

    // Detalles de productos (fadeToggle)
    $(document).on('click', '.toggle-detail', function(e) {
      e.stopPropagation();
      const $button = $(this);
      const targetId = $button.data('target');
      const $detail = $('#' + targetId);
      $detail.stop(true, true).fadeToggle(250, function() {
        const visible = $detail.is(':visible');
        $button.text(visible ? 'Ocultar Detalles' : 'Ver Detalles').attr('aria-expanded', String(visible));
      });
    });

    // ============================================================
    // 15. INSCRIPCIÓN DE EQUIPOS
    // ============================================================

    function agregarJugador() {
      playerCount++;
      const $row = $(`
        <div class="player-row" data-player="${playerCount}">
          <div class="form-group" style="margin:0;">
            <label for="player-nick-${playerCount}">Nickname *</label>
            <input type="text" id="player-nick-${playerCount}" class="player-nick" required placeholder="Nickname" autocomplete="nickname">
            <span class="error-msg" style="display:none;">Requerido</span>
          </div>
          <div class="form-group" style="margin:0;">
            <label for="player-name-${playerCount}">Nombre *</label>
            <input type="text" id="player-name-${playerCount}" class="player-name" required placeholder="Nombre completo" autocomplete="name">
            <span class="error-msg" style="display:none;">Requerido</span>
          </div>
          <div class="form-group" style="margin:0;">
            <label for="player-role-${playerCount}">Rol *</label>
            <input type="text" id="player-role-${playerCount}" class="player-role" required placeholder="Rol/Posición">
            <span class="error-msg" style="display:none;">Requerido</span>
          </div>
          <button type="button" class="remove-player" title="Eliminar">✕</button>
        </div>
      `);
      $('#playersContainer').append($row);
    }

    function inicializarJugadores() {
      $('#playersContainer').empty();
      playerCount = 0;
      for (let i = 0; i < 5; i++) agregarJugador();
    }

    $('#addPlayerBtn').on('click', function() {
      if ($('.player-row').length >= 7) {
        alert('Máximo 7 jugadores permitidos.');
        return;
      }
      agregarJugador();
    });

    $(document).on('click', '.remove-player', function() {
      if ($('.player-row').length <= 5) {
        alert('Mínimo 5 jugadores requeridos.');
        return;
      }
      $(this).closest('.player-row').remove();
    });

    // Validación en vivo
    function validarEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validarTelefono(telefono) {
      const digits = telefono.replace(/\D/g, '');
      return digits.length >= 8;
    }

    function validarCampo(id, condicion, errorId) {
      if (condicion) {
        $('#' + id).removeClass('error').addClass('valid');
        $('#' + errorId).hide();
        return true;
      } else {
        $('#' + id).removeClass('valid').addClass('error');
        $('#' + errorId).show();
        return false;
      }
    }

    // Validación en vivo de campos de equipo
    $('#teamName, #teamCaptain').on('input', function() {
      validarCampo($(this).attr('id'), $(this).val().trim() !== '', 'err-' + $(this).attr('id'));
    });

    $('#teamEmail').on('input', function() {
      validarCampo('teamEmail', validarEmail($(this).val().trim()), 'err-teamEmail');
    });

    $('#teamPhone').on('input', function() {
      validarCampo('teamPhone', validarTelefono($(this).val()), 'err-teamPhone');
    });

    $('#teamGame, #teamCountry').on('change', function() {
      validarCampo($(this).attr('id'), $(this).val() !== '', 'err-' + $(this).attr('id'));
    });

    // Validación en vivo de jugadores
    $(document).on('input', '.player-nick, .player-name, .player-role', function() {
      const $error = $(this).siblings('.error-msg');
      if ($(this).val().trim() !== '') {
        $(this).removeClass('error').addClass('valid');
        $error.hide();
      } else {
        $(this).removeClass('valid').addClass('error');
        $error.show();
      }
    });

    // Vista previa
    $('#previewBtn').on('click', function() {
      const teamName = $('#teamName').val().trim();
      const teamGame = $('#teamGame').val();
      const teamCaptain = $('#teamCaptain').val().trim();

      if (!teamName || !teamGame || !teamCaptain) {
        $('#inscripcionError').text('⚠️ Completa al menos los datos básicos del equipo para la vista previa.').fadeIn();
        setTimeout(() => $('#inscripcionError').fadeOut(), 3000);
        return;
      }

      const players = [];
      $('.player-row').each(function() {
        const nick = $(this).find('.player-nick').val().trim();
        const name = $(this).find('.player-name').val().trim();
        const role = $(this).find('.player-role').val().trim();
        if (nick || name || role) {
          players.push({ nick, name, role });
        }
      });

      let html = `
        <p><strong>Equipo:</strong> ${teamName}</p>
        <p><strong>Juego:</strong> ${teamGame.toUpperCase()}</p>
        <p><strong>Capitán:</strong> ${teamCaptain}</p>
        <p><strong>Jugadores:</strong> ${players.length}</p>
        <ul style="margin-top:0.5rem;padding-left:1.5rem;">
      `;
      players.forEach(p => {
        html += `<li style="color:var(--gray);font-size:0.85rem;">${p.nick} - ${p.name} (${p.role})</li>`;
      });
      html += `</ul>`;

      $('#previewContent').html(html);
      $('#previewBox').slideDown(300);
    });

    // Enviar inscripción
    $('#formInscripcion').on('submit', async function(e) {
      e.preventDefault();
      if (!currentUser || currentProfile?.role !== 'admin') { alert('Solo administradores pueden inscribir equipos.'); return; }
      
      let valido = true;
      const teamName = $('#teamName').val().trim();
      const teamGame = $('#teamGame').val();
      const teamCaptain = $('#teamCaptain').val().trim();
      const teamEmail = $('#teamEmail').val().trim();
      const teamPhone = $('#teamPhone').val().trim();
      const teamCountry = $('#teamCountry').val();

      // Validar campos del equipo
      if (!teamName) { validarCampo('teamName', false, 'err-teamName'); valido = false; }
      if (!teamGame) { validarCampo('teamGame', false, 'err-teamGame'); valido = false; }
      if (!teamCaptain) { validarCampo('teamCaptain', false, 'err-teamCaptain'); valido = false; }
      if (!validarEmail(teamEmail)) { validarCampo('teamEmail', false, 'err-teamEmail'); valido = false; }
      if (!validarTelefono(teamPhone)) { validarCampo('teamPhone', false, 'err-teamPhone'); valido = false; }
      if (!teamCountry) { validarCampo('teamCountry', false, 'err-teamCountry'); valido = false; }

      // Validar jugadores
      const players = [];
      let playersValidos = true;
      $('.player-row').each(function() {
        const nick = $(this).find('.player-nick').val().trim();
        const name = $(this).find('.player-name').val().trim();
        const role = $(this).find('.player-role').val().trim();
        
        if (!nick || !name || !role) {
          playersValidos = false;
          $(this).find('input').each(function() {
            if (!$(this).val().trim()) {
              $(this).addClass('error');
              $(this).siblings('.error-msg').show();
            }
          });
        } else {
          players.push({ nick, name, role });
        }
      });

      if (!playersValidos || players.length < 5) {
        $('#playerError').text('⚠️ Se requieren mínimo 5 jugadores completos para inscribir el equipo.').show();
        valido = false;
      } else {
        $('#playerError').hide();
      }

      if (!valido) {
        $('#inscripcionError').text('⚠️ Por favor corrige los errores marcados en el formulario.').fadeIn();
        setTimeout(() => $('#inscripcionError').fadeOut(), 4000);
        return;
      }

      const codigo = 'RGN-' + Date.now().toString(36).toUpperCase().slice(-6);

      const inscripcion = {
        id: Date.now(),
        codigo: codigo,
        nombre: teamName,
        juego: teamGame,
        capitan: teamCaptain,
        email: teamEmail,
        telefono: teamPhone,
        pais: teamCountry,
        jugadores: players,
        fecha: new Date().toLocaleDateString('es-ES'),
        hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        estado: 'pendiente'
      };

      const { data: cloudTeam, error: teamError } = await supabaseClient.from('team_registrations').insert({ user_id: currentUser.id, code: codigo, team_name: teamName, game: teamGame, captain: teamCaptain, email: teamEmail, phone: teamPhone, country: teamCountry, players, status: 'pendiente' }).select().single();
      if (teamError) { alert('No se pudo guardar la inscripción: ' + teamError.message); return; }
      inscripcion.id = cloudTeam.id;
      inscripciones.unshift(inscripcion); saveInscripciones(); renderizarInscripciones();

      $('#inscripcionError').hide();
      $('#inscripcionSuccess').html(`✅ ¡Inscripción registrada!<br><strong>Equipo:</strong> ${teamName}<br><strong>Código:</strong> ${codigo}<br><br>Tu equipo está pendiente de aprobación.`).fadeIn();
      setTimeout(() => $('#inscripcionSuccess').fadeOut(), 6000);

      registrarEvento('Inscripción: ' + teamName, 'Equipo inscrito para ' + teamGame + ' - Código: ' + codigo);

      // Resetear
      this.reset();
      inicializarJugadores();
      $('#previewBox').slideUp(300);
      $('.form-group input, .form-group select').removeClass('valid error');
      $('.error-msg').hide();
    });

    // Renderizar inscripciones
    function renderizarInscripciones() {
      const $tbody = $('#inscripcionesTableBody');
      $tbody.empty();

      const filtro = $('#filtroJuegoInscripcion').val();
      let filtradas = inscripciones;

      if (filtro !== 'todos') {
        filtradas = inscripciones.filter(i => i.juego === filtro);
      }

      if (filtradas.length === 0) {
        $tbody.html('<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:#555;">No hay equipos inscritos aún.</td></tr>');
        return;
      }

      filtradas.forEach(i => {
        const estadoColor = i.estado === 'aprobada' ? 'var(--green-bright)' : 
                           i.estado === 'rechazada' ? '#ff4444' : '#ffcc00';
        $tbody.append(`
          <tr>
            <td>${i.nombre}</td>
            <td>${i.juego.toUpperCase()}</td>
            <td>${i.capitan}</td>
            <td class="timestamp-cell">${i.codigo}</td>
            <td style="color:${estadoColor};font-weight:700;">${i.estado.toUpperCase()}</td>
            <td>${i.fecha} ${i.hora}</td>
          </tr>
        `);
      });
    }

    $('#filtroJuegoInscripcion').on('change', renderizarInscripciones);

    // ============================================================
    // 16. CONTROLES DE EVENTOS
    // ============================================================
    $('#btnRefreshEvents').on('click', function() {
      renderizarTablaEventos();
      actualizarEstadisticas();
      registrarEvento('Actualizó Historial', 'El usuario actualizó manualmente el historial');
    });

    $('#btnClearEvents').on('click', function() {
      if (confirm('¿Estás seguro de que quieres limpiar todos los registros?')) {
        eventsHistory = [];
        saveHistory();
        renderizarTablaEventos();
        actualizarEstadisticas();
        registrarEvento('Limpió Historial', 'El usuario eliminó todos los registros de eventos');
      }
    });

    // ============================================================
    // 17. DEMO JQUERY (hide, show, fadeToggle, etc.)
    // ============================================================
    $('#demoClick').on('click', function() {
      $('#demoBox').html('🖱️ ¡Evento <strong>click()</strong> registrado!').css({
        'background': 'rgba(22, 163, 74, 0.3)', 'border-color': '#22C55E', 'color': '#fff'
      });
      registrarEvento('Demo: Click', 'El usuario hizo click en el botón de demostración');
    });

    $('#demoDblClick').on('dblclick', function() {
      $('#demoBox').html('🖱️🖱️ ¡Evento <strong>dblclick()</strong> registrado!').css({
        'background': 'rgba(34, 197, 94, 0.3)', 'border-color': '#16A34A', 'color': '#fff'
      });
      registrarEvento('Demo: Doble Click', 'El usuario hizo doble click en el botón');
    });

    $('#demoHover').on('mouseenter', function() {
      $('#demoBox').html('🖱️ ¡Evento <strong>mouseenter()</strong> detectado!').css({
        'background': 'rgba(22, 163, 74, 0.2)', 'border-color': '#16A34A', 'color': '#fff'
      });
      registrarEvento('Demo: Hover', 'El usuario pasó el mouse sobre el botón');
    }).on('mouseleave', function() {
      $('#demoBox').html('🖱️ Mouse fuera. Evento <strong>mouseleave()</strong> ejecutado.').css({
        'background': 'rgba(22, 163, 74, 0.1)', 'border-color': '#16A34A', 'color': '#A3A3A3'
      });
    });

    $('#demoChange').on('click', function() {
      const colores = ['#16A34A', '#22C55E', '#052E16', '#ffffff'];
      const color = colores[Math.floor(Math.random() * colores.length)];
      $('#demoBox').html('🎨 ¡Evento <strong>change()</strong> simulado!').css({
        'background': color + '33', 'border-color': color, 'color': '#fff'
      });
      registrarEvento('Demo: Change', 'El usuario simuló un evento change');
    });

    $('#demoHide').on('click', function() {
      $('#demoBox').hide(500);
      registrarEvento('Demo: hide()', 'El usuario ocultó el cuadro de demostración');
    });

    $('#demoShow').on('click', function() {
      $('#demoBox').show(500);
      registrarEvento('Demo: show()', 'El usuario mostró el cuadro de demostración');
    });

    $('#demoFadeToggle').on('click', function() {
      $('#demoBox').fadeToggle(500);
      registrarEvento('Demo: fadeToggle()', 'El usuario alternó la visibilidad con fadeToggle');
    });

    // ============================================================
    // 19. SUPABASE: AUTENTICACIÓN Y PERFILES (ADMIN / CLIENTE)
    // ============================================================
    const SUPABASE_URL = 'https://voqjmivdzwtzzcfoliig.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_XRCVkFlGHGMq9Seh1aFk1A_-Rv2UEh9';

    const supabaseConfigurado = true;
    supabaseClient = (window.supabase && supabaseConfigurado)
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
          }
        })
      : null;

    // currentUser/currentProfile declarados al inicio para las funciones de evento.

    // ----- Perfil social: nombre/nickname en Supabase; bio y avatar solo en este navegador -----
    const AVATAR_DEF = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#111713"/><circle cx="48" cy="38" r="17" fill="#22c55e"/><path d="M14 92c3-22 18-32 34-32s31 10 34 32z" fill="#16a34a"/></svg>');
    const socialKey = () => 'ragnarok_social_' + (currentUser ? currentUser.id : 'anon');
    const leerSocial = () => { try { return JSON.parse(safeGet(socialKey(), '{}')) || {}; } catch (_) { return {}; } };
    const urlSegura = u => /^https:\/\//i.test(u || '') ? u : '';
    const msg = ($el, texto, esError) => $el.text(texto || '').toggleClass('auth-msg--error', !!esError).toggleClass('show', !!texto);
    function mostrarInicioCompletado(texto = '✅ Inicio completado') {
      const $alerta = $('#perfilLoginSuccess');
      if ($alerta.length) {
        $alerta.stop(true, true).text(texto).css('display', 'block');
      }
      $('#toastInicioCompletado').remove();
      const $toast = $('<div id="toastInicioCompletado" role="status" aria-live="polite"></div>')
        .text(texto)
        .css({
          position: 'fixed',
          top: '1.1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#052e16',
          color: '#22c55e',
          border: '2px solid #22c55e',
          borderRadius: '12px',
          padding: '0.85rem 1.6rem',
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: '700',
          fontSize: '0.95rem',
          boxShadow: '0 0 25px rgba(34, 197, 94, 0.5)'
        });
      $('body').append($toast);
      setTimeout(() => $toast.fadeOut(400, () => $toast.remove()), 5000);
    }

    // ----- Menú desplegable superior de cuenta -----
    function toggleAccountDropdown(forceState) {
      const $btn = $('#accountBtn');
      const $drop = $('#accountDropdown');
      const shouldOpen = typeof forceState === 'boolean' ? forceState : !$drop.hasClass('open');
      $drop.toggleClass('open', shouldOpen);
      $btn.attr('aria-expanded', String(shouldOpen));
    }

    $('#accountBtn').on('click', function(e) {
      e.stopPropagation();
      toggleAccountDropdown();
    });

    $(document).on('click', function(e) {
      if (!$(e.target).closest('#accountMenuWrapper').length) {
        toggleAccountDropdown(false);
      }
    });

    $(document).on('keydown', function(e) {
      if (e.key === 'Escape' && $('#accountDropdown').hasClass('open')) {
        toggleAccountDropdown(false);
        $('#accountBtn').trigger('focus');
      }
    });

    $('#menuLoginBtn').on('click', function() {
      toggleAccountDropdown(false);
      abrirAuth('login');
    });

    $('#menuRegisterBtn').on('click', function() {
      toggleAccountDropdown(false);
      abrirAuth('registro');
    });

    $('#menuProfileBtn').on('click', function() {
      toggleAccountDropdown(false);
      showSection('cuenta');
    });

    $('#menuAdminBtn').on('click', function() {
      toggleAccountDropdown(false);
      showSection('admin');
    });

    $('#menuLogoutBtn').on('click', async function() {
      toggleAccountDropdown(false);
      if (supabaseClient) await supabaseClient.auth.signOut();
      currentUser = null; currentProfile = null;
      try { localStorage.removeItem(SESSION_CACHE_KEY); } catch (_) {}
      aplicarPermisosPorRol();
      registrarEvento('Cierre de Sesión', 'El usuario cerró sesión');
    });

    function renderPerfil() {
      const logged = Boolean(currentUser);
      $('#perfilUser').show(); if (!logged) $('#perfilLoginSuccess').hide();
      $('#accountDropdownGuestActions').toggle(!logged);
      $('#accountDropdownAuthActions').toggle(logged);
      $('#authProfileBox').toggle(logged);
      $('#authTabsBox').toggle(!logged);
      if (!logged) {
        const esRegistro = $('#tabRegistro').hasClass('active');
        $('#formLoginSupabase').toggle(!esRegistro);
        $('#formRegisterSupabase').toggle(esRegistro);
      } else {
        $('#formLoginSupabase, #formRegisterSupabase').hide();
      }

      if (!logged) {
        $('#adminTopBanner').removeClass('visible is-admin');
        $('#accountIcon').text('🔐');
        $('#accountBtnLabel').text('Cuenta');
        $('#accountDropdownTitle').text('Invitado');
        $('#accountDropdownSub').text('Sin sesión iniciada');
        $('#currentUserLabel').text('Invitado');
        $('#perfilTag').text('@jugador');
        $('#perfilBio').text('Jugador de Ragnarok eSports.');
        $('#perfilAvatarImg').attr('src', AVATAR_DEF);
        $('#currentUserRole').text('invitado').removeClass('perfil-badge-rol--admin').addClass('perfil-badge-rol--user');
        $('#perfilEmail').text('—');
        $('#perfilDesde').text('—');
        $('#perfilRolTexto').text('invitado');
        return;
      }
      const p = currentProfile || {}, soc = leerSocial();
      const nombre = p.full_name || (currentUser.user_metadata && currentUser.user_metadata.full_name) || (currentUser.email ? currentUser.email.split('@')[0] : 'Jugador');
      const nick = p.nickname || (currentUser.user_metadata && currentUser.user_metadata.nickname) || (currentUser.email ? currentUser.email.split('@')[0] : 'jugador');
      const rol = p.role || 'usuario', esAdmin = rol === 'admin';
      const avatarSrc = urlSegura(soc.avatar) || AVATAR_DEF;
      $('#currentUserLabel').text(nombre);
      $('#perfilTag').text('@' + nick);
      $('#perfilBio').text(soc.bio || (esAdmin ? 'Administrador de Ragnarok eSports.' : 'Jugador de Ragnarok eSports.'));
      $('#perfilAvatarImg').attr('src', avatarSrc).off('error').on('error', function () { this.src = AVATAR_DEF; });
      $('#currentUserRole').text(rol).toggleClass('perfil-badge-rol--admin', esAdmin).toggleClass('perfil-badge-rol--user', !esAdmin);
      $('#perfilEmail').text(currentUser.email || '—'); $('#perfilRolTexto').text(rol);
      const f = p.created_at || currentUser.created_at;
      $('#perfilDesde').text(f ? new Date(f).toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');
      if (!$('#formEditarPerfil :focus').length) {
        $('#editNombre').val(nombre); $('#editNick').val(nick); $('#editBio').val(soc.bio || ''); $('#editAvatar').val(soc.avatar || '');
      }

      $('#accountDropdownTitle').text(nombre);
      $('#accountDropdownSub').text('@' + nick + (esAdmin ? ' · ADMIN' : ''));

      // Actualizar banner superior para cualquier usuario autenticado (y destacar si es admin)
      $('#adminTopBanner').addClass('visible').toggleClass('is-admin', esAdmin);
      $('#adminTopName').text(nombre);
      $('#adminTopNick').text('@' + nick + (esAdmin ? ' · ADMIN' : ' · MIEMBRO'));
      $('#adminTopAvatar').attr('src', avatarSrc).off('error').on('error', function () { this.src = AVATAR_DEF; });
      $('#adminTopPanelBtn').toggle(esAdmin);
      $('#modalProfileAvatar').attr('src', avatarSrc).off('error').on('error', function () { this.src = AVATAR_DEF; });
      $('#modalProfileName').text(nombre);
      $('#modalProfileNick').text('@' + nick + (esAdmin ? ' · ADMIN' : ''));
      $('#modalProfileEmail').text(currentUser.email || '—');
      $('#accountIcon').text(esAdmin ? '🛡️' : '👤');
      $('#accountBtnLabel').text(nick || nombre);
    }

    function aplicarPermisosPorRol() {
      const isAdmin = currentProfile?.role === 'admin';
      const isLoggedIn = Boolean(currentUser);
      const displayLabel = isLoggedIn
        ? (currentProfile?.nickname || currentProfile?.full_name || (currentUser.user_metadata && (currentUser.user_metadata.nickname || currentUser.user_metadata.full_name)) || (currentUser.email ? currentUser.email.split('@')[0] : 'Cuenta'))
        : 'Cuenta';
      $('#accountIcon').text(isLoggedIn ? (isAdmin ? '🛡️' : '👤') : '🔐');
      $('#accountBtnLabel').text(displayLabel);
      $('#accountBtn').attr('aria-label', isLoggedIn ? 'Menú de mi cuenta' : 'Iniciar sesión o crear cuenta');
      $('#btnLogoutSupabase').toggle(isLoggedIn);
      $('#adminPanelBox').toggle(isAdmin);
      $('.admin-only').toggle(isAdmin);
      $('[data-section=inscripcion], [data-section=eventos]').toggle(isAdmin);
      $('#page-inscripcion, #page-eventos').toggle(isAdmin);
      renderPerfil();
      actualizarVistaAdminCompleta();
      if (isAdmin) cargarPerfilesParaAdmin();
    }

    async function cargarPerfilUsuario(user) {
      const loadVersion = ++profileLoadVersion;
      currentUser = user || null;
      if (!currentUser) {
        currentProfile = null;
        try { localStorage.removeItem(SESSION_CACHE_KEY); } catch (_) {}
        aplicarPermisosPorRol();
        return;
      }
      const userId = currentUser.id;

      // Restaurar perfil cacheado al instante y actualizar UI de inmediato antes de esperar red
      try {
        const cached = JSON.parse(safeGet(SESSION_CACHE_KEY, 'null'));
        const cachedProfile = cached && cached.user && cached.profile ? cached.profile : cached;
        const cachedUserId = cached && cached.user ? cached.user.id : (cached && cached.id);
        if (cachedProfile && cachedUserId === currentUser.id) {
          currentProfile = cachedProfile;
        }
      } catch (_) {}
      aplicarPermisosPorRol();

      if (!supabaseClient) {
        return;
      }

      let data = null, error = null;
      try {
        const res = await supabaseClient
          .from('profiles')
          .select('id, email, full_name, nickname, role, created_at')
          .eq('id', currentUser.id)
          .single();
        data = res.data;
        error = res.error;
      } catch (err) {
        error = err;
      }

      // Ignora respuestas antiguas si el usuario cambió o cerró sesión mientras cargaba el perfil.
      if (loadVersion !== profileLoadVersion || currentUser?.id !== userId) return;
      if (!error && data) {
        currentProfile = data;
      }
      safeSet(SESSION_CACHE_KEY, JSON.stringify({ user: currentUser, profile: currentProfile }));
      aplicarPermisosPorRol();
      if (loadVersion !== profileLoadVersion || currentUser?.id !== userId) return;
      if (currentProfile?.role === 'admin') await cargarDatosAdminCloud();
      if (loadVersion === profileLoadVersion && currentUser?.id === userId) await cargarCatalogoCloud();
    }

    async function cargarPerfilesParaAdmin() {
      if (!supabaseClient || currentProfile?.role !== 'admin') return;
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, email, full_name, nickname, role, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        $('#adminProfilesList').html('<p style="color:#ff6666;">Error al cargar perfiles.</p>');
        return;
      }

      adminProfilesCache = data || [];
      actualizarVistaAdminCompleta();
      let html = '<div class="table-responsive"><table><thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Acción</th></tr></thead><tbody>';
      (data || []).forEach(p => {
        const nextRole = p.role === 'admin' ? 'cliente' : 'admin';
        html += `
          <tr>
            <td>${p.nickname || p.full_name || '--'}</td>
            <td>${p.email}</td>
            <td><strong>${p.role.toUpperCase()}</strong></td>
            <td>
              <button type="button" class="btn btn-sm btn-toggle-role" data-id="${p.id}" data-next-role="${nextRole}">
                Cambiar a ${nextRole}
              </button>
            </td>
          </tr>
        `;
      });
      html += '</tbody></table></div>';
      $('#adminProfilesList, #adminProfilesTableContainer').html(html);
    }

    $(document).on('click', '.btn-toggle-role', async function() {
      if (!supabaseClient || currentProfile?.role !== 'admin') return;
      const targetId = $(this).data('id');
      const nextRole = $(this).data('next-role');
      let { error } = await supabaseClient.rpc('admin_change_role', { target_user: targetId, new_role: nextRole });
      if (error) {
        const resUpdate = await supabaseClient
          .from('profiles')
          .update({ role: nextRole })
          .eq('id', targetId)
          .select();
        error = resUpdate.error || ((!resUpdate.data || !resUpdate.data.length) ? { message: 'Sin permisos RLS para cambiar rol en profiles.' } : null);
      }

      if (!error) {
        registrarEvento('Cambio de Rol', `Perfil ${targetId} actualizado a ${nextRole}`);
        cargarPerfilesParaAdmin();
      } else {
        alert('No se pudo actualizar el rol: ' + error.message);
      }
    });

    // ----- Ventana de acceso (login / registro) -----
    let focoPrevio = null;
    function abrirAuth(modo) {
      const reg = modo === 'registro';
      $('#tabLogin').toggleClass('active', !reg).attr('aria-selected', String(!reg));
      $('#tabRegistro').toggleClass('active', reg).attr('aria-selected', String(reg));
      $('#formLoginSupabase').toggle(!reg); $('#formRegisterSupabase').toggle(reg);
      msg($('#errorLogin'), ''); msg($('#errorRegistro'), '');
      focoPrevio = document.activeElement;
      $('#modalAuth').css('display', 'flex').attr('aria-hidden', 'false'); $('body').addClass('modal-open');
      setTimeout(() => $(reg ? '#regName' : '#loginEmail').trigger('focus'), 60);
    }
    function cerrarAuth() {
      $('#modalAuth').hide().attr('aria-hidden', 'true'); $('body').removeClass('modal-open');
      if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
    }
    $('#tabLogin').on('click', () => abrirAuth('login'));
    $('#tabRegistro').on('click', () => abrirAuth('registro'));
    $('#closeModalAuth').on('click', cerrarAuth);
    $('#modalAuth').on('mousedown', e => { if (e.target.id === 'modalAuth') cerrarAuth(); });
    $(document).on('keydown', e => { if (e.key === 'Escape' && $('#modalAuth').is(':visible')) cerrarAuth(); });
    $('#btnPerfilLogin').on('click', () => abrirAuth('login'));
    $('#btnPerfilRegistro').on('click', () => abrirAuth('registro'));
    $('#btnPerfilIrAdmin').on('click', () => showSection('admin'));
    $('#modalGoProfileBtn').on('click', function() { cerrarAuth(); showSection('cuenta'); });
    $('#modalLogoutBtn').on('click', function() { cerrarAuth(); $('#btnLogoutSupabase').trigger('click'); });
    $('#adminTopPanelBtn').on('click', () => showSection('admin'));
    $('#adminTopProfileBtn').on('click', () => showSection('cuenta'));

    const sinSupabase = 'El acceso no está disponible: Supabase no está configurado o no se pudo cargar.';
    const traducirError = m => /invalid login/i.test(m) ? 'Correo o contraseña incorrectos.' : /already registered|already been registered/i.test(m) ? 'Este correo ya está registrado. Inicia sesión.' : /email not confirmed/i.test(m) ? 'Confirma tu correo antes de entrar.' : m;

    $('#formRegisterSupabase').on('submit', async function (e) {
      e.preventDefault();
      const $err = $('#errorRegistro'), $btn = $(this).find('[type=submit]');
      const full_name = $('#regName').val().trim(), nickname = $('#regNick').val().trim().replace(/^@/, '');
      const email = $('#regEmail').val().trim().toLowerCase(), password = $('#regPassword').val();
      if (!supabaseClient) return msg($err, sinSupabase, true);
      if (full_name.length < 2) return msg($err, 'Escribe tu nombre completo.', true);
      if (!/^[\w.\-]{3,20}$/.test(nickname)) return msg($err, 'El nickname debe tener 3–20 caracteres (letras, números, _ . -).', true);
      if (!/^\S+@\S+\.\S+$/.test(email)) return msg($err, 'Escribe un correo válido.', true);
      if (password.length < 6) return msg($err, 'La contraseña debe tener al menos 6 caracteres.', true);
      msg($err, ''); $btn.prop('disabled', true).text('Creando…');
      try {
        // El rol NO se envía: lo asigna el servidor (trigger), nunca el navegador.
        const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name, nickname } } });
        if (error) return msg($err, traducirError(error.message), true);
        registrarEvento('Registro Usuario', 'Nueva cuenta creada');
        this.reset();
        if (data && data.session) { await cargarPerfilUsuario(data.session.user); cerrarAuth(); showSection('cuenta'); mostrarInicioCompletado('✅ Inicio completado'); }
        else { abrirAuth('login'); msg($('#errorLogin'), 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.', false); }
      } catch (err) { msg($err, 'No se pudo conectar. Revisa tu internet.', true); }
      finally { $btn.prop('disabled', false).text('Crear cuenta'); }
    });

    $('#formLoginSupabase').on('submit', async function (e) {
      e.preventDefault();
      const $err = $('#errorLogin'), $btn = $(this).find('[type=submit]');
      const email = $('#loginEmail').val().trim().toLowerCase(), password = $('#loginPassword').val();
      if (!supabaseClient) return msg($err, sinSupabase, true);
      if (!email || !password) return msg($err, 'Escribe tu correo y contraseña.', true);
      msg($err, ''); $btn.prop('disabled', true).text('Entrando…');
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { registrarEvento('Login fallido', 'Intento de inicio de sesión fallido'); return msg($err, traducirError(error.message), true); }
        currentUser = data.user;
        aplicarPermisosPorRol();
        await cargarPerfilUsuario(data.user);
        registrarEvento('Inicio de Sesión', 'Sesión iniciada');
        this.reset(); cerrarAuth(); showSection('cuenta'); mostrarInicioCompletado('✅ Inicio completado');
      } catch (err) { msg($err, 'No se pudo conectar. Revisa tu internet.', true); }
      finally { $btn.prop('disabled', false).text('Entrar'); }
    });

    $('#formEditarPerfil').on('submit', async function (e) {
      e.preventDefault();
      const $m = $('#msgPerfil'); if (!currentUser) return;
      const full_name = $('#editNombre').val().trim(), nickname = $('#editNick').val().trim().replace(/^@/, '');
      const bio = $('#editBio').val().trim().slice(0, 160), avatar = $('#editAvatar').val().trim();
      if (full_name.length < 2) return msg($m, 'Escribe tu nombre.', true);
      if (!/^[\w.\-]{3,20}$/.test(nickname)) return msg($m, 'Nickname: 3–20 caracteres (letras, números, _ . -).', true);
      if (avatar && !urlSegura(avatar)) return msg($m, 'El avatar debe ser una URL que empiece con https://', true);
      if (supabaseClient) {
        const payload = {
          id: currentUser.id,
          email: currentUser.email,
          full_name,
          nickname,
          role: currentProfile?.role || 'cliente'
        };
        const { data: savedProf, error } = await supabaseClient
          .from('profiles')
          .upsert(payload, { onConflict: 'id' })
          .select()
          .single();
        if (error) return msg($m, 'No se pudo guardar en Supabase: ' + error.message, true);
        if (!savedProf) return msg($m, 'Supabase no devolvió cambios (revisa políticas RLS de profiles).', true);
        currentProfile = savedProf;
        safeSet(SESSION_CACHE_KEY, JSON.stringify({ user: currentUser, profile: currentProfile }));
      }
      safeSet(socialKey(), JSON.stringify({ bio, avatar }));
      renderPerfil(); msg($m, '✅ Perfil actualizado.', false); setTimeout(() => msg($m, ''), 3000);
    });

    $('#btnLogoutSupabase').on('click', async function () {
      if (supabaseClient) await supabaseClient.auth.signOut();
      currentUser = null; currentProfile = null;
      try { localStorage.removeItem(SESSION_CACHE_KEY); } catch (_) {}
      aplicarPermisosPorRol();
      registrarEvento('Cierre de Sesión', 'El usuario cerró sesión');
    });

    if (supabaseClient) {
      cargarCatalogoCloud();

      // Evita que un INITIAL_SESSION antiguo (normalmente null) sobrescriba
      // un SIGNED_IN reciente y haga que la interfaz parezca cerrar la cuenta.
      // También comprueba la sesión real antes de limpiar el estado tras SIGNED_OUT.
      let authEventVersion = 0;
      supabaseClient.auth.onAuthStateChange((event, session) => {
        const eventVersion = ++authEventVersion;

        if (event === 'INITIAL_SESSION') {
          setTimeout(async () => {
            if (eventVersion !== authEventVersion) return;
            try {
              const { data, error } = await supabaseClient.auth.getSession();
              if (eventVersion !== authEventVersion) return;
              if (!error && data?.session?.user) {
                await cargarPerfilUsuario(data.session.user);
              } else if (!currentUser) {
                // Solo limpiar si no hubo un inicio de sesión posterior.
                cargarPerfilUsuario(null);
              }
            } catch (err) {
              console.warn('No se pudo restaurar la sesión inicial:', err);
            }
          }, 0);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            setTimeout(() => {
              if (eventVersion === authEventVersion) cargarPerfilUsuario(session.user);
            }, 0);
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          setTimeout(async () => {
            if (eventVersion !== authEventVersion) return;
            try {
              const { data, error } = await supabaseClient.auth.getSession();
              if (eventVersion !== authEventVersion) return;
              if (!error && data?.session?.user) {
                await cargarPerfilUsuario(data.session.user);
              } else {
                cargarPerfilUsuario(null);
              }
            } catch (err) {
              console.warn('No se pudo verificar el cierre de sesión:', err);
            }
          }, 0);
        }
      });
    }


    // ============================================================
    // 20. VISTA COMPLETA DE ADMINISTRADOR (#page-admin)
    // ============================================================
    let adminProfilesCache = [];

    function actualizarVistaAdminCompleta() {
      const isAdmin = currentProfile?.role === 'admin';
      $('#adminAccessDenied').toggle(!isAdmin);
      $('#adminDashboardContent').toggle(isAdmin);

      if (!isAdmin) return;

      // Estadísticas
      const totalUsers = adminProfilesCache.length;
      const totalAdmins = adminProfilesCache.filter(p => p.role === 'admin').length;
      const totalTeams = inscripciones.length;
      const pendingTeams = inscripciones.filter(i => i.estado === 'pendiente').length;

      $('#adminStatUsers').text(totalUsers);
      $('#adminStatAdmins').text(totalAdmins);
      $('#adminStatTeams').text(totalTeams);
      $('#adminStatPending').text(pendingTeams);

      renderizarTablaInscripcionesAdmin();
      renderizarTablaProductosAdmin();
    }

    function renderizarTablaInscripcionesAdmin() {
      const $tbody = $('#adminInscripcionesTableBody');
      if (!$tbody.length) return;
      $tbody.empty();

      if (inscripciones.length === 0) {
        $tbody.html('<tr><td colspan="6" style="text-align:center;padding:1.2rem;color:#555;">No hay equipos inscritos.</td></tr>');
        return;
      }

      inscripciones.forEach(i => {
        const estadoColor = i.estado === 'aprobada' ? 'var(--green-bright)' :
                            i.estado === 'rechazada' ? '#ff4444' : '#ffcc00';
        $tbody.append(`
          <tr>
            <td>${i.nombre}</td>
            <td>${i.juego.toUpperCase()}</td>
            <td>${i.capitan}<br><small style="color:var(--gray);">${i.email || ''}</small></td>
            <td class="timestamp-cell">${i.codigo}</td>
            <td style="color:${estadoColor};font-weight:700;">${i.estado.toUpperCase()}</td>
            <td style="display:flex; gap:0.4rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-sm admin-team-status" data-id="${i.id}" data-status="aprobada">✅ Aprobar</button>
              <button type="button" class="btn btn-sm btn-outline admin-team-status" data-id="${i.id}" data-status="rechazada">❌ Rechazar</button>
              <button type="button" class="btn btn-sm btn-danger admin-team-delete" data-id="${i.id}">🗑️</button>
            </td>
          </tr>
        `);
      });
    }

    $(document).on('click', '.admin-team-status', async function() {
      if (currentProfile?.role !== 'admin') return;
      const id = String($(this).data('id'));
      const status = $(this).data('status');
      const item = inscripciones.find(x => String(x.id) === id);
      if (!item) return;
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('team_registrations')
          .update({ status })
          .eq('id', id)
          .select();
        if (error) {
          alert('Error al actualizar estado en Supabase: ' + error.message);
          return;
        }
        if (!data || !data.length) {
          alert('No se actualizó en Supabase (revisa políticas RLS de team_registrations).');
          return;
        }
      }
      item.estado = status;
      saveInscripciones();
      renderizarInscripciones();
      actualizarVistaAdminCompleta();
      registrarEvento('Admin: Estado Equipo', `${item.nombre} marcado como ${status.toUpperCase()}`);
    });

    $(document).on('click', '.admin-team-delete', async function() {
      if (currentProfile?.role !== 'admin') return;
      const id = String($(this).data('id'));
      if (!confirm('¿Eliminar esta inscripción?')) return;
      if (supabaseClient) await supabaseClient.from('team_registrations').delete().eq('id', id);
      inscripciones = inscripciones.filter(x => String(x.id) !== id);
      saveInscripciones();
      renderizarInscripciones();
      actualizarVistaAdminCompleta();
      registrarEvento('Admin: Eliminó Equipo', `Inscripción ID ${id} eliminada`);
    });

    function renderizarTablaProductosAdmin() {
      const $tbody = $('#adminProductosTableBody');
      if (!$tbody.length) return;
      $tbody.empty();

      productosData.forEach(p => {
        const dispColor = p.disponible ? 'var(--green-bright)' : '#ff4444';
        $tbody.append(`
          <tr>
            <td>${p.nombre}</td>
            <td style="text-transform:uppercase;">${p.categoria}</td>
            <td>Bs ${Number(p.precio).toFixed(2)}</td>
            <td style="color:${dispColor};font-weight:700;">${p.disponible ? 'DISPONIBLE' : 'AGOTADO'}</td>
            <td>${p.destacado ? '⭐ Sí' : 'No'}</td>
            <td style="display:flex; gap:0.4rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-sm btn-outline admin-prod-toggle-stock" data-id="${p.id}">
                ${p.disponible ? 'Marcar Agotado' : 'Marcar Disponible'}
              </button>
              <button type="button" class="btn btn-sm admin-prod-toggle-feat" data-id="${p.id}">
                ${p.destacado ? 'Quitar Destacado' : 'Destacar'}
              </button>
              <button type="button" class="btn btn-sm admin-prod-edit" data-id="${p.id}">Editar</button>
            </td>
          </tr>
        `);
      });
    }

    $(document).on('click', '.admin-prod-toggle-stock', function() {
      if (currentProfile?.role !== 'admin') return;
      const id = Number($(this).data('id'));
      const prod = productosData.find(p => p.id === id);
      if (prod) {
        prod.disponible = !prod.disponible;
        syncProductToSupabase(prod);
        renderizarProductos();
        renderizarProductosDestacados();
        renderizarTablaProductosAdmin();
        registrarEvento('Admin: Stock Producto', `${prod.nombre} -> ${prod.disponible ? 'Disponible' : 'Agotado'}`);
      }
    });

    $(document).on('click', '.admin-prod-toggle-feat', function() {
      if (currentProfile?.role !== 'admin') return;
      const id = Number($(this).data('id'));
      const prod = productosData.find(p => p.id === id);
      if (prod) {
        prod.destacado = !prod.destacado;
        syncProductToSupabase(prod);
        renderizarProductos();
        renderizarProductosDestacados();
        renderizarTablaProductosAdmin();
        registrarEvento('Admin: Destacado Producto', `${prod.nombre} -> ${prod.destacado ? 'Destacado' : 'Normal'}`);
      }
    });

    async function cargarCatalogoCloud() {
      if (!supabaseClient) return;
      const { data, error } = await supabaseClient.from('products').select('*').order('id');
      if (error) { console.warn('Catálogo Supabase:', error.message); return; }
      if (data && data.length) {
        productosData = data.map(row => ({ id: row.id, nombre: row.name, categoria: row.category, precio: Number(row.price), img: row.image, desc: row.description, destacado: row.featured, nuevo: row.is_new, disponible: row.available }));
        window.productosData = productosData;
        renderizarProductos(); renderizarProductosDestacados(); renderizarTablaProductosAdmin();
      } else if (currentProfile?.role === 'admin') {
        const initial = productosBase.map(p => ({ id:p.id, name:p.nombre, category:p.categoria, price:p.precio, image:p.img, description:p.desc, featured:p.destacado, is_new:p.nuevo, available:p.disponible }));
        const { error: seedError } = await supabaseClient.from('products').upsert(initial);
        if (seedError) console.warn('No se pudo iniciar catálogo:', seedError.message);
      }
    }
    async function cargarDatosAdminCloud() {
      if (!supabaseClient || currentProfile?.role !== 'admin') return;
      const [{ data: teams, error: teamError }, { data: orders, error: orderError }, { data: logs, error: logError }] = await Promise.all([
        supabaseClient.from('team_registrations').select('*').order('created_at', { ascending:false }),
        supabaseClient.from('orders').select('*').order('created_at', { ascending:false }),
        supabaseClient.from('event_log').select('*').order('created_at', { ascending:false }).limit(100)
      ]);
      if (!teamError && teams) {
        inscripciones = teams.map(t => ({ id:t.id, codigo:t.code, nombre:t.team_name, juego:t.game, capitan:t.captain, email:t.email, telefono:t.phone, pais:t.country, jugadores:t.players, estado:t.status, fecha:new Date(t.created_at).toLocaleDateString('es-BO'), hora:new Date(t.created_at).toLocaleTimeString('es-BO') }));
        renderizarInscripciones(); actualizarVistaAdminCompleta();
      }
      const $orders = $('#adminOrdersTableBody');
      if ($orders.length) {
        $orders.empty();
        if (orderError || !orders?.length) $orders.html('<tr><td colspan="7">No hay pedidos todavía.</td></tr>');
        else orders.forEach(o => $orders.append(`<tr><td>${new Date(o.created_at).toLocaleString('es-BO')}</td><td>${o.product_name} × ${o.quantity}</td><td>${o.customer_name}</td><td>${o.phone}</td><td>${o.address}</td><td>Bs ${(o.unit_price*o.quantity).toFixed(2)}</td><td>${o.status}</td></tr>`));
      }
      if (!logError && logs) {
        eventsHistory = logs.map(e => ({ id:e.id, nombre:e.event_name, descripcion:e.description, fecha:new Date(e.created_at).toLocaleDateString('es-BO'), hora:new Date(e.created_at).toLocaleTimeString('es-BO'), timestamp:new Date(e.created_at).getTime() }));
        renderizarTablaEventos(); actualizarEstadisticas();
      }
    }
    async function syncProductToSupabase(prod) {
      if (!supabaseClient || currentProfile?.role !== 'admin') return;
      const row = { id: prod.id, name: prod.nombre, category: prod.categoria, price: prod.precio, image: prod.img, description: prod.desc, featured: prod.destacado, is_new: prod.nuevo, available: prod.disponible };
      const { data, error } = await supabaseClient.from('products').upsert(row, { onConflict: 'id' }).select();
      if (error) alert('Error guardando producto en Supabase: ' + error.message);
      else if (!data || !data.length) alert('Supabase no permitió actualizar el producto (revisa políticas RLS de products).');
    }
    $(document).on('click', '.admin-prod-edit', async function() {
      if (currentProfile?.role !== 'admin') return;
      const prod = productosData.find(p => p.id === Number($(this).data('id'))); if (!prod) return;
      const name = prompt('Nombre', prod.nombre); if (name === null) return;
      const priceText = prompt('Precio en Bs', String(prod.precio)); if (priceText === null) return;
      const price = Number(priceText); const description = prompt('Descripción', prod.desc); if (description === null) return;
      if (!name.trim() || !Number.isFinite(price) || price < 0) return alert('Nombre o precio inválido.');
      prod.nombre = name.trim(); prod.precio = price; prod.desc = description.trim();
      await syncProductToSupabase(prod); renderizarProductos(); renderizarProductosDestacados(); renderizarTablaProductosAdmin();
    });
    // ============================================================
    // 21. CARRITO DESPLEGABLE EN BURBUJA (BOLIVIANOS - Bs)
    // ============================================================
    const CART_KEY = 'ragnarok_carrito_bs_v1';
    let carrito = [];
    try { carrito = JSON.parse(safeGet(CART_KEY, '[]')); } catch (_) { carrito = []; }

    const fmtBs = n => 'Bs ' + (Number(n) || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const saveCart = () => safeSet(CART_KEY, JSON.stringify(carrito));

    function renderCart() {
      const $items = $('#rgnCartItems');
      const $drawer = $('#rgnCartDrawer');
      if (!$items.length) return;
      $items.empty();

      let totalQty = 0;
      let totalBs = 0;

      if (!carrito.length) {
        $items.html('<p style="color:#a3a3a3;font-size:0.85rem;text-align:center;padding:0.8rem 0;">Tu carrito está vacío.</p>');
      } else {
        carrito.forEach(item => {
          const subBs = Number(item.precio) * item.qty;
          totalQty += item.qty;
          totalBs += subBs;
          $items.append(`
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;background:#080b09;border:1px solid #1a2e1f;border-radius:10px;padding:0.55rem 0.65rem;">
              <div style="min-width:0;flex:1;">
                <div style="font-weight:700;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.nombre}</div>
                <div style="color:#22c55e;font-size:0.8rem;">${fmtBs(item.precio)} c/u · <strong>${fmtBs(subBs)}</strong></div>
              </div>
              <div style="display:flex;align-items:center;gap:0.3rem;">
                <button type="button" class="rgn-qty-btn" data-id="${item.id}" data-d="-1" style="width:24px;height:24px;border-radius:6px;border:1px solid #22c55e;background:none;color:#fff;cursor:pointer;">-</button>
                <span style="min-width:18px;text-align:center;font-size:0.85rem;font-weight:700;">${item.qty}</span>
                <button type="button" class="rgn-qty-btn" data-id="${item.id}" data-d="1" style="width:24px;height:24px;border-radius:6px;border:1px solid #22c55e;background:none;color:#fff;cursor:pointer;">+</button>
              </div>
            </div>
          `);
        });
      }

      $('#rgnCartCount').text(totalQty);
      $('#rgnCartBubbleTotal').text(fmtBs(totalBs));
      $('#rgnCartTotalBs').text(fmtBs(totalBs));
      $drawer.data('totalBs', totalBs);
    }

    function addToCart(prod) {
      if (!prod || !prod.disponible) return;
      const found = carrito.find(x => Number(x.id) === Number(prod.id));
      if (found) found.qty += 1;
      else carrito.push({ id: prod.id, nombre: prod.nombre, precio: Number(prod.precio) || 0, qty: 1 });
      saveCart();
      renderCart();
      $('#rgnCartDrawer').stop(true, true).slideDown(180);
      registrarEvento('Carrito: Agregado', `${prod.nombre} (${fmtBs(prod.precio)})`);
    }

    $('#rgnCartBubbleBtn').on('click', () => $('#rgnCartDrawer').stop(true, true).slideToggle(180));
    $('#rgnCartClose').on('click', () => $('#rgnCartDrawer').slideUp(180));

    $(document).on('click', '.rgn-qty-btn', function() {
      const id = Number($(this).data('id'));
      const d = Number($(this).data('d'));
      const idx = carrito.findIndex(x => Number(x.id) === id);
      if (idx === -1) return;
      carrito[idx].qty += d;
      if (carrito[idx].qty <= 0) carrito.splice(idx, 1);
      saveCart();
      renderCart();
    });

    $('#rgnCartClear').on('click', () => {
      carrito = [];
      saveCart();
      renderCart();
    });

    $(document).on('click', '.btn-pedido-producto', function() {
      const prod = productosData.find(p => Number(p.id) === Number($(this).data('id')));
      if (prod) addToCart(prod);
    });

    $('#rgnCartCheckout').on('click', async function() {
      if (!carrito.length) return alert('Agrega al menos un producto al carrito.');
      if (!currentUser) { alert('Debes registrarte o iniciar sesión para realizar pedidos.'); abrirAuth('registro'); return; }
      const customer = prompt('Nombre para el pedido', currentProfile?.full_name || ''); if (!customer) return;
      const phone = prompt('Teléfono de contacto'); if (!phone) return;
      const address = prompt('Dirección de entrega'); if (!address) return;
      const notes = prompt('Notas opcionales', '') || '';
      const codigo = 'RGN-' + Date.now().toString(36).toUpperCase().slice(-6);
      const totalBs = $('#rgnCartDrawer').data('totalBs') || 0;

      if (supabaseClient) {
        const rows = carrito.map(item => ({
          user_id: currentUser.id,
          code: codigo,
          product_id: item.id,
          product_name: item.nombre,
          unit_price: item.precio,
          quantity: item.qty,
          customer_name: customer.trim(),
          phone: phone.trim(),
          address: address.trim(),
          notes
        }));
        const { error } = await supabaseClient.from('orders').insert(rows);
        if (error) return alert('Pedido fallido: ' + error.message);
      }

      registrarEvento('Pedido Confirmado', `Código ${codigo} · Total ${fmtBs(totalBs)}`);
      alert(`¡Pedido confirmado!\nCódigo: ${codigo}\nTotal: ${fmtBs(totalBs)}\nEl administrador lo revisará.`);
      carrito = [];
      saveCart();
      renderCart();
      $('#rgnCartDrawer').slideUp(180);
    });

    renderCart();

    $('#btnRefreshAdminData').on('click', function() {
      if (currentProfile?.role === 'admin') {
        cargarPerfilesParaAdmin();
        cargarDatosAdminCloud();
        actualizarVistaAdminCompleta();
        registrarEvento('Admin: Actualizó Panel', 'Datos de administrador actualizados');
      }
    });

  });


// ============================================================
// CARRUSELES: enlaza controles existentes o crea controles si el track no los tiene.
(() => {
  const montar = id => {
    const track = document.getElementById(id);
    if (!track || track.dataset.carouselReady === 'true') return;
    let wrap = track.parentElement;
    if (!wrap.classList.contains('carousel')) {
      const parent = wrap;
      parent.querySelectorAll(':scope > .carousel__btn').forEach(btn => btn.remove());
      wrap = document.createElement('div'); wrap.className = 'carousel';
      track.parentNode.insertBefore(wrap, track); wrap.appendChild(track);
    }
    track.classList.add('carousel__track');
    const mk = (cls, txt, label) => {
      let b = wrap.querySelector('.' + cls);
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'carousel__btn ' + cls; b.textContent = txt; b.setAttribute('aria-label', label); wrap.appendChild(b); }
      return b;
    };
    const prev = mk('carousel__btn--prev', '‹', 'Anterior');
    const next = mk('carousel__btn--next', '›', 'Siguiente');
    const ui = () => {
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      prev.hidden = max <= 4 || track.scrollLeft <= 4;
      next.hidden = max <= 4 || track.scrollLeft >= max - 4;
    };
    const mover = dir => track.scrollBy({ left: dir * Math.max(track.clientWidth * .85, 160), behavior: 'smooth' });
    prev.addEventListener('click', () => mover(-1)); next.addEventListener('click', () => mover(1));
    track.addEventListener('scroll', ui, { passive: true });
    window.addEventListener('resize', ui);
    new MutationObserver(() => { track.scrollLeft = 0; ui(); }).observe(track, { childList: true });
    if (window.ResizeObserver) new ResizeObserver(ui).observe(track);
    track.dataset.carouselReady = 'true'; ui();
  };
  const init = () => ['productosDestacadosInicio', 'equipoGrid', 'productosGrid'].forEach(montar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


// PWA: tema claro/oscuro, botón de instalación y registro del Service Worker
// ============================================================
(() => {
  const themeButton = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const getSavedTheme = () => { try { return localStorage.getItem('ragnarok-theme'); } catch (_) { return null; } };
  const saveTheme = value => { try { localStorage.setItem('ragnarok-theme', value); } catch (_) {} };
  const applyTheme = (theme) => {
    const light = theme === 'light';
    document.body.classList.toggle('theme-light', light);
    if (themeIcon) themeIcon.textContent = light ? '☾' : '☀';
    themeButton?.setAttribute('aria-label', light ? 'Activar modo oscuro' : 'Activar modo claro');
    themeButton?.setAttribute('aria-pressed', String(light));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#eef5ef' : '#07120b');
  };
  applyTheme(getSavedTheme() || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  themeButton?.addEventListener('click', () => {
    const next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
    saveTheme(next); applyTheme(next);
  });
  let deferredInstall;
  const installButton = document.getElementById('installAppBtn');
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredInstall = event; if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if (installButton) installButton.hidden = true; deferredInstall = null; });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('PWA no registrada:', err)));
  }
})();
