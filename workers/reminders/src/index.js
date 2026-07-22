import webpush from 'web-push';

export default {
  async fetch(request) {
    if (new URL(request.url).pathname !== '/health') return new Response('not found', { status: 404 });
    return Response.json({ ok: true, service: 'miracle-reminders' });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(sendDueReminders(new Date(controller.scheduledTime), env));
  },
};

async function sendDueReminders(now, env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.error('[reminders] VAPID secrets are missing');
    return;
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const { results = [] } = await env.DB.prepare(
    `SELECT s.endpoint, s.user_id AS userId, s.p256dh, s.auth, s.timezone,
            p.morning_time AS morningTime, p.follow_time AS followTime,
            p.quiet_from AS quietFrom, p.quiet_until AS quietUntil,
            d.resolved, d.total, d.open_loops AS openLoops, d.complete
       FROM push_subscriptions s
       JOIN reminder_preferences p ON p.user_id = s.user_id AND p.enabled = 1
  LEFT JOIN reminder_daily_state d ON d.user_id = s.user_id
        AND d.date = ?1
      WHERE s.enabled = 1
      ORDER BY s.updated_at DESC
      LIMIT 500`,
  ).bind(now.toISOString().slice(0, 10)).all();

  for (const row of results) {
    const local = localClock(now, row.timezone);
    const state = await stateForLocalDate(env, row, local.date);
    if (isQuiet(local.time, row.quietFrom, row.quietUntil)) continue;
    if (withinCronWindow(local.time, row.morningTime)) {
      await deliver(env, row, local.date, 'morning', {
        title: 'Morning Gate is open',
        body: 'Anchor, aim, and attend when you are ready.',
        tag: `miracle-morning-${local.date}`,
        url: './?open=rhythm',
        badge: 1,
      });
    }
    if (withinCronWindow(local.time, row.followTime) && !state?.complete) {
      const remaining = Math.max(0, Number(state?.total || 0) - Number(state?.resolved || 0));
      const openLoops = Number(state?.openLoops || 0);
      const detail = [remaining ? `${remaining} chosen practice${remaining === 1 ? '' : 's'}` : '', openLoops ? `${openLoops} open loop${openLoops === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
      await deliver(env, row, local.date, 'follow-through', {
        title: 'A quiet follow-through',
        body: detail ? `${detail} remain. Complete, close, or reschedule them.` : 'Open today’s path and decide what remains.',
        tag: `miracle-follow-${local.date}`,
        url: './?open=rhythm',
        badge: Math.max(1, remaining + openLoops),
      });
    }
  }
}

async function stateForLocalDate(env, row, localDate) {
  if (row.localDate === localDate) return row;
  return env.DB.prepare(
    'SELECT resolved, total, open_loops AS openLoops, complete FROM reminder_daily_state WHERE user_id = ?1 AND date = ?2',
  ).bind(row.userId, localDate).first();
}

async function deliver(env, row, localDate, kind, payload) {
  const existing = await env.DB.prepare(
    'SELECT id FROM push_deliveries WHERE endpoint = ?1 AND local_date = ?2 AND kind = ?3',
  ).bind(row.endpoint, localDate, kind).first();
  if (existing) return;
  try {
    const result = await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'normal' });
    await env.DB.prepare(
      'INSERT OR IGNORE INTO push_deliveries (user_id, endpoint, local_date, kind, status) VALUES (?1, ?2, ?3, ?4, ?5)',
    ).bind(row.userId, row.endpoint, localDate, kind, result.statusCode || 201).run();
  } catch (error) {
    const status = Number(error.statusCode || 0);
    if (status === 404 || status === 410) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(row.endpoint).run();
      return;
    }
    console.error('[reminders] push failed', status, error.message);
  }
}

function localClock(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function withinCronWindow(current, target) {
  const currentMinutes = minutes(current);
  const targetMinutes = minutes(target);
  const difference = (currentMinutes - targetMinutes + 1440) % 1440;
  return difference >= 0 && difference < 15;
}

function isQuiet(current, from, until) {
  const now = minutes(current);
  const start = minutes(from);
  const end = minutes(until);
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

function minutes(value) {
  const [hour = 0, minute = 0] = String(value || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}
