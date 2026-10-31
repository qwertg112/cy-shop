/* ==========================================================================
   CY68 · 黑红波浪纹机械键盘 / 高精度程序化 3D 模型
   --------------------------------------------------------------------------
   - 100% 程序化几何：68 键 65% 配列、 sculpted keycaps、铝合金外壳、定位板、
     轴体、卫星轴、脚垫、螺丝、Type-C 接口、底部铭牌。
   - 每颗键帽独立生成 PBT 波浪纹贴图（无外部图片依赖）。
   - 自由轨道旋转 / 俯仰 / 缩放 / 自动旋转 / 预设视角 / 触屏手势。
   - 可直接挂载到任意容器，也可通过 VIEW3D.open(productId) 打开站内弹窗。
   ========================================================================== */
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var BASE = (function () {
    try {
      if (SCRIPT && SCRIPT.src) return new URL(".", SCRIPT.src).href;
    } catch (e) {}
    return "assets/";
  })();
  var THREE_URL = BASE + "three.min.js";
  var threePromise = null;

  function loadThree() {
    if (window.THREE) return Promise.resolve(enableColorManagement(window.THREE));
    if (threePromise) return threePromise;
    threePromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = THREE_URL;
      s.async = true;
      s.onload = function () {
        if (window.THREE) resolve(enableColorManagement(window.THREE));
        else reject(new Error("three.js 加载完成但未找到 THREE"));
      };
      s.onerror = function () {
        reject(new Error("three.js 加载失败：" + THREE_URL));
      };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  function enableColorManagement(THREE) {
    // r150 默认 legacy 色彩模式会把 sRGB 材质/贴图当线性值使用，
    // 导致黑色发灰、红色过曝。显式开启色彩管理后材质与贴图保持一致。
    try {
      if (THREE.ColorManagement) {
        THREE.ColorManagement.legacyMode = false;
        if ("enabled" in THREE.ColorManagement) THREE.ColorManagement.enabled = true;
      }
    } catch (e) {}
    return THREE;
  }

  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ======================================================================
     1. 配列
     ====================================================================== */
  var BOARD_W = 16.75;        // 键区宽度（单位 u）
  var ROW_PITCH = 1.02;       // 行距
  var KEY_GAP = 0.052;        // 键帽间隙
  var CASE_W = 18.0;
  var CASE_D = 6.15;
  var PLATE_Y = 0.0;
  var CAP_BASE_Y = 0.105;

  /* RGB 黑色款的键帽字符：与黑红波浪纹款“无字符”完全不同 */
  var RGB_LABELS = [
    ["Esc","1!","2@","3#","4$","5%","6^","7&","8*","9(","0)","-_","=+","Backspace","Ins"],
    ["Tab","Q","W","E","R","T","Y","U","I","O","P","[{","]}","\\|","Del"],
    ["Caps","A","S","D","F","G","H","J","K","L",";:","'\"","Enter","PgUp"],
    ["Shift","Z","X","C","V","B","N","M",",<",".>","/?","Shift","↑","PgDn"],
    ["Ctrl","Win","Alt","","Alt","Fn","Ctrl","←","↓","→"]
  ];

  var LAYOUT_ROWS = [
    {
      tilt: 0.075, height: 0.525,
      widths: [1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
      labels: ["Esc","1","2","3","4","5","6","7","8","9","0","-","=","Backspace","Del"],
      types:  ["B","B","B","B","B","B","B","B","B","R","R","R","R","S","R"]
    },
    {
      tilt: 0.038, height: 0.515,
      widths: [1.5,1,1,1,1,1,1,1,1,1,1,1,1,1.5,1],
      labels: ["Tab","Q","W","E","R","T","Y","U","I","O","P","[","]","\\","PgUp"],
      types:  ["B","B","B","B","B","B","B","B","B","B","B","B","B","B","B"]
    },
    {
      tilt: 0.0, height: 0.503,
      widths: [1.75,1,1,1,1,1,1,1,1,1,1,1,2.25,1],
      labels: ["Caps","A","S","D","F","G","H","J","K","L",";","'","Enter","PgDn"],
      types:  ["B","B","B","B","B","B","S","S","R","B","B","B","S","B"]
    },
    {
      tilt: -0.052, height: 0.49,
      widths: [2.25,1,1,1,1,1,1,1,1,1,1,1.75,1,1],
      labels: ["LShift","Z","X","C","V","B","N","M",",",".","/","RShift","Up","End"],
      types:  ["B","B","B","S","R","R","R","R","R","R","R","S","S","B"]
    },
    {
      tilt: -0.082, height: 0.44,
      widths: [1.25,1.25,1.25,6.25,1.25,1.25,1.25,1,1,1],
      labels: ["LCtrl","Win","LAlt","Space","RAlt","Fn","RCtrl","Left","Down","Right"],
      types:  ["B","B","S","R","R","R","R","R","R","R"]
    }
  ];

  function buildKeyData() {
    var keys = [];
    var totalDepth = (LAYOUT_ROWS.length - 1) * ROW_PITCH;
    LAYOUT_ROWS.forEach(function (row, r) {
      var total = row.widths.reduce(function (a, b) { return a + b; }, 0);
      var scale = BOARD_W / total;
      var x = -BOARD_W / 2;
      var z = -totalDepth / 2 + r * ROW_PITCH;
      row.widths.forEach(function (w0, i) {
        var pitch = w0 * scale;
        var label = row.labels[i];
        var type = row.types[i];
        var key = {
          id: r + "-" + i,
          label: label,
          type: type,
          row: r,
          index: i,
          x: x + pitch / 2,
          z: z,
          pitch: pitch,
          w: pitch - KEY_GAP,
          d: ROW_PITCH - KEY_GAP,
          tilt: row.tilt,
          height: row.height,
          capW: pitch - KEY_GAP,
          capD: ROW_PITCH - KEY_GAP
        };
        if (type === "S") {
          var rnd = mulberry32(hashStr(label + "|" + r + "|" + i + "|split"));
          key.split = {
            redBelow: rnd() > 0.18,
            slope: (rnd() - 0.5) * 0.52,
            bias: (rnd() - 0.5) * 0.52,
            wave: 0.022 + rnd() * 0.045,
            phase: rnd() * TAU
          };
        }
        keys.push(key);
        x += pitch;
      });
    });
    return keys;
  }

  /* ======================================================================
     2. 几何工具
     ====================================================================== */
  function roundedRectPoints(w, d, r, n) {
    var hw = w / 2, hd = d / 2;
    r = Math.max(0, Math.min(r, hw - 0.0001, hd - 0.0001));
    var sx = w - 2 * r, sz = d - 2 * r;
    var arc = Math.PI * r / 2;
    var segs = [
      { len: sx, fn: function (t) { return [-hw + r + sx * t, -hd]; } },
      { len: arc, fn: function (t) {
          var a = -Math.PI / 2 + Math.PI / 2 * t;
          return [hw - r + Math.cos(a) * r, -hd + r + Math.sin(a) * r];
      } },
      { len: sz, fn: function (t) { return [hw, -hd + r + sz * t]; } },
      { len: arc, fn: function (t) {
          var a = Math.PI / 2 * t;
          return [hw - r + Math.cos(a) * r, hd - r + Math.sin(a) * r];
      } },
      { len: sx, fn: function (t) { return [hw - r - sx * t, hd]; } },
      { len: arc, fn: function (t) {
          var a = Math.PI / 2 + Math.PI / 2 * t;
          return [-hw + r + Math.cos(a) * r, hd - r + Math.sin(a) * r];
      } },
      { len: sz, fn: function (t) { return [-hw, hd - r - sz * t]; } },
      { len: arc, fn: function (t) {
          var a = Math.PI + Math.PI / 2 * t;
          return [-hw + r + Math.cos(a) * r, -hd + r + Math.sin(a) * r];
      } }
    ];
    var perimeter = 0;
    segs.forEach(function (s) { perimeter += s.len; });
    var pts = [];
    for (var i = 0; i < n; i++) {
      var dist = perimeter * i / n;
      var acc = 0, seg = segs[0], t = 0;
      for (var j = 0; j < segs.length; j++) {
        if (dist <= acc + segs[j].len || j === segs.length - 1) {
          seg = segs[j];
          t = seg.len > 0 ? (dist - acc) / seg.len : 0;
          break;
        }
        acc += segs[j].len;
      }
      t = clamp(t, 0, 1);
      var p = seg.fn(t);
      pts.push({ x: p[0], z: p[1], u: i / n });
    }
    return pts;
  }

  /* 键帽两套本质不同的模具：
     - square：黑色键帽，高一点、顶部收得更小、倒角更利，表面有釉面高光
     - round ：红色键帽，矮一点、顶部更大更圆、哑光 PBT
     参考图中黑色键帽与红色键帽并不是同一套帽型。 */
  var CAP_PROFILES = {
    square: { topInset: 0.145, topRadius: 0.060, baseRadius: 0.100, fillet: 0.018, dish: 0.005, heightAdj: 0.006 },
    round:  { topInset: 0.075, topRadius: 0.118, baseRadius: 0.140, fillet: 0.052, dish: 0.016, heightAdj: -0.014 }
  };

  function buildTopGeometry(w, d, wallH, dish, rings, arcN, profile) {
    var THREE = window.THREE;
    profile = profile || CAP_PROFILES.square;
    var topW = w;
    var topD = d;
    var radius = Math.min(profile.topRadius, topW * 0.22, topD * 0.22);
    var positions = [], uvs = [], indices = [];
    rings = rings || 10;
    arcN = arcN || 64;
    var ringCount = rings - 1;
    for (var ri = 0; ri < ringCount; ri++) {
      var t = ri / (rings - 1);
      var s = 1 - smooth(t);
      if (s < 0.02) s = 0.02;
      var pts = roundedRectPoints(topW * s, topD * s, radius * s, arcN);
      var y = wallH - dish * smooth(t);
      for (var pi = 0; pi < pts.length; pi++) {
        var p = pts[pi];
        positions.push(p.x, y, p.z);
        uvs.push(clamp(p.x / topW + 0.5, 0, 1), clamp(p.z / topD + 0.5, 0, 1));
      }
    }
    var centerIndex = positions.length / 3;
    positions.push(0, wallH - dish, 0);
    uvs.push(0.5, 0.5);

    for (var ring = 0; ring < ringCount - 1; ring++) {
      for (var i = 0; i < arcN; i++) {
        var a = ring * arcN + i;
        var b = ring * arcN + (i + 1) % arcN;
        var c = (ring + 1) * arcN + i;
        var e = (ring + 1) * arcN + (i + 1) % arcN;
        indices.push(a, c, b, b, c, e);
      }
    }
    var last = (ringCount - 1) * arcN;
    for (var k = 0; k < arcN; k++) {
      indices.push(last + k, centerIndex, last + (k + 1) % arcN);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  function buildSideGeometry(w, d, wallH, capType, split, isRGB, profile) {
    var THREE = window.THREE;
    profile = profile || CAP_PROFILES.square;
    var topW = w - profile.topInset;
    var topD = d - profile.topInset;
    var baseR = Math.min(profile.baseRadius, w * 0.18, d * 0.18);
    var topR = Math.min(profile.topRadius, topW * 0.22, topD * 0.22);
    var fillet = profile.fillet;
    var arcN = 64;
    var rings = [
      { y: 0.004, w: w * 0.988, d: d * 0.988, r: baseR * 0.94, c: 0.58 },
      { y: 0.030, w: w, d: d, r: baseR, c: 0.78 },
      { y: wallH * 0.64, w: lerp(w, topW, 0.74), d: lerp(d, topD, 0.74), r: lerp(baseR, topR, 0.74), c: 0.92 },
      { y: wallH - fillet, w: topW + 0.012, d: topD + 0.012, r: topR + 0.007, c: 1.0 },
      { y: wallH - fillet * 0.38, w: topW + 0.004, d: topD + 0.004, r: topR + 0.002, c: 1.0 },
      { y: wallH, w: topW, d: topD, r: topR, c: 1.0 }
    ];
    var positions = [], uvs = [], colors = [], indices = [];
    var black = new THREE.Color(0x101116);
    var red = new THREE.Color(0x5e0d18);
    for (var ri = 0; ri < rings.length; ri++) {
      var ring = rings[ri];
      var pts = roundedRectPoints(ring.w, ring.d, ring.r, arcN);
      for (var pi = 0; pi < pts.length; pi++) {
        var p = pts[pi];
        positions.push(p.x, ring.y, p.z);
        uvs.push(pi / arcN, ring.y / wallH);
        var nx = clamp(p.x / (ring.w * 0.5), -1, 1);
        var nz = clamp(p.z / (ring.d * 0.5), -1, 1);
        var isRed = capType === "R";
        if (isRGB) isRed = false;
        if (!isRGB && capType === "S" && split) {
          var b = split.bias + split.slope * nx + split.wave * Math.sin(nx * 3.15 + split.phase);
          isRed = split.redBelow ? nz > b : nz < b;
        }
        var col = isRed ? red : black;
        var shade = ring.c;
        if (ri === 0) shade *= 0.82;
        colors.push(col.r * shade, col.g * shade, col.b * shade);
      }
    }
    for (var r = 0; r < rings.length - 1; r++) {
      for (var i = 0; i < arcN; i++) {
        var a = r * arcN + i;
        var b = r * arcN + (i + 1) % arcN;
        var c = (r + 1) * arcN + i;
        var e = (r + 1) * arcN + (i + 1) % arcN;
        indices.push(a, c, b, b, c, e);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  function mergeGeometries(geos) {
    var THREE = window.THREE;
    var totalV = 0, totalI = 0;
    geos.forEach(function (g) {
      totalV += g.attributes.position.count;
      totalI += g.index.count;
    });
    var pos = new Float32Array(totalV * 3);
    var nor = new Float32Array(totalV * 3);
    var uv = new Float32Array(totalV * 2);
    var col = new Float32Array(totalV * 3);
    var idx = new Uint32Array(totalI);
    var vo = 0, io = 0;
    geos.forEach(function (g) {
      var p = g.attributes.position.array;
      var n = g.attributes.normal.array;
      var u = g.attributes.uv.array;
      var c = g.attributes.color ? g.attributes.color.array : null;
      pos.set(p, vo * 3); nor.set(n, vo * 3); uv.set(u, vo * 2);
      if (c) col.set(c, vo * 3);
      var gi = g.index.array;
      for (var i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      vo += g.attributes.position.count;
      io += gi.length;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    out.setAttribute("color", new THREE.BufferAttribute(col, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }

  /* ======================================================================
     3. 键帽波浪纹贴图
     ====================================================================== */
  var PALETTE = {
    black: {
      top: "#18191e", mid: "#0b0c10", bottom: "#050608",
      line: "#e23b58", lineSoft: "rgba(226,59,88,.18)",
      grainLight: "rgba(255,255,255,.05)", grainDark: "rgba(0,0,0,.09)"
    },
    red: {
      top: "#5a0c18", mid: "#410811", bottom: "#24040a",
      line: "#050203", lineSoft: "rgba(5,2,3,.28)",
      grainLight: "rgba(255,255,255,.04)", grainDark: "rgba(0,0,0,.14)"
    }
  };

  function splitBoundaryY(W, H, split, x) {
    var nx = x / W;
    return H * (0.5 + split.bias + split.slope * (nx - 0.5) +
      split.wave * Math.sin(nx * Math.PI * 2.1 + split.phase));
  }

  function splitPath(W, H, split) {
    var p = new Path2D();
    p.moveTo(-10, splitBoundaryY(W, H, split, -10));
    for (var x = 0; x <= W + 10; x += Math.max(2, W / 90)) {
      p.lineTo(x, splitBoundaryY(W, H, split, x));
    }
    if (split.redBelow) {
      p.lineTo(W + 10, H + 10); p.lineTo(-10, H + 10);
    } else {
      p.lineTo(W + 10, -10); p.lineTo(-10, -10);
    }
    p.closePath();
    return p;
  }

  function drawWaveLines(ctx, W, H, color, alpha, rnd, weight, countBoost) {
    weight = weight || 1;
    countBoost = countBoost || 0;
    var count = Math.max(5, Math.min(22, Math.round(H / 46 + W / 220) + countBoost));
    var lw = Math.max(0.8, H / 330) * weight;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var i = 0; i < count; i++) {
      var base = (i + 0.35 + rnd() * 0.3) / count * H;
      var amp1 = H * (0.010 + rnd() * 0.020);
      var amp2 = H * (0.003 + rnd() * 0.010);
      var f1 = 0.8 + rnd() * 1.15;
      var f2 = 2.2 + rnd() * 2.1;
      var phase = rnd() * TAU;
      var slope = (rnd() - 0.5) * H * 0.085;
      var start = -W * 0.08;
      var end = W * 1.08;
      var steps = 34;
      ctx.beginPath();
      for (var s = 0; s <= steps; s++) {
        var x = lerp(start, end, s / steps);
        var nx = x / W;
        var y = base + slope * (nx - 0.5) +
          amp1 * Math.sin(nx * TAU * f1 + phase) +
          amp2 * Math.sin(nx * TAU * f2 + phase * 1.7);
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha * (0.68 + rnd() * 0.32) * 0.20;
      ctx.lineWidth = lw * 3.6;
      ctx.stroke();
      ctx.globalAlpha = alpha * (0.58 + rnd() * 0.32);
      ctx.lineWidth = lw * (0.72 + rnd() * 0.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  function makeKeyTexture(key, maxAniso, variant) {
    var isRGB = variant === "rgb";
    var H = 320;
    var aspect = clamp(key.capW / key.capD, 0.7, 7.2);
    var W = clamp(Math.round(H * aspect), 220, 1400);
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    var isRed = !isRGB && key.type === "R";
    var isSplit = !isRGB && key.type === "S";
    var pal = isRed ? PALETTE.red : PALETTE.black;
    var lineColor = pal.line;
    if (isRGB) {
      var hue = (key.row * 67 + key.index * 29 + 205) % 360;
      lineColor = "hsl(" + hue + ", 95%, 66%)";
    }
    var seed = hashStr(key.id + "|" + key.label + "|wave");
    var rnd = mulberry32(seed);

    // 底色：轻微纵向渐变 + 中心柔光
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.48, pal.mid);
    g.addColorStop(1, pal.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var rg = ctx.createRadialGradient(W * 0.48, H * 0.32, 0, W * 0.48, H * 0.42, Math.max(W, H) * 0.78);
    rg.addColorStop(0, "rgba(255,255,255,.028)");
    rg.addColorStop(0.48, "rgba(255,255,255,.008)");
    rg.addColorStop(1, "rgba(0,0,0,.08)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    // 撞色斜切（部分键帽）
    var redPath = null;
    if (isSplit) {
      redPath = splitPath(W, H, key.split);
      var rg2 = ctx.createLinearGradient(0, 0, W, H);
      rg2.addColorStop(0, PALETTE.red.top);
      rg2.addColorStop(1, PALETTE.red.bottom);
      ctx.save();
      ctx.clip(redPath);
      ctx.fillStyle = rg2;
      ctx.fillRect(0, 0, W, H);
      // 红色区域边缘微暗
      ctx.strokeStyle = "rgba(20,8,12,.32)";
      ctx.lineWidth = Math.max(2, H * 0.009);
      ctx.stroke(redPath);
      ctx.restore();

      // 黑区画红线
      var blackClip = new Path2D();
      blackClip.rect(0, 0, W, H);
      blackClip.addPath(redPath);
      ctx.save();
      ctx.clip(blackClip, "evenodd");
      drawWaveLines(ctx, W, H, PALETTE.black.line, 0.6, mulberry32(seed ^ 0x9e3779b9), 1.0, -1);
      ctx.restore();

      // 红区画黑线
      ctx.save();
      ctx.clip(redPath);
      drawWaveLines(ctx, W, H, PALETTE.red.line, 1.0, mulberry32(seed ^ 0x85ebca6b), 2.8, 3);
      ctx.restore();
    } else {
      drawWaveLines(ctx, W, H, lineColor, isRed ? 1.0 : 0.6, mulberry32(seed ^ 0x27d4eb2d), isRed ? 2.8 : 1.0, isRed ? 3 : -1);
    }

    // PBT 细颗粒
    ctx.save();
    var grains = Math.round(W * H / 480);
    for (var i = 0; i < grains; i++) {
      var gx = rnd() * W, gy = rnd() * H;
      ctx.fillStyle = rnd() > 0.52 ? pal.grainLight : pal.grainDark;
      ctx.globalAlpha = 0.45 + rnd() * 0.55;
      ctx.fillRect(gx, gy, 0.8 + rnd() * 1.5, 0.8 + rnd() * 1.5);
    }
    ctx.restore();

    // 边缘轻微压暗，让倒角更有层次
    var edge = ctx.createLinearGradient(0, 0, 0, H);
    edge.addColorStop(0, "rgba(0,0,0,.08)");
    edge.addColorStop(0.12, "rgba(0,0,0,0)");
    edge.addColorStop(0.86, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(0,0,0,.12)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
    var edgeX = ctx.createLinearGradient(0, 0, W, 0);
    edgeX.addColorStop(0, "rgba(0,0,0,.06)");
    edgeX.addColorStop(0.05, "rgba(0,0,0,0)");
    edgeX.addColorStop(0.95, "rgba(0,0,0,0)");
    edgeX.addColorStop(1, "rgba(0,0,0,.06)");
    ctx.fillStyle = edgeX;
    ctx.fillRect(0, 0, W, H);

    var tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    if (THREE.SRGBColorSpace && "colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso || 4;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function drawArrowGlyph(ctx, cx, cy, size, dir) {
    ctx.save();
    ctx.translate(cx, cy);
    if (dir === "left") ctx.rotate(-Math.PI / 2);
    if (dir === "right") ctx.rotate(Math.PI / 2);
    if (dir === "down") ctx.rotate(Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.lineTo(size * 0.55, size * 0.45);
    ctx.lineTo(0, size * 0.22);
    ctx.lineTo(-size * 0.55, size * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRgbLegend(ctx, W, H, label, key) {
    ctx.save();
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(210,232,255,.24)";
    ctx.shadowBlur = Math.max(2, H * 0.012);
    ctx.fillStyle = "#d9dbe4";
    if (!label) {
      // 空格：参考图是一条短横线
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#8b8f9b";
      ctx.fillRect(W * 0.40, H * 0.26, W * 0.20, Math.max(1.5, H * 0.007));
      ctx.restore();
      return;
    }
    if (label === "↑" || label === "↓" || label === "←" || label === "→") {
      ctx.shadowBlur = 0;
      drawArrowGlyph(ctx, W * 0.5, H * 0.30, Math.min(W, H) * 0.17,
        label === "↑" ? "up" : label === "↓" ? "down" : label === "←" ? "left" : "right");
      ctx.restore();
      return;
    }
    var wide = key.w > 1.35;
    if (wide) {
      var fs = Math.min(H * 0.115, W * 0.085);
      ctx.font = "700 " + Math.round(fs) + "px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, W * 0.5, H * 0.48);
    } else if (label.length === 2 && /^[0-9]/.test(label) && /[!@#$%^&*()_+]/.test(label[1])) {
      ctx.font = "700 " + Math.round(H * 0.185) + "px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(label[0], W * 0.09, H * 0.31);
      ctx.font = "600 " + Math.round(H * 0.10) + "px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(label[1], W * 0.09 + H * 0.11, H * 0.22);
    } else if (label.length === 2 && /^[\[\]\\;'.,\/=\-]/.test(label[0])) {
      ctx.font = "700 " + Math.round(H * 0.155) + "px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(label[0], W * 0.10, H * 0.31);
      ctx.font = "600 " + Math.round(H * 0.095) + "px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(label[1], W * 0.10 + H * 0.095, H * 0.23);
    } else if (/^(Esc|Tab|Caps|Ctrl|Alt|Fn|Win|Ins|Del|PgUp|PgDn)$/.test(label)) {
      var f2 = label.length > 3 ? Math.min(H * 0.095, W * 0.13) : Math.min(H * 0.13, W * 0.16);
      ctx.font = "700 " + Math.round(f2) + "px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, W * 0.5, H * 0.38);
    } else {
      var f3 = Math.min(H * 0.18, W * 0.19);
      ctx.font = "700 " + Math.round(f3) + "px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(label, W * 0.10, H * 0.31);
    }
    ctx.restore();
  }

  function makeRgbKeyTexture(key, maxAniso) {
    var H = 320;
    var aspect = clamp(key.capW / key.capD, 0.7, 7.2);
    var W = clamp(Math.round(H * aspect), 220, 1400);
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    var label = (RGB_LABELS[key.row] && RGB_LABELS[key.row][key.index] != null)
      ? RGB_LABELS[key.row][key.index] : key.label;

    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1e1f25");
    g.addColorStop(0.48, "#111217");
    g.addColorStop(1, "#07080b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var rg = ctx.createRadialGradient(W * 0.48, H * 0.30, 0, W * 0.48, H * 0.42, Math.max(W, H) * 0.8);
    rg.addColorStop(0, "rgba(255,255,255,.055)");
    rg.addColorStop(0.55, "rgba(255,255,255,.008)");
    rg.addColorStop(1, "rgba(0,0,0,.10)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    // PBT 细颗粒
    var rnd = mulberry32(hashStr(key.id + "|rgbcap"));
    for (var i = 0; i < Math.round(W * H / 560); i++) {
      ctx.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.09)";
      ctx.fillRect(rnd() * W, rnd() * H, 0.8 + rnd() * 1.4, 0.8 + rnd() * 1.4);
    }

    // 键帽下沿的 RGB 溢光，颜色按行列渐变
    var hue = (key.row * 70 + key.index * 23 + 300) % 360;
    var eg = ctx.createLinearGradient(0, H * 0.72, 0, H);
    eg.addColorStop(0, "hsla(" + hue + ",100%,60%,0)");
    eg.addColorStop(1, "hsla(" + hue + ",100%,62%,.20)");
    ctx.fillStyle = eg;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    // 顶部字符
    drawRgbLegend(ctx, W, H, label, key);

    // 边缘轻微压暗
    var edge = ctx.createLinearGradient(0, 0, 0, H);
    edge.addColorStop(0, "rgba(0,0,0,.10)");
    edge.addColorStop(0.12, "rgba(0,0,0,0)");
    edge.addColorStop(0.9, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(0,0,0,.14)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);

    var tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    if (THREE.SRGBColorSpace && "colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso || 4;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }


  /* ======================================================================
     4. 外壳 / 配件
     ====================================================================== */
  function roundedRectShape(w, d, r, asPath) {
    var THREE = window.THREE;
    var hw = w / 2, hd = d / 2;
    r = Math.max(0.001, Math.min(r, hw - 0.001, hd - 0.001));
    var s = asPath ? new THREE.Path() : new THREE.Shape();
    s.moveTo(-hw + r, -hd);
    s.lineTo(hw - r, -hd);
    s.quadraticCurveTo(hw, -hd, hw, -hd + r);
    s.lineTo(hw, hd - r);
    s.quadraticCurveTo(hw, hd, hw - r, hd);
    s.lineTo(-hw + r, hd);
    s.quadraticCurveTo(-hw, hd, -hw, hd - r);
    s.lineTo(-hw, -hd + r);
    s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    return s;
  }

  function extrudedRounded(w, d, r, height, bevel, mat) {
    var THREE = window.THREE;
    var shape = roundedRectShape(w, d, r);
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 20,
      steps: 1
    });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function makeBrushedMap() {
    var c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    var x = c.getContext("2d");
    x.fillStyle = "#808080"; x.fillRect(0, 0, c.width, c.height);
    var rnd = mulberry32(0xb10c0a);
    for (var i = 0; i < 5000; i++) {
      var y = rnd() * c.height;
      var len = 20 + rnd() * 240;
      var x0 = rnd() * c.width;
      var v = 110 + Math.floor(rnd() * 36);
      x.strokeStyle = "rgba(" + v + "," + v + "," + v + "," + (0.12 + rnd() * 0.25) + ")";
      x.lineWidth = 0.6;
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + len, y); x.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 2);
    return tex;
  }

  function roundRectCanvas(w, h, r, fill) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var x = c.getContext("2d");
    x.fillStyle = fill;
    x.beginPath();
    x.moveTo(r, 0); x.lineTo(w - r, 0); x.quadraticCurveTo(w, 0, w, r);
    x.lineTo(w, h - r); x.quadraticCurveTo(w, h, w - r, h);
    x.lineTo(r, h); x.quadraticCurveTo(0, h, 0, h - r);
    x.lineTo(0, r); x.quadraticCurveTo(0, 0, r, 0);
    x.closePath(); x.fill();
    return c;
  }

  function makeBottomLabelTexture() {
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 420;
    var x = c.getContext("2d");
    x.fillStyle = "#101116"; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#a91b35"; x.fillRect(0, 0, c.width, 12);
    x.strokeStyle = "rgba(255,255,255,.15)"; x.lineWidth = 2;
    x.strokeRect(22, 22, c.width - 44, c.height - 44);
    x.fillStyle = "#f3f3f5";
    x.font = "700 150px 'Segoe UI', Arial, sans-serif";
    x.fillText("CY68", 64, 210);
    x.fillStyle = "#c9203c";
    x.font = "700 38px 'Segoe UI', Arial, sans-serif";
    x.fillText("ANIME GEAR LAB", 70, 270);
    x.fillStyle = "#aeb0b9";
    x.font = "26px 'Segoe UI', Arial, sans-serif";
    x.fillText("65% MECHANICAL KEYBOARD  ·  68 KEYS", 70, 322);
    x.fillText("PBT DOUBLE-SHOT  ·  TYPE-C  ·  DESIGNED IN CHINA", 70, 360);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeNameplateTexture() {
    var c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    var x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = "#d7d8de";
    x.font = "700 54px 'Segoe UI', Arial, sans-serif";
    x.fillText("CY68", 18, 62);
    x.fillStyle = "#8c1528";
    x.fillRect(165, 18, 4, 48);
    x.fillStyle = "#6f717b";
    x.font = "600 22px 'Segoe UI', Arial, sans-serif";
    x.fillText("ANIME GEAR", 190, 48);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeFrontBadgeTexture() {
    var c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    var x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = "#c8cad1";
    x.font = "700 46px 'Segoe UI', Arial, sans-serif";
    x.fillText("CY68", 10, 58);
    x.fillStyle = "#891428";
    x.fillRect(142, 18, 3, 40);
    x.fillStyle = "#5d606a";
    x.font = "600 17px 'Segoe UI', Arial, sans-serif";
    x.fillText("CUSTOM SERIES", 160, 42);
    x.fillStyle = "#3e414a";
    x.font = "500 13px 'Segoe UI', Arial, sans-serif";
    x.fillText("65% / 68 KEYS", 160, 64);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  /* ======================================================================
     5. 键盘模型
     ====================================================================== */
  function addRgbUnderglow(root, keys) {
    var THREE = window.THREE;
    // 键帽下方 RGB 灯板
    var back = new THREE.Mesh(
      new THREE.PlaneGeometry(16.75, 5.18),
      new THREE.MeshBasicMaterial({
        map: makeRgbBacklightTexture(), transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    back.rotation.x = -Math.PI / 2;
    back.position.y = 0.012;
    back.renderOrder = 1;
    root.add(back);

    // 每颗轴体下方的独立 RGB 灯珠
    var ledGeo = new THREE.BoxGeometry(0.30, 0.012, 0.30);
    var ledMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var leds = new THREE.InstancedMesh(ledGeo, ledMat, keys.length);
    var dummy = new THREE.Object3D();
    keys.forEach(function (key, i) {
      dummy.position.set(key.x, 0.043, key.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      leds.setMatrixAt(i, dummy.matrix);
      var hue = ((key.row * 70 + key.index * 23 + 300) % 360) / 360;
      leds.setColorAt(i, new THREE.Color().setHSL(hue, 1, 0.55));
    });
    leds.instanceMatrix.needsUpdate = true;
    if (leds.instanceColor) leds.instanceColor.needsUpdate = true;
    leds.renderOrder = 2;
    root.add(leds);

    // 外壳边缘 RGB 灯带
    var stripTex = makeRgbStripTexture();
    var stripMat = new THREE.MeshBasicMaterial({
      map: stripTex, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide
    });
    var front = new THREE.Mesh(new THREE.PlaneGeometry(CASE_W - 0.28, 0.11), stripMat);
    front.position.set(0, -0.61, CASE_D / 2 + 0.006);
    root.add(front);
    var left = new THREE.Mesh(new THREE.PlaneGeometry(CASE_D - 0.30, 0.11), stripMat);
    left.rotation.y = -Math.PI / 2;
    left.position.set(-CASE_W / 2 - 0.006, -0.61, 0);
    root.add(left);
    var right = new THREE.Mesh(new THREE.PlaneGeometry(CASE_D - 0.30, 0.11), stripMat);
    right.rotation.y = Math.PI / 2;
    right.position.set(CASE_W / 2 + 0.006, -0.61, 0);
    root.add(right);

    // 上沿细灯带：对应参考图前唇和侧面的彩色反光
    var topFront = new THREE.Mesh(new THREE.PlaneGeometry(CASE_W - 0.28, 0.045), stripMat);
    topFront.position.set(0, -0.095, CASE_D / 2 + 0.006);
    root.add(topFront);
    var topLeft = new THREE.Mesh(new THREE.PlaneGeometry(CASE_D - 0.30, 0.045), stripMat);
    topLeft.rotation.y = -Math.PI / 2;
    topLeft.position.set(-CASE_W / 2 - 0.006, -0.095, 0);
    root.add(topLeft);
    var topRight = new THREE.Mesh(new THREE.PlaneGeometry(CASE_D - 0.30, 0.045), stripMat);
    topRight.rotation.y = Math.PI / 2;
    topRight.position.set(CASE_W / 2 + 0.006, -0.095, 0);
    root.add(topRight);

    // 彩色氛围光
    [[-7.0, 0.5, -1.2, 0xff2f9a, 1.1], [0, 0.5, 1.2, 0x46ff8a, 0.9], [7.0, 0.5, -1.0, 0x3d7bff, 1.2]].forEach(function (p) {
      var l = new THREE.PointLight(p[3], p[4], 11, 2);
      l.position.set(p[0], p[1], p[2]);
      root.add(l);
    });
  }

  function buildKeyboard(variant, renderer) {
    var THREE = window.THREE;
    var root = new THREE.Group();
    root.name = "CY68_Keyboard";
    var keys = buildKeyData();
    var isRGB = variant === "rgb";
    var maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;

    var brushed = makeBrushedMap();
    var caseMat = new THREE.MeshLambertMaterial({
      color: 0x181920
    });
    var frameMat = new THREE.MeshLambertMaterial({
      color: 0x14151b
    });
    var plateMat = new THREE.MeshLambertMaterial({
      color: 0x07080b
    });
    var darkMat = new THREE.MeshLambertMaterial({
      color: 0x040507
    });
    caseMat.bumpMap = brushed; caseMat.bumpScale = 0.004;
    frameMat.bumpMap = brushed; frameMat.bumpScale = 0.004;
    var metalMat = new THREE.MeshStandardMaterial({
      color: 0x2b2d34, metalness: 0.95, roughness: 0.28
    });
    var rubberMat = new THREE.MeshStandardMaterial({
      color: 0x070708, metalness: 0.0, roughness: 0.96
    });
    // r150 的 legacy 色彩模式不会自动把材质 hex 转为线性，手动转换，
    // 否则黑色外壳在强光下会发灰。
    [caseMat, frameMat, plateMat, darkMat, metalMat, rubberMat].forEach(function (m) {
      if (m.color && m.color.convertSRGBToLinear) m.color.convertSRGBToLinear();
    });

    // 底壳
    var body = extrudedRounded(CASE_W, CASE_D, 0.31, 0.57, 0.055, caseMat);
    body.position.y = -0.68;
    body.name = "CaseBody";
    root.add(body);

    // 顶部框体（带内孔）
    var frameShape = roundedRectShape(CASE_W - 0.015, CASE_D - 0.015, 0.31);
    var hole = roundedRectShape(16.98, 5.30, 0.16, true);
    frameShape.holes.push(hole);
    var frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.175, bevelEnabled: true, bevelThickness: 0.032,
      bevelSize: 0.032, bevelSegments: 3, curveSegments: 22, steps: 1
    });
    frameGeo.rotateX(-Math.PI / 2);
    frameGeo.computeVertexNormals();
    var frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = -0.115;
    frame.name = "CaseFrame";
    frame.castShadow = true; frame.receiveShadow = true;
    root.add(frame);

    // 外壳分层细线：深灰而不是镜面银，避免破坏黑化质感
    var trimShape = roundedRectShape(CASE_W + 0.002, CASE_D + 0.002, 0.312);
    trimShape.holes.push(roundedRectShape(CASE_W - 0.032, CASE_D - 0.032, 0.30, true));
    var trimGeo = new THREE.ExtrudeGeometry(trimShape, {
      depth: 0.010, bevelEnabled: false, curveSegments: 20, steps: 1
    });
    trimGeo.rotateX(-Math.PI / 2);
    var trim = new THREE.Mesh(trimGeo, new THREE.MeshLambertMaterial({ color: 0x24252c }));
    trim.position.y = -0.120;
    root.add(trim);

    // 前唇顶沿细线 / 指示灯
    var topEdge = new THREE.Mesh(
      new THREE.BoxGeometry(CASE_W - 0.10, 0.016, 0.018),
      new THREE.MeshLambertMaterial({ color: 0x30323a })
    );
    topEdge.position.set(0, -0.105, CASE_D / 2 + 0.002);
    root.add(topEdge);
    [0xff304d, 0xf3f4f8, 0xff304d].forEach(function (c, i) {
      var led = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.008, 14),
        new THREE.MeshBasicMaterial({ color: c })
      );
      led.position.set(6.35 + i * 0.25, 0.066, 2.80);
      root.add(led);
    });

    // 键区内沿保持深色倒角，不使用高反光金属条，避免抢视觉

    // 内凹定位板
    var plate = extrudedRounded(17.15, 5.45, 0.19, 0.07, 0.012, plateMat);
    plate.position.y = -0.075;
    plate.name = "Plate";
    root.add(plate);

    // 定位板边缘红色细线（非常克制）
    var accentLine = new THREE.Mesh(
      new THREE.BoxGeometry(16.93, 0.012, 0.014),
      new THREE.MeshBasicMaterial({ color: 0x7c1021 })
    );
    accentLine.position.set(0, 0.002, 2.66);
    root.add(accentLine);

    // 键帽
    var sideBuckets = { black: [], red: [], split: [], rgb: [] };
    var capGroup = new THREE.Group();
    capGroup.name = "Keycaps";
    var switchPositions = [];
    var stabKeys = [];

    keys.forEach(function (key) {
      var isRedKey = !isRGB && key.type === "R";
      var profile = isRGB ? CAP_PROFILES.round : (isRedKey ? CAP_PROFILES.round : CAP_PROFILES.square);
      var wallH = key.height + profile.heightAdj;
      var topW = key.w - profile.topInset;
      var topD = key.d - profile.topInset;
      var topGeo = buildTopGeometry(
        topW, topD, wallH, profile.dish, 10, 64, profile
      );
      var tex = isRGB ? makeRgbKeyTexture(key, maxAniso) : makeKeyTexture(key, maxAniso, variant);
      var mat;
      if (isRGB) {
        mat = new THREE.MeshLambertMaterial({
          map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.11
        });
      } else if (isRedKey) {
        mat = new THREE.MeshLambertMaterial({
          map: tex,
          color: 0x8a8a8a
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.38, metalness: 0.06,
          envMapIntensity: 0.28
        });
      }
      var m = new THREE.Matrix4();
      m.makeRotationX(key.tilt);
      m.setPosition(key.x, CAP_BASE_Y, key.z);
      topGeo.applyMatrix4(m);
      var topMesh = new THREE.Mesh(topGeo, mat);
      topMesh.name = "key-" + key.id + "-" + key.type;
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      capGroup.add(topMesh);

      var side = buildSideGeometry(
        key.w, key.d, wallH, isRGB ? "B" : key.type, key.split, isRGB, profile
      );
      side.applyMatrix4(m);
      var sideFinish = isRGB ? "rgb" : (key.type === "R" ? "red" : (key.type === "S" ? "split" : "black"));
      sideBuckets[sideFinish].push(side);

      switchPositions.push([key.x, key.z]);
      if (key.w > 1.6) stabKeys.push(key);
    });

    var sideMats = {
      black: new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.4, metalness: 0.05, envMapIntensity: 0.22
      }),
      red: new THREE.MeshLambertMaterial({
        vertexColors: true
      }),
      split: new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.55, metalness: 0.03, envMapIntensity: 0.16
      }),
      rgb: new THREE.MeshLambertMaterial({
        vertexColors: true
      })
    };
    Object.keys(sideBuckets).forEach(function (finish) {
      var geos = sideBuckets[finish];
      if (!geos.length) return;
      var sideGeo = mergeGeometries(geos);
      var sideMesh = new THREE.Mesh(sideGeo, sideMats[finish]);
      sideMesh.name = "KeycapSides-" + finish;
      sideMesh.castShadow = true;
      sideMesh.receiveShadow = true;
      capGroup.add(sideMesh);
    });
    root.add(capGroup);

    // 轴体上盖（InstancedMesh）
    var housingGeo = new THREE.BoxGeometry(0.385, 0.115, 0.385);
    var housingMat = new THREE.MeshStandardMaterial({
      color: 0x040507, metalness: 0.02, roughness: 0.72
    });
    var housings = new THREE.InstancedMesh(housingGeo, housingMat, switchPositions.length);
    var stemGeo = new THREE.BoxGeometry(0.19, 0.052, 0.075);
    var stemGeo2 = new THREE.BoxGeometry(0.075, 0.052, 0.19);
    var stemMat = new THREE.MeshStandardMaterial({
      color: isRGB ? 0x7b2dff : 0x8e1c2e, roughness: 0.4, metalness: 0.1,
      emissive: isRGB ? 0x2a0070 : 0x250008, emissiveIntensity: isRGB ? 0.55 : 0.25
    });
    var stems = new THREE.InstancedMesh(stemGeo, stemMat, switchPositions.length);
    var stems2 = new THREE.InstancedMesh(stemGeo2, stemMat, switchPositions.length);
    var dummy = new THREE.Object3D();
    switchPositions.forEach(function (p, i) {
      dummy.position.set(p[0], 0.055, p[1]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      housings.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p[0], 0.108, p[1]);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      stems2.setMatrixAt(i, dummy.matrix);
    });
    housings.instanceMatrix.needsUpdate = true;
    stems.instanceMatrix.needsUpdate = true;
    stems2.instanceMatrix.needsUpdate = true;
    housings.castShadow = false; housings.receiveShadow = true;
    stems.castShadow = false; stems.receiveShadow = true;
    root.add(housings); root.add(stems); root.add(stems2);

    // 大键卫星轴钢丝
    var stabMat = new THREE.MeshStandardMaterial({ color: 0x5f6168, metalness: 0.9, roughness: 0.35 });
    stabKeys.forEach(function (key) {
      var len = Math.min(key.w * 0.58, key.w - 0.55);
      var wire = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 8), stabMat);
      wire.rotation.z = Math.PI / 2;
      wire.position.set(key.x, 0.072, key.z - 0.23);
      root.add(wire);
      var wire2 = wire.clone();
      wire2.position.z = key.z + 0.23;
      root.add(wire2);
    });

    // 底壳内嵌面板
    var bottomPanel = extrudedRounded(17.15, 5.36, 0.22, 0.028, 0.008,
      new THREE.MeshStandardMaterial({ color: 0x24262e, metalness: 0.35, roughness: 0.68 }));
    bottomPanel.position.y = -0.708;
    bottomPanel.name = "BottomPanel";
    root.add(bottomPanel);

    // 底部金属配重
    var weightMat = new THREE.MeshStandardMaterial({
      color: 0x3a3d45, metalness: 0.9, roughness: 0.32, envMapIntensity: 0.6
    });
    var weight = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.025, 2.2), weightMat);
    weight.position.set(0, -0.719, -1.18);
    root.add(weight);
    var weightLine = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.004, 0.018),
      new THREE.MeshBasicMaterial({ color: 0x7c1021 }));
    weightLine.position.set(0, -0.733, -1.18);
    root.add(weightLine);

    // 底部脚垫
    var footGeo = new THREE.CylinderGeometry(0.19, 0.21, 0.052, 20);
    [[-7.9, -2.5], [7.9, -2.5], [-7.9, 2.5], [7.9, 2.5], [0, -2.6], [0, 2.6]].forEach(function (p) {
      var f = new THREE.Mesh(footGeo, rubberMat);
      f.position.set(p[0], -0.740, p[1]);
      f.castShadow = false; f.receiveShadow = true;
      root.add(f);
    });

    // 底壳螺丝
    var screwGeo = new THREE.CylinderGeometry(0.072, 0.082, 0.022, 6);
    var screwSlotMat = new THREE.MeshBasicMaterial({ color: 0x020203 });
    [[-7.55, -2.15], [7.55, -2.15], [-7.55, 2.15], [7.55, 2.15], [-2.8, -2.55], [2.8, 2.55]].forEach(function (p) {
      var s = new THREE.Mesh(screwGeo, metalMat);
      s.position.set(p[0], -0.712, p[1]);
      root.add(s);
      var slot = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.004, 0.014), screwSlotMat);
      slot.position.set(p[0], -0.724, p[1]);
      root.add(slot);
    });

    // 底部铭牌
    var labelTex = makeBottomLabelTexture();
    var labelGeo = new THREE.PlaneGeometry(4.7, 1.93);
    var labelMat = new THREE.MeshBasicMaterial({
      map: labelTex, color: 0xb9b9b9, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    var label = new THREE.Mesh(labelGeo, labelMat);
    label.rotation.x = Math.PI / 2;
    label.position.set(0, -0.725, 1.15);
    label.renderOrder = 3;
    root.add(label);

    // 顶部铭牌
    var nameTex = makeNameplateTexture();
    var nameMat = new THREE.MeshBasicMaterial({
      map: nameTex, transparent: true, depthWrite: false
    });
    var name = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), nameMat);
    name.rotation.x = -Math.PI / 2;
    name.position.set(6.55, 0.073, 2.70);
    root.add(name);

    // 前唇小铭牌
    var frontTex = makeFrontBadgeTexture();
    var frontBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(1.46, 0.274),
      new THREE.MeshBasicMaterial({ map: frontTex, transparent: true, opacity: 0.9, depthWrite: false })
    );
    frontBadge.position.set(6.65, -0.20, CASE_D / 2 + 0.006);
    root.add(frontBadge);
    var frontPin = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.016, 0.012),
      new THREE.MeshBasicMaterial({ color: 0x6f1020 })
    );
    frontPin.position.set(6.65, -0.32, CASE_D / 2 + 0.006);
    root.add(frontPin);

    // Type-C 接口（背部）
    var portPlate = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.26, 0.055), metalMat);
    portPlate.position.set(0, -0.34, -CASE_D / 2 + 0.005);
    root.add(portPlate);
    var portInner = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.105, 0.07), darkMat);
    portInner.position.set(0, -0.34, -CASE_D / 2 - 0.010);
    root.add(portInner);
    var portFloor = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.055, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x9d7b4c, metalness: 0.8, roughness: 0.3 }));
    portFloor.position.set(0, -0.34, -CASE_D / 2 - 0.028);
    root.add(portFloor);

    // 侧面固定螺丝
    var sideScrewGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.016, 12);
    [[-1, -1.65], [-1, 1.65], [1, -1.65], [1, 1.65]].forEach(function (p) {
      var ss = new THREE.Mesh(sideScrewGeo, metalMat);
      ss.rotation.z = Math.PI / 2;
      ss.position.set(p[0] * (CASE_W / 2 + 0.002), -0.44, p[1]);
      root.add(ss);
    });

    // 背部电源开关（细节）
    var powerSwitch = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x111217 }));
    powerSwitch.position.set(-7.0, -0.32, -CASE_D / 2 - 0.012);
    root.add(powerSwitch);
    var powerKnob = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.075),
      new THREE.MeshLambertMaterial({ color: 0x2a2b32 }));
    powerKnob.position.set(-7.12, -0.32, -CASE_D / 2 - 0.025);
    root.add(powerKnob);

    // 底部 RGB 氛围（RGB 版本）
    if (isRGB) {
      addRgbUnderglow(root, keys);
    }

    root.userData.bounds = new THREE.Box3().setFromObject(root);
    root.userData.keys = keys;
    return root;
  }

  /* ======================================================================
     6. 摄影棚环境
     ====================================================================== */
  function makeStudioEnv(renderer) {
    var THREE = window.THREE;
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    var x = c.getContext("2d");
    var bg = x.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, "#14151a");
    bg.addColorStop(0.45, "#08090c");
    bg.addColorStop(1, "#020203");
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);

    function softBox(cx, cy, w, h, color, alpha) {
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
      g.addColorStop(0, "rgba(" + color + "," + alpha + ")");
      g.addColorStop(0.45, "rgba(" + color + "," + (alpha * 0.62) + ")");
      g.addColorStop(1, "rgba(" + color + ",0)");
      x.save();
      x.translate(cx, cy);
      x.scale(w / Math.max(w, h), h / Math.max(w, h));
      x.translate(-cx, -cy);
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, Math.max(w, h), 0, TAU);
      x.fill();
      x.restore();
    }
    softBox(170, 180, 280, 190, "255,245,235", 0.95);
    softBox(830, 140, 240, 150, "220,235,255", 0.8);
    softBox(510, 20, 360, 80, "255,255,255", 0.85);
    softBox(80, 430, 180, 110, "255,80,105", 0.26);
    softBox(900, 430, 190, 110, "100,150,255", 0.22);

    var tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    var pmrem = new THREE.PMREMGenerator(renderer);
    var rt = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();
    return rt.texture;
  }

  function makeFloorTexture() {
    var THREE = window.THREE;
    var c = document.createElement("canvas");
    c.width = c.height = 1024;
    var x = c.getContext("2d");
    x.fillStyle = "#08090d"; x.fillRect(0, 0, 1024, 1024);
    var g = x.createRadialGradient(512, 430, 10, 512, 512, 250);
    g.addColorStop(0, "#4b4e59");
    g.addColorStop(0.34, "#30323b");
    g.addColorStop(0.66, "#161820");
    g.addColorStop(1, "#090a0e");
    x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeContactShadowTexture() {
    var THREE = window.THREE;
    var c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    var x = c.getContext("2d");
    var g = x.createRadialGradient(256, 128, 10, 256, 128, 250);
    g.addColorStop(0, "rgba(0,0,0,.85)");
    g.addColorStop(0.45, "rgba(0,0,0,.45)");
    g.addColorStop(0.8, "rgba(0,0,0,.1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.save();
    x.scale(1, 0.5);
    x.beginPath(); x.arc(256, 256, 250, 0, TAU); x.fill();
    x.restore();
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function makeRgbBacklightTexture() {
    var THREE = window.THREE;
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    var x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "lighter";
    function blob(cx, cy, r, color) {
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color);
      g.addColorStop(0.42, color.replace(/[\d.]+\)$/, "0.5)"));
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
    }
    blob(130, 100, 240, "rgba(255,47,154,.95)");
    blob(390, 70, 230, "rgba(255,120,35,.85)");
    blob(610, 180, 220, "rgba(68,255,120,.82)");
    blob(870, 300, 230, "rgba(45,220,255,.9)");
    blob(520, 450, 260, "rgba(65,100,255,.9)");
    blob(980, 100, 160, "rgba(168,66,255,.8)");
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    if (THREE.SRGBColorSpace && "colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeRgbStripTexture() {
    var THREE = window.THREE;
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 64;
    var x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, "#ff2f9a");
    g.addColorStop(0.18, "#ff7a2a");
    g.addColorStop(0.36, "#ffe33d");
    g.addColorStop(0.55, "#47ff8b");
    g.addColorStop(0.72, "#2fe6ff");
    g.addColorStop(0.88, "#496bff");
    g.addColorStop(1, "#b14bff");
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    if (THREE.SRGBColorSpace && "colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeRgbPoolTexture() {
    var THREE = window.THREE;
    var c = document.createElement("canvas");
    c.width = 768; c.height = 384;
    var x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "lighter";
    function blob(cx, cy, r, color) {
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
    }
    blob(130, 210, 210, "rgba(255,47,154,.55)");
    blob(360, 160, 210, "rgba(255,125,32,.42)");
    blob(470, 220, 200, "rgba(68,255,120,.36)");
    blob(650, 220, 220, "rgba(45,170,255,.55)");
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    if (THREE.SRGBColorSpace && "colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildScene(variant) {
    var THREE = window.THREE;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(31, 1, 0.1, 220);
    var renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.setClearColor(0x000000, 0);

    scene.environment = makeStudioEnv(renderer);
    scene.fog = new THREE.Fog(0x08090d, 42, 105);

    var model = buildKeyboard(variant, renderer);
    scene.add(model);

    var hemi = new THREE.HemisphereLight(0xdfe7ff, 0x08070a, 0.28);
    scene.add(hemi);
    var ambient = new THREE.AmbientLight(0xffffff, 0.58);
    scene.add(ambient);

    var keyLight = new THREE.DirectionalLight(0xfff2ec, 3.0);
    keyLight.position.set(11, 22, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 70;
    keyLight.shadow.camera.left = -13;
    keyLight.shadow.camera.right = 13;
    keyLight.shadow.camera.top = 11;
    keyLight.shadow.camera.bottom = -11;
    keyLight.shadow.bias = -0.00035;
    keyLight.shadow.normalBias = 0.018;
    scene.add(keyLight);

    var fill = new THREE.DirectionalLight(0xe8eeff, 0.9);
    fill.position.set(-15, 9, 7);
    scene.add(fill);

    var rimRed = new THREE.PointLight(0xff294d, 1.4, 24, 2);
    rimRed.position.set(-10, 3.2, -6.5);
    scene.add(rimRed);
    var rimBlue = new THREE.PointLight(0x5a8dff, 0.7, 22, 2);
    rimBlue.position.set(11, 4.5, -5);
    scene.add(rimBlue);

    // 正面/侧后方轮廓光：让黑色外壳与键帽层次更清楚
    var frontLight = new THREE.DirectionalLight(0xffffff, 0.6);
    frontLight.position.set(-2, 3.5, 14);
    scene.add(frontLight);
    var rimRed2 = new THREE.DirectionalLight(0xff3d5e, 0.85);
    rimRed2.position.set(-13, 5, -7);
    scene.add(rimRed2);

    // 底部补光：转到仰视时能看清铭牌、螺丝与脚垫
    var underLight = new THREE.DirectionalLight(0xcdd8ff, 1.6);
    underLight.position.set(0, -8, 2.5);
    scene.add(underLight);


    // 地面
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({
        map: makeFloorTexture(), roughness: 0.54, metalness: 0.18,
        envMapIntensity: 0.45
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.775;
    floor.receiveShadow = true;
    floor.name = "StudioFloor";
    scene.add(floor);

    var contact = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 8.5),
      new THREE.MeshBasicMaterial({
        map: makeContactShadowTexture(), transparent: true,
        opacity: 0.72, depthWrite: false
      })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = -0.768;
    contact.name = "ContactShadow";
    contact.renderOrder = 2;
    scene.add(contact);

    // RGB 版本：桌面上的彩色溢光
    var glowPool = null;
    if (variant === "rgb") {
      glowPool = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 10.5),
        new THREE.MeshBasicMaterial({
          map: makeRgbPoolTexture(), transparent: true, opacity: 0.62,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      glowPool.rotation.x = -Math.PI / 2;
      glowPool.position.set(0, -0.771, 0.5);
      glowPool.renderOrder = 1;
      glowPool.name = "RgbFloorPool";
      scene.add(glowPool);
    }

    var box = new THREE.Box3().setFromObject(model);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    return {
      scene: scene, camera: camera, renderer: renderer,
      model: model, floor: floor, contact: contact, glowPool: glowPool,
      size: size, center: center
    };
  }

  /* ======================================================================
     7. 交互 Viewer
     ====================================================================== */
  var VIEW_PRESETS = {
    hero:   { yaw: -0.30, pitch: 0.94, zoom: 1.02 },
    front:  { yaw: 0.0, pitch: 0.30, zoom: 1.0 },
    side:   { yaw: -1.12, pitch: 0.30, zoom: 0.92 },
    top:    { yaw: 0.0, pitch: 1.45, zoom: 0.95 },
    bottom: { yaw: 0.0, pitch: -1.34, zoom: 1.08 },
    low:    { yaw: -0.52, pitch: -0.05, zoom: 0.95 }
  };

  function createViewer(container, options) {
    options = options || {};
    var THREE = window.THREE;
    var built = buildScene(options.variant === "rgb" ? "rgb" : "blackred");
    var scene = built.scene;
    var camera = built.camera;
    var renderer = built.renderer;
    var model = built.model;
    var floor = built.floor;
    var contact = built.contact;
    var glowPool = built.glowPool;

    var oldCanvas = container.querySelector("canvas");
    if (oldCanvas) oldCanvas.remove();
    var stage = document.createElement("div");
    stage.className = "k3d-stage";
    stage.tabIndex = 0;
    stage.setAttribute("aria-label", "CY68 键盘 3D 模型，可拖动旋转");
    container.appendChild(stage);
    stage.appendChild(renderer.domElement);

    var state = {
      yaw: VIEW_PRESETS.hero.yaw,
      pitch: VIEW_PRESETS.hero.pitch,
      zoom: 1,
      targetYaw: VIEW_PRESETS.hero.yaw,
      targetPitch: VIEW_PRESETS.hero.pitch,
      targetZoom: 1,
      baseDist: 24,
      minZoom: 0.62,
      maxZoom: 2.3,
      autoRotate: options.autoRotate !== false,
      autoPaused: false,
      resumeAt: 0,
      dragging: false,
      pointers: new Map(),
      lastX: 0, lastY: 0, lastPinch: 0,
      userInteracted: false,
      disposed: false,
      raf: 0,
      lastT: performance.now(),
      width: 1, height: 1,
      target: new THREE.Vector3(0, 0.02, 0)
    };

    var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

    function computeFit() {
      var vfov = camera.fov * Math.PI / 180;
      var hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.max(camera.aspect, 0.2));
      var maxPlan = Math.max(built.size.x, built.size.z);
      var fitW = (maxPlan * 0.5 + 0.22) / Math.tan(hfov / 2);
      var fitH = (built.size.z * 0.5 + 0.22) / Math.tan(vfov / 2);
      var narrow = camera.aspect < 1.0 ? 1.12 : (camera.aspect < 1.25 ? 1.06 : 1.0);
      state.baseDist = Math.max(fitW, fitH) * 1.10 * narrow;
      state.target.set(0, 0.02, 0);
    }

    function resize() {
      var w = container.clientWidth || 1;
      var h = container.clientHeight || 1;
      state.width = w; state.height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      computeFit();
    }

    function applyCamera() {
      var r = state.baseDist * state.zoom;
      var cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      camera.position.set(
        state.target.x + r * cp * Math.sin(state.yaw),
        state.target.y + r * sp,
        state.target.z + r * cp * Math.cos(state.yaw)
      );
      camera.lookAt(state.target);
      // 从下方观看时隐藏地面，避免遮挡
      var below = camera.position.y < -0.72;
      floor.visible = !below;
      contact.visible = !below;
      if (glowPool) glowPool.visible = !below;
      // 近距离/低角度时，让地面阴影淡出
      var fade = clamp((camera.position.y + 0.7) / 2.2, 0, 1);
      contact.material.opacity = 0.72 * fade;
    }

    function tick(now) {
      if (state.disposed) return;
      state.raf = requestAnimationFrame(tick);
      var dt = Math.min((now - state.lastT) / 1000, 0.05);
      state.lastT = now;

      if (state.autoRotate && !state.autoPaused && !state.dragging && now > state.resumeAt && !reduce) {
        state.targetYaw += dt * 0.11;
      }
      state.yaw += (state.targetYaw - state.yaw) * 0.12;
      state.pitch += (state.targetPitch - state.pitch) * 0.12;
      state.zoom += (state.targetZoom - state.zoom) * 0.12;
      applyCamera();
      renderer.render(scene, camera);
    }

    function markInteract() {
      state.userInteracted = true;
      state.autoPaused = true;
      state.resumeAt = performance.now() + 4800;
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
      try { if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId); } catch (err) {}
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 1) {
        state.dragging = true;
        state.lastX = e.clientX; state.lastY = e.clientY;
        stage.classList.add("grabbing");
        markInteract();
      } else if (state.pointers.size === 2) {
        var pts = Array.from(state.pointers.values());
        state.lastPinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!state.pointers.has(e.pointerId)) return;
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 2) {
        var pts = Array.from(state.pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (state.lastPinch > 0) {
          state.targetZoom = clamp(state.targetZoom * (state.lastPinch / Math.max(d, 1)), state.minZoom, state.maxZoom);
        }
        state.lastPinch = d;
        markInteract();
        return;
      }
      if (!state.dragging) return;
      var dx = e.clientX - state.lastX;
      var dy = e.clientY - state.lastY;
      state.targetYaw -= dx * 0.0062;
      state.targetPitch = clamp(state.targetPitch + dy * 0.0048, -1.45, 1.45);
      state.lastX = e.clientX; state.lastY = e.clientY;
      markInteract();
      e.preventDefault();
    }

    function endPointer(e) {
      state.pointers.delete(e.pointerId);
      if (state.pointers.size === 0) {
        state.dragging = false;
        state.lastPinch = 0;
        stage.classList.remove("grabbing");
      } else if (state.pointers.size === 1) {
        var p = Array.from(state.pointers.values())[0];
        state.lastX = p.x; state.lastY = p.y;
      }
    }

    function onWheel(e) {
      e.preventDefault();
      state.targetZoom = clamp(state.targetZoom * (1 + e.deltaY * 0.0011), state.minZoom, state.maxZoom);
      markInteract();
    }

    function onDoubleClick() { reset(); }

    function reset() {
      setView(options.initialView || "hero");
      state.autoPaused = false;
      state.resumeAt = 0;
      stage.classList.remove("grabbing");
    }

    function snap() {
      state.yaw = state.targetYaw;
      state.pitch = state.targetPitch;
      state.zoom = state.targetZoom;
      applyCamera();
      renderer.render(scene, camera);
    }

    function setView(name) {
      var v = typeof name === "string" ? VIEW_PRESETS[name] || VIEW_PRESETS.hero : name;
      if (!v) return;
      state.targetYaw = v.yaw;
      state.targetPitch = v.pitch;
      state.targetZoom = v.zoom == null ? 1 : v.zoom;
      state.autoPaused = true;
      state.resumeAt = performance.now() + 9000;
      if (v.yaw !== undefined && Math.abs(v.yaw - state.yaw) > Math.PI) {
        // 选择更短的旋转路径
        state.targetYaw = v.yaw + Math.round((state.yaw - v.yaw) / TAU) * TAU;
      }
    }

    function setAutoRotate(on) {
      state.autoRotate = !!on;
      if (on) { state.autoPaused = false; state.resumeAt = 0; }
    }

    function toggleAutoRotate() {
      setAutoRotate(!state.autoRotate);
      return state.autoRotate;
    }

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", endPointer);
    stage.addEventListener("pointercancel", endPointer);
    stage.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse" && state.pointers.has(e.pointerId)) endPointer(e);
    });
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("dblclick", onDoubleClick);

    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(resize);
      ro.observe(container);
    } else {
      window.addEventListener("resize", resize);
    }

    // 初始尺寸 / 相机
    resize();
    state.yaw = VIEW_PRESETS.hero.yaw;
    state.pitch = VIEW_PRESETS.hero.pitch;
    state.zoom = 0.98;
    state.targetZoom = 0.98;
    applyCamera();
    renderer.render(scene, camera);

    state.raf = requestAnimationFrame(tick);

    var viewer = {
      container: container,
      stage: stage,
      scene: scene,
      camera: camera,
      renderer: renderer,
      model: model,
      state: state,
      reset: reset,
      snap: snap,
      setView: setView,
      setAutoRotate: setAutoRotate,
      toggleAutoRotate: toggleAutoRotate,
      isAutoRotating: function () { return state.autoRotate && !state.autoPaused; },
      dispose: function () {
        if (state.disposed) return;
        state.disposed = true;
        cancelAnimationFrame(state.raf);
        if (ro) ro.disconnect();
        else window.removeEventListener("resize", resize);
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerup", endPointer);
        stage.removeEventListener("pointercancel", endPointer);
        stage.removeEventListener("wheel", onWheel);
        stage.removeEventListener("dblclick", onDoubleClick);
        scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(function (m) {
              if (m.map) m.map.dispose();
              if (m.bumpMap) m.bumpMap.dispose();
              m.dispose();
            });
          }
        });
        if (scene.environment && scene.environment.dispose) scene.environment.dispose();
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      }
    };
    return viewer;
  }

  /* ======================================================================
     8. HUD / 弹窗
     ====================================================================== */
  var cssInjected = false;
  function injectCSS() {
    if (cssInjected || document.getElementById("k3d-style")) { cssInjected = true; return; }
    cssInjected = true;
    var css = `
    .k3d-stage{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none;outline:none}
    .k3d-stage.grabbing{cursor:grabbing}
    .k3d-stage canvas{display:block;width:100%;height:100%}
    .k3d-hud{position:absolute;inset:0;pointer-events:none;z-index:5;font-family:inherit}
    .k3d-badge{position:absolute;left:18px;top:18px;display:flex;align-items:center;gap:9px;
      padding:8px 13px;border-radius:999px;background:rgba(8,9,14,.68);border:1px solid rgba(255,255,255,.13);
      color:#edf0f8;font-size:12px;letter-spacing:.04em;backdrop-filter:blur(10px);box-shadow:0 8px 30px rgba(0,0,0,.25)}
    .k3d-badge i{width:7px;height:7px;border-radius:50%;background:#ff3557;box-shadow:0 0 12px #ff3557;display:block}
    .k3d-badge b{font-weight:700;color:#fff}
    .k3d-badge span{color:#8e94a8}
    .k3d-help{position:absolute;right:18px;top:18px;padding:8px 12px;border-radius:999px;
      background:rgba(8,9,14,.55);border:1px solid rgba(255,255,255,.1);color:#9ba2b5;font-size:11.5px;
      backdrop-filter:blur(8px);letter-spacing:.02em}
    .k3d-views{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:5px;
      padding:5px;border-radius:999px;background:rgba(8,9,14,.72);border:1px solid rgba(255,255,255,.12);
      backdrop-filter:blur(12px);pointer-events:auto;box-shadow:0 10px 30px rgba(0,0,0,.3)}
    .k3d-views button{border:0;background:transparent;color:#aab0c2;font:inherit;font-size:11.5px;
      padding:7px 11px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:.18s}
    .k3d-views button:hover{color:#fff;background:rgba(255,255,255,.08)}
    .k3d-views button.on{color:#fff;background:linear-gradient(135deg,#e42645,#8f1cff);box-shadow:0 4px 14px rgba(228,38,69,.32)}
    .k3d-zoombar{position:absolute;right:18px;bottom:18px;display:flex;gap:6px;pointer-events:auto}
    .k3d-zoombar button{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.16);
      background:rgba(8,9,14,.72);color:#e7eaf2;font:inherit;font-size:17px;line-height:1;cursor:pointer;
      backdrop-filter:blur(10px);transition:.18s}
    .k3d-zoombar button:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.35)}
    .k3d-zoombar button.auto{width:auto;padding:0 13px;border-radius:999px;font-size:11px;letter-spacing:.04em;
      display:flex;align-items:center;gap:6px}
    .k3d-zoombar button.auto i{width:6px;height:6px;border-radius:50%;background:#5b6070;transition:.2s}
    .k3d-zoombar button.auto.on i{background:#ff3557;box-shadow:0 0 10px #ff3557}
    .k3d-zoombar button.auto.on{color:#fff;border-color:rgba(255,53,87,.55);background:rgba(255,53,87,.14)}
    @media (max-width:760px){
      .k3d-badge{left:10px;top:10px;padding:6px 10px;font-size:10.5px;gap:6px}
      .k3d-help{display:none}
      .k3d-views{left:10px;right:10px;bottom:10px;transform:none;width:auto;justify-content:center;gap:2px;padding:4px;overflow:auto}
      .k3d-views button{padding:6px 7px;font-size:10.5px}
      .k3d-zoombar{right:10px;bottom:55px;gap:4px}
      .k3d-zoombar button{width:30px;height:30px;font-size:15px}
      .k3d-zoombar button.auto{padding:0 8px;font-size:9px;gap:4px;width:auto}
      .k3d-zoombar button.auto i{width:8px;height:8px}
    }
    .k3d-mask{position:fixed;inset:0;z-index:260;display:none;align-items:center;justify-content:center;
      background:rgba(3,4,8,.82);backdrop-filter:blur(10px);padding:22px;opacity:0;transition:opacity .24s ease}
    .k3d-mask.on{display:flex;opacity:1}
    .k3d-box{width:min(1100px,96vw);height:min(780px,92vh);display:flex;flex-direction:column;
      background:linear-gradient(180deg,#151821,#08090e 65%);border:1px solid rgba(255,255,255,.13);
      border-radius:22px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.75),0 0 80px rgba(255,53,87,.08);
      transform:translateY(12px) scale(.985);transition:transform .3s cubic-bezier(.2,.8,.2,1)}
    .k3d-mask.on .k3d-box{transform:none}
    .k3d-head{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08);
      background:linear-gradient(90deg,rgba(255,53,87,.06),transparent 45%)}
    .k3d-title{display:flex;align-items:center;gap:11px;min-width:0}
    .k3d-title .mark{width:9px;height:9px;border-radius:50%;background:#ff3557;box-shadow:0 0 14px #ff3557;flex:0 0 auto}
    .k3d-title strong{display:block;font-size:15px;color:#f5f6fa;white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis;max-width:56vw;letter-spacing:.01em}
    .k3d-title small{display:block;color:#7f869b;font-size:10.5px;letter-spacing:.12em;margin-top:2px;text-transform:uppercase}
    .k3d-head-actions{margin-left:auto;display:flex;align-items:center;gap:7px;flex:0 0 auto}
    .k3d-head-actions button{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.03);
      color:#c9cfdd;border-radius:999px;padding:7px 12px;font:inherit;font-size:11.5px;cursor:pointer;transition:.18s;white-space:nowrap}
    .k3d-head-actions button:hover{color:#fff;border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.08)}
    .k3d-head-actions .close{width:32px;height:32px;padding:0;font-size:20px;line-height:1;border-radius:50%}
    .k3d-body{position:relative;flex:1;min-height:0;background:
      radial-gradient(58% 62% at 50% 38%,rgba(255,53,87,.11),transparent 70%),
      radial-gradient(42% 50% at 78% 84%,rgba(78,110,255,.07),transparent 72%),
      linear-gradient(180deg,#0a0b10,#07080c)}
    .k3d-body:after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;
      background:radial-gradient(120% 90% at 50% 42%,transparent 58%,rgba(0,0,0,.28) 100%)}
    .k3d-loading{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;
      flex-direction:column;gap:12px;color:#99a0b3;font-size:12px;letter-spacing:.08em;background:#090a10}
    .k3d-loading .spin{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.12);
      border-top-color:#ff3557;animation:k3dspin .9s linear infinite}
    @keyframes k3dspin{to{transform:rotate(360deg)}}
    .k3d-foot{display:flex;align-items:center;gap:10px;padding:9px 18px;border-top:1px solid rgba(255,255,255,.07);
      color:#737b8e;font-size:10.5px;letter-spacing:.03em;flex-wrap:wrap}
    .k3d-foot b{color:#b9c0d0;font-weight:600}
    .k3d-foot .sep{width:1px;height:10px;background:rgba(255,255,255,.12)}
    @media (max-width:760px){
      .k3d-mask{padding:8px}
      .k3d-box{width:100%;height:90vh;border-radius:16px}
      .k3d-head{padding:10px 12px;gap:8px}
      .k3d-title{flex:1;min-width:0}
      .k3d-title strong{max-width:none;width:100%;font-size:12.5px}
      .k3d-title small{display:none}
      .k3d-head-actions{gap:4px}
      .k3d-head-actions .reset{display:none}
      .k3d-head-actions button{padding:6px 8px;font-size:10.5px}
      .k3d-head-actions .close{width:30px;height:30px}
      .k3d-foot{padding:7px 12px;font-size:9.5px;gap:6px}
      .k3d-foot span:last-child{display:none}
    }
    `;
    var style = document.createElement("style");
    style.id = "k3d-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function makeHud(container, viewer, variant) {
    var hud = document.createElement("div");
    hud.className = "k3d-hud";
    hud.innerHTML =
      '<div class="k3d-badge"><i></i><b>CY68</b><span>' +
        (variant === "rgb" ? "RGB 幻彩" : "黑红波浪纹") + ' · 实时 3D</span></div>' +
      '<div class="k3d-help">拖动旋转 · 滚轮缩放 · 双击复位</div>' +
      '<div class="k3d-views">' +
        '<button type="button" data-view="hero" class="on">45°</button>' +
        '<button type="button" data-view="front">正面</button>' +
        '<button type="button" data-view="side">侧面</button>' +
        '<button type="button" data-view="top">俯视</button>' +
        '<button type="button" data-view="bottom">底部</button>' +
      '</div>' +
      '<div class="k3d-zoombar">' +
        '<button type="button" class="zoomout" aria-label="缩小">−</button>' +
        '<button type="button" class="zoomin" aria-label="放大">＋</button>' +
        '<button type="button" class="auto on" aria-label="切换自动旋转"><i></i>自动</button>' +
      '</div>';
    container.appendChild(hud);

    hud.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        hud.querySelectorAll("[data-view]").forEach(function (b) { b.classList.remove("on"); });
        btn.classList.add("on");
        viewer.setView(btn.getAttribute("data-view"));
      });
    });
    hud.querySelector(".zoomout").addEventListener("click", function () {
      viewer.state.targetZoom = clamp(viewer.state.targetZoom * 1.18, viewer.state.minZoom, viewer.state.maxZoom);
    });
    hud.querySelector(".zoomin").addEventListener("click", function () {
      viewer.state.targetZoom = clamp(viewer.state.targetZoom / 1.18, viewer.state.minZoom, viewer.state.maxZoom);
    });
    var autoBtn = hud.querySelector(".auto");
    autoBtn.addEventListener("click", function () {
      var on = viewer.toggleAutoRotate();
      autoBtn.classList.toggle("on", on);
    });
    return hud;
  }

  function ensureModal() {
    injectCSS();
    var mask = document.querySelector(".k3d-mask");
    if (mask) return mask;
    mask = document.createElement("div");
    mask.className = "k3d-mask";
    mask.innerHTML =
      '<div class="k3d-box" role="dialog" aria-modal="true" aria-label="CY68 键盘 3D 模型">' +
        '<div class="k3d-head">' +
          '<div class="k3d-title"><span class="mark"></span><div>' +
            '<strong id="k3dTitle">CY68 黑红波浪纹版 · 3D 模型</strong>' +
            '<small>Real-time WebGL · 360° inspection</small>' +
          '</div></div>' +
          '<div class="k3d-head-actions">' +
            '<button type="button" class="reset">重置视角</button>' +
            '<button type="button" class="close" aria-label="关闭 3D 查看">×</button>' +
          '</div>' +
        '</div>' +
        '<div class="k3d-body">' +
          '<div class="k3d-loading"><div class="spin"></div><span>正在构建 3D 模型…</span></div>' +
        '</div>' +
        '<div class="k3d-foot">' +
          '<b>68 键</b><span class="sep"></span><b>65% 紧凑配列</b><span class="sep"></span>' +
          '<span>PBT 双色键帽 · 铝合金外壳 · Type-C</span>' +
          '<span style="margin-left:auto">WebGL 实时渲染 · 拖动可从任意角度查看</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(mask);
    return mask;
  }

  var modalViewer = null;
  var modalPid = null;
  var lastFocus = null;
  var modalBound = false;

  function bindModal(mask) {
    if (modalBound) return;
    modalBound = true;
    mask.addEventListener("click", function (e) {
      if (e.target === mask) close();
    });
    mask.querySelector(".close").addEventListener("click", close);
    mask.querySelector(".reset").addEventListener("click", function () {
      if (modalViewer) modalViewer.reset();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mask.classList.contains("on")) close();
    });
  }

  function open(pid) {
    injectCSS();
    var mask = ensureModal();
    bindModal(mask);
    modalPid = pid;
    var p = (typeof window.getProduct === "function") ? window.getProduct(pid) : null;
    var name = p ? p.name : "CY68 黑红波浪纹版";
    var variant = p && /黑红|波浪/.test(p.name) ? "blackred" : (pid === 2 ? "blackred" : "rgb");
    var title = mask.querySelector("#k3dTitle");
    if (title) title.textContent = name + " · 3D 模型";
    var badge = mask.querySelector(".k3d-badge span");
    if (badge) badge.textContent = (variant === "rgb" ? "RGB 幻彩" : "黑红波浪纹") + " · 实时 3D";
    lastFocus = document.activeElement;
    mask.classList.add("on");
    document.body.style.overflow = "hidden";
    mask.querySelector(".close").focus();
    var body = mask.querySelector(".k3d-body");
    body.innerHTML = '<div class="k3d-loading"><div class="spin"></div><span>正在构建 3D 模型…</span></div>';

    loadThree().then(function () {
      return new Promise(function (r) { setTimeout(r, 30); });
    }).then(function () {
      if (!mask.classList.contains("on")) return;
      if (modalViewer) { modalViewer.dispose(); modalViewer = null; }
      body.innerHTML = "";
      modalViewer = createViewer(body, {
        variant: variant,
        autoRotate: true,
        initialView: "hero"
      });
      makeHud(body, modalViewer, variant);
      window.__k3dViewer = modalViewer;
    }).catch(function (err) {
      body.innerHTML = '<div class="k3d-loading"><span>3D 加载失败：' + (err && err.message ? err.message : err) + '</span></div>';
    });
  }

  function close() {
    var mask = document.querySelector(".k3d-mask");
    if (!mask) return;
    mask.classList.remove("on");
    document.body.style.overflow = "";
    if (modalViewer) { modalViewer.dispose(); modalViewer = null; }
    window.__k3dViewer = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ======================================================================
     9. 对外 API
     ====================================================================== */
  function mount(container, options) {
    options = options || {};
    injectCSS();
    return loadThree().then(function () {
      return new Promise(function (r) { setTimeout(r, 20); });
    }).then(function () {
      var viewer = createViewer(container, options);
      if (options.hud !== false) makeHud(container, viewer, options.variant);
      window.__k3dViewer = viewer;
      return viewer;
    });
  }

  window.CY_KEYBOARD3D = {
    version: "1.0.0",
    mount: mount,
    open: open,
    close: close,
    loadThree: loadThree,
    presets: VIEW_PRESETS
  };
  window.VIEW3D = { open: open, close: close };
})();
