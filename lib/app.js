const express = require('express');
const crypto = require('crypto');
const { readData, writeData } = require('./storage');

const DEFAULT_UPI_ID = '9916300450@hdfc';
const DEFAULT_MCC = process.env.DEFAULT_MCC || ''; // Set to empty by default to prevent category mismatch blocks
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/api/payments', async (req, res) => {
  const data = await readData();
  const { name, amount } = req.body;
  if (!name || !amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Name and valid amount are required' });
  }
  const id = crypto.randomBytes(4).toString('hex');
  const payment = {
    id,
    upiId: DEFAULT_UPI_ID,
    mcc: DEFAULT_MCC,
    personName: name.trim(),
    amount: parseFloat(amount),
    clientName: '',
    clientBusiness: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    confirmedAt: null
  };
  data.payments.push(payment);
  await writeData(data);
  const link = `/pay/${id}`;
  res.json({ link, id, payment });
});

app.get('/api/payments', async (req, res) => {
  const data = await readData();
  const { person } = req.query;
  let payments = data.payments;
  if (person) {
    payments = payments.filter(p => p.personName.toLowerCase() === person.toLowerCase());
  }
  res.json(payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/payments/:id', async (req, res) => {
  const data = await readData();
  const payment = data.payments.find(p => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json(payment);
});

app.post('/api/payments/:id/confirm', async (req, res) => {
  const data = await readData();
  const payment = data.payments.find(p => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status === 'confirmed') {
    return res.status(400).json({ error: 'Payment already confirmed' });
  }
  const { clientName, clientBusiness } = req.body;
  if (clientName) payment.clientName = clientName;
  if (clientBusiness) payment.clientBusiness = clientBusiness;
  payment.status = 'confirmed';
  payment.confirmedAt = new Date().toISOString();
  await writeData(data);
  res.json({ success: true, payment });
});

app.get('/api/analytics', async (req, res) => {
  const data = await readData();
  const { person, period } = req.query;

  let payments = data.payments.filter(p => p.status === 'confirmed');
  if (person) {
    payments = payments.filter(p => p.personName.toLowerCase() === person.toLowerCase());
  }

  const now = new Date();
  let filtered = [];
  let startDate;

  if (period === 'weekly') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - now.getDay());
    startDate.setHours(0, 0, 0, 0);
    filtered = payments.filter(p => new Date(p.confirmedAt) >= startDate);
  } else if (period === 'monthly') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    filtered = payments.filter(p => new Date(p.confirmedAt) >= startDate);
  } else if (period === 'yearly') {
    startDate = new Date(now.getFullYear(), 0, 1);
    filtered = payments.filter(p => new Date(p.confirmedAt) >= startDate);
  } else {
    filtered = payments;
  }

  const totalAmount = filtered.reduce((sum, p) => sum + p.amount, 0);
  const totalCount = filtered.length;

  const byPerson = {};
  filtered.forEach(p => {
    if (!byPerson[p.personName]) {
      byPerson[p.personName] = { count: 0, total: 0 };
    }
    byPerson[p.personName].count++;
    byPerson[p.personName].total += p.amount;
  });

  const timeline = {};
  const allPersonNames = [...new Set(filtered.map(p => p.personName))];
  filtered.forEach(p => {
    const d = new Date(p.confirmedAt);
    const dateKey = period === 'yearly'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!timeline[dateKey]) {
      timeline[dateKey] = { total: 0, byPerson: {} };
    }
    timeline[dateKey].total += p.amount;
    if (!timeline[dateKey].byPerson[p.personName]) {
      timeline[dateKey].byPerson[p.personName] = 0;
    }
    timeline[dateKey].byPerson[p.personName] += p.amount;
  });

  const timelineArr = [];
  if (startDate) {
    const end = new Date(now);
    let cursor = new Date(startDate);
    while (cursor <= end) {
      let key;
      if (period === 'yearly') {
        key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const existing = timeline[key] || { total: 0, byPerson: {} };
        allPersonNames.forEach(n => { if (!existing.byPerson[n]) existing.byPerson[n] = 0; });
        timelineArr.push({ date: key, total: existing.total, byPerson: existing.byPerson });
        cursor.setMonth(cursor.getMonth() + 1);
      } else {
        key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        const existing = timeline[key] || { total: 0, byPerson: {} };
        allPersonNames.forEach(n => { if (!existing.byPerson[n]) existing.byPerson[n] = 0; });
        timelineArr.push({ date: key, total: existing.total, byPerson: existing.byPerson });
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  } else {
    Object.keys(timeline).sort().forEach(k => {
      const existing = timeline[k];
      allPersonNames.forEach(n => { if (!existing.byPerson[n]) existing.byPerson[n] = 0; });
      timelineArr.push({ date: k, total: existing.total, byPerson: existing.byPerson });
    });
  }

  res.json({ totalAmount, totalCount, byPerson, payments: filtered, timeline: timelineArr, allPersonNames });
});

app.get('/api/persons', async (req, res) => {
  const data = await readData();
  const persons = [...new Set(data.payments.map(p => p.personName))];
  res.json(persons);
});

app.get('/crm', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'crm.html'));
});

app.get('/analytics', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'analytics.html'));
});

app.get('/pay/:id', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'pay.html'));
});

app.get('/success/:id', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'success.html'));
});

app.use(express.static(require('path').join(__dirname, '..', 'public')));

module.exports = app;
