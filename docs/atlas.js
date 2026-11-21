import { construirAtlas, tipos } from './atlas-modelo.js';
import { montarVisor } from './atlas-visor.js';

const porId = id => document.getElementById(id);
const estado = porId('estado-atlas');
const parametros = new URLSearchParams(location.search);
const integrado = parametros.get('embed') === '1' && window !== window.top;
if (integrado) document.body.classList.add('atlas-integrado');

function texto(tag, valor) {
  const el = document.createElement(tag);
  el.textContent = valor;
  return el;
}

function iniciar(atlas) {
  const buscar = porId('publicacion');
  const cluster = porId('cluster');
  const detalle = porId('detalle-atlas');
  const planetas = porId('planetas');
  const cielo = porId('cielo');
  const bienvenida = [...detalle.childNodes];
  const visor = montarVisor(cielo, atlas, {
    plano: parametros.get('view') === '2d', elegir,
  });
  let actual;
  cielo.dataset.disposicion = 'cielo';
  cielo.dataset.sistemas = atlas.sistemas.length;
  cielo.dataset.planetas = atlas.sistemas.reduce((total, s) => total + s.nodos.length - 1, 0);
  estado.textContent = visor.modo === '3d' ? 'Vista 3D · WebGL' : 'Vista 2D · Sin necesidad de WebGL';
  const modo = porId('modo-atlas');
  const alternativa = new URLSearchParams(integrado ? { embed: '1' } : {});
  if (visor.modo === '3d') alternativa.set('view', '2d');
  else modo.textContent = 'Intentar vista 3D';
  modo.href = `constelacion.html${alternativa.size ? `?${alternativa}` : ''}`;

  for (const s of atlas.sistemas) {
    const opcion = document.createElement('option');
    opcion.value = `${s.item.id} · ${s.item.titulo_corto || s.item.title}`;
    porId('publicaciones-atlas').append(opcion);
  }
  for (const c of atlas.clusters) cluster.add(new Option(c.name, c.id));
  for (const [, label, color] of [['sol', 'Publicación', '#ffc95e'], ...tipos, ['arco', 'Tema compartido entre publicaciones', '#8d9edb']]) {
    const li = texto('li', label);
    li.style.setProperty('--planeta', color);
    porId('leyenda-atlas').append(li);
  }

  function elegir(n, centrar) {
    if (n.sistema !== actual) {
      actual = n.sistema;
      planetas.replaceChildren(...actual.nodos.map(p => {
        const boton = texto('button', p.clave === 'sol' ? 'Publicación' : p.label);
        boton.addEventListener('click', () => elegir(p, false));
        return boton;
      }));
    }
    buscar.value = n.sistema.item.id;
    visor.seleccionar(n);
    if (centrar) visor.centrar(n);
    const { item } = n.sistema;
    const ficha = texto('a', 'Abrir ficha en el catálogo');
    ficha.href = `./#${encodeURIComponent(item.id)}`;
    if (integrado) ficha.target = '_top';
    detalle.replaceChildren(texto('p', `${item.id} · ${item.year} · ${n.sistema.cluster?.name || 'Sin clúster'}`),
      texto('h2', item.title), texto('p', n.detalle || item.journal), ficha);
    for (const [i, boton] of [...planetas.children].entries()) {
      boton.setAttribute('aria-pressed', String(n.sistema.nodos[i] === n));
    }
  }
  function limpiar() {
    actual = null;
    buscar.value = '';
    visor.seleccionar(null);
    detalle.replaceChildren(...bienvenida);
    planetas.replaceChildren();
  }
  const normalizar = valor => valor.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
  porId('buscar-atlas').addEventListener('submit', e => {
    e.preventDefault();
    const consulta = normalizar(buscar.value.trim().split(' · ')[0]);
    if (!consulta) { limpiar(); return; }
    const s = atlas.sistemas.find(s => normalizar(s.item.id) === consulta)
      || atlas.sistemas.find(s => normalizar(`${s.item.title} ${s.item.titulo_corto || ''}`).includes(consulta));
    if (!s) {
      estado.textContent = 'No se encontró una publicación con ese ID o título.';
      return;
    }
    estado.textContent = visor.modo === '3d' ? 'Vista 3D · WebGL' : 'Vista 2D · Sin necesidad de WebGL';
    if (cluster.value && cluster.value !== s.cluster?.id) {
      cluster.value = ''; visor.filtrar('');
    }
    elegir(s.nodos[0], true);
  });
  cluster.addEventListener('change', () => {
    if (cluster.value && cluster.value !== actual?.cluster?.id) limpiar();
    visor.filtrar(cluster.value);
    visor.reiniciar();
  });
  const accionar = (id, fn) => porId(id).addEventListener('click', fn);
  const alternar = (id, fn) => accionar(id, e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    fn(on);
  });
  accionar('mas', () => visor.zoom(1.35));
  accionar('menos', () => visor.zoom(1 / 1.35));
  accionar('izquierda', () => visor.girar(.25, 0));
  accionar('derecha', () => visor.girar(-.25, 0));
  accionar('arriba', () => visor.girar(0, -.18));
  accionar('abajo', () => visor.girar(0, .18));
  alternar('rotacion', visor.rotar);
  alternar('nombres', visor.nombres);
  alternar('disposicion', on => visor.disponer(on ? 'grupos' : 'cielo'));
  accionar('reiniciar', () => {
    limpiar(); cluster.value = ''; visor.filtrar(''); visor.reiniciar();
  });
}

try {
  const respuesta = await fetch('../data/bank.json');
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  iniciar(construirAtlas(await respuesta.json()));
} catch (error) {
  console.error(error);
  estado.textContent = 'No se pudo cargar la constelación. Volvé al catálogo o recargá la página.';
}
