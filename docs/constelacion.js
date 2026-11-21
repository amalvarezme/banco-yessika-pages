'use strict';

function svg(tipo, atributos = {}) {
  const elemento = document.createElementNS('http://www.w3.org/2000/svg', tipo);
  for (const [clave, valor] of Object.entries(atributos)) elemento.setAttribute(clave, valor);
  return elemento;
}

function proyectar({ x, y, z }, angulo) {
  const horizontal = x * Math.cos(angulo) + z * Math.sin(angulo);
  const profundidad = z * Math.cos(angulo) - x * Math.sin(angulo);
  const escala = 680 / (680 - profundidad);
  return { x: 220 + horizontal * escala, y: 160 + y * escala, escala };
}

function iniciarConstelacion({ items, clusters, links }, abrir) {
  if (!items.length) return;
  const mapa = document.querySelector('#mapa-red');
  const giro = document.querySelector('#giro');
  const lectura = document.querySelector('#lectura-red');
  const leyenda = document.querySelector('#leyenda-red');
  const fichas = new Map(items.map((item) => [item.id, item]));
  const orden = clusters.flatMap((cluster, i) => cluster.members.map((id) => ({ id, color: i % 4, grupo: cluster.name })));
  const nodos = new Map();
  const filas = Math.ceil(orden.length / 3);
  // El catálogo actual cabe en tres filas; la altura aumenta con el corpus.
  const alto = Math.max(320, filas * 100 + 20);
  mapa.setAttribute('viewBox', `0 0 440 ${alto}`);
  const aristas = links.map((link) => ({ ...link, linea: svg('line', { class: 'enlace-red' }) }));
  mapa.append(...aristas.map(({ linea }) => linea));
  let seleccionado;

  for (const [i, { id, color, grupo }] of orden.entries()) {
    const item = fichas.get(id);
    if (!item) continue;
    const nodo = svg('a', { href: `#${id}`, 'data-nodo': id, class: `grupo-${color}`,
      'aria-label': `${id}: ${item.titulo_corto || item.title} — ${grupo}` });
    const rotulo = svg('text', { 'aria-hidden': 'true', 'text-anchor': 'middle', dy: '.35em' });
    rotulo.textContent = id;
    nodo.append(svg('circle', { r: 27 }), rotulo);
    nodo.addEventListener('click', (evento) => {
      evento.preventDefault();
      seleccionado?.removeAttribute('aria-current');
      seleccionado = nodo;
      nodo.setAttribute('aria-current', 'true');
      const ficha = texto('a', 'Abrir ficha en el catálogo');
      ficha.href = `#${id}`;
      ficha.addEventListener('click', (e) => {
        e.preventDefault();
        history.replaceState(null, '', ficha.hash);
        abrir(id);
      });
      lectura.replaceChildren(texto('p', `${id} · ${item.year}`, 'meta'), texto('p', item.title, 'titulo'), ficha);
    });
    mapa.append(nodo);
    nodos.set(id, { nodo, x: (i % 3 - 1) * 142,
      y: (Math.floor(i / 3) - (filas - 1) / 2) * 93,
      z: (Math.floor(i / 3) % 3 - 1) * 25 });
  }
  for (const [i, cluster] of clusters.entries()) {
    const entrada = texto('li', cluster.name, `grupo-${i % 4}`);
    leyenda.append(entrada);
  }

  function renderizar() {
    const angulo = Number(giro.value) * Math.PI / 180;
    const posiciones = new Map();
    for (const [id, dato] of nodos) {
      const punto = proyectar(dato, angulo);
      punto.y += (alto - 320) / 2;
      posiciones.set(id, punto);
      dato.nodo.setAttribute('transform', `translate(${punto.x} ${punto.y}) scale(${punto.escala})`);
    }
    for (const { from, to, linea } of aristas) {
      const a = posiciones.get(from);
      const b = posiciones.get(to);
      if (!a || !b) continue;
      for (const [atributo, valor] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })) {
        linea.setAttribute(atributo, valor);
      }
    }
  }
  giro.addEventListener('input', renderizar);
  document.querySelector('#reiniciar-giro').addEventListener('click', () => {
    giro.value = giro.defaultValue;
    renderizar();
  });
  renderizar();
  document.querySelector('#constelacion').hidden = false;
}
