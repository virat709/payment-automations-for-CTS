const app = require('./lib/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Payment System running at:`);
  console.log(`  http://localhost:${PORT}`);
});
