/* Data layer: batches of first timers and their 4-week follow-up. History is kept for good. */
window.FT = (function () {
  var CFG = window.FT_CONFIG, GROUPS = window.GROUPS, NW = CFG.WEEKS;
  var F = { Called: 'called', Visited: 'visited', Rehearsal: 'rehearsal', Church: 'church' };
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function day(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parseDate(v) {
    if (v == null || v === '') return null; if (v instanceof Date) return v;
    var m = /^Date\((\d+),(\d+),(\d+)/.exec(String(v)); if (m) return new Date(+m[1], +m[2], +m[3]);
    var d = new Date(v); return isNaN(d.getTime()) ? null : d;
  }
  function sundayOnOrBefore(d) { var x = day(d); x.setDate(x.getDate() - x.getDay()); return x; }
  function label(d) { return d.getDate() + ' ' + MON[d.getMonth()]; }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }

  function sample() {
    function rnd(s) { var x = Math.sin(s) * 10000; return x - Math.floor(x); }
    var rows = [], last = sundayOnOrBefore(new Date()), si = 0;
    GROUPS.forEach(function (g) { g.shepherds.forEach(function (s) { si++;
      for (var b = 7; b >= 0; b--) {                                   // 8 Sundays of batches
        var bd = new Date(last); bd.setDate(bd.getDate() - 7 * b);
        var got = 3 + Math.round(rnd(si * 31 + b * 7) * 9);
        rows.push({ date: bd, shepherd: s.name, type: 'Gotten', batch: bd, value: got });
        for (var w = 1; w <= NW; w++) {
          if (w > b) break;                                            // that week has not happened yet
          var keep = Math.pow(0.78 + rnd(si + b + w) * 0.12, w), end = new Date(bd); end.setDate(end.getDate() + 7 * w);
          function at(off) { var d = new Date(end); d.setDate(d.getDate() - off); return d; }
          rows.push({ date: at(6), shepherd: s.name, type: 'Called', batch: bd, value: Math.round(got * Math.min(1, keep + 0.25)) });
          rows.push({ date: at(2), shepherd: s.name, type: 'Visited', batch: bd, value: Math.round(got * keep * 0.8) });
          rows.push({ date: at(1), shepherd: s.name, type: 'Rehearsal', batch: bd, value: Math.round(got * keep * 0.6) });
          rows.push({ date: at(0), shepherd: s.name, type: 'Church', batch: bd, value: Math.round(got * keep * 0.9) });
        }
      } }); });
    return rows;
  }

  function fetchSheet() {
    return new Promise(function (resolve, reject) {
      var cb = '__ftcb' + Date.now();
      window[cb] = function (resp) { delete window[cb];
        if (!resp || resp.status === 'error') return reject(new Error('Could not read the sheet'));
        var L = resp.table.cols.map(function (c) { return String(c.label || '').toLowerCase(); });
        function ix(w) { for (var i = 0; i < L.length; i++) if (L[i].indexOf(w) !== -1) return i; return -1; }
        var iT = ix('timestamp'), iD = L.indexOf('date'), iS = ix('shepherd'), iR = ix('report'), iB = ix('batch'), iV = ix('value');
        resolve(resp.table.rows.map(function (r) { var c = r.c || []; function v(i) { return i >= 0 && c[i] ? c[i].v : null; }
          return { date: parseDate(v(iD)) || parseDate(v(iT)), shepherd: String(v(iS) || '').trim(), type: String(v(iR) || '').trim(), batch: parseDate(v(iB)), value: v(iV) };
        }).filter(function (r) { return r.date && r.shepherd; })); };
      var s = document.createElement('script');
      s.src = 'https://docs.google.com/spreadsheets/d/' + CFG.SHEET_ID + '/gviz/tq?sheet=' + encodeURIComponent(CFG.TAB) + '&headers=1&tqx=out:json;responseHandler:' + cb;
      s.onerror = function () { reject(new Error('Could not reach the sheet')); };
      document.body.appendChild(s);
    });
  }

  function build(rows, isSample) {
    var by = {}, sundays = {};
    rows.forEach(function (r) {
      var bd = sundayOnOrBefore(r.batch || r.date), k = bd.getTime();
      var s = by[r.shepherd] || (by[r.shepherd] = {}), b = s[k] || (s[k] = { key: k, date: bd, label: label(bd), gotten: 0, weeks: {} });
      sundays[k] = bd;
      if (r.type === 'Gotten') { b.gotten = num(r.value); return; }               // latest wins
      var f = F[r.type]; if (!f) return;
      var w = Math.ceil((day(r.date) - bd) / (7 * 86400000)); if (w < 1 || w > NW) return;
      (b.weeks[w] || (b.weeks[w] = {}))[f] = num(r.value);                         // latest wins
    });
    var sundayList = Object.keys(sundays).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return { key: k, date: sundays[k], label: label(sundays[k]) }; });
    function batches(name) { var s = by[name] || {}; return Object.keys(s).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return s[k]; }); }
    function names(group) { var out = []; GROUPS.forEach(function (g) { if (!group || g.group === group) g.shepherds.forEach(function (s) { out.push(s.name); }); }); return out; }
    function all(group) { var out = []; names(group).forEach(function (n) { out = out.concat(batches(n)); }); return out; }
    function gottenOn(k, group) { var t = 0; names(group).forEach(function (n) { var b = (by[n] || {})[k]; if (b) t += b.gotten; }); return t; }
    function cumulative(group) { return all(group).reduce(function (s, b) { return s + b.gotten; }, 0); }
    // retention for week w = people in church in week w ÷ people gotten, over every batch that has reached week w
    function retention(list, w, f) { var a = 0, g = 0; f = f || 'church';
      list.forEach(function (b) { var x = b.weeks[w]; if (x && x[f] != null) { a += x[f]; g += b.gotten; } });
      return g ? { n: a, of: g, pct: Math.round(100 * a / g) } : null; }
    return { sample: !!isSample, weeks: NW, groups: GROUPS, sundays: sundayList, batches: batches, all: all, gottenOn: gottenOn, cumulative: cumulative, retention: retention };
  }
  function load(cb, onErr) {
    if (!CFG.SHEET_ID) return cb(build(sample(), true));
    fetchSheet().then(function (rows) { cb(build(rows, false)); }).catch(onErr || function () {});
  }
  return { load: load };
})();
