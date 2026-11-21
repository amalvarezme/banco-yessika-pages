import * as T from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';

export function montarVisor(host, atlas, { plano, elegir }) {
  const escena = new T.Scene();
  escena.background = new T.Color('#070c19');
  const camara = new T.PerspectiveCamera(43, 1, .1, 180);
  let lienzo = document.createElement('canvas');
  let webgl;
  if (!plano) {
    try {
      if (lienzo.getContext('webgl2', { antialias: true })) {
        webgl = new T.WebGLRenderer({ canvas: lienzo, antialias: true });
      }
    } catch { /* La vista plana no depende de GPU. */ }
  }
  if (!webgl) lienzo = document.createElement('canvas');
  const ctx = webgl ? null : lienzo.getContext('2d');
  host.prepend(lienzo);
  host.dataset.modo = webgl ? '3d' : '2d';
  lienzo.setAttribute('aria-hidden', 'true');
  const orbita = new OrbitControls(camara, lienzo);
  orbita.minDistance = 2.5;
  orbita.maxDistance = 85;
  orbita.autoRotateSpeed = .42;
  const esfera = new T.SphereGeometry(1, 20, 14);
  const nodos = atlas.sistemas.flatMap(s => s.nodos);
  let layout = 'cielo', filtro = '', activo = null, mostrar = true, frame = 0;
  let ancho, alto, puntos = [];
  const rotulo = host.querySelector('#nombres-atlas');
  const pista = host.querySelector('#pista-atlas');
  const etiquetas = new Map(atlas.sistemas.map(s => {
    const el = document.createElement('span');
    el.textContent = `${s.item.id} · ${s.item.titulo_corto || s.item.title}`;
    el.hidden = true;
    rotulo.append(el);
    return [s, el];
  }));
  function trazo(vertices, color, opacidad, tipo = 'linea') {
    const geometria = new T.BufferGeometry().setFromPoints(vertices);
    const material = tipo === 'estrellas'
      ? new T.PointsMaterial({ color, size: .052, transparent: true, opacity: opacidad })
      : new T.LineBasicMaterial({ color, transparent: true, opacity: opacidad });
    return tipo === 'estrellas' ? new T.Points(geometria, material) : new T.Line(geometria, material);
  }
  const estrellas = Array.from({ length: 330 }, (_, i) => new T.Vector3(
    37 * Math.sin(i * 12.9898), 23 * Math.cos(i * 6.917), 35 * Math.sin(i * 17.37)));
  if (webgl) {
    escena.add(trazo(estrellas, '#97b4ee', .45, 'estrellas'));
    const luz = new T.DirectionalLight('#e5ecff', 2.1);
    luz.position.set(8, 14, 12);
    escena.add(new T.AmbientLight('#b9ccf5', 1.8), luz);
  }
  let trazos = [];
  function centro(s) { return layout === 'grupos' ? s.agrupado : s.lugar; }
  function lugar(s, radio, angulo) {
    return centro(s).clone().add(new T.Vector3(radio * Math.cos(angulo), 0, radio * Math.sin(angulo))
      .applyAxisAngle(new T.Vector3(1, 0, 0), s.inclinacion)
      .applyAxisAngle(new T.Vector3(0, 1, 0), s.giro));
  }
  function vecinos(s, otro) { return atlas.arcos.some(({ a, b }) => (a === s && b === otro) || (b === s && a === otro)); }
  function visible(s) { return !filtro || filtro === s.cluster?.id; }
  function opacidad(s) {
    if (!visible(s)) return .07;
    return !activo || s === activo.sistema || vecinos(s, activo.sistema) ? 1 : .22;
  }
  function actualizar() {
    const anteriores = trazos;
    trazos = [];
    const linea = (vertices, color, alpha) => trazos.push({ vertices, color, alpha });
    for (const s of atlas.sistemas) {
      for (const radio of new Set(s.nodos.slice(1).map(n => n.distancia))) {
        linea(Array.from({ length: 41 }, (_, i) => lugar(s, radio, i * Math.PI / 20)), '#607396', .46 * opacidad(s));
      }
      for (const n of s.nodos) {
        n.pos = lugar(s, n.distancia, n.angulo);
        if (webgl && !n.malla) {
          const material = n.clave === 'sol' ? new T.MeshBasicMaterial() : new T.MeshStandardMaterial();
          n.malla = new T.Mesh(esfera, material);
          escena.add(n.malla);
        }
        if (n.malla) {
          n.malla.position.copy(n.pos);
          n.malla.scale.setScalar(n.radio * (n === activo ? 1.35 : 1));
          n.malla.material.color.set(n.color).multiplyScalar(.09 + .91 * opacidad(s));
        }
      }
    }
    for (const { a, b } of atlas.arcos) {
      const medio = centro(a).clone().lerp(centro(b), .5);
      medio.y += 1.2 + centro(a).distanceTo(centro(b)) * .22;
      linea(new T.QuadraticBezierCurve3(centro(a), medio, centro(b)).getPoints(32), '#8d9edb', .58 * Math.min(opacidad(a), opacidad(b)));
    }
    if (webgl) {
      for (const { figura } of anteriores) {
        escena.remove(figura); figura.geometry.dispose(); figura.material.dispose();
      }
      for (const t of trazos) { t.figura = trazo(t.vertices, t.color, t.alpha); escena.add(t.figura); }
    }
    pedir();
  }
  function proyectar(v) {
    const p = v.clone().project(camara);
    return { x: (p.x + 1) * ancho / 2, y: (1 - p.y) * alto / 2, z: p.z };
  }
  function dibujarPlano() {
    ctx.fillStyle = '#070c19'; ctx.fillRect(0, 0, ancho, alto);
    ctx.fillStyle = '#53658b';
    for (const estrella of estrellas) {
      const p = proyectar(estrella);
      if (Math.abs(p.z) < 1) ctx.fillRect(p.x, p.y, 1.3, 1.3);
    }
    for (const { vertices, color, alpha } of trazos) {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.globalAlpha = alpha;
      let empezar = true;
      for (const v of vertices) {
        const p = proyectar(v);
        if (Math.abs(p.z) >= 1) { empezar = true; continue; }
        if (empezar) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        empezar = false;
      }
      ctx.stroke();
    }
    for (const { n, x, y, z, r } of puntos) {
      if (Math.abs(z) >= 1) continue;
      ctx.globalAlpha = opacidad(n.sistema); ctx.fillStyle = n.color;
      ctx.shadowColor = n.color; ctx.shadowBlur = n.clave === 'sol' ? 10 : 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  function dibujarNombres() {
    const ocupados = [];
    for (const el of etiquetas.values()) el.hidden = true;
    if (!mostrar) return;
    const soles = puntos.filter(p => p.n.clave === 'sol' && visible(p.n.sistema) && Math.abs(p.z) < 1)
      .sort((a, b) => Number(b.n.sistema === activo?.sistema) - Number(a.n.sistema === activo?.sistema) || a.z - b.z);
    for (const p of soles) {
      const el = etiquetas.get(p.n.sistema);
      el.hidden = false;
      const w = el.offsetWidth, h = el.offsetHeight;
      const x = Math.min(ancho - w - 4, Math.max(4, p.x + p.r + 4)), y = p.y - h / 2;
      if (p.x < 0 || p.x > ancho || y < 3 || y + h > alto - 3 ||
        ocupados.some(b => x < b.x + b.w + 3 && b.x < x + w + 3 && y < b.y + b.h + 3 && b.y < y + h + 3)) {
        el.hidden = true;
        continue;
      }
      el.style.transform = `translate(${x}px,${y}px)`;
      ocupados.push({ x, y, w, h });
    }
  }
  function dibujar() {
    frame = 0;
    if (!ancho || !alto) return;
    if (orbita.autoRotate) orbita.update();
    camara.updateMatrixWorld();
    puntos = nodos.map(n => ({ n, ...proyectar(n.pos), r: Math.max(2, alto * n.radio * 1.28 / camara.position.distanceTo(n.pos)) }))
      .sort((a, b) => b.z - a.z);
    if (webgl) webgl.render(escena, camara); else dibujarPlano();
    dibujarNombres();
    if (orbita.autoRotate) pedir();
  }
  function pedir() { if (!frame) frame = requestAnimationFrame(dibujar); }
  const inicio = new T.Vector3(3, 14, 24).normalize();
  function reiniciar() {
    orbita.target.set(0, 0, 0);
    const distancia = Math.max(23, Math.min(47, 20 / camara.aspect));
    camara.position.copy(inicio).multiplyScalar(distancia);
    orbita.update(); pedir();
  }
  function medir() {
    ancho = host.clientWidth; alto = host.clientHeight;
    if (!ancho || !alto) return;
    camara.aspect = ancho / alto; camara.updateProjectionMatrix();
    const dpi = Math.min(devicePixelRatio, 1.5);
    if (webgl) { webgl.setPixelRatio(dpi); webgl.setSize(ancho, alto, false); }
    else { lienzo.width = ancho * dpi; lienzo.height = alto * dpi; ctx.setTransform(dpi, 0, 0, dpi, 0, 0); }
    pedir();
  }
  function centrar(n) {
    const delta = camara.position.clone().sub(orbita.target).setLength(7);
    orbita.target.copy(n.pos); camara.position.copy(n.pos).add(delta); orbita.update(); pedir();
  }
  function girar(horizontal, vertical) {
    const e = new T.Spherical().setFromVector3(camara.position.clone().sub(orbita.target));
    e.theta += horizontal; e.phi += vertical; e.makeSafe();
    camara.position.setFromSpherical(e).add(orbita.target); orbita.update(); pedir();
  }
  let inicioPuntero;
  lienzo.addEventListener('pointerdown', e => { inicioPuntero = [e.clientX, e.clientY]; });
  function detectar(e) {
    const rect = lienzo.getBoundingClientRect();
    return puntos.findLast(p => visible(p.n.sistema) && Math.abs(p.z) < 1 &&
      Math.hypot(p.x - e.clientX + rect.left, p.y - e.clientY + rect.top) < Math.max(8, p.r))?.n;
  }
  function seleccionar(e, centrarVista) {
    if (!inicioPuntero || Math.hypot(inicioPuntero[0] - e.clientX, inicioPuntero[1] - e.clientY) > 6) return;
    const nodo = detectar(e);
    if (nodo) elegir(nodo, centrarVista);
  }
  lienzo.addEventListener('pointermove', e => {
    const nodo = e.buttons ? null : detectar(e);
    pista.hidden = !nodo;
    if (nodo) pista.textContent = `${nodo.sistema.item.id} · ${nodo.label}`;
  });
  lienzo.addEventListener('pointerleave', () => { pista.hidden = true; });
  lienzo.addEventListener('click', e => seleccionar(e, false));
  lienzo.addEventListener('dblclick', e => seleccionar(e, true));
  orbita.addEventListener('change', pedir);
  actualizar(); medir(); reiniciar(); new ResizeObserver(medir).observe(host);
  return {
    centrar, girar, reiniciar,
    modo: host.dataset.modo,
    zoom(factor) {
      const offset = camara.position.clone().sub(orbita.target);
      camara.position.copy(orbita.target).add(offset.setLength(T.MathUtils.clamp(offset.length() / factor, 2.5, 85)));
      orbita.update(); pedir();
    },
    rotar(on) { orbita.autoRotate = on; pedir(); },
    nombres(on) { mostrar = on; pedir(); },
    seleccionar(n) { activo = n; actualizar(); },
    filtrar(id) { filtro = id; actualizar(); },
    disponer(modo) { layout = modo; host.dataset.disposicion = modo; actualizar(); reiniciar(); },
  };
}
