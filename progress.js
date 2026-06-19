/* =========================================================================
 * Neon Dash — retention progress (daily streak, daily challenge, missions).
 * Pure logic + localStorage; no DOM. Rewards are returned as gem amounts for
 * the game to bank (this module never touches the wallet directly).
 *
 *   NeonProgress.startDay()   -> { isNewDay, streak, reward }   // login bonus
 *   NeonProgress.recordRun({score,gems,powerups}) -> { rewards, completed[] }
 *   NeonProgress.summary()    -> { streak, daily, missions[] }  // for the UI
 *
 * NeonProgress.create(storage, nowFn) builds an instance with injected
 * storage + clock (used by unit tests).
 * ========================================================================= */

(function (global) {
  "use strict";

  var KEY = "neondash.progress";

  // Lifetime cumulative missions (claimed once each).
  var MISSIONS = [
    { id: "gems_50",   desc: "Collect 50 gems",      metric: "gems",     target: 50,  reward: 30 },
    { id: "score_500", desc: "Reach 500 in a run",   metric: "bestRun",  target: 500, reward: 50 },
    { id: "power_15",  desc: "Grab 15 power-ups",    metric: "powerups", target: 15,  reward: 40 },
    { id: "gems_250",  desc: "Collect 250 gems",     metric: "gems",     target: 250, reward: 90 },
    { id: "runs_25",   desc: "Play 25 runs",         metric: "runs",     target: 25,  reward: 60 },
  ];

  // Daily challenge variants (cumulative within the day), chosen by date.
  var DAILY = [
    { metric: "dayGems",     base: 20, span: 5, step: 10, reward: 40, label: "Collect %d gems today" },
    { metric: "dayPowerups", base: 3,  span: 4, step: 1,  reward: 35, label: "Grab %d power-ups today" },
  ];

  function defaultState() {
    return {
      lastDay: null, streak: 0,
      day: null, dayGems: 0, dayPowerups: 0, dailyClaimed: false,
      lifetime: { gems: 0, powerups: 0, runs: 0, bestRun: 0 },
      missionsClaimed: {},
    };
  }

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function dateStr(d) { return d.toISOString().slice(0, 10); }
  function dayNumber(s) { return Math.floor(Date.parse(s + "T00:00:00Z") / 86400000); }

  function dailyFor(day) {
    var seed = hash(day);
    var t = DAILY[seed % DAILY.length];
    var target = t.base + (seed % t.span) * t.step;
    return { metric: t.metric, target: target, reward: t.reward, desc: t.label.replace("%d", target) };
  }

  function makeProgress(storage, nowFn) {
    var now = nowFn || function () { return new Date(); };
    function store() { return storage || global.localStorage; }
    function load() {
      try {
        var s = JSON.parse(store().getItem(KEY));
        if (s && typeof s === "object") {
          var d = defaultState();
          d.lastDay = s.lastDay || null; d.streak = s.streak || 0;
          d.day = s.day || null; d.dayGems = s.dayGems || 0; d.dayPowerups = s.dayPowerups || 0;
          d.dailyClaimed = !!s.dailyClaimed;
          if (s.lifetime) d.lifetime = Object.assign(d.lifetime, s.lifetime);
          d.missionsClaimed = s.missionsClaimed || {};
          return d;
        }
      } catch (e) { /* fall through */ }
      return defaultState();
    }
    function save(st) { try { store().setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }
    function rollDay(st, today) {
      if (st.day !== today) { st.day = today; st.dayGems = 0; st.dayPowerups = 0; st.dailyClaimed = false; }
    }

    function startDay() {
      var st = load();
      var today = dateStr(now());
      var reward = 0, isNewDay = false;
      if (st.lastDay !== today) {
        isNewDay = true;
        if (st.lastDay && dayNumber(today) - dayNumber(st.lastDay) === 1) st.streak += 1;
        else st.streak = 1;
        st.lastDay = today;
        reward = 10 + Math.min(st.streak, 7) * 5; // grows with streak, capped
      }
      rollDay(st, today);
      save(st);
      return { isNewDay: isNewDay, streak: st.streak, reward: reward };
    }

    function recordRun(run) {
      var st = load();
      var today = dateStr(now());
      rollDay(st, today);
      var gems = (run && run.gems) || 0;
      var powerups = (run && run.powerups) || 0;
      var score = (run && run.score) || 0;
      st.lifetime.gems += gems; st.lifetime.powerups += powerups; st.lifetime.runs += 1;
      if (score > st.lifetime.bestRun) st.lifetime.bestRun = score;
      st.dayGems += gems; st.dayPowerups += powerups;

      var rewards = 0, completed = [];
      var daily = dailyFor(today);
      var dp = daily.metric === "dayGems" ? st.dayGems : st.dayPowerups;
      if (!st.dailyClaimed && dp >= daily.target) {
        st.dailyClaimed = true; rewards += daily.reward;
        completed.push({ type: "daily", desc: daily.desc, reward: daily.reward });
      }
      MISSIONS.forEach(function (m) {
        if (!st.missionsClaimed[m.id] && (st.lifetime[m.metric] || 0) >= m.target) {
          st.missionsClaimed[m.id] = true; rewards += m.reward;
          completed.push({ type: "mission", desc: m.desc, reward: m.reward });
        }
      });
      save(st);
      return { rewards: rewards, completed: completed };
    }

    function summary() {
      var st = load();
      var daily = dailyFor(dateStr(now()));
      var dp = daily.metric === "dayGems" ? st.dayGems : st.dayPowerups;
      return {
        streak: st.streak,
        daily: { desc: daily.desc, target: daily.target, progress: Math.min(dp, daily.target), done: st.dailyClaimed, reward: daily.reward },
        missions: MISSIONS.map(function (m) {
          var v = st.lifetime[m.metric] || 0;
          return { desc: m.desc, target: m.target, progress: Math.min(v, m.target), done: !!st.missionsClaimed[m.id], reward: m.reward };
        }),
      };
    }

    return { startDay: startDay, recordRun: recordRun, summary: summary };
  }

  global.NeonProgress = makeProgress();
  global.NeonProgress.create = makeProgress; // injectable storage + clock for tests
})(window);
