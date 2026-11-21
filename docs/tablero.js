'use strict';

const porId = (id) => document.getElementById(id);
const buscar = porId('buscar');
const grupo = porId('grupo');
const estado = porId('estado');
const vacio = porId('vacio');
const publicaciones = porId('publicaciones');

function texto(etiqueta, contenido, clase) {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = contenido;
  if (clase) elemento.className = clase;
  return elemento;
}

function normalizar(valor) {
  return valor.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
}

function ficha(item, cluster) {
  const fila = document.createElement('li');
  const detalle = document.createElement('details');
  detalle.id = item.id;
  const resumen = document.createElement('summary');
  resumen.append(
    texto('span', item.titulo_corto || item.title, 'titulo'),
    texto('span', [item.year, item.journal, cluster?.name].filter(Boolean).join(' · '), 'meta'),
  );

  const cuerpo = texto('div', '', 'ficha');
  cuerpo.append(texto('h3', item.title));
  if (item.authors.length) cuerpo.append(texto('p', item.authors.join(', '), 'origen'));
  const fuente = item.fuente === 'abstract' ? 'Resumen basado en el abstract' : 'Ficha basada en el título (sin abstract)';
  cuerpo.append(texto('p', fuente, 'origen'));
  for (const [campo, etiqueta] of [
    ['aplicacion', 'Aplicación'], ['problema', 'Problema'], ['propuesta', 'Propuesta'],
    ['metodos', 'Métodos'], ['resultados', 'Resultados'], ['conclusiones', 'Conclusiones'],
    ['idea_futura', 'Idea futura'],
  ]) {
    if (item[campo]) cuerpo.append(texto('h4', etiqueta), texto('p', item[campo]));
  }

  const enlaces = texto('p', '', 'enlaces');
  if (item.doi?.startsWith('10.')) {
    const doi = texto('a', 'Ver publicación (DOI)');
    doi.href = `https://doi.org/${item.doi.split('/').map(encodeURIComponent).join('/')}`;
    enlaces.append(doi);
  }
  const markdown = texto('a', 'Abrir ficha Markdown');
  markdown.href = `../articulos/${encodeURIComponent(`${item.id}-${item.slug}`)}.md`;
  enlaces.append(markdown);
  cuerpo.append(enlaces);
  detalle.append(resumen, cuerpo);
  fila.append(detalle);
  return fila;
}

function iniciar({ items, clusters, topics }) {
  const grupos = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  for (const cluster of clusters) grupo.add(new Option(cluster.name, cluster.id));
  const registros = [...items].sort((a, b) => b.year - a.year || a.id.localeCompare(b.id)).map((item) => {
    const idGrupo = item.cluster.split(' ', 1)[0];
    const cluster = grupos.get(idGrupo);
    const indice = normalizar([
      item.title, item.titulo_corto, item.doi, item.journal, ...item.authors,
      ...item.palabras_clave, ...item.temas.map((tema) => topics[tema]?.name), cluster?.name,
    ].join(' '));
    return { idGrupo, indice, fila: ficha(item, cluster) };
  });
  publicaciones.replaceChildren(...registros.map(({ fila }) => fila));

  function filtrar() {
    const palabras = normalizar(buscar.value.trim()).split(/\s+/).filter(Boolean);
    let total = 0;
    for (const { idGrupo, indice, fila } of registros) {
      const coincide = (!grupo.value || grupo.value === idGrupo) && palabras.every((palabra) => indice.includes(palabra));
      fila.hidden = !coincide;
      if (coincide) total++;
    }
    estado.textContent = registros.length
      ? `${total} de ${registros.length} ${registros.length === 1 ? 'publicación' : 'publicaciones'} · Más recientes primero`
      : 'El catálogo aún no contiene publicaciones.';
    vacio.hidden = total > 0 || registros.length === 0;
  }

  buscar.addEventListener('input', filtrar);
  grupo.addEventListener('change', filtrar);
  function limpiar() {
    buscar.value = '';
    grupo.value = '';
    filtrar();
  }
  porId('limpiar').addEventListener('click', () => {
    limpiar();
    buscar.focus();
  });
  porId('filtros').hidden = registros.length === 0;
  filtrar();
  return (id) => {
    const detalle = porId(id);
    if (!detalle || !publicaciones.contains(detalle)) return;
    if (detalle.closest('li').hidden) limpiar();
    detalle.open = true;
    detalle.querySelector('summary').focus({ preventScroll: true });
    detalle.scrollIntoView({ block: 'start' });
  };
}

async function cargar() {
  estado.textContent = 'Cargando publicaciones…';
  try {
    const respuesta = await fetch('../data/bank.json');
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const datos = await respuesta.json();
    const abrir = iniciar(datos);
    iniciarConstelacion(datos, abrir);
    if (location.hash) abrir(location.hash.slice(1));
  } catch {
    estado.textContent = 'No se pudo cargar el catálogo. ';
    const reintentar = texto('a', 'Volver a cargar');
    reintentar.href = './';
    estado.append(reintentar);
  }
}

cargar();
