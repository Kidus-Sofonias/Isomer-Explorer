(function (global) {
  "use strict";

  var THREE = global.THREE;
  if (!THREE) {
    console.warn("Three.js not loaded — 3D viewer unavailable.");
    return;
  }

  // ── CPK color & radius tables ──────────────────────────────
  var ATOM_COLORS = {
    C: 0x404040,
    H: 0xffffff,
    O: 0xff0d0d,
    N: 0x3050f8,
    F: 0x90e050,
    Cl: 0x1ff01f,
    Br: 0xa62929,
    I: 0x940094,
    S: 0xffff30,
    P: 0xff8000,
    B: 0xffb5b5,
    default: 0xcc80ff,
  };

  var ATOM_RADII = {
    C: 0.5,
    H: 0.3,
    O: 0.45,
    N: 0.45,
    F: 0.38,
    Cl: 0.5,
    Br: 0.55,
    I: 0.6,
    S: 0.5,
    P: 0.5,
    B: 0.45,
    default: 0.45,
  };

  var BOND_RADIUS = 0.09;
  var DOUBLE_OFFSET = 0.07;
  var TRIPLE_OFFSET = 0.09;

  // ── Helpers ────────────────────────────────────────────────
  function atomColor(el) {
    return ATOM_COLORS[el] || ATOM_COLORS.default;
  }
  function atomRadius(el) {
    return ATOM_RADII[el] || ATOM_RADII.default;
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // Build a smooth sphere geometry
  function makeSphere(radius) {
    return new THREE.SphereGeometry(radius, 28, 24);
  }

  // Build a cylinder along +Y, length `len`
  function makeCylinder(radius, len) {
    return new THREE.CylinderGeometry(radius, radius, len, 10, 1);
  }

  // ── Main class ─────────────────────────────────────────────
  function MoleculeViewer3D() {
    this._container = null;
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._molGroup = null;
    this._animId = null;
    this._autoRotate = true;

    // interaction state
    this._isDown = false;
    this._prev = { x: 0, y: 0 };
    this._spherical = { theta: 0.3, phi: 0.8, radius: 6 };
    this._target = new THREE.Vector3(0, 0, 0);
    this._tmpVec = new THREE.Vector3();

    // bounce
    this._bound = {
      md: this._onMouseDown.bind(this),
      mm: this._onMouseMove.bind(this),
      mu: this._onMouseUp.bind(this),
      mw: this._onWheel.bind(this),
      rs: this._onResize.bind(this),
    };
  }

  // ── Public API ─────────────────────────────────────────────

  /** Initialise scene, camera, renderer inside `container` HTMLElement */
  MoleculeViewer3D.prototype.init = function (container) {
    if (!container) return;
    this._container = container;

    // Scene
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e1a); // deep navy

    // Camera
    var w = container.clientWidth || 400;
    var h = container.clientHeight || 300;
    var camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 50);
    camera.position.set(0, 1.5, 6);
    camera.lookAt(0, 0, 0);

    // Renderer
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Lights
    this._addLights(scene);

    // Molecule group (children added by loadModel)
    var molGroup = new THREE.Group();
    molGroup.position.set(0, 0, 0);
    scene.add(molGroup);

    // Starfield
    this._addStars(scene);

    // Ground ring (subtle)
    this._addGroundRing(scene);

    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    this._molGroup = molGroup;

    // Events
    var el = renderer.domElement;
    el.addEventListener("mousedown", this._bound.md, false);
    el.addEventListener("touchstart", this._bound.md, { passive: false });
    el.addEventListener("wheel", this._bound.mw, { passive: false });
    global.addEventListener("resize", this._bound.rs, false);

    // Start loop
    this._autoRotate = true;
    this._startLoop();
  };

  /** Load a molecule model from the data returned by molecule3DModel() */
  MoleculeViewer3D.prototype.loadModel = function (model) {
    var group = this._molGroup;
    if (!group) return;

    // Clear previous model
    this._clearGroup(group);

    if (!model || !model.atoms || !model.atoms.length) return;

    var atoms = model.atoms;
    var bonds = model.bonds || [];

    // Compute centre for centering
    var cx = 0,
      cy = 0,
      cz = 0;
    for (var ai = 0; ai < atoms.length; ai++) {
      cx += atoms[ai].x;
      cy += atoms[ai].y || 0;
      cz += atoms[ai].z || 0;
    }
    cx /= atoms.length;
    cy /= atoms.length;
    cz /= atoms.length;

    // Offset so molecule is centred
    var offset = this._tmpVec.set(-cx, -cy, -cz);

    // Determine overall scale
    var maxR = 0;
    for (var si = 0; si < atoms.length; si++) {
      var dx = atoms[si].x - cx;
      var dy = (atoms[si].y || 0) - cy;
      var dz = (atoms[si].z || 0) - cz;
      var r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r > maxR) maxR = r;
    }
    var scale = maxR > 0.01 ? 3.2 / maxR : 1;
    scale = clamp(scale, 0.3, 3);

    // Deduplicate bond pairs: store in a map keyed by "from,to"
    var bondMap = {};
    for (var bi = 0; bi < bonds.length; bi++) {
      var b = bonds[bi];
      var f = b.from,
        t = b.to,
        o = b.order || 1;
      if (f === undefined || t === undefined) continue;
      var key = f < t ? f + "," + t : t + "," + f;
      bondMap[key] = (bondMap[key] || 0) + o;
    }

    // Track which bonds we've rendered so we only render each edge once
    var renderedBonds = {};

    // Create atoms
    var sphereGeoCache = {};
    for (var aj = 0; aj < atoms.length; aj++) {
      var a = atoms[aj];
      var el = a.element || "C";
      var col = atomColor(el);
      var rad = atomRadius(el) * scale;

      var geo = sphereGeoCache[el] || makeSphere(rad);
      if (!sphereGeoCache[el]) sphereGeoCache[el] = geo;
      else geo = sphereGeoCache[el];

      // scale geometry if radii differ slightly
      var mat = new THREE.MeshPhysicalMaterial({
        color: col,
        metalness: 0.15,
        roughness: 0.25,
        clearcoat: 0.1,
        clearcoatRoughness: 0.4,
      });
      var mesh = new THREE.Mesh(geo, mat);
      var px = (a.x + offset.x) * scale;
      var py = ((a.y || 0) + offset.y) * scale;
      var pz = ((a.z || 0) + offset.z) * scale;
      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Create bonds
    for (var bk = 0; bk < bonds.length; bk++) {
      var bb = bonds[bk];
      var fi = bb.from,
        ti = bb.to;
      if (fi === undefined || ti === undefined) continue;
      var kk = fi < ti ? fi + "," + ti : ti + "," + fi;
      if (renderedBonds[kk]) continue;
      renderedBonds[kk] = true;

      var order = bb.order || 1;
      var a1 = atoms[fi];
      var a2 = atoms[ti];
      if (!a1 || !a2) continue;

      var p1 = new THREE.Vector3(
        (a1.x + offset.x) * scale,
        ((a1.y || 0) + offset.y) * scale,
        ((a1.z || 0) + offset.z) * scale
      );
      var p2 = new THREE.Vector3(
        (a2.x + offset.x) * scale,
        ((a2.y || 0) + offset.y) * scale,
        ((a2.z || 0) + offset.z) * scale
      );

      // Compute bond direction
      var dir = new THREE.Vector3().subVectors(p2, p1);
      var len = dir.length();
      if (len < 0.001) continue;
      var mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      var norm = dir.clone().normalize();

      // Build perpendicular basis for multiple bonds
      var upRef = Math.abs(norm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      var perp1 = new THREE.Vector3().crossVectors(norm, upRef).normalize();
      var perp2 = new THREE.Vector3().crossVectors(norm, perp1).normalize();

      var br = BOND_RADIUS * scale;

      if (order === 1) {
        this._addBondCylinder(group, p1, p2, br, 0x808080);
      } else if (order === 2) {
        this._addBondCylinder(
          group,
          p1.clone().add(perp1.clone().multiplyScalar(DOUBLE_OFFSET * scale)),
          p2.clone().add(perp1.clone().multiplyScalar(DOUBLE_OFFSET * scale)),
          br,
          0x808080
        );
        this._addBondCylinder(
          group,
          p1.clone().add(perp1.clone().multiplyScalar(-DOUBLE_OFFSET * scale)),
          p2.clone().add(perp1.clone().multiplyScalar(-DOUBLE_OFFSET * scale)),
          br,
          0x808080
        );
      } else if (order >= 3) {
        this._addBondCylinder(
          group,
          p1.clone().add(perp1.clone().multiplyScalar(TRIPLE_OFFSET * scale)),
          p2.clone().add(perp1.clone().multiplyScalar(TRIPLE_OFFSET * scale)),
          br,
          0x808080
        );
        this._addBondCylinder(
          group,
          p1.clone().add(perp1.clone().multiplyScalar(-TRIPLE_OFFSET * scale)),
          p2.clone().add(perp1.clone().multiplyScalar(-TRIPLE_OFFSET * scale)),
          br,
          0x808080
        );
        this._addBondCylinder(group, p1, p2, br * 0.6, 0x808080);
      }
    }

    // Reset camera
    this._spherical.theta = 0.3;
    this._spherical.phi = 0.8;
    this._spherical.radius = 6;
    this._updateCamera();
  };

  /** Resize – call when container changes size */
  MoleculeViewer3D.prototype.resize = function () {
    if (!this._container || !this._camera || !this._renderer) return;
    var w = this._container.clientWidth || 400;
    var h = this._container.clientHeight || 300;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  };

  /** Dispose – clean up everything */
  MoleculeViewer3D.prototype.dispose = function () {
    this._stopLoop();
    if (this._renderer) {
      this._renderer.domElement.removeEventListener("mousedown", this._bound.md);
      this._renderer.domElement.removeEventListener("touchstart", this._bound.md);
      this._renderer.domElement.removeEventListener("wheel", this._bound.mw);
    }
    global.removeEventListener("resize", this._bound.rs, false);
    global.removeEventListener("mousemove", this._bound.mm, false);
    global.removeEventListener("mouseup", this._bound.mu, false);
    global.removeEventListener("touchmove", this._bound.mm, false);
    global.removeEventListener("touchend", this._bound.mu, false);

    if (this._scene) {
      this._disposeScene(this._scene);
    }
    if (this._renderer) {
      if (this._renderer.domElement && this._renderer.domElement.parentNode) {
        this._renderer.domElement.parentNode.removeChild(this._renderer.domElement);
      }
      this._renderer.dispose();
    }
    this._container = null;
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._molGroup = null;
  };

  // ── Internal ──────────────────────────────────────────────

  MoleculeViewer3D.prototype._addLights = function (scene) {
    var ambient = new THREE.AmbientLight(0x223355, 0.4);
    scene.add(ambient);

    var key = new THREE.DirectionalLight(0xffeedd, 1.8);
    key.position.set(5, 8, 5);
    key.castShadow = true;
    scene.add(key);

    var fill = new THREE.DirectionalLight(0x4488ff, 0.6);
    fill.position.set(-4, -2, -3);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(-2, 3, -6);
    scene.add(rim);
  };

  MoleculeViewer3D.prototype._addStars = function (scene) {
    var count = 400;
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 80;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      color: 0x8899cc,
      size: 0.08,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    var stars = new THREE.Points(geo, mat);
    stars.name = "__stars";
    scene.add(stars);
  };

  MoleculeViewer3D.prototype._addGroundRing = function (scene) {
    var geo = new THREE.RingGeometry(2.8, 3.0, 64);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x334466,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    var ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.2;
    scene.add(ring);
  };

  MoleculeViewer3D.prototype._addBondCylinder = function (group, p1, p2, radius, color) {
    var dir = new THREE.Vector3().subVectors(p2, p1);
    var len = dir.length();
    if (len < 0.001) return;
    var mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    var geo = makeCylinder(radius, len);
    var mat = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.3,
      roughness: 0.4,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);

    var up = new THREE.Vector3(0, 1, 0);
    var quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    mesh.quaternion.copy(quat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  MoleculeViewer3D.prototype._clearGroup = function (group) {
    while (group.children.length) {
      var child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      group.remove(child);
    }
  };

  MoleculeViewer3D.prototype._disposeScene = function (scene) {
    scene.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(function (m) {
            m.dispose();
          });
        } else {
          obj.material.dispose();
        }
      }
    });
  };

  // ── Interaction ────────────────────────────────────────────

  MoleculeViewer3D.prototype._onMouseDown = function (e) {
    e.preventDefault();
    this._isDown = true;
    var pt = e.touches ? e.touches[0] : e;
    this._prev.x = pt.clientX;
    this._prev.y = pt.clientY;
    this._autoRotate = false;

    global.addEventListener("mousemove", this._bound.mm, false);
    global.addEventListener("mouseup", this._bound.mu, false);
    global.addEventListener("touchmove", this._bound.mm, { passive: false });
    global.addEventListener("touchend", this._bound.mu, false);
  };

  MoleculeViewer3D.prototype._onMouseMove = function (e) {
    if (!this._isDown) return;
    e.preventDefault();
    var pt = e.touches ? e.touches[0] : e;
    var dx = pt.clientX - this._prev.x;
    var dy = pt.clientY - this._prev.y;
    this._prev.x = pt.clientX;
    this._prev.y = pt.clientY;

    this._spherical.theta -= dx * 0.008;
    this._spherical.phi = clamp(this._spherical.phi - dy * 0.008, 0.1, Math.PI - 0.1);
    this._updateCamera();
  };

  MoleculeViewer3D.prototype._onMouseUp = function () {
    this._isDown = false;
    this._autoRotate = true;
    global.removeEventListener("mousemove", this._bound.mm, false);
    global.removeEventListener("mouseup", this._bound.mu, false);
    global.removeEventListener("touchmove", this._bound.mm, false);
    global.removeEventListener("touchend", this._bound.mu, false);
  };

  MoleculeViewer3D.prototype._onWheel = function (e) {
    e.preventDefault();
    this._spherical.radius = clamp(this._spherical.radius + e.deltaY * 0.005, 2, 14);
    this._updateCamera();
  };

  MoleculeViewer3D.prototype._onResize = function () {
    this.resize();
  };

  // ── Camera ─────────────────────────────────────────────────

  MoleculeViewer3D.prototype._updateCamera = function () {
    var s = this._spherical;
    this._camera.position.x = s.radius * Math.sin(s.phi) * Math.sin(s.theta);
    this._camera.position.y = s.radius * Math.cos(s.phi);
    this._camera.position.z = s.radius * Math.sin(s.phi) * Math.cos(s.theta);
    this._camera.lookAt(this._target);
  };

  // ── Animation ──────────────────────────────────────────────

  MoleculeViewer3D.prototype._startLoop = function () {
    var self = this;
    var last = performance.now();
    function frame(now) {
      self._animId = requestAnimationFrame(frame);
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      self._tick(dt);
      self._renderer.render(self._scene, self._camera);
    }
    this._animId = requestAnimationFrame(frame);
  };

  MoleculeViewer3D.prototype._stopLoop = function () {
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  };

  MoleculeViewer3D.prototype._tick = function (dt) {
    if (this._autoRotate) {
      this._spherical.theta += dt * 0.5;
    }
    this._updateCamera();

    // Gentle floating motion for the molecule
    if (this._molGroup) {
      this._molGroup.position.y = Math.sin(performance.now() * 0.0008) * 0.06;
    }
  };

  // ── Export ─────────────────────────────────────────────────
  global.MoleculeViewer3D = MoleculeViewer3D;
})(window);
