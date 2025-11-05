const dayjs = require('dayjs');
const { getDb } = require('../models/db');

function isWeekday(d) {
  const wd = d.day(); // 0 Sun - 6 Sat
  return wd >= 1 && wd <= 5;
}

function generatePlan(req, res) {
  const db = getDb();
  const perDay = Math.max(1, Math.min(200, Number(req.body.per_day) || 25));
  const userIds = Array.isArray(req.body.user_ids) && req.body.user_ids.length ? req.body.user_ids.map(Number) : [];
  const accounts = userIds.length || Math.max(1, Math.min(10, Number(req.body.accounts) || 1));
  const startDate = req.body.start_date || dayjs().format('YYYY-MM-DD');
  const daysCount = Math.max(1, Math.min(365, Number(req.body.days) || 30));

  const dailyCapacity = perDay * accounts;
  const capacityTotal = dailyCapacity * daysCount;

  // Candidates: not assigned yet and not unwanted
  const candidates = db.prepare(`
    SELECT p.id, p.username FROM prospects p
    WHERE p.unwanted=0 AND p.id NOT IN (SELECT prospect_id FROM plan)
    LIMIT ?
  `).all(capacityTotal);

  const insert = db.prepare(`INSERT INTO plan (prospect_id, date, account_label, assigned_user_id, status) VALUES (?, ?, ?, ?, 'pending')`);
  const tx = db.transaction(() => {
    let idx = 0;
    for (let d = 0; d < daysCount; d++) {
      const day = dayjs(startDate).add(d, 'day');
      if (!isWeekday(day)) continue; // skip weekends
      const date = day.format('YYYY-MM-DD');
      const accIds = userIds.length ? userIds : Array.from({ length: accounts }, (_, i) => null);
      for (let a = 0; a < accIds.length; a++) {
        const assignedUserId = accIds[a];
        const accountLabel = assignedUserId ? `User ${assignedUserId}` : `Account ${a + 1}`;
        for (let c = 0; c < perDay; c++) {
          const cand = candidates[idx++];
          if (!cand) return; // all assigned
          insert.run(cand.id, date, accountLabel, assignedUserId);
        }
      }
    }
  });

  tx();

  const assigned = db.prepare(`SELECT COUNT(*) as c FROM plan`).get().c;
  res.json({ ok: true, assigned_total: assigned, planned_now: candidates.length });
}

function getDayPlan(req, res) {
  const db = getDb();
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  const isSender = req.user?.role === 'sender';
  const rows = isSender
    ? db.prepare(`
      SELECT pl.id as plan_id, pl.date, pl.account_label, pl.status, pl.assigned_user_id,
             p.username, p.full_name, p.href,
             u.username as assigned_username, u.name as assigned_name
      FROM plan pl
      JOIN prospects p ON p.id = pl.prospect_id
      LEFT JOIN users u ON u.id = pl.assigned_user_id
      WHERE pl.date = ? AND pl.assigned_user_id = ?
      ORDER BY pl.account_label, p.username
    `).all(date, req.user.id)
    : db.prepare(`
      SELECT pl.id as plan_id, pl.date, pl.account_label, pl.status, pl.assigned_user_id,
             p.username, p.full_name, p.href,
             u.username as assigned_username, u.name as assigned_name
      FROM plan pl
      JOIN prospects p ON p.id = pl.prospect_id
      LEFT JOIN users u ON u.id = pl.assigned_user_id
      WHERE pl.date = ?
      ORDER BY pl.account_label, p.username
    `).all(date);
  res.json({ ok: true, date, items: rows });
}

function mondayOf(dateStr) {
  const d = dayjs(dateStr || dayjs());
  const wd = d.day(); // 0 = Sun
  const delta = (wd + 6) % 7; // days since Monday
  return d.subtract(delta, 'day');
}

function getWeekPlan(req, res) {
  const db = getDb();
  const start = mondayOf(req.query.start || dayjs().format('YYYY-MM-DD'));
  const dates = [];
  for (let i = 0; i < 5; i++) dates.push(start.add(i, 'day').format('YYYY-MM-DD'));
  const from = dates[0];
  const to = dates[4];
  const isSender = req.user?.role === 'sender';
  const rows = (isSender
    ? db.prepare(`
      SELECT pl.id as plan_id, pl.date, pl.account_label, pl.status, pl.assigned_user_id,
             p.id as prospect_id, p.username, p.full_name, p.href,
             u.username as assigned_username, u.name as assigned_name
      FROM plan pl
      JOIN prospects p ON p.id = pl.prospect_id
      LEFT JOIN users u ON u.id = pl.assigned_user_id
      WHERE pl.date BETWEEN ? AND ? AND pl.assigned_user_id = ?
      ORDER BY pl.date, COALESCE(u.username, pl.account_label), p.username
    `).all(from, to, req.user.id)
    : db.prepare(`
      SELECT pl.id as plan_id, pl.date, pl.account_label, pl.status, pl.assigned_user_id,
             p.id as prospect_id, p.username, p.full_name, p.href,
             u.username as assigned_username, u.name as assigned_name
      FROM plan pl
      JOIN prospects p ON p.id = pl.prospect_id
      LEFT JOIN users u ON u.id = pl.assigned_user_id
      WHERE pl.date BETWEEN ? AND ?
      ORDER BY pl.date, COALESCE(u.username, pl.account_label), p.username
    `).all(from, to)).filter(r => dates.includes(r.date));
  res.json({ ok: true, start: from, end: to, dates, items: rows });
}

function buildNextWeekdays(startStr, daysCount) {
  let d = dayjs(startStr || dayjs().format('YYYY-MM-DD'));
  const out = [];
  while (out.length < daysCount) {
    if (isWeekday(d)) out.push(d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
  return out;
}

function getRangePlan(req, res) {
  const db = getDb();
  const start = req.query.start || dayjs().format('YYYY-MM-DD');
  const daysN = Math.max(1, Math.min(60, Number(req.query.days) || 2));
  const dates = buildNextWeekdays(start, daysN);
  const perDay = Number((db.prepare(`SELECT value FROM settings WHERE key='per_day'`).get()||{value:'25'}).value) || 25;
  // Use all current senders; ignore legacy active_senders setting
  const senders = db.prepare(`SELECT id, username FROM users WHERE role='sender'`).all();

  if (!senders.length) {
    return res.json({ ok: true, dates, items: [], no_senders: true });
  }

  if (senders.length) {
    const countAllStmt = db.prepare(`SELECT COUNT(*) as c FROM plan WHERE date=? AND assigned_user_id=?`);
    const pendingIdsForDateStmt = db.prepare(`SELECT id FROM plan WHERE date=? AND assigned_user_id=? AND status='pending' ORDER BY id DESC`);
    const backlogOldStmt = db.prepare(`SELECT id FROM plan WHERE assigned_user_id=? AND status='pending' AND date < ? ORDER BY date ASC, id ASC`);
    const updateDateByIdStmt = (ids, newDate) => {
      if (!ids || !ids.length) return 0;
      const inQ = ids.map(()=>'?').join(',');
      return db.prepare(`UPDATE plan SET date=? WHERE id IN (${inQ})`).run(newDate, ...ids).changes;
    };
    const candStmt = db.prepare(`SELECT id FROM prospects WHERE unwanted=0 AND id NOT IN (SELECT prospect_id FROM plan) ORDER BY id ASC LIMIT ?`);
    const insert = db.prepare(`INSERT INTO plan (prospect_id, date, account_label, assigned_user_id, status) VALUES (?,?,?,?, 'pending')`);

    function nextWeekdayDate(str){
      let d = dayjs(str).add(1,'day');
      while (![1,2,3,4,5].includes(d.day())) d = d.add(1,'day');
      return d.format('YYYY-MM-DD');
    }

    const tx = db.transaction(() => {
      for (const s of senders) {
        // 1) Move backlog (older than first date) forward into the range respecting perDay per date
        let backlog = backlogOldStmt.all(s.id, dates[0]).map(r=>r.id);
        if (backlog.length) {
          for (const d of dates) {
            const haveAll = Number(countAllStmt.get(d, s.id).c || 0);
            const missing = Math.max(0, perDay - haveAll);
            if (missing > 0 && backlog.length) {
              const take = backlog.splice(0, missing);
              updateDateByIdStmt(take, d);
            }
            if (!backlog.length) break;
          }
          // If backlog remains after filling range, push it after last date day by day
          let carryDate = dates[dates.length-1];
          while (backlog.length) {
            carryDate = nextWeekdayDate(carryDate);
            const haveAll = Number(countAllStmt.get(carryDate, s.id).c || 0);
            const missing = Math.max(0, perDay - haveAll);
            if (missing > 0) {
              const take = backlog.splice(0, missing);
              updateDateByIdStmt(take, carryDate);
            } else {
              // no capacity; advance another day
              continue;
            }
          }
        }
        // 2) Within the range, if a date has more than perDay total, move pending overflow to next dates successively
        for (let i=0; i<dates.length; i++) {
          const d = dates[i];
          const total = Number(countAllStmt.get(d, s.id).c || 0);
          if (total > perDay) {
            const over = total - perDay;
            const pendings = pendingIdsForDateStmt.all(d, s.id).map(r=>r.id);
            if (pendings.length > perDay) {
              const overPend = pendings.length - perDay;
              const moveIds = pendings.slice(0, overPend); // move newest pending first
              // find next date with capacity, cascading
              let j = i + 1;
              let remaining = moveIds.slice();
              while (remaining.length) {
                let targetDate = j < dates.length ? dates[j] : nextWeekdayDate(j === i+1 ? d : dates[j-1]);
                const haveAllTgt = Number(countAllStmt.get(targetDate, s.id).c || 0);
                const missingTgt = Math.max(0, perDay - haveAllTgt);
                if (missingTgt > 0) {
                  const take = remaining.splice(0, missingTgt);
                  updateDateByIdStmt(take, targetDate);
                } else {
                  j += 1;
                }
                if (j > dates.length + 30) break; // safety
              }
            }
          }
        }
        // 3) Fill missing in range with new prospects
        for (const d of dates) {
          const haveAll = Number(countAllStmt.get(d, s.id).c || 0);
          const missing = Math.max(0, perDay - haveAll);
          if (missing > 0) {
            const cands = candStmt.all(missing);
            for (const c of cands) insert.run(c.id, d, s.username, s.id);
          }
        }
      }
    });
    tx();
  }

  const from = dates[0];
  const to = dates[dates.length-1];
  let rows;
  if (req.user?.role === 'sender') {
    rows = db.prepare(`
      SELECT pl.id as plan_id, pl.date, pl.account_label, pl.status, pl.assigned_user_id,
             p.id as prospect_id, p.username, p.full_name, p.href,
             u.username as assigned_username, u.name as assigned_name,
             uu.source as upload_source, uu.network as upload_network, uu.instagram_account as upload_instagram_account, uu.created_at as upload_created_at
      FROM plan pl
      JOIN prospects p ON p.id = pl.prospect_id
      LEFT JOIN users u ON u.id = pl.assigned_user_id
      LEFT JOIN uploads uu ON uu.id = p.upload_id
      WHERE pl.date BETWEEN ? AND ? AND pl.assigned_user_id = ?
      ORDER BY pl.date, COALESCE(u.username, pl.account_label), p.username
    `).all(from, to, req.user.id).filter(r => dates.includes(r.date));
  } else {
    const senderIds = senders.map(s=>s.id);
    const inQ = senderIds.map(()=>'?').join(',');
    rows = db.prepare(`
      SELECT pl.id as plan_id, pl.date, pl.account_label, pl.status, pl.assigned_user_id,
             p.id as prospect_id, p.username, p.full_name, p.href,
             u.username as assigned_username, u.name as assigned_name,
             uu.source as upload_source, uu.network as upload_network, uu.instagram_account as upload_instagram_account, uu.created_at as upload_created_at
      FROM plan pl
      JOIN prospects p ON p.id = pl.prospect_id
      LEFT JOIN users u ON u.id = pl.assigned_user_id
      LEFT JOIN uploads uu ON uu.id = p.upload_id
      WHERE pl.date BETWEEN ? AND ? AND pl.assigned_user_id IN (${inQ})
      ORDER BY pl.date, COALESCE(u.username, pl.account_label), p.username
    `).all(from, to, ...senderIds).filter(r => dates.includes(r.date));
  }

  res.json({ ok: true, dates, items: rows, no_senders: senders.length === 0 });
}

function autoGenerate(req, res) {
  const db = getDb();
  const perDay = Math.max(1, Math.min(200, Number(req.body.per_day) || Number((db.prepare(`SELECT value FROM settings WHERE key='per_day'`).get()||{value:'25'}).value) || 25));
  const startDate = req.body.start_date || dayjs().format('YYYY-MM-DD');
  const daysCount = Math.max(1, Math.min(365, Number(req.body.days) || 30));
  let activeSenders = [];
  try { activeSenders = JSON.parse((db.prepare(`SELECT value FROM settings WHERE key='active_senders'`).get()||{value:'[]'}).value); } catch { activeSenders = []; }
  const senders = activeSenders.length
    ? db.prepare(`SELECT id, username FROM users WHERE role='sender' AND id IN (${activeSenders.map(()=>'?').join(',')})`).all(...activeSenders)
    : db.prepare(`SELECT id, username FROM users WHERE role='sender'`).all();
  const accounts = senders.length || 1;
  const dailyCapacity = perDay * accounts;
  const capacityTotal = dailyCapacity * daysCount;

  const candidates = db.prepare(`
    SELECT p.id, p.username FROM prospects p
    WHERE p.unwanted=0 AND p.id NOT IN (SELECT prospect_id FROM plan)
    ORDER BY p.id ASC
    LIMIT ?
  `).all(capacityTotal);

  const insert = db.prepare(`INSERT INTO plan (prospect_id, date, account_label, assigned_user_id, status) VALUES (?, ?, ?, ?, 'pending')`);
  const tx = db.transaction(() => {
    let idx = 0;
    let d = dayjs(startDate);
    for (let di = 0; di < daysCount; ) {
      if (!isWeekday(d)) { d = d.add(1,'day'); continue; }
      const date = d.format('YYYY-MM-DD');
      const roundAccounts = senders.length ? senders : Array.from({length: accounts}, (_,i)=>({id:null, username:`Account ${i+1}`}));
      for (const acc of roundAccounts) {
        for (let c=0;c<perDay;c++){
          const cand = candidates[idx++];
          if (!cand) return;
          insert.run(cand.id, date, acc.username || `Account`, acc.id || null);
        }
      }
      d = d.add(1,'day');
      di++;
    }
  });
  tx();
  const assigned = db.prepare(`SELECT COUNT(*) as c FROM plan`).get().c;
  res.json({ ok: true, assigned_total: assigned, planned_now: candidates.length, per_day: perDay, accounts });
}

function updatePlanStatus(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  const status = String(req.body.status || '').toLowerCase();
  if (!['pending', 'sent', 'interested', 'won'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const uid = req.user?.id || null;
  if (req.user?.role === 'sender') {
    const pl = db.prepare(`SELECT assigned_user_id FROM plan WHERE id=?`).get(id);
    if (!pl) return res.status(404).json({ error: 'Not found' });
    if (pl.assigned_user_id != null && pl.assigned_user_id !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const r = db.prepare(`UPDATE plan SET status=?, updated_by_user_id=? WHERE id=?`).run(status, uid, id);
  res.json({ ok: true, updated: r.changes });
}

module.exports = { generatePlan, getDayPlan, getWeekPlan, getRangePlan, autoGenerate, updatePlanStatus };
