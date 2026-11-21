import { Vector3 } from 'three';

export const tipos = [
  ['aplicacion', 'Aplicación', '#5ad1e6', 1],
  ['problema', 'Problema', '#ff7474', 1],
  ['propuesta', 'Propuesta', '#f89d55', 2],
  ['metodos', 'Métodos', '#85be75', 2],
  ['resultados', 'Resultados', '#48d99a', 3],
  ['conclusiones', 'Conclusiones', '#b8c2d2', 3],
  ['grupo', 'Clúster', '#ba9cf6', 3],
];

const dorado = Math.PI * (3 - Math.sqrt(5));

export function construirAtlas({ items, clusters, links }) {
  const grupo = new Map(clusters.flatMap(c => c.members.map(id => [id, c])));
  const sistemas = [...items].sort((a, b) => a.id.localeCompare(b.id)).map((item, i) => {
    const cluster = grupo.get(item.id);
    const lugar = new Vector3(Math.cos(i * dorado) * Math.sqrt(i) * 2.3,
      (i % 3 - 1) * 1.4, Math.sin(i * dorado) * Math.sqrt(i) * 2.3);
    const c = Math.max(0, clusters.indexOf(cluster));
    const m = Math.max(0, cluster?.members.indexOf(item.id) ?? 0);
    const agrupado = new Vector3(Math.cos(c * dorado) * 5 + Math.cos(m * dorado) * m * 1.15,
      (c % 2 - .5) * 2 + .45 * m, Math.sin(c * dorado) * 5 + Math.sin(m * dorado) * m * 1.15);
    const sistema = { item, cluster, lugar, agrupado, giro: i * dorado, inclinacion: i % 2 ? .34 : -.3 };
    sistema.nodos = [{ sistema, clave: 'sol', label: item.titulo_corto || item.title,
      radio: .32, color: '#ffc95e', distancia: 0, angulo: 0 }];
    const valores = { ...item, grupo: cluster?.name };
    for (const [j, [clave, label, color, orbita]] of tipos.entries()) {
      if (!valores[clave]) continue;
      sistema.nodos.push({ sistema, clave, label, color, radio: .13, distancia: .48 * orbita,
        angulo: j * dorado, detalle: valores[clave] });
    }
    return sistema;
  });
  const porId = new Map(sistemas.map(s => [s.item.id, s]));
  const arcos = links.flatMap(({ from, to, topics }) => porId.has(from) && porId.has(to)
    ? [{ a: porId.get(from), b: porId.get(to), topics }] : []);
  return { sistemas, clusters, arcos };
}
