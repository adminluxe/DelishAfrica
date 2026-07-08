const express = require('express');
const app = express();
const port = 3000;
app.use(express.static('dist'));
app.listen(port, '0.0.0.0', () => {
  console.log(`🟢 Serveur OTA en ligne sur http://0.0.0.0:${port}`);
});
