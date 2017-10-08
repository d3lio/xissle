New-Item -ItemType Directory -Force -Path src | Out-Null
Copy-Item -Force ../../src/xissle.js src/xissle.js
& node server.js
