// Server xem trước giao diện không cần chơi thật: npm run preview → http://localhost:3200/preview.html#turn
// Trang preview giả lập socket bằng trạng thái mẫu, dùng code public/ thật.
const path = require('path');
const express = require('express');

require('./mkstates');
const root = path.join(__dirname, '..', '..');
const PORT = process.env.PORT || 3200;
const app = express();
app.use(express.static(__dirname));
app.use(express.static(path.join(root, 'public')));
app.use('/vendor/three', express.static(path.join(root, 'node_modules', 'three')));
app.listen(PORT, () => console.log(`Xem trước: http://localhost:${PORT}/preview.html#turn  (turn|draft|wait|end|purple|gallery|lobby|home|fx|warlord|rules-tips...)`));
